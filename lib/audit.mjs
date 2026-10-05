// Read-only audit of an existing repository against the playbook foundation.
// It reads files and Git history. It never writes into the repo, installs anything or contacts anything.
// Used by `repo-fit audit`. Not vendored into repos.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { detect, ruleOverlap } from "./detect.mjs";
import { bigFilePolicy, ownSystems, protectedBy } from "./adapt.mjs";
import { PATH_DEFAULTS, bodyWords } from "../scripts/playbook/lib.mjs";

const SKIP = new Set([".git", "node_modules", ".venv", "venv", "dist", "build", ".next", ".astro", "__pycache__", ".cache", "coverage", "worktrees"]);
const MD_CAP = 4000;
const today = () => new Date().toLocaleDateString("sv-SE");
// Paths are compared with Git output, which always uses forward slashes. Windows gives backslashes.
const rel = (root, p) => relative(root, p).split("\\").join("/");
const git = (root, args) => {
  const r = spawnSync("git", ["-C", root, ...args], { encoding: "utf8", maxBuffer: 128 * 1024 * 1024, timeout: 30000 });
  return r.status === 0 ? r.stdout : "";
};
const first = (root, list) => list.find((p) => existsSync(join(root, p)));

function markdownFiles(root, area) {
  const out = [];
  let capped = false;
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (out.length >= MD_CAP) return void (capped = true);
      if (SKIP.has(e.name)) continue;
      const p = join(dir, e.name);
      // Dot folders (.claude, .github, .codex, ...) hold tool and config files, not notes.
      if (e.isDirectory()) e.name.startsWith(".") || walk(p);
      else if (e.isFile() && /\.mdx?$/i.test(e.name)) out.push(rel(root, p));
    }
  };
  try {
    walk(area ? join(root, area) : root);
  } catch {
    /* unreadable folder: audit what was read */
  }
  return { files: out, capped };
}

// Broken relative links, and how many links point at each Markdown file (to find notes nothing links to).
function links(root, files) {
  const inbound = new Map(files.map((f) => [f, 0]));
  const broken = [];
  let skippedSite = 0;
  for (const f of files) {
    let text = "";
    try {
      if (statSync(join(root, f)).size > 1024 * 1024) continue;
      text = readFileSync(join(root, f), "utf8");
    } catch {
      continue;
    }
    let fenced = false;
    text.split("\n").forEach((line, i) => {
      if (line.trim().startsWith("```")) {
        fenced = !fenced;
        return;
      }
      if (fenced) return;
      for (const m of line.matchAll(/\]\(([^)\s]+)\)/g)) {
        const target = m[1];
        if (/^(https?:|mailto:|#|<|data:)/.test(target) || target.includes("://")) continue;
        let path = target.split("#")[0].split("?")[0];
        try {
          path = decodeURIComponent(path);
        } catch {
          /* keep raw path */
        }
        if (!path) continue;
        // A link starting with "/" is either repo-root relative (docs) or a website URL (content). Count it only when it resolves.
        const site = path.startsWith("/");
        const abs = site ? join(root, path) : resolve(join(root, dirname(f)), path);
        const relTarget = rel(root, abs);
        if (!existsSync(abs)) {
          if (site) skippedSite++;
          else broken.push({ file: f, line: i + 1, target });
        } else if (inbound.has(relTarget)) inbound.set(relTarget, inbound.get(relTarget) + 1);
      }
    });
  }
  return { broken, inbound, skippedSite };
}

// Date each file last changed in Git (first time it appears, newest commit first).
function lastChanged(root) {
  const map = new Map();
  let date = "";
  for (const line of git(root, ["log", "--format=@%cs", "--name-only", "-n", "3000"]).split("\n")) {
    if (line.startsWith("@")) date = line.slice(1);
    else if (line && !map.has(line)) map.set(line, date);
  }
  return map;
}

const SECRET = /(^|\/)\.env(\.|$)|\.(pem|key|p12|pfx)$|(^|\/)id_(rsa|ed25519)$|credentials|secret/i;
const SAFE_SECRET = /\.(md|mdx|example|sample|template|txt|json|py|js|mjs|ts|html|yaml|yml)$|\.env\.(example|sample|template)$/i;

// Where a NEW file for a role goes. The home-folder files (current, board, log, questions, people) sit beside an
// existing sibling that already uses this tool's own file name, so 00-home/current.md gets 00-home/board.md next to it.
// With no such sibling, the default path is used. Nothing is guessed from other file names.
const HOME_ROLES = ["current", "board", "log", "questions", "people"];
export function placeNew(mapping, role) {
  const def = PATH_DEFAULTS[role];
  if (!HOME_ROLES.includes(role)) return def;
  for (const k of HOME_ROLES) {
    const p = mapping[k];
    if (p && p.includes("/") && basename(p) === basename(PATH_DEFAULTS[k])) return `${dirname(p)}/${basename(def)}`;
  }
  return def;
}

// Where existing files could already play a foundation role. Mapped, never moved.
const FIND = {
  current: ["docs/00-home/current.md", "00-home/current.md", "STATUS.md", "PROJECT_STATUS.md", "specs/PROJECT_STATUS.md", "docs/status.md", "docs/STATUS.md", "CURRENT.md", "docs/current.md"],
  log: ["docs/00-home/log.md", "00-home/log.md", "LOG.md", "log.md", "docs/log.md", "progress/SESSION_LOG.md"],
  decisions: ["docs/decisions.md", "decisions.md", "DECISIONS.md", "decisions", "docs/decisions", "docs/adr", "adr", "specs/decisions.md"],
  questions: ["docs/00-home/open-questions.md", "00-home/open-questions.md", "open-questions.md", "OPEN_QUESTIONS.md", "docs/open-questions.md"],
  people: ["docs/00-home/people.md", "00-home/people.md", "people.md", "docs/people.md", "PEOPLE.md"],
  lessons: ["LEARNINGS.md", "docs/LEARNINGS.md", "specs/LEARNINGS.md", "LESSONS.md"],
  board: ["docs/00-home/board.md", "backlog/tasks", "backlog", "TODO.md", "TASKS.md", "JOBS.md"],
  hubs: ["docs/00-home/hubs", "00-home/hubs", "docs/hubs", "hubs"],
  outputs: ["outputs", "output", "deliverables"],
  inputs: ["docs/sources/founder-input", "sources/founder-input", "source-archive/inputs", "sources/inputs"],
  template: ["docs/templates/note.md", "templates/note.md"],
};

