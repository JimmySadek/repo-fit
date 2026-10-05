// Shared helpers for the playbook scripts. No dependencies.
// Managed by repo-fit: change it there and run `repo-fit update`, not here.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// scripts/playbook/lib.mjs -> repo root, whichever tool or folder started the session.
// `repo-fit preview` runs the brief from the playbook folder against a repo that does not have the scripts yet:
// REPO_FIT_PREVIEW_ROOT names that repo, REPO_FIT_PREVIEW_CONFIG the settings the recommended set would write.
export const preview = Boolean(process.env.REPO_FIT_PREVIEW_ROOT);
export const root = preview ? resolve(process.env.REPO_FIT_PREVIEW_ROOT) : resolve(fileURLToPath(new URL("../../", import.meta.url)));
export const today = () => new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD, local time
export const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
export const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Runs git in the repo. `run` keeps stderr for error messages; `git` returns stdout or null.
export function run(args) {
  const r = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  return { ok: r.status === 0, out: r.stdout ?? "", err: (r.stderr ?? "").trim() };
}
export const git = (args) => {
  const r = run(args);
  return r.ok ? r.out : null;
};

// Where each foundation role lives. A repo can point a role at a file it already has (`paths` in playbook.json).
export const PATH_DEFAULTS = {
  current: "docs/00-home/current.md",
  board: "docs/00-home/board.md",
  log: "docs/00-home/log.md",
  questions: "docs/00-home/open-questions.md",
  people: "docs/00-home/people.md",
  decisions: "docs/decisions.md",
  lessons: "LEARNINGS.md",
  inputs: "docs/sources/founder-input",
  outputs: "outputs",
};

const DEFAULTS = {
  paths: {},
  required: null, // null means the full Starter kit. A list means only these files.
  playbook: "0.0.0",
  profile: "knowledge",
  tools: ["claude-code", "codex"],
  models: [],
  autosave: true,
  autosaveAllow: ["docs/**", "outputs/**/README.md", "LEARNINGS.md"],
  autosaveMaxFileMB: 5,
  protectedBranches: ["main", "master"],
  currentWordCap: 900,
  staleDays: 30,
  staleIsError: true,
  staleNoteDays: 180, // a note untouched this long, with no review_after date ahead, goes on the review queue
  reviewIgnore: [], // extra globs to keep out of the review queue
  protectedPaths: [], // folders ("source-archive/") or globs the repo never edits: kept out of the review queue too
  recorders: ["Codex", "Claude Code", "Claude Cowork", "Claude app"],
};

export function config() {
  const path = join(root, "playbook.json");
  let own = {};
  try {
    own = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : preview ? JSON.parse(process.env.REPO_FIT_PREVIEW_CONFIG || "{}") : {};
  } catch {
    /* not valid JSON: defaults */
  }
  return { ...DEFAULTS, ...own };
}

// Words in a Markdown file's body. YAML frontmatter at the top is metadata, so it does not count toward a word cap.
export const bodyWords = (text) => text.replace(/^\uFEFF?---\r?\n(?:[\s\S]*?\r?\n)?---[ \t]*(?:\r?\n|$)/, "").split(/\s+/).filter(Boolean).length;

export const paths = () => ({ ...PATH_DEFAULTS, ...Object.fromEntries(Object.entries(config().paths ?? {}).filter(([, v]) => v)) });

// Minimal glob: `**` crosses folders, `*` stays inside one folder.
export function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        i++;
        if (glob[i + 1] === "/") {
          i++;
          re += "(?:.*/)?";
        } else re += ".*";
      } else re += "[^/]*";
    } else if ("\\^$+?.()|{}[]".includes(c)) re += `\\${c}`;
    else re += c;
  }
  return new RegExp(`^${re}$`);
}
export const matchesAny = (path, globs) => globs.some((g) => globToRegExp(g).test(path));

// Changed or untracked files (relative paths), or null when this is not a Git repository.
export function changedFiles() {
  const out = git(["status", "--porcelain", "-z", "--untracked-files=all"]);
  if (out === null) return null;
  const parts = out.split("\0").filter(Boolean);
  const files = [];
  for (let i = 0; i < parts.length; i++) {
    files.push(parts[i].slice(3));
    if (parts[i][0] === "R" || parts[i][0] === "C") i++; // rename or copy: next field is the old path
  }
  return files;
}

