// Capture check and Level 2 autosave. Never pushes. Never commits on a protected branch.
//   node scripts/playbook/autosave.mjs --report [--host Codex]                  report only, commits nothing
//   node scripts/playbook/autosave.mjs --event stop --host "Claude Code"        Stop hook (Claude Code or Codex)
//   node scripts/playbook/autosave.mjs --event precompact --host "Claude Code"  PreCompact hook
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { root, today, git, run, config, changedFiles, matchesAny, slug, paths } from "./lib.mjs";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const event = arg("event", "report");
const host = arg("host", "unknown");
const report = event === "report";

let input = {};
if (!report) {
  try {
    input = JSON.parse(readFileSync(0, "utf8") || "{}");
  } catch {
    /* no or invalid input: check anyway */
  }
}
// Codex sends stop_hook_active when the turn already continued. Claude Code's docs do not list it,
// so the guard below (one block per session and reason) does the real work.
if (input.stop_hook_active) process.exit(0);

const emit = (obj) => console.log(JSON.stringify(obj));
const cfg = config();
const before = changedFiles();
if (before === null) {
  if (report) console.log("Not a Git repository: nothing to save.");
  process.exit(0);
}

const isSecret = (p) => /(^|\/)\.env(\.|$)|\.(pem|key|p12)$|secret|credential/i.test(p);
const tooBig = (p) => {
  try {
    return statSync(join(root, p)).size > cfg.autosaveMaxFileMB * 1024 * 1024;
  } catch {
    return false; // deleted file
  }
};
const allow = before.filter((p) => matchesAny(p, cfg.autosaveAllow) && !isSecret(p) && !tooBig(p));

// Level 2: commit allow-listed files. On a protected branch, switch to a wip/ branch first.
function autosave(files) {
  const branch = (git(["branch", "--show-current"]) ?? "").trim();
  if (!branch) return { error: "detached HEAD, not committing" };
  let target = branch;
  if (cfg.protectedBranches.includes(branch)) {
    target = `wip/${today()}-${slug(host)}`;
    const exists = git(["rev-parse", "--verify", "--quiet", `refs/heads/${target}`]) !== null;
    const sw = run(exists ? ["switch", target] : ["switch", "-c", target]);
    if (!sw.ok) return { error: `could not switch to ${target}: ${sw.err}` };
  }
  const add = run(["add", "--", ...files]);
  if (!add.ok) return { error: `git add failed: ${add.err}` };
  const shown = files.slice(0, 12).map((f) => `- ${f}`).join("\n") + (files.length > 12 ? `\n- and ${files.length - 12} more` : "");
  const message = `wip(${slug(host)}): autosave ${files.length} file${files.length === 1 ? "" : "s"}`;
  // --only commits just these paths, so anything else the user has staged is left alone.
  const commit = run(["commit", "--only", "-m", message, "-m", shown, "-m", `Host: ${host}`, "--", ...files]);
  if (!commit.ok) return { error: `commit failed: ${commit.err || commit.out.trim()}` };
  const sha = (git(["rev-parse", "--short", "HEAD"]) ?? "").trim();
  return { branch: target, sha, count: files.length };
}

let saved = null;
if (!report && cfg.autosave && allow.length) saved = autosave(allow);

// What is left for the assistant to finish.
const after = changedFiles() ?? [];
const left = new Map();
const show = (files) => files.slice(0, 6).join(", ") + (files.length > 6 ? `, and ${files.length - 6} more` : "");
if (after.length) left.set("outside", `uncommitted changes ${cfg.autosave && !report ? "outside the autosave list" : ""} (${show(after)})`.replace("  ", " "));
if (saved?.error) left.set("failed", `autosave failed: ${saved.error}`);
const logRel = paths().log;
const log = join(root, logRel);
const committedToday = (git(["log", "--since=midnight", "--format=%h"]) ?? "").split("\n").filter(Boolean);
const workedToday = before.length > 0 || committedToday.length > 0;
if (workedToday && existsSync(log) && !readFileSync(log, "utf8").includes(`- ${today()}`)) {
  left.set("nolog", `no line for ${today()} in ${logRel}`);
}

if (report) {
  if (allow.length) console.log(`Would autosave (${cfg.autosave ? "on" : "off"}): ${show(allow)}`);
  if (!left.size) console.log("Capture complete: nothing left over, and today's work (if any) is in the log.");
  else console.log(`Capture pass not finished: ${[...left.values()].join("; ")}.`);
  process.exit(left.size ? 1 : 0);
}

const savedNote = saved && !saved.error ? `Autosaved ${saved.count} file${saved.count === 1 ? "" : "s"} to ${saved.branch} (${saved.sha}).` : "";

if (event === "precompact" || !left.size) {
  if (savedNote) emit({ systemMessage: savedNote });
  process.exit(0);
}

// Stop hook: block, but only once per session for the same set of reasons.
const gitDir = (git(["rev-parse", "--absolute-git-dir"]) ?? "").trim();
const stateFile = gitDir ? join(gitDir, "playbook-state.json") : null;
let state = {};
try {
  if (stateFile) state = JSON.parse(readFileSync(stateFile, "utf8"));
} catch {
  /* first run */
}
const session = String(input.session_id ?? "no-session");
const key = createHash("sha256").update([...left.keys()].sort().join("|")).digest("hex").slice(0, 12);
if (state.blocked?.[session] === key) {
  if (savedNote) emit({ systemMessage: savedNote });
  process.exit(0);
}
const blocked = { ...(state.blocked ?? {}), [session]: key };
for (const k of Object.keys(blocked).slice(0, -30)) delete blocked[k]; // keep the last 30 sessions
try {
  if (stateFile) writeFileSync(stateFile, JSON.stringify({ ...state, blocked }));
} catch {
  /* best effort */
}
emit({
  decision: "block",
  reason:
    `${savedNote ? `${savedNote} ` : ""}Capture pass not finished: ${[...left.values()].join("; ")}. ` +
    'Follow "Capture by default" in AGENTS.md: update the board, current.md, log.md and open questions, ' +
    "run node scripts/playbook/check.mjs, then commit. If something should stay uncommitted, tell the user what and why.",
});
