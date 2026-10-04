#!/usr/bin/env node
// Checks a live /repo-fit run against the setup contract, from a Claude Code session transcript (.jsonl).
//   node dev/transcript-check.mjs <session.jsonl>
// Claude Code keeps transcripts in ~/.claude/projects/<folder>/<session-id>.jsonl. Read-only. Not shipped to npm.
// Fails (exit 1) when the run asked more than 3 questions, asked about something repo-fit does not change,
// or wrote (apply, update, skip, init) without an answer from the user after the last dry run.
import { readFileSync } from "node:fs";

const MAX_QUESTIONS = 3;
const OFF_TOPIC = /\b(CI|workflows?|GitHub Actions|deploy\w*|archive|big files?|large files?|models?|which (?:AI )?tools)\b/i;
const REPO_FIT = /repo-fit(?:\.mjs)?\s+(apply|update|skip|init|undo|connect|tools)\b/;

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
  const writes = [];
  const askIds = new Set();
  let answered = true; // nothing to answer before the first dry run
  for (const e of events.slice(start + 1)) {
    const content = e.message?.content;
    if (e.type === "user") {
      const blocks = typeof content === "string" ? [{ type: "text", text: content }] : content ?? [];
      // A typed message, or the answer to a question, counts as the user's word.
      if (blocks.some((b) => (b.type === "text" && b.text.trim() && !b.text.startsWith("<")) || (b.type === "tool_result" && askIds.has(b.tool_use_id)))) answered = true;
      continue;
    }
    if (e.type !== "assistant" || !Array.isArray(content)) continue;
    for (const b of content) {
      if (b.type !== "tool_use") continue;
      if (b.name === "AskUserQuestion") {
        askIds.add(b.id);
        for (const q of b.input?.questions ?? []) questions.push(q.question ?? "");
      }
      const cmd = b.name === "Bash" ? b.input?.command ?? "" : "";
      const m = cmd.match(REPO_FIT);
      if (!m) continue;
      const writes_ = m[1] === "init" ? !/--dry-run/.test(cmd) : /--apply\b/.test(cmd);
      if (!writes_) {
        if (["apply", "update", "skip", "init"].includes(m[1])) answered = false; // a dry run the user must answer
      } else {
        writes.push({ command: cmd.slice(0, 160), approved: answered });
        answered = false;
      }
    }
  }
  const offTopic = questions.filter((q) => OFF_TOPIC.test(q));
  const unapproved = writes.filter((w) => !w.approved);
  const problems = [
    ...(questions.length > MAX_QUESTIONS ? [`${questions.length} questions, more than ${MAX_QUESTIONS}`] : []),
    ...offTopic.map((q) => `off-topic question: ${q.slice(0, 120)}`),
    ...unapproved.map((w) => `wrote without an answer after the dry run: ${w.command}`),
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
