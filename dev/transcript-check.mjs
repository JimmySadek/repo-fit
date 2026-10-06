#!/usr/bin/env node
// Checks a live /repo-fit run against the setup contract, from a Claude Code session transcript (.jsonl).
//   node dev/transcript-check.mjs <session.jsonl>
// Claude Code keeps transcripts in ~/.claude/projects/<folder>/<session-id>.jsonl. Read-only. Not shipped to npm.
// Fails (exit 1) when the run asked more than 3 questions, asked about something repo-fit does not change, asked
// before showing the before and after of an organize plan it had made, or wrote (apply, update, skip, init, organize,
// hooks) without an answer given after that exact dry run. One yes approves every dry run shown before it.
import { readFileSync } from "node:fs";

const MAX_QUESTIONS = 3;
// Organizing (archive, old notes, unlinked notes) is on topic since the redesign; these are still not repo-fit's to ask.
const OFF_TOPIC = /\b(CI|workflows?|GitHub Actions|deploy\w*|big files?|large files?|models?|which (?:AI )?tools|link (?:the|this|these|an?) \w+ note|\.gitignore)\b/i;
const REPO_FIT = /repo-fit(?:\.mjs)?["']?\s+(apply|update|skip|init|undo|connect|tools|hooks|organize|file|status|remove)\b/;
// The before/after screen: the organize plan's two columns, or the same in the assistant's own words.
const SCREEN = /(your folder today|before)[\s\S]*\bafter\b/i;
// A dry run and its write are the same command without the flags that only switch writing or the view on.
const same = (cmd) => cmd.replace(/\s\d?>&?\s*\S+/g, "").replace(/\s--plan\s+\S+/g, "").replace(/\s--(apply|dry-run|list|json|show)\b/g, "").replace(/["']/g, "").replace(/\s+/g, " ").trim();

export function checkTranscript(text) {
  const events = text.split("\n").filter(Boolean).flatMap((line) => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });
  // From the last time the skill was invoked.
  let start = 0;
  events.forEach((e, i) => {
    if (/command-name>\/repo-fit|Re-invocation of \/repo-fit/.test(JSON.stringify(e.message?.content ?? ""))) start = i;
  });
  const questions = [];
  const asked = [];
  const writes = [];
  const askIds = new Set();
  const early = [];
  const planIds = new Map(); // tool_use id of an organize, status or remove run → waiting for its output
  let answered = false; // invoking the skill is not a yes: every hand edit needs an answer first
  const shown = new Set(); // dry runs shown since the last answer
  const approved = new Set(); // dry runs an answer approved (it came after them)
  let planMade = false; // an organize plan was made...
  let screenShown = false; // ...and its before and after shown in the reply
  for (const e of events.slice(start + 1)) {
    const content = e.message?.content;
    if (e.type === "user") {
      const blocks = typeof content === "string" ? [{ type: "text", text: content }] : content ?? [];
      // A typed message, or the answer to a question, counts as the user's word.
      // A plan run shows a plan only when its output has one ("already organized" has nothing to show).
      for (const b of blocks) if (b.type === "tool_result" && planIds.has(b.tool_use_id)) {
        const t = typeof b.content === "string" ? b.content : JSON.stringify(b.content ?? "");
        if (SCREEN.test(t) || /Before → after/.test(t)) planMade = true;
        planIds.delete(b.tool_use_id);
      }
      if (blocks.some((b) => (b.type === "text" && b.text.trim() && !b.text.startsWith("<")) || (b.type === "tool_result" && askIds.has(b.tool_use_id)))) {
        answered = true;
        for (const s of shown) approved.add(s);
        shown.clear();
      }
      continue;
    }
    if (e.type !== "assistant" || !Array.isArray(content)) continue;
    for (const b of content) {
      if (b.type === "text" && planMade && SCREEN.test(b.text ?? "")) screenShown = true;
      if (b.type !== "tool_use") continue;
      // A file the assistant edits or writes by itself is a write too.
      if (["Edit", "Write", "MultiEdit", "NotebookEdit"].includes(b.name)) {
        writes.push({ command: `${b.name} ${b.input?.file_path ?? ""}`, approved: answered });
        continue;
      }
      if (b.name === "AskUserQuestion") {
        askIds.add(b.id);
        if (planMade && !screenShown) early.push((b.input?.questions ?? []).map((q) => q.question).join(" / "));
        for (const q of b.input?.questions ?? []) questions.push(q.question ?? "");
        // The options say what is really being asked ("Link the June note"), so they count for the topic too.
        for (const q of b.input?.questions ?? []) asked.push([q.question, ...(q.options ?? []).map((o) => `${o.label} ${o.description ?? ""}`)].join(" "));
      }
      // One Bash call can chain several commands ("a; b && c | tail"): each repo-fit command counts on its own.
      const vars = {};
      for (const raw of (b.name === "Bash" ? b.input?.command ?? "" : "").split(/\s*(?:;|&&|\|\|?|\n)\s*/)) {
      const set = raw.match(/^(?:export\s+)?([A-Za-z_]\w*)=(?:"([^"]*)"|'([^']*)'|(\S*))$/);
      if (set) vars[set[1]] = set[2] ?? set[3] ?? set[4];
      const cmd = raw.replace(/\$\{?([A-Za-z_]\w*)\}?/g, (all, v) => (v in vars ? vars[v] : all));
      const m = cmd.match(REPO_FIT);
      if (!m) continue;
      if (m[1] === "status") {
        // The checkup can carry the organize plan: its screen must be shown before any question, and it counts as
        // the organize dry run for the same folder.
        planIds.set(b.id, true);
        const k = same(cmd.slice(cmd.search(REPO_FIT)).replace(/\bstatus\b/, "organize"));
        shown.add(k);
        approved.delete(k);
        continue;
      }
      const writes_ = m[1] === "init" ? !/--dry-run/.test(cmd) : /--apply\b/.test(cmd);
      const key = same(cmd.slice(cmd.search(REPO_FIT)));
      if (!writes_) {
        if (["apply", "update", "skip", "init", "organize", "hooks", "file", "remove"].includes(m[1])) {
          shown.add(key); // a dry run the user must answer
          approved.delete(key);
          if (m[1] === "organize" || m[1] === "remove") planIds.set(b.id, true); // if it shows a plan, it must be in the reply before a question
        }
      } else {
        writes.push({ command: cmd.slice(0, 160), approved: approved.has(key) });
        approved.delete(key);
      }
      }
    }
  }
  const offTopic = asked.filter((q) => OFF_TOPIC.test(q));
  const unapproved = writes.filter((w) => !w.approved);
  const problems = [
    ...(questions.length > MAX_QUESTIONS ? [`${questions.length} questions, more than ${MAX_QUESTIONS}`] : []),
    ...offTopic.map((q) => `off-topic question: ${q.slice(0, 120)}`),
    ...unapproved.map((w) => `wrote without an answer after the dry run: ${w.command}`),
    ...early.map((q) => `asked before showing the before and after of the plan: ${q.slice(0, 120)}`),
  ];
  return { questions, writes, problems, ok: problems.length === 0 };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: node dev/transcript-check.mjs <session.jsonl>");
    process.exit(2);
  }
  const r = checkTranscript(readFileSync(file, "utf8"));
  console.log(`Questions: ${r.questions.length}`);
  for (const q of r.questions) console.log(`  - ${q.slice(0, 140)}`);
  console.log(`Writes: ${r.writes.length} (${r.writes.filter((w) => w.approved).length} after an answer)`);
  console.log(r.ok ? "✅ Meets the setup contract." : `❌ ${r.problems.length} problem(s):\n${r.problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exitCode = r.ok ? 0 : 1;
}
