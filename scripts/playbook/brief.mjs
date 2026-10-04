// Session brief. Read-only: it never writes, commits or contacts anything.
//   node scripts/playbook/brief.mjs --text                  for a person, or Codex without hooks
//   node scripts/playbook/brief.mjs --hook                  Claude Code SessionStart hook (JSON)
//   node scripts/playbook/brief.mjs --hook --format codex   Codex SessionStart hook (JSON)
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { root, git, config, readBoard, analyseBoard, paths, coverage, preview } from "./lib.mjs";

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

// Which branch to work on is the repo's own rule. The brief only says where autosave puts its commits.
if (cfg.autosave && cfg.protectedBranches.includes(branch)) out.push(`🌿 On ${branch}: autosave saves to a wip/ branch, not here.`);
if (branch.startsWith("wip/")) {
  const base = cfg.protectedBranches.find((b) => git(["rev-parse", "--verify", "--quiet", `refs/heads/${b}`]) !== null);
  const ahead = base ? Number((git(["rev-list", "--count", `${base}..HEAD`]) ?? "0").trim()) : 0;
  if (ahead) out.push(`🌿 ${ahead} autosave commit${ahead === 1 ? "" : "s"} not merged into ${base} yet. Merge or squash when ready.`);
}

const unfinished = ["README.md", "AGENTS.md", P.current].filter((f) => existsSync(join(root, f)) && /\bTODO\b/.test(readFileSync(join(root, f), "utf8")));
if (unfinished.length) out.push(`🚧 Setup not finished: ${unfinished.join(", ")} still ${unfinished.length === 1 ? "has" : "have"} TODO placeholders.`);

// 🔄 the board
const board = readBoard();
// A repo can adopt only some parts (`required` in playbook.json). Without a board, Git says where the last session stopped.
const noBoard = board.missing && Array.isArray(cfg.required) && !cfg.required.includes(P.board);
if (noBoard) {
  const recent = (git(["log", "-3", "--format=%cs %s"]) ?? "").split("\n").filter(Boolean);
  if (recent.length) out.push(`🕘 Recent: ${recent.map((l) => short(l, 70)).join(" · ")}`);
} else if (board.missing && preview) {
  out.push("➡️ The board starts empty. Say what you want to work on and it goes on the board.");
} else if (board.missing) {
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

// 🧹 review queue: notes nothing links to, notes untouched for a long time, notes past their review_after date
// Up to 3 notes are named. More than that is a count only, so the brief stays short every session; check lists them all.
const cov = coverage(cfg);
const total = cov.orphans.length + cov.stale.length + cov.due.length;
const named = (rows, f) => (total <= 3 ? ` (${list(rows, f)})` : "");
const queue = [];
if (cov.orphans.length) queue.push(`${cov.orphans.length} nobody links to${named(cov.orphans, (p) => short(p, 45))}`);
if (cov.stale.length) queue.push(`${cov.stale.length} untouched ${cov.staleNoteDays}+ days${named(cov.stale, (s) => `${short(s.path, 45)} ${s.date}`)}`);
if (cov.due.length) queue.push(`${cov.due.length} due for review${named(cov.due, (s) => `${short(s.path, 45)} ${s.date}`)}`);
if (queue.length) out.push(`🧹 Review queue: ${queue.join(" · ")}.${total > 3 ? " `node scripts/playbook/check.mjs` lists them." : ""} Link, merge or archive them when you touch that topic.`);

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
  // Both tools read hookSpecificOutput.additionalContext. Codex shows systemMessage as a warning, so it gets none.
  const context = { hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: forModel } };
  const payload = format === "codex" ? context : { systemMessage: text, ...context };
  console.log(JSON.stringify(payload));
}