// Date (YYYY-MM-DD) a path last changed. Uncommitted changes count as today.
export function lastChanged(rel) {
  const path = rel.split("#")[0].trim();
  const abs = join(root, path);
  if (!existsSync(abs)) return null;
  const dirty = git(["status", "--porcelain", "--", path]);
  if (dirty && dirty.trim()) return today();
  const committed = git(["log", "-1", "--format=%cs", "--", path]);
  if (committed && committed.trim()) return committed.trim();
  return new Date(statSync(abs).mtimeMs).toLocaleDateString("sv-SE");
}

export const STATUSES = ["inbox", "clarified", "active", "parked", "blocked", "done"];
export const KINDS = ["task", "job", "question", "idea"];

// Reads the board table (paths().board). Column names are the lower-cased header cells.
// `external: true` means the repo tracks work somewhere else (another tool, a folder, a different table shape).
export function readBoard() {
  const path = join(root, paths().board);
  if (!existsSync(path)) return { rows: [], missing: true, path: paths().board };
  if (statSync(path).isDirectory()) return { rows: [], missing: false, external: true, path: paths().board };
  let cols = null;
  const rows = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
    if (!cols) {
      if (cells[0].toLowerCase() === "id") cols = cells.map((c) => c.toLowerCase());
      continue;
    }
    if (cells.every((c) => /^:?-+:?$/.test(c))) continue;
    const row = {};
    cols.forEach((c, i) => (row[c] = cells[i] ?? ""));
    if (row.id) rows.push(row);
  }
  if (!cols) return { rows: [], missing: false, external: true, path: paths().board };
  return { rows, missing: false, path: paths().board };
}

// Errors (must fix), warnings (should look), stale rows (evidence changed after the verified date).
export function analyseBoard(rows, cfg) {
  const errors = [];
  const warnings = [];
  const stale = [];
  const seen = new Set();
  const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  for (const r of rows) {
    if (seen.has(r.id)) errors.push(`${r.id}: duplicate ID`);
    seen.add(r.id);
    if (!STATUSES.includes(r.status)) errors.push(`${r.id}: unknown status "${r.status}"`);
    if (!KINDS.includes(r.kind)) errors.push(`${r.id}: unknown kind "${r.kind}"`);
    if (r.status === "done") continue;
    if (!r.item) errors.push(`${r.id}: no item text`);
    if (!r.owner) errors.push(`${r.id}: no owner`);
    if (!r["next step"]) errors.push(`${r.id}: no next step`);
    if (r.status === "parked" && !r.trigger) warnings.push(`${r.id}: parked with no wake-up trigger`);
    if (r.status === "active" || r.status === "blocked") {
      const evidence = (r.evidence ?? "").split(";").map((s) => s.trim()).filter(Boolean);
      if (!evidence.length) errors.push(`${r.id}: ${r.status} row needs evidence links`);
      if (!isDate(r.verified ?? "")) errors.push(`${r.id}: ${r.status} row needs a verified date (YYYY-MM-DD)`);
      else {
        for (const e of evidence) {
          const changed = lastChanged(e);
          if (changed === null) errors.push(`${r.id}: evidence not found: ${e}`);
          else if (changed > r.verified) stale.push({ id: r.id, why: `${e} changed ${changed}, verified ${r.verified}` });
        }
      }
    }
    if (r.status === "active" && isDate(r.updated ?? "") && daysBetween(r.updated, today()) > cfg.staleDays) {
      stale.push({ id: r.id, why: `no update for ${daysBetween(r.updated, today())} days` });
    }
  }
  return { errors, warnings, stale };
}

// The review queue: notes nothing links to, notes untouched for a long time, and notes whose `review_after` date has passed.
// Same rules as `repo-fit audit` (F14 and F15). Archives, raw inputs, outputs, templates, folder READMEs and the
// root files are expected to be unlinked, so they are never reported. Read-only.
const EXPECTED_UNLINKED = /(^|\/)(source-archive|archive|archives|_archive|\.handoffs|raw|vendor|third_party|outputs|_?templates?|kits?|starters?|scaffolds?|boilerplates?|skeletons?)\//;
const ROOT_NAMES = new Set(["README.md", "AGENTS.md", "CLAUDE.md", "GEMINI.md", "CHANGELOG.md", "LICENSE.md", "CONTRIBUTING.md", "SECURITY.md", "MAP.md"]);
const MD_CAP = 4000;

export function markdownFiles() {
  const out = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (out.length >= MD_CAP) return;
      if (e.name.startsWith(".") || e.name === "node_modules") continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".md")) out.push(relative(root, p).split("\\").join("/"));
    }
  };
  walk(root);
  return out.sort();
}

