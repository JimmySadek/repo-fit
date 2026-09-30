// Shared helpers for the playbook scripts. No dependencies.
// Managed by repo-fit: change it there and run `repo-fit update`, not here.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// scripts/playbook/lib.mjs -> repo root, whichever tool or folder started the session.
export const root = resolve(fileURLToPath(new URL("../../", import.meta.url)));
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
  recorders: ["Codex", "Claude Code", "Claude Cowork", "Claude app"],
};

export function config() {
  const path = join(root, "playbook.json");
  if (!existsSync(path)) return DEFAULTS;
  try {
    return { ...DEFAULTS, ...JSON.parse(readFileSync(path, "utf8")) };
  } catch {
    return DEFAULTS;
  }
}

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