// A people or entity register kept as data: people.json, contacts.yaml, entity-register/registry.json and the like.
// A register of everyone ranks before a partial one (team, founders, members).
const REGISTER_EXT = /\.(json|ya?ml|csv)$/i;
function registerRank(rel) {
  const name = basename(rel).replace(/\.[^.]+$/, "").toLowerCase();
  const parent = basename(dirname(rel)).toLowerCase();
  if (/^(people|persons|contacts|entities|entity[-_]?regist(er|ry)|people[-_]?regist(er|ry))$/.test(name) && /\.(md|json|ya?ml|csv)$/i.test(rel)) return 0;
  if (REGISTER_EXT.test(rel) && /(people|person|entit|contact)/.test(parent) && /^(registry|register|index|people|entities|contacts)$/.test(name)) return 0;
  if (/^(team|founders|members)$/.test(name) && /\.(md|json|ya?ml|csv)$/i.test(rel)) return 1;
  return -1;
}

// One shallow walk for files that have no fixed name: a note template and a people register.
const NOT_LIVE = /^(source-archive|archive|archives|_archive|outputs|test|tests|fixtures|__tests__|examples?)$/i;
function shallowFind(root, depth = 4) {
  const templates = [];
  const registers = [];
  let seen = 0;
  const walk = (dir, d) => {
    let entries = [];
    try {
      entries = readdirSync(join(root, dir), { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (++seen > 20000) return;
      const rel = dir ? `${dir}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (d < depth && !e.name.startsWith(".") && !SKIP.has(e.name) && !NOT_LIVE.test(e.name)) walk(rel, d + 1);
      } else if (e.isFile()) {
        if (/(^|\/)templates?\/note\.md$/i.test(rel)) templates.push(rel);
        const rank = registerRank(rel);
        if (rank >= 0) registers.push({ rel, rank });
      }
    }
  };
  walk("", 1);
  const depthOf = (p) => p.split("/").length;
  return {
    templates: templates.sort((a, b) => depthOf(a) - depthOf(b) || a.localeCompare(b)),
    registers: registers.sort((a, b) => a.rank - b.rank || depthOf(a.rel) - depthOf(b.rel) || a.rel.localeCompare(b.rel)).map((x) => x.rel),
  };
}

// The path for each role in this repo. playbook.json `paths` win when the file is there (so a user can map a role
// to any file), then the usual names, then a template or register found by the shallow walk. Null when nothing fits.
export function rolePaths(root, found = shallowFind(root)) {
  const m = {};
  for (const [role, list] of Object.entries(FIND)) m[role] = first(root, list) ?? null;
  m.template ??= found.templates[0] ?? null;
  m.people ??= found.registers[0] ?? null;
  let mapped = {};
  try {
    mapped = JSON.parse(readFileSync(join(root, "playbook.json"), "utf8")).paths ?? {};
  } catch {
    /* no playbook.json, or not valid JSON: use what was found */
  }
  for (const [role, p] of Object.entries(mapped)) if (typeof p === "string" && p && existsSync(join(root, p))) m[role] = p;
  return m;
}

export function audit(target, { area } = {}) {
  const root = resolve(target);
  const d = detect(root);
  const r = d.repo;
  const a = { date: today(), root, name: basename(root), area: area ?? null, detect: d, checks: [], plan: { safe: [], decide: [] }, mapping: {}, details: {}, limits: [] };
  if (!r.exists) return a;

  const md = markdownFiles(root, area);
  const lk = links(root, md.files);
  const changed = r.git ? lastChanged(root) : new Map();
  const tracked = r.git ? new Set(git(root, ["ls-files", "-z"]).split("\0").filter(Boolean)) : new Set();
  const isProtected = ["main", "master"].includes(r.branch);
  const add = (id, label, status, found, suggest, weight = 1) => a.checks.push({ id, label, status, found, suggest, weight });

  // Where existing files could already play a foundation role. Mapped, never moved.
  const found = shallowFind(root);
  a.mapping = rolePaths(root, found);
  a.details.peopleRegisters = found.registers;
  // What the repo already does for itself: checks, hooks, caps, recorders, protected paths, rules by topic.
  const own = ownSystems(root, a.mapping);
  a.own = own;
  const skipped = own.playbook.skipped && typeof own.playbook.skipped === "object" ? own.playbook.skipped : {};
  // Protected paths: the repo's own (wording in its rules, protectedPaths) and delivered outputs, which are records.
  const prot = [...own.protected];
  if (a.mapping.outputs && !protectedBy(prot, `${a.mapping.outputs}/x`)) prot.push({ path: `${a.mapping.outputs.replace(/\/+$/, "")}/`, why: "delivered outputs are a record of what was handed over", where: "repo-fit default" });
  a.details.protected = prot;
  const isProt = (f) => Boolean(protectedBy(prot, f));

  // F1 front door
  const readme = first(root, ["README.md", "readme.md", "README"]);
  const readmeWords = readme ? readFileSync(join(root, readme), "utf8").split(/\s+/).filter(Boolean).length : 0;
  add("F1", "Front door (README)", !readme ? "missing" : readmeWords < 40 ? "part" : "ok", readme ? `${readme}, ${readmeWords} words` : "no README", !readme ? "Add a README with purpose and a start-here link" : readmeWords < 40 ? "Say what this repo is and where to start" : "", 2);

  // F2 rulebook, F3 links, F4 size
  const hasAgents = r.rules.includes("AGENTS.md");
  const hasClaude = r.rules.includes("CLAUDE.md");
  add("F2", "Rulebook for AI tools (AGENTS.md)", hasAgents ? "ok" : hasClaude ? "part" : "missing", hasAgents ? "AGENTS.md present" : hasClaude ? "only CLAUDE.md: Codex will not read it" : "no rule file", hasAgents ? "" : "Add AGENTS.md as the shared rulebook", 2);
  if (hasAgents && hasClaude) add("F3", "Rule files linked", r.claudeVsAgents === "imports AGENTS.md" ? "ok" : r.claudeVsAgents.startsWith("identical") ? "part" : "missing", r.claudeVsAgents, r.claudeVsAgents === "imports AGENTS.md" ? "" : "Make CLAUDE.md import AGENTS.md (review any differences first)", 2);
  else add("F3", "Rule files linked", "na", "needs both AGENTS.md and CLAUDE.md", "", 0);
  const agentsBytes = hasAgents ? statSync(join(root, "AGENTS.md")).size : 0;
  const claudeLines = hasClaude ? readFileSync(join(root, "CLAUDE.md"), "utf8").split("\n").length : 0;
  const sizeNotes = [];
  if (agentsBytes > 32768) sizeNotes.push(`AGENTS.md is ${Math.round(agentsBytes / 1024)} KB, over Codex's 32 KiB default`);
  else if (agentsBytes > 20000) sizeNotes.push(`AGENTS.md is ${Math.round(agentsBytes / 1024)} KB, close to Codex's 32 KiB default`);
  if (claudeLines > 200) sizeNotes.push(`CLAUDE.md is ${claudeLines} lines, over the recommended 200`);
  add("F4", "Rule files are a sensible size", !hasAgents && !hasClaude ? "na" : sizeNotes.length ? "part" : "ok", sizeNotes.join("; ") || `AGENTS.md ${Math.round(agentsBytes / 1024)} KB, CLAUDE.md ${claudeLines} lines`, sizeNotes.length ? "Move detail out of the always-loaded files (guidance C2, X2)" : "", 1);

  // F5 to F11 roles
  const role = (id, label, key, missing, weight = 1) => add(id, label, a.mapping[key] ? "ok" : "missing", a.mapping[key] ?? "not found", a.mapping[key] ? "" : missing, weight);
  // F5 also reads the word cap. The repo's own cap (in its check scripts, its rules or the file) comes first,
  // then currentWordCap in playbook.json, then the default 900. Only the body counts, not the frontmatter.
  const cur = a.mapping.current;
  const curFile = cur && statSync(join(root, cur)).isFile() ? cur : null;
  const curWords = curFile ? bodyWords(readFileSync(join(root, curFile), "utf8")) : null;
  const repoCap = own.wordCap;
  const pjCap = Number.isInteger(own.playbook.currentWordCap) ? own.playbook.currentWordCap : null;
  const capUsed = repoCap?.cap ?? pjCap ?? 900;
  const capFrom = repoCap ? `stated in ${repoCap.where}` : pjCap ? "from playbook.json" : "no cap stated, default";
  const twoCaps = repoCap && pjCap && repoCap.cap !== pjCap;
  a.details.current = curFile ? { words: curWords, cap: repoCap?.cap ?? null, capSource: repoCap?.where ?? null, playbookCap: pjCap } : null;
  if (!cur) role("F5", "Current-state page", "current", "Add a short current view (one block per topic)", 2);
  else add("F5", "Current-state page", curFile && (curWords > capUsed || twoCaps) ? "part" : "ok",
    curFile ? `${cur}, body ${curWords} words; word cap ${capUsed} (${capFrom})${twoCaps ? `; playbook.json says ${pjCap}` : ""}` : cur,
    !curFile ? "" : twoCaps ? `Two caps disagree: set currentWordCap to ${repoCap.cap} in playbook.json` : curWords > capUsed ? (repoCap || pjCap ? "Trim the body to its cap" : "Over the default cap of 900. Pick a cap with apply --word-cap <N>, or trim it") : "", 2);
  role("F6", "Work log", "log", "Add a dated log");
  role("F7", "Decisions record", "decisions", "Add a decisions file with who decided and their words", 2);
  const tracks = r.taskTools.length ? r.taskTools.join(", ") : null;
  // No board, but the current view and the open questions carry the work: an equivalent, not a gap.
  const workElsewhere = !tracks && a.mapping.current && a.mapping.questions;
  add("F8", "Tracked work (tasks, jobs, questions)", tracks ? "ok" : workElsewhere ? "equivalent" : "missing",
    tracks ?? (workElsewhere ? `no board; work and status kept in ${a.mapping.current} and ${a.mapping.questions}${own.topics.status ? ` (${own.topics.status.where})` : ""}` : "no board or task tool"),
    tracks ? "Map the board to it instead of adding a second one" : workElsewhere ? "Leave as is if this is how you track work. A board is optional" : "Add a board", 2);
  role("F9", "Open questions in one place", "questions", "Add an open-questions page");
  const regs = a.details.peopleRegisters.filter((f) => f !== a.mapping.people);
  if (a.mapping.people) add("F10", "People and roles", "ok", `${a.mapping.people}${regs.length ? `; also ${regs.slice(0, 3).join(", ")}` : ""}`, regs.length ? "To use another file, set paths.people in playbook.json" : "");
  else role("F10", "People and roles", "people", "Add a people page with all spellings, or set paths.people in playbook.json to the file you keep");
  role("F11", "Lessons learned", "lessons", "Add a lessons file (every entry needs a why)");

  // F12 outputs indexed
  const outDir = a.mapping.outputs;
  if (outDir && statSync(join(root, outDir)).isDirectory()) {
    const subs = readdirSync(join(root, outDir), { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith("."));
    const noReadme = subs.filter((e) => !existsSync(join(root, outDir, e.name, "README.md"))).map((e) => `${outDir}/${e.name}`);
    a.details.outputsWithoutReadme = noReadme;
    add("F12", "Every output folder has a README", !subs.length ? "na" : noReadme.length === 0 ? "ok" : noReadme.length === subs.length ? "missing" : "part", `${subs.length} folders, ${noReadme.length} without a README`, noReadme.length ? "Add a short README to each" : "", 1);
  } else add("F12", "Every output folder has a README", "na", "no outputs folder", "", 0);

  // F13 links, F14 orphans, F15 stale
  // Broken links inside protected paths are listed, never offered for fixing.
  const broken = lk.broken.filter((b) => !isProt(b.file));
  a.details.brokenLinks = broken;
  a.details.protectedFindings = { brokenLinks: lk.broken.filter((b) => isProt(b.file)) };
  const protNote = a.details.protectedFindings.brokenLinks.length ? `; ${a.details.protectedFindings.brokenLinks.length} more in protected paths (listed only)` : "";
  add("F13", "Links between notes work", md.files.length === 0 ? "na" : broken.length === 0 ? "ok" : broken.length <= 5 ? "part" : "missing", `${broken.length} broken links in ${md.files.length}${md.capped ? "+" : ""} Markdown files${protNote}${lk.skippedSite ? `; ${lk.skippedSite} links starting with "/" not counted (they may be website URLs)` : ""}`, broken.length ? "Fix or remove them (see details)" : "", 1);
  const rootNames = new Set(["README.md", "AGENTS.md", "CLAUDE.md", "GEMINI.md", "CHANGELOG.md", "LICENSE.md", "CONTRIBUTING.md", "SECURITY.md"]);
  const mapped = new Set(Object.values(a.mapping).filter(Boolean));
  // Archives, raw inputs and vendored folders are expected to be unlinked. Content sites link by URL, so this check is informational.
  // Templates too, as in the review queue (scripts/playbook/lib.mjs), so the audit and the daily checks agree.
  const expected = /(^|\/)(source-archive|archive|archives|_archive|\.handoffs|raw|vendor|third_party|outputs|_?templates?|kits?|starters?|scaffolds?|boilerplates?|skeletons?)\//;
  // Rule files of nested projects (a sub-folder's AGENTS.md or CLAUDE.md) are read by tools, not linked from notes.
  const ruleFile = /(^|\/)(AGENTS|CLAUDE|GEMINI)\.md$/;
  const orphans = [...lk.inbound].filter(([f, n]) => n === 0 && !rootNames.has(f) && !mapped.has(f) && !expected.test(f) && !ruleFile.test(f) && !isProt(f) && !/(^|\/)README\.md$/i.test(f)).map(([f]) => f);
  a.details.orphans = orphans;
  add("F14", "Notes that nothing links to (informational)", md.files.length === 0 ? "na" : orphans.length === 0 ? "ok" : "part", `${orphans.length} of ${md.files.length} Markdown files have no inbound link (archives, outputs, protected paths and dot folders left out)`, orphans.length ? "Link from a folder README or archive. May be normal for content folders" : "", 0);
  const cutoff = new Date(Date.now() - 180 * 864e5).toLocaleDateString("sv-SE");
  const staleAll = md.files.filter((f) => changed.get(f) && changed.get(f) < cutoff);
  const stale = staleAll.filter((f) => !isProt(f));
  a.details.stale = stale;
  a.details.protectedFindings.stale = staleAll.filter((f) => isProt(f));
  add("F15", "Documents are not left to rot", !r.git || md.files.length === 0 ? "na" : stale.length === 0 ? "ok" : "part", `${stale.length} Markdown files unchanged for 180+ days`, stale.length ? "Review: still true, archive, or add a review-again date" : "", 1);

  // F16 heavy files, F17 secrets, F18 backup, F19 branch safety
  const big = r.files.big ?? [];
  // Tracked big files are the real issue; ignored ones live on this machine only, which is usually fine.
  const bigTrackedAll = big.filter((b) => b.tracked);
  const untracked = big.filter((b) => !b.tracked);
  const ignoredSet = r.git && untracked.length ? new Set(spawnSync("git", ["-C", root, "check-ignore", "--stdin"], { input: untracked.map((b) => b.path).join("\n"), encoding: "utf8" }).stdout.split("\n").filter(Boolean)) : new Set();
  const loose = untracked.filter((b) => !ignoredSet.has(b.path));
  const ignore = existsSync(join(root, ".gitignore")) ? readFileSync(join(root, ".gitignore"), "utf8") : "";
  const mediaRule = /\*\.(mp4|mov|zip|psd|webm)/.test(ignore);
  const policy = bigFilePolicy(root);
  const bigTracked = bigTrackedAll.filter((b) => !isProt(b.path));
  a.details.bigTracked = bigTracked;
  a.details.protectedFindings.bigTracked = bigTrackedAll.filter((b) => isProt(b.path));
  a.details.bigPolicy = policy;
  a.details.bigLoose = loose;
  const f16 = !big.length ? "ok" : bigTrackedAll.length && !policy ? "missing" : loose.length && !policy ? "part" : r.files.heavyMedia > 0 && !mediaRule && !policy ? "part" : "ok";
  add("F16", "Heavy files have a policy", f16,
    !big.length ? "no files over 5 MB" : `${big.length} files over 5 MB${r.git ? `: ${bigTrackedAll.length} tracked in Git, ${ignoredSet.size} ignored (local only)${loose.length ? `, ${loose.length} untracked and not ignored` : ""}` : ""}${policy ? `; written policy: "${policy.heading}" (${policy.where})` : ""}${mediaRule ? "; .gitignore has media rules" : ""}`,
    f16 === "ok" ? (bigTrackedAll.length ? "Leave as is: the tracked ones follow the written policy" : "") : bigTrackedAll.length ? "Decide: keep, Git LFS, or move out of Git, and write the policy in the README" : "Write where big files live (a README section), or ignore them", 2);
  const secrets = r.git ? [...tracked].filter((f) => SECRET.test(f) && !SAFE_SECRET.test(f)) : [];
  const envOnDisk = existsSync(join(root, ".env")) && r.git && spawnSync("git", ["-C", root, "check-ignore", "-q", ".env"]).status !== 0;
  a.details.secrets = secrets;
  add("F17", "No secrets in Git", secrets.length || envOnDisk ? "missing" : "ok", secrets.length ? `${secrets.length} tracked file(s) with secret-like names (names only): ${secrets.slice(0, 5).join(", ")}` : envOnDisk ? ".env exists and is not ignored" : "no secret-like file names tracked (names only, contents not read)", secrets.length || envOnDisk ? "Untrack, add to .gitignore and rotate the secret" : "", 3);
  add("F18", "Off-machine backup (a remote)", !r.git ? "na" : r.remotes.length ? "ok" : "missing", r.git ? (r.remotes.length ? `${r.host}` : "no remote: commits exist only on this machine") : "not a Git repo", r.git && !r.remotes.length ? "Add a private remote (needs your approval)" : "", 3);
  // Which branch to work on is the repo's own rule: this only notes unsaved work sitting on main, and never counts as a gap.
  add("F19", "Unsaved work on main", !r.git ? "na" : isProtected && r.uncommitted && !own.topics.mainBranch ? "part" : "ok", r.git ? `on ${r.branch}${r.uncommitted ? `, ${r.uncommitted} uncommitted` : ""}${own.topics.mainBranch ? ` (its rules commit on main: ${own.topics.mainBranch.where})` : ""}` : "", isProtected && r.uncommitted && !own.topics.mainBranch ? "Commit it or move it to a branch, the way your rules say" : "", 0);

  // The notes files count as gaps only where the recommended set would add them: all of them in a notes repo, the current
  // view in a mixed one, none in a code repo. The others stay on offer under "let me pick", but a missing one is not a gap.
  const optional = NOTES_ONLY[r.kind.value] ?? [];
  for (const c of a.checks) if (optional.includes(c.id) && c.status === "missing") Object.assign(c, { status: "na", found: `optional in a ${r.kind.value === "technical" ? "code" : r.kind.value} repo`, suggest: "", weight: 0 });

  // The plan. Safe steps only add files. Anything else needs a decision.
  const S = a.plan.safe;
  const D = a.plan.decide;
  if (!r.playbook) S.push({ id: "A-01", risk: "add-only", step: `Add playbook.json with the tools, models and the paths mapping below${curFile ? `, and a word cap of ${capUsed} for the current view (${repoCap ? `copied from ${repoCap.where}` : "the default; change it with --word-cap"})` : ""}${own.recorders ? `, and the recorder list from ${own.recorders.where}` : ""}`, files: ["playbook.json"] });
  // No board but an equivalent (F8 🔁): a board is optional, so it is a decision with "leave as is" first.
  if (!a.mapping.board && workElsewhere) D.push({ id: "A-02", risk: "add-only", step: `Add a board at ${placeNew(a.mapping, "board")} (optional)`, why: `Work is already tracked in ${a.mapping.current} and ${a.mapping.questions}`, options: "leave as is (recommended unless you want one list of tasks), or add a board" });
  else if (!a.mapping.board) S.push({ id: "A-02", risk: "add-only", step: "Add a board", files: [placeNew(a.mapping, "board")] });
  for (const [key, id, label, file] of [["current", "A-03", "a current view", "docs/00-home/current.md"], ["log", "A-04", "a work log", "docs/00-home/log.md"], ["decisions", "A-05", "a decisions record", "docs/decisions.md"], ["questions", "A-06", "an open-questions page", "docs/00-home/open-questions.md"], ["people", "A-07", "a people page", "docs/00-home/people.md"], ["lessons", "A-08", "a lessons file", "LEARNINGS.md"]]) {
    if (!a.mapping[key]) S.push({ id, risk: "add-only", step: `Add ${label}`, files: [placeNew(a.mapping, key) === PATH_DEFAULTS[key] ? file : placeNew(a.mapping, key)] });
  }
  if (a.details.outputsWithoutReadme?.length) S.push({ id: "A-09", risk: "add-only", step: `Add a README to ${a.details.outputsWithoutReadme.length} output folder(s)`, files: a.details.outputsWithoutReadme.slice(0, 8).map((f) => `${f}/README.md`) });
  // A-10 is a plain add, unless the repo already runs its own hooks or checks: then it is a decision.
  const ownParts = [...own.hooks.map((h) => `${h.tool} ${h.event} hook \`${h.command}\``), ...own.checks.files.map((f) => `check script \`${f}\``)];
  a.details.ownHooksAndChecks = ownParts;
  if (!existsSync(join(root, "scripts/playbook/brief.mjs"))) {
    if (ownParts.length) D.push({ id: "A-10", risk: "edit", step: "Add the scripts (brief, check, autosave) and hook files next to the repo's own", why: `Repo already has: ${ownParts.slice(0, 4).join("; ")}${ownParts.length > 4 ? ` and ${ownParts.length - 4} more` : ""}. Two checks must not disagree about the same rule`, options: "skip and keep yours (recommended when yours cover it), scripts without hooks (--hooks none), or add the brief hook next to yours (--hooks brief)" });
    else S.push({ id: "A-10", risk: "add-only", step: "Add the scripts (brief, check, autosave) and hook files for the chosen tools", files: ["scripts/playbook/", ".claude/settings.json or .codex/hooks.json (merged, never replaced)", "CLAUDE.md (thin import, only if missing and AGENTS.md exists)"] });
  }
  if (!hasAgents) S.push({ id: "A-11", risk: "add-only", step: "Add AGENTS.md with the managed core block", files: ["AGENTS.md"] });
  if (!readme) S.push({ id: "A-12", risk: "add-only", step: "Add a README", files: ["README.md"] });

  // D-01: the block goes after the repo's own rules and says those win where they overlap. Nothing to negotiate.
  const hasBlock = hasAgents && /<!-- playbook:core v\S+ begin/.test(readFileSync(join(root, "AGENTS.md"), "utf8"));
  if (hasAgents && !hasBlock) D.push({ id: "D-01", risk: "edit", step: "Add the short shared rules (repo-fit) to AGENTS.md, after your own", why: "Five short rules: write it down, start from the files, search before saying unknown, keep what matters, never invent agreement. Your rules stay first and win where they overlap", options: "approve, or skip" });
  const ov = hasAgents && hasClaude ? ruleOverlap(root) : null;
  a.details.overlap = ov ? { identical: ov.identical, share: Math.round(ov.share * 100), onlyInClaude: ov.onlyInClaude.length } : null;
  if (ov && r.claudeVsAgents !== "imports AGENTS.md") {
    const pct = Math.round(ov.share * 100);
    if (ov.identical) D.push({ id: "D-02", risk: "edit", step: "Replace CLAUDE.md with a thin import of AGENTS.md", why: "CLAUDE.md is an identical copy. Nothing is lost, and the backup keeps the old file", options: "replace, or leave as is" });
    else if (pct >= 80) D.push({ id: "D-02", risk: "edit", step: `Link CLAUDE.md to AGENTS.md (${pct}% of its lines already appear in AGENTS.md)`, why: `A plain import would load the shared lines twice. "--claude-link merge" keeps only the ${ov.onlyInClaude.length} line(s) that exist only in CLAUDE.md, below the import`, options: "merge (recommended), plain import, or leave as is" });
    else D.push({ id: "D-02", risk: "edit", step: `Make CLAUDE.md import AGENTS.md (${pct}% overlap)`, why: `Claude Code reads only CLAUDE.md when it exists. The two files differ, so after the import both sets of rules load. Review for conflicts`, options: "import and keep CLAUDE.md below it, or leave as is" });
  }
  // Only CLAUDE.md holds the rules: Codex never sees them. D-02 moves them into AGENTS.md (with A-11, the core block goes after them).
  const claudeText = hasClaude && !hasAgents ? readFileSync(join(root, "CLAUDE.md"), "utf8") : "";
  if (claudeText.trim() && !/(^|\s)@AGENTS\.md\b/.test(claudeText)) D.push({ id: "D-02", risk: "edit", step: "Move CLAUDE.md's rules into AGENTS.md, word for word, and make CLAUDE.md import it", why: "Codex reads AGENTS.md, not CLAUDE.md, so it does not see these rules. After the move both tools read one rulebook. With A-11, the core block is added after the moved rules", options: "move (recommended when Codex works here too), or leave CLAUDE.md as is" });
  const agentsText = hasAgents ? readFileSync(join(root, "AGENTS.md"), "utf8") : "";
  const hasCmdSection = /^#{1,3}\s+.*\b(dev|develop|development|test|testing|build|commands|lint)\b/im.test(agentsText) || agentsText.includes("playbook:commands");
  // Offered also when AGENTS.md does not exist yet: A-11 or D-02 creates it, and the section goes into the new file.
  if (r.commands.length && !hasCmdSection) D.push({ id: "D-10", risk: "edit", step: `Draft a Dev, Test and Lint section in AGENTS.md from ${r.commands.length} detected script(s): ${r.commands.slice(0, 4).map((c) => c.run).join(", ")}`, why: "Agents follow exact commands better than prose", options: "approve the draft, edit it later, or skip" });
  if (broken.length) D.push({ id: "D-03", risk: "edit", step: `Fix ${broken.length} broken link(s)`, why: "Broken links hide notes", options: "fix the ones you name, or list only" });
  if (orphans.length) D.push({ id: "D-04", risk: "edit", step: `Link or archive ${orphans.length} unlinked note(s)`, why: "Notes nobody can reach are lost", options: "link from a folder README, archive, or leave" });
  if (bigTracked.length && !policy) D.push({ id: "D-05", risk: "move", step: `Decide about ${bigTracked.length} big file(s) tracked in Git`, why: "They make every clone heavy and stay in history", options: "keep, Git LFS, or move out of Git and note where they live" });
  if (secrets.length || envOnDisk) D.push({ id: "D-06", risk: "delete", step: "Untrack secret-like files and rotate them", why: "A secret in Git history stays there", options: "untrack now and rotate; nothing is deleted from disk" });
  if (r.git && !r.remotes.length) D.push({ id: "D-07", risk: "outward", step: "Add a private remote for backup", why: "No commits exist off this machine", options: `run "repo-fit connect <repo>". Hosts ready: ${["github", "gitlab"].filter((h) => (h === "github" ? d.machine.tools.gh.loggedIn?.length : d.machine.tools.glab.loggedIn?.length)).join(" or ") || "no host CLI is logged in"}, or skip` });
  if (mediaRule === false && r.files.heavyMedia > 0) D.push({ id: "D-08", risk: "edit", step: "Add media patterns to .gitignore", why: `${r.files.heavyMedia} video, zip or psd file(s), no rule`, options: "add, or skip" });
  if (stale.length) D.push({ id: "D-09", risk: "edit", step: `Review ${stale.length} old document(s)`, why: "Old text can mislead a fresh session", options: "keep, archive, or add a review-again date" });

  // Steps the user skipped on purpose (`skipped` in playbook.json) leave the plan and are shown with their reason.
  a.plan.skipped = [];
  for (const list of [S, D]) {
    for (const s of [...list]) {
      if (!Object.hasOwn(skipped, s.id)) continue;
      list.splice(list.indexOf(s), 1);
      a.plan.skipped.push({ ...s, reason: String(skipped[s.id] || "no reason given") });
    }
  }

  // The recommended set: the few steps with visible value for this kind of repo, offered as ONE choice with ONE dry run.
  // Everything else stays under "let me pick". Moves, deletes, outward steps and housekeeping are never in it.
  a.plan.recommended = recommend(a, { hasClaude });

  // What the repo already covers. The walk-through shows these as "leave as is".
  const L = (a.leave = []);
  for (const c of a.checks.filter((x) => x.status === "equivalent")) L.push({ what: c.label, why: `covered by an equivalent: ${c.found}` });
  if (own.checks.fromRules.length) L.push({ what: "Its own checks", why: `${own.checks.fromRules.slice(0, 4).map((c) => `\`${c.run}\``).join(", ")} (${own.checks.fromRules[0].where}). The core block points at these` });
  for (const h of own.hooks) L.push({ what: `Its own ${h.tool} ${h.event} hook`, why: `\`${h.command}\` in ${h.file}` });
  if (repoCap) L.push({ what: "Its word cap for the current view", why: `${repoCap.cap} words (${repoCap.where}). ${pjCap === repoCap.cap ? "playbook.json uses the same cap" : pjCap ? `playbook.json says ${pjCap}: set it to ${repoCap.cap}` : "A-01 copies it into playbook.json"}` });
  if (own.recorders) L.push({ what: "Its list of allowed recorders", why: `${own.recorders.names.join(", ")} (${own.recorders.where}). playbook.json copies it` });
  if (own.topics.decisions) L.push({ what: "Its decision lifecycle", why: `${own.topics.decisions.quote} (${own.topics.decisions.where})` });
  if (own.topics.inputs) L.push({ what: "Its way of saving raw input", why: `${own.topics.inputs.quote} (${own.topics.inputs.where})` });
  if (own.topics.commits) L.push({ what: "Its commit rules", why: `${own.topics.commits.quote} (${own.topics.commits.where})` });
  for (const p of prot) L.push({ what: `Protected: \`${p.path}\``, why: `${p.why} (${p.where}). Findings inside are listed only, never offered for fixing, moving or archiving` });
  if (policy && bigTrackedAll.length) L.push({ what: "Big files tracked in Git", why: `${bigTrackedAll.length}, following the written policy "${policy.heading}" (${policy.where})` });
  for (const s of a.plan.skipped) L.push({ what: `${s.id} skipped on purpose`, why: s.reason });

  a.limits = [
    "Read-only: nothing was written into the repo.",
    "Secret check uses file names only. File contents were not read.",
    `Links and orphans cover ${md.files.length}${md.capped ? "+ (cap reached)" : ""} Markdown files; only Markdown links are followed.`,
    r.git ? "Old-document check uses the last 3000 commits." : "No Git history, so no old-document check.",
    area ? `Limited to the area "${area}" for notes, links and old documents. Repo-level checks still cover the whole repo.` : "Whole repo.",
    "Kind, sizes and counts are rules of thumb, not judgements.",
  ];
  return a;
}

// What each recommended step gives, in plain words. A-01 is the settings file the others need, so it is not a gain.
const GAIN = {
  "A-10": "A short briefing at the start of every session: branch, unsaved work, what is open, where to start",
  "A-11": "One rulebook (AGENTS.md) that Claude Code and Codex both read",
  "D-02": "One rulebook: Claude Code and Codex read the same rules (CLAUDE.md imports AGENTS.md)",
  "D-10": "The exact dev, test and lint commands in the rulebook, so the assistant runs the right ones",
  "A-03": "A one-page current view that every session starts from",
  "A-02": "One list of open tasks and questions, shown in the briefing",
  "D-01": "Five short shared rules (write it down, search before saying unknown, never invent agreement), after the repo's own rules, which win",
};
const BY_KIND = {
  technical: ["A-01", "A-10", "A-11", "D-02", "D-10"],
  mixed: ["A-01", "A-10", "A-11", "D-02", "D-10"],
  notes: ["A-01", "A-10", "A-11", "D-02", "D-10", "A-03", "A-02", "D-01"],
};
function recommend(a, { hasClaude }) {
  const r = a.detect.repo;
  const kind = BY_KIND[r.kind.value] ? r.kind.value : "mixed";
  const inPlan = new Map([...a.plan.safe, ...a.plan.decide].map((s) => [s.id, s]));
  const steps = BY_KIND[kind].filter((id) => {
    if (!inPlan.has(id)) return false;
    // A code repo gets the managed rules block only when it has no rulebook at all: then the block is its rulebook.
    if (id === "A-11" && kind === "technical") return !hasClaude;
    // A board is in the set only as a plain add. When work is already tracked elsewhere (A-02 is a decision), it is not.
    if (id === "A-02") return a.plan.safe.some((s) => s.id === "A-02");
    // Linking two rule files that differ a lot needs a review of the diff, so it is its own question.
    if (id === "D-02") return !a.details.overlap || a.details.overlap.identical || a.details.overlap.share >= 80;
    return true;
  });
  const T = a.detect.machine.tools;
  const tool = T.claude?.installed && !T.codex?.installed ? "claude" : T.codex?.installed && !T.claude?.installed ? "codex" : "both";
  // Autosave and the full hooks only where the repo has no rules of its own about committing or hooks.
  const own = a.own;
  // Settings the repo already chose in playbook.json stay as they are.
  const quiet = own.playbook.autosave === false || kind !== "notes" || own.topics.commits || own.topics.mainBranch || own.hooks.length;
  // A CLAUDE.md that mostly repeats AGENTS.md is merged, so the shared lines do not load twice.
  const merge = steps.includes("D-02") && a.details.overlap && !a.details.overlap.identical && a.details.overlap.share >= 80;
  // Hook files change how every session starts, so Claude Code's auto mode blocks the assistant from writing them.
  // The recommended set adds the scripts only (--hooks none); the user turns the briefing on with one line (`hooks`).
  const flags = `--tool ${tool} --hooks none ${quiet ? "--autosave off" : "--autosave on"}${merge ? " --claude-link merge" : ""}`;
  const hooksMode = quiet ? "brief" : "all";
  const gains = steps.filter((id) => GAIN[id]).map((id) => GAIN[id]);
  const hooksCommand = steps.includes("A-10") ? `repo-fit hooks ${a.root} --hooks ${hooksMode} --apply` : null;
  return { kind, steps, flags, gains, command: steps.length ? `repo-fit apply ${a.root} --steps ${steps.join(",")} ${flags}` : null, hooksMode, hooksCommand };
}

// Notes-file checks that are optional for each kind of repo (see BY_KIND for what is recommended).
const NOTES_ONLY = { technical: ["F5", "F6", "F7", "F8", "F9", "F10", "F11"], mixed: ["F5", "F6", "F7", "F8", "F9", "F10", "F11"] };
const ICON = { ok: "✅", equivalent: "🔁", part: "⚠️", missing: "❌", na: "➖" };
const RISK = { "add-only": "🟢 add only", edit: "🟡 edit", move: "🟠 move", delete: "🔴 delete", outward: "🔵 outward" };

export function markdown(a) {
  const d = a.detect;
  const r = d.repo;
  if (!r.exists) return `# Audit: ${a.root}\n\n❌ Not a folder.\n`;
  const out = [];
  const applicable = a.checks.filter((c) => c.status !== "na");
  const n = (s) => applicable.filter((c) => c.status === s).length;
  const gaps = applicable.filter((c) => c.status !== "ok" && c.status !== "equivalent" && c.weight > 0).sort((x, y) => y.weight - x.weight).slice(0, 3);
  out.push(`# Audit: ${a.name} (${a.date})`, "", "> Read-only. Nothing was changed. Facts come from the files and Git history on the date above.", "");
  const rec = a.plan.recommended;
  out.push("## Recommended set", "");
  if (rec?.steps.length) {
    out.push(`For a ${rec.kind === "technical" ? "code" : rec.kind} repo. One dry run, one yes, one undo. The repo's own rules stay as they are.`, "", ...rec.gains.map((g) => `- ${g}`), "", "```sh", `${rec.command}          # dry run`, "```", "");
    if (rec.hooksCommand) out.push("Then the person, not the assistant, turns on the start-of-session briefing (Claude Code's auto mode does not let an assistant change how sessions start):", "", "```sh", rec.hooksCommand, "```", "");
  } else out.push("Nothing to recommend: the repo already has the pieces that matter.", "");
  out.push("## Verdict", "", `**${n("ok") + n("equivalent")} of ${applicable.length}** foundation checks are in place${n("equivalent") ? ` (${n("equivalent")} through an equivalent the repo already has, 🔁)` : ""}, **${n("part")}** partly, **${n("missing")}** missing.${gaps.length ? ` Biggest gaps: ${gaps.map((g) => `${g.label}: ${g.found}`).join("; ")}.` : " No gaps found."}${NOTES_ONLY[r.kind.value] ? ` Notes files the recommended set would not add are optional in a ${r.kind.value === "technical" ? "code" : r.kind.value} repo and not counted.` : ""}`, "");
  out.push("## What is here", "");
  out.push(`- **Kind:** ${r.kind.value}, because ${r.kind.why}`);
  out.push(`- **Git:** ${r.git ? `branch ${r.branch}, ${r.commits} commits, ${r.uncommitted} uncommitted` : "not a Git repository"}${r.git ? ` · remote: ${r.remotes.length ? r.host : "none"}` : ""}`);
  out.push(`- **Files:** ${r.files.files}${r.files.truncated ? "+" : ""} (${r.files.docs} documents, ${r.files.code} code, ${r.files.media} media)`);
  out.push(`- **Rule files:** ${r.rules.join(", ") || "none"}${r.claudeVsAgents ? ` · CLAUDE.md vs AGENTS.md: ${r.claudeVsAgents}` : ""}`);
  out.push(`- **Task tools:** ${r.taskTools.join(", ") || "none"} · **CI:** ${r.ci.join(", ") || "none"}${r.otherTools.length ? ` · **Other:** ${r.otherTools.join(", ")}` : ""}`, "");
  out.push("## Foundation checks", "", "| # | Check | Status | What I found | Suggested |", "|---|---|---|---|---|");
  for (const c of a.checks) out.push(`| ${c.id} | ${c.label} | ${ICON[c.status]} | ${c.found.replace(/\|/g, "/")} | ${c.suggest} |`);
  out.push("", "## Leave as is (the repo already covers it)", "");
  if (a.leave.length) out.push("repo-fit adapts to these instead of adding its own.", "", ...a.leave.map((l) => `- **${l.what}:** ${l.why}`));
  else out.push("Nothing found that the repo already covers in its own way.");
  out.push("", "## Existing files that could fill the gaps", "", "Mapped, not moved. Step 3 will read these from `paths` in `playbook.json`.", "", "```json", JSON.stringify({ paths: a.mapping }, null, 2), "```", "");
  out.push("## Plan: worth improving", "", "### Safe to do now (add only)", "");
  if (a.plan.safe.length) {
    out.push("| ID | Risk | Step | Files |", "|---|---|---|---|");
    for (const s of a.plan.safe) out.push(`| ${s.id} | ${RISK[s.risk]} | ${s.step} | ${s.files.map((f) => `\`${f}\``).join(", ")} |`);
  } else out.push("Nothing to add.");
  out.push("", "### Needs your decision", "");
  if (a.plan.decide.length) {
    out.push("| ID | Risk | Step | Why | Options |", "|---|---|---|---|---|");
    for (const s of a.plan.decide) out.push(`| ${s.id} | ${RISK[s.risk]} | ${s.step} | ${s.why} | ${s.options} |`);
  } else out.push("Nothing needs a decision.");
  out.push("", "Every step: dry run, your approval, a backup, a line in a receipt, an undo. Moves, deletes and outward steps never run without your approval for that exact step.", "");
  const list = (title, items, fmt, max = 8) => items.length && out.push(`### ${title} (${items.length})`, "", ...items.slice(0, max).map((x) => `- ${fmt(x)}`), ...(items.length > max ? [`- and ${items.length - max} more`] : []), "");
  out.push("## Details", "");
  list("Broken links", a.details.brokenLinks, (b) => `\`${b.file}:${b.line}\` → ${b.target}`);
  list("Notes nothing links to", a.details.orphans, (f) => `\`${f}\``, 10);
  list("Documents unchanged for 180+ days", a.details.stale, (f) => `\`${f}\``, 6);
  list("Big files tracked in Git", a.details.bigTracked, (b) => `\`${b.path}\` (${b.mb} MB)`);
  list("Big files neither tracked nor ignored", a.details.bigLoose ?? [], (b) => `\`${b.path}\` (${b.mb} MB)`);
  const pf = a.details.protectedFindings ?? {};
  list("In protected paths, listed only (not offered for fixing, moving or archiving)", [...(pf.brokenLinks ?? []).map((b) => `broken link \`${b.file}:${b.line}\` → ${b.target}`), ...(pf.bigTracked ?? []).map((b) => `big file \`${b.path}\` (${b.mb} MB)`), ...(pf.stale ?? []).map((f) => `old document \`${f}\``)], (x) => x);
  list("Secret-like tracked file names", a.details.secrets, (f) => `\`${f}\``);
  out.push("## Limits", "", ...a.limits.map((l) => `- ${l}`), "");
  return out.join("\n");
}