export function coverage(cfg = config()) {
  const files = markdownFiles();
  const set = new Set(files);
  const byName = new Map(); // "note" -> every file called note.md, for [[wiki links]]
  for (const f of files) {
    const n = basename(f, ".md").toLowerCase();
    byName.set(n, [...(byName.get(n) ?? []), f]);
  }
  const inbound = new Map(files.map((f) => [f, 0]));
  const reviewAfter = new Map();
  // Links inside repo-fit's generated lists (MAP.md, index pages) reach every note, so they do not count: a note
  // only the map links to is still one nothing else links to. Generated index pages are never orphans themselves.
  const generated = new Set();
  let inList = false;
  const hit = (f) => !inList && inbound.set(f, inbound.get(f) + 1);
  for (const f of files) {
    let text;
    try {
      if (statSync(join(root, f)).size > 1024 * 1024) continue;
      text = readFileSync(join(root, f), "utf8");
    } catch {
      continue;
    }
    const date = text.replace(/\r\n?/g, "\n").match(/^---\n([\s\S]*?)\n---/)?.[1].match(/^review_after:\s*"?(\d{4}-\d{2}-\d{2})/m)?.[1];
    if (date) reviewAfter.set(f, date);
    let fenced = false;
    inList = false;
    for (const line of text.split(/\r?\n/)) {
      if (/<!-- repo-fit:(map|index) begin/.test(line)) {
        inList = true;
        if (line.includes("repo-fit:index")) generated.add(f);
      } else if (/<!-- repo-fit:(map|index) end/.test(line)) inList = false;
      if (line.trim().startsWith("```")) {
        fenced = !fenced;
        continue;
      }
      if (fenced) continue;
      for (const m of line.matchAll(/\]\(([^)\s]+)\)/g)) {
        const target = m[1];
        if (/^(https?:|mailto:|#|<|data:)/.test(target) || target.includes("://")) continue;
        let path = target.split("#")[0].split("?")[0];
        try {
          path = decodeURIComponent(path);
        } catch {
          /* keep the raw path */
        }
        if (!path) continue;
        const abs = path.startsWith("/") ? join(root, path) : resolve(join(root, dirname(f)), path);
        const rel = relative(root, abs).split("\\").join("/");
        if (set.has(rel)) hit(rel);
      }
      for (const m of line.matchAll(/\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g)) {
        const name = m[1].trim().replace(/\.md$/, "");
        if (name.includes("/") && set.has(`${name}.md`)) hit(`${name}.md`);
        else for (const t of byName.get(basename(name).toLowerCase()) ?? []) hit(t);
      }
    }
  }
  const roles = new Set(Object.values(paths()));
  const skip = (f) => ROOT_NAMES.has(f) || /(^|\/)(AGENTS|CLAUDE|GEMINI)\.md$/.test(f) || EXPECTED_UNLINKED.test(f) || /(^|\/)README\.md$/i.test(f) || matchesAny(f, cfg.reviewIgnore ?? []) || matchesAny(f, (cfg.protectedPaths ?? []).map((p) => (p.endsWith("/") ? `${p}**` : p)));
  const orphans = files.filter((f) => inbound.get(f) === 0 && !skip(f) && !roles.has(f) && !generated.has(f));

  // Last commit date per file, one git call. An uncommitted edit counts as today.
  const changed = new Map();
  let when = "";
  for (const line of (git(["log", "--format=@%cs", "--name-only", "-n", "3000"]) ?? "").split("\n")) {
    if (line.startsWith("@")) when = line.slice(1);
    else if (line && !changed.has(line)) changed.set(line, when);
  }
  const dirty = new Set(changedFiles() ?? []);
  // A note repo-fit moved (and whose only change since is its links) keeps the date of where it came from: a move is
  // not a change to the note. The receipts of moves not undone say where each file came from.
  const movedFrom = new Map();
  const receipts = join(root, ".playbook/receipts");
  for (const r of existsSync(receipts) ? readdirSync(receipts).filter((n) => n.endsWith(".json") && !existsSync(join(receipts, `${n}.undone`))).sort() : []) {
    let rc;
    try {
      rc = JSON.parse(readFileSync(join(receipts, r), "utf8"));
    } catch {
      continue;
    }
    const sums = new Set((rc.entries ?? []).filter((e) => e.type === "edit").map((e) => `${e.path}\0${e.after}`));
    for (const e of (rc.entries ?? []).filter((x) => x.type === "move")) {
      let now;
      try {
        now = readFileSync(join(root, e.to));
      } catch {
        continue;
      }
      const same = createHash("sha256").update(now).digest("hex") === e.hash || sums.has(`${e.to}\0${createHash("sha256").update(now.toString("utf8")).digest("hex")}`);
      if (same) movedFrom.set(e.to, movedFrom.get(e.from) ?? e.from);
    }
  }
  for (const [to, from] of movedFrom) {
    if (changed.has(from) && !changed.has(to)) {
      changed.set(to, changed.get(from));
      dirty.delete(to);
    }
  }
  const t = today();
  const cutoff = new Date(Date.now() - cfg.staleNoteDays * 864e5).toLocaleDateString("sv-SE");
  const stale = [];
  const due = [];
  for (const f of files) {
    if (skip(f)) continue;
    const review = reviewAfter.get(f);
    if (review) {
      if (review < t) due.push({ path: f, date: review }); // a planned review date replaces the age rule
      continue;
    }
    if (dirty.has(f)) continue;
    const last = changed.get(f);
    if (last && last < cutoff) stale.push({ path: f, date: last });
  }
  stale.sort((a, b) => a.date.localeCompare(b.date) || a.path.localeCompare(b.path));
  due.sort((a, b) => a.date.localeCompare(b.date) || a.path.localeCompare(b.path));
  return { scanned: files.length, capped: files.length >= MD_CAP, orphans, stale, due, staleNoteDays: cfg.staleNoteDays };
}

// Is version a newer than version b? Both like "1.2.3"; anything unreadable is not newer.
const parts = (v) => (String(v ?? "").match(/^(\d+)\.(\d+)\.(\d+)/) ?? []).slice(1).map(Number);
export function newer(a, b) {
  const x = parts(a);
  const y = parts(b);
  if (x.length < 3 || y.length < 3) return false;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
}

// Tells the briefing when a newer repo-fit matters. At most once a day it asks npm for the latest release: one request
// that carries only the package name, never a file, with a 2-second limit. The answer is cached in ~/.config/repo-fit/.
// A line appears only when a release newer than this repo's is marked important. Any failure, offline included, is silent.
// Off with REPO_FIT_UPDATE_CHECK=off, or "updateCheck": "off" in ~/.config/repo-fit/preferences.json.
export async function updateNotice(have) {
  const dir = process.env.REPO_FIT_CONFIG ?? join(process.env.HOME ?? process.env.USERPROFILE ?? "", ".config/repo-fit");
  let prefs = {};
  try {
    prefs = JSON.parse(readFileSync(join(dir, "preferences.json"), "utf8"));
  } catch {
    /* no preferences: the check is on */
  }
  if (process.env.REPO_FIT_UPDATE_CHECK === "off" || prefs.updateCheck === "off" || !parts(have).length || have === "0.0.0") return null;
  const cache = join(dir, "update-check.json");
  let latest = null;
  try {
    const c = JSON.parse(readFileSync(cache, "utf8"));
    if (c.checked === today()) latest = c.latest;
  } catch {
    /* no cache yet */
  }
  if (!latest) {
    try {
      // REPO_FIT_UPDATE_JSON stands in for npm's answer in the tests, which never use the network.
      const j = process.env.REPO_FIT_UPDATE_JSON ? JSON.parse(process.env.REPO_FIT_UPDATE_JSON) : await (await fetch("https://registry.npmjs.org/repo-fit/latest", { signal: AbortSignal.timeout(2000) })).json();
      latest = { version: j.version, releases: (j.repoFit?.releases ?? []).map(({ version, important, why }) => ({ version, important, why })) };
      mkdirSync(dir, { recursive: true });
      writeFileSync(cache, `${JSON.stringify({ checked: today(), latest })}\n`);
    } catch {
      return null;
    }
  }
  if (!newer(latest.version, have)) return null;
  const important = latest.releases.filter((r) => r.important && newer(r.version, have) && !newer(r.version, latest.version));
  if (!important.length) return null;
  const top = important.sort((a, b) => (newer(a.version, b.version) ? -1 : 1))[0];
  return `🆕 repo-fit ${latest.version} is out (this repo has ${have}): ${top.why} To get it, update repo-fit (\`npx skills update -g -y\`, or /plugin in Claude Code), then ask your assistant to run /repo-fit here.`;
}
