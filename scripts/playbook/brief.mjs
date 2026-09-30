// Session brief. Read-only: it never writes, commits or contacts anything.
//   node scripts/playbook/brief.mjs --text                  for a person, or Codex without hooks
//   node scripts/playbook/brief.mjs --hook                  Claude Code SessionStart hook (JSON)
//   node scripts/playbook/brief.mjs --hook --format codex   Codex SessionStart hook (JSON, format untested)
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { root, git, config, readBoard, analyseBoard, paths } from "./lib.mjs";

const args = process.argv.slice(2);
const hook = args.includes("--hook");
const format = args.includes("--format") ? args[args.indexOf("--format") + 1] : "claude";
const cfg = config();
const P = paths();
const out = [];
const short = (s, n = 90) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const list = (rows, f) => rows.slice(0, 3).map(f).join(" · ") + (rows.length > 3 ? ` · +${rows.length - 3} more` : "");

// 📍 where we are
const branch = (git(["branch", "--show-current"]) ?? "").trim();
const dirty = (git(["status", "--porcelain"]) ?? "").split("\n").filter(Boolean).length;
const last = git(["log", "-1", "--format=%cs%n%B"]);
const lastDate = last ? last.split("\n")[0] : "";
const host = last?.match(/^Host:\s*(.+)$/m)?.[1];
out.push(
  `📍 ${basename(root)} · ${branch || "no branch"} · ${dirty ? `${dirty} uncommitted` : "clean"}` +
    (lastDate ? ` · last commit ${lastDate}${host ? ` by ${host}` : ""}` : " · no commits yet"),
);

if (cfg.protectedBranches.includes(branch)) {
  out.push(`⚠️ On ${branch}: the playbook rule is never to commit here. ${cfg.autosave ? "Autosave will use a wip/ branch." : "Work on a branch."}`);
}
if (branch.startsWith("wip/")) {
  const base = cfg.protectedBranches.find((b) => git(["rev-parse", "--verify", "--quiet", `refs/heads/${b}`]) !== null);
  const ahead = base ? Number((git(["rev-list", "--count", `${base}..HEAD`]) ?? "0").trim()) : 0;
  if (ahead) out.push(`🌿 ${ahead} autosave commit${ahead === 1 ? "" : "s"} not merged into ${base} yet. Merge or squash when ready.`);
}

const unfinished = ["README.md", "AGENTS.md", P.current].filter((f) => existsSync(join(root, f)) && /\bTODO\b/.test(readFileSync(join(root, f), "utf8")));
if (unfinished.length) out.push(`🚧 Setup not finished: ${unfinished.join(", ")} still ${unfinished.length === 1 ? "has" : "have"} TODO placeholders.`);

// 🔄 the board
const board = readBoard();
if (board.missing) {
  out.push(`❌ The board (${P.board}) is missing. Run repo-fit init, or create it.`);
} else if (board.external) {
  out.push(`🔄 Work is tracked in ${P.board} (not a playbook table). Read it for what is open.`);
} else {
  const by = (s) => board.rows.filter((r) => r.status === s);
  const { errors, stale } = analyseBoard(board.rows, cfg);
  const fmt = (r) => `${r.id} ${short(r.item, 50)}${r["next step"] ? ` → ${short(r["next step"], 60)}` : ""}`;
  if (by("active").length) out.push(`🔄 Active (${by("active").length}): ${list(by("active"), fmt)}`);
  if (by("blocked").length) out.push(`❌ Blocked (${by("blocked").length}): ${list(by("blocked"), (r) => `${r.id} ${short(r.item, 50)}${r.trigger ? ` (waiting: ${short(r.trigger, 40)})` : ""}`)}`);
  if (by("inbox").length) out.push(`📥 Inbox (${by("inbox").length}): ${list(by("inbox"), (r) => `${r.id} ${short(r.item, 50)}`)}`);
  if (stale.length) out.push(`🕓 Stale (${stale.length}): ${list(stale, (s) => `${s.id} (${short(s.why, 70)})`)}`);
  if (errors.length) out.push(`⚠️ Board problems (${errors.length}): ${short(errors[0], 100)}`);
  const next = by("active")[0] ?? by("clarified")[0] ?? by("inbox")[0];
  out.push(next ? `➡️ Suggested start: ${next.id} ${short(next["next step"] || next.item, 100)}` : "➡️ The board is empty. Say what you want to work on and it goes on the board.");
}

// ❓ open questions (bullets above the "Answered or overtaken" heading)
const oq = join(root, P.questions);
if (existsSync(oq)) {
  let n = 0;
  for (const line of readFileSync(oq, "utf8").split("\n")) {
    if (/^#+\s.*(answered|overtaken)/i.test(line)) break;
    if (/^\s*[-*]\s+\S/.test(line)) n++;
  }
  if (n) out.push(`❓ Open questions: ${n} (${P.questions})`);
}

// 📝 log and current view
const logPath = join(root, P.log);
if (existsSync(logPath) && lastDate && !readFileSync(logPath, "utf8").includes(`- ${lastDate}`)) {
  out.push(`⚠️ The last commit (${lastDate}) has no line in ${P.log}.`);
}
const cur = join(root, P.current);
if (existsSync(cur)) {
  const words = readFileSync(cur, "utf8").split(/\s+/).filter(Boolean).length;
  if (words > cfg.currentWordCap) out.push(`⚠️ ${P.current} is ${words} words (cap ${cfg.currentWordCap}). Trim it.`);
}

const text = out.join("\n");
if (!hook) {
  console.log(text);
} else {
  const forModel = `${text}\n\nSession brief, read from files. Show the top of it to the user in 3 to 5 lines before starting, and refresh Git facts before relying on it.`;
  const payload =
    format === "codex"
      ? { systemMessage: text, additionalContext: forModel }
      : { systemMessage: text, hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: forModel } };
  console.log(JSON.stringify(payload));
}
