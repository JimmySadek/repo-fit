// Session brief. It never commits or pushes. The one change it makes: at session start (--hook, or --file), new
// items in inbox/ that match a standing rule the person approved (inbox/rules.json) are filed, with a receipt and
// undo (file.mjs). Everything else is read-only. Once a day it may ask npm for the
// latest repo-fit version (package name only) and cache the answer in ~/.config/repo-fit/; see updateNotice in lib.mjs.
//   node scripts/playbook/brief.mjs --text                  for a person, or Codex without hooks
//   node scripts/playbook/brief.mjs --hook                  Claude Code SessionStart hook (JSON)
//   node scripts/playbook/brief.mjs --hook --format codex   Codex SessionStart hook (JSON)
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { root, git, config, readBoard, analyseBoard, paths, coverage, preview, updateNotice } from "./lib.mjs";
import { capture } from "./file.mjs";
import { fitFacts, fitLines, rebuildMap } from "./fit.mjs";
import { scan } from "./map.mjs";

const args = process.argv.slice(2);
const hook = args.includes("--hook");
const format = args.includes("--format") ? args[args.indexOf("--format") + 1] : "claude";
const cfg = config();
const P = paths();
const out = [];
const short = (s, n = 90) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const list = (rows, f) => rows.slice(0, 3).map(f).join(" · ") + (rows.length > 3 ? ` · +${rows.length - 3} more` : "");

// 📥 the inbox first, so the lines below see the folder after filing. Filing happens only when a session starts.
const inbox = capture(root, { apply: (hook || args.includes("--file")) && !preview, protect: cfg.protectedPaths ?? [] });

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

out.push(...inbox.lines);
// The map is repo-fit's own page: at session start it follows the folder by itself (notes added, renamed, removed).
if ((hook || args.includes("--file")) && !preview && rebuildMap(cfg).length) out.push("✅ Map updated: notes were added, renamed or removed.");
// What is off, one short line each. Quiet when all is well.
out.push(...fitLines(fitFacts(cfg)));
// ✅ open work, collected where it already is (MAP.md lists it).
{
  const open = scan(root, { protect: cfg.protectedPaths ?? [] }).open;
  const notes = new Set(open.map((o) => o.path)).size;
  if (open.length) out.push(`✅ Open work: ${open.length} ${open.length === 1 ? "item" : "items"} in ${notes} ${notes === 1 ? "note" : "notes"} (see MAP.md)`);
}

// A newer repo-fit that matters for this repo (see updateNotice: once a day, package name only, silent on failure).
const notice = preview ? null : await updateNotice(cfg.playbook);
if (notice) out.push(notice);

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
  const forModel = `${text}\n\nSession brief, read from files. Show the top of it to the user in 3 to 5 lines before starting, and refresh Git facts before relying on it.${inbox.waiting?.length ? " For the 📥 items waiting, follow the inbox lines in AGENTS.md: ask once per kind with exactly Yes, Yes and always, Not now; never delete, merge or commit them." : ""}${/🆕 Two weeks/.test(text) ? " For a review, run node scripts/playbook/check.mjs --review and propose; nothing changes without a yes." : ""}`;
  // Both tools read hookSpecificOutput.additionalContext. Codex shows systemMessage as a warning, so it gets none.
  const context = { hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: forModel } };
  const payload = format === "codex" ? context : { systemMessage: text, ...context };
  console.log(JSON.stringify(payload));
}
