// The setup contract, on four kinds of repo: the recommended set is safe to approve in one yes, it applies cleanly,
// and the repo is healthy afterwards. Plus the checker for live runs (dev/transcript-check.mjs).
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkTranscript } from "../dev/transcript-check.mjs";
import { cli, repo, sandboxed, script } from "./helpers.mjs";

const pkg = JSON.stringify({ name: "app", scripts: { test: "node --test", lint: "eslint ." } });
const KINDS = {
  code: { "package.json": pkg, "src/a.js": "1\n", "src/b.js": "2\n", "src/c.js": "3\n", "src/d.js": "4\n" },
  notes: { "notes/one.md": "# One\n", "notes/two.md": "# Two\n", "people.md": "# People\n" },
  mixed: { "package.json": pkg, "src/a.js": "1\n", "docs/one.md": "# One\n", "docs/two.md": "# Two\n", "docs/three.md": "# Three\n" },
  mature: {
    "AGENTS.md": "# Rules\n\nCommit only when asked.\nBefore you commit, run `python3 scripts/check_notes.py`.\n",
    "CLAUDE.md": "@AGENTS.md\n",
    "00-home/current.md": "# Current\n",
    "00-home/open-questions.md": "# Questions\n",
    "decisions/accepted/one.md": "# One\n",
    "scripts/check_notes.py": "# check\n",
  },
};

for (const [kind, files] of Object.entries(KINDS)) {
  test(`contract (${kind}): one yes is enough, and the repo is healthy after it`, sandboxed((sb) => {
    const d = repo(sb, kind, { commit: true, files });
    const a = JSON.parse(cli(sb, ["audit", d, "--json"]).stdout);
    const rec = a.plan.recommended;
    assert.ok(rec.steps.length, "something is recommended");
    const risky = [...a.plan.safe, ...a.plan.decide].filter((s) => rec.steps.includes(s.id) && ["move", "delete", "outward"].includes(s.risk));
    assert.deepEqual(risky, [], "no move, delete or outward step in the one-click set");
    const args = ["apply", d, "--steps", rec.steps.join(","), ...rec.flags.split(" ")];
    const dry = cli(sb, args);
    assert.equal(dry.status, 0, dry.out);
    assert.match(dry.out, /Dry run/);
    const done = cli(sb, [...args, "--apply"]);
    assert.equal(done.status, 0, done.out);
    const check = script(sb, d, "check.mjs");
    assert.equal(check.status, 0, check.out);
    const brief = script(sb, d, "brief.mjs", ["--text"]);
    assert.equal(brief.status, 0, brief.out);
    assert.doesNotMatch(brief.stdout, /❌/, brief.stdout);
    assert.equal(JSON.parse(cli(sb, ["audit", d, "--json"]).stdout).plan.recommended.steps.length, 0, "nothing is recommended twice");
  }));
}

// Transcripts in Claude Code's format, reduced to what the checker reads.
const line = (o) => JSON.stringify(o);
const user = (text) => line({ type: "user", message: { content: text } });
const ask = (id, ...qs) => line({ type: "assistant", message: { content: [{ type: "tool_use", id, name: "AskUserQuestion", input: { questions: qs.map((q) => ({ question: q })) } }] } });
const answer = (id) => line({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: id, content: "answered" }] } });
const bash = (command) => line({ type: "assistant", message: { content: [{ type: "tool_use", id: "b", name: "Bash", input: { command } }] } });
const start = user("<command-message>repo-fit</command-message> <command-name>/repo-fit</command-name>");
const DRY = "node bin/repo-fit.mjs apply /r --steps A-01,A-10 --tool both --hooks brief --autosave off";

test("transcript check: dry run, one question, then apply meets the contract", () => {
  const r = checkTranscript([start, bash(DRY), ask("q1", "Set up these files?"), answer("q1"), bash(`${DRY} --apply`)].join("\n"));
  assert.ok(r.ok, r.problems.join("; "));
  assert.equal(r.questions.length, 1);
});

test("transcript check: a write with no answer after the dry run fails", () => {
  const r = checkTranscript([start, bash(DRY), bash(`${DRY} --apply`)].join("\n"));
  assert.ok(!r.ok);
  assert.match(r.problems.join(), /wrote without an answer/);
});

test("transcript check: a new dry run after the answer needs a new answer", () => {
  const r = checkTranscript([start, bash(DRY), ask("q1", "Set up?"), answer("q1"), bash(DRY.replace("A-01,A-10", "A-01")), bash(`${DRY.replace("A-01,A-10", "A-01")} --apply`)].join("\n"));
  assert.match(r.problems.join(), /wrote without an answer/);
});

test("transcript check: more than 3 questions, or an off-topic one, fails", () => {
  const many = checkTranscript([start, ask("q1", "A?", "B?", "C?", "D?")].join("\n"));
  assert.match(many.problems.join(), /4 questions/);
  const ci = checkTranscript([start, ask("q1", "A GitHub Actions workflow still runs every Monday. Should it keep running?")].join("\n"));
  assert.match(ci.problems.join(), /off-topic/);
});

test("transcript check: only the last /repo-fit run counts", () => {
  const r = checkTranscript([start, ask("q0", "A?", "B?", "C?", "D?"), user("(Re-invocation of /repo-fit — new arguments)"), ask("q1", "Set up?")].join("\n"));
  assert.equal(r.questions.length, 1);
});

const say = (text) => line({ type: "assistant", message: { content: [{ type: "text", text }] } });
const ORG = 'node "/x/bin/repo-fit.mjs" organize /r';
const SCREEN = "```\nYour folder today          After one yes (undo any time)\n32 things loose at the top  notes/: your 12 notes\n```\n**Why this is better for you**";

test("transcript check: the before/after screen, one yes, then setup and organize both run", () => {
  const r = checkTranscript([start, bash(DRY), bash(ORG), say(SCREEN), ask("q1", "Organize it all?"), answer("q1"), bash(`${DRY} --apply`), bash(`${ORG} --apply`)].join("\n"));
  assert.ok(r.ok, r.problems.join("; "));
  assert.equal(r.writes.length, 2);
});

test("transcript check: asking before the before/after screen was shown fails", () => {
  const r = checkTranscript([start, bash(DRY), bash(ORG), say("I looked at your folder."), ask("q1", "Organize it all?"), answer("q1"), bash(`${ORG} --apply`)].join("\n"));
  assert.match(r.problems.join(), /before showing the before and after/);
});

test("transcript check: organize --apply needs a yes given after its plan was shown", () => {
  const r = checkTranscript([start, bash(DRY), say(SCREEN), ask("q1", "Set up?"), answer("q1"), bash(ORG), bash(`${ORG} --apply`)].join("\n"));
  assert.match(r.problems.join(), /wrote without an answer.*organize/);
});

test("transcript check: archive and old notes are part of organizing now, not off-topic", () => {
  const r = checkTranscript([start, bash(ORG), say(SCREEN), ask("q1", "Organize it all? Old folders go to the archive; old notes stay findable.")].join("\n"));
  assert.ok(r.ok, r.problems.join("; "));
});

test("transcript check: commands chained in one line are read one by one", () => {
  const S = 'SKILL_DIR=/x; R=/r; node "$SKILL_DIR/bin/repo-fit.mjs"';
  const r = checkTranscript([start, bash(`${S} apply "$R" --steps A-01 --hooks none; echo ---; ${S} organize "$R"`), say(SCREEN), ask("q1", "Organize it all?"), answer("q1"), bash(`${S} organize "$R" --apply --plan abc123 2>&1 | tail -5; echo ---; ${S} apply "$R" --steps A-01 --hooks none --apply`)].join("\n"));
  assert.ok(r.ok, r.problems.join("; "));
  assert.equal(r.writes.length, 2);
});

test("transcript check: a folder written as a shell variable in the dry run and as a path in the write is the same", () => {
  const dry = 'S=/x; R=/tmp/f; node "$S/bin/repo-fit.mjs" organize "$R"';
  const r = checkTranscript([start, bash(dry), say(SCREEN), ask("q1", "Organize it all?"), answer("q1"), bash("node /x/bin/repo-fit.mjs organize /tmp/f --apply --plan abc")].join("\n"));
  assert.ok(r.ok, r.problems.join("; "));
});

test("transcript check: on a re-run, the checkup's plan must be shown before the question too", () => {
  const STATUS = 'node /x/bin/repo-fit.mjs status /r';
  assert.match(checkTranscript([start, bash(STATUS), say("Mostly tidy."), ask("q1", "Organize it?")].join("\n")).problems.join(), /before showing the before and after/);
  assert.ok(checkTranscript([start, bash(STATUS), say(SCREEN), ask("q1", "Organize it?")].join("\n")).ok);
});

test("transcript check: a quoted path, a hand edit and a housekeeping option are all caught", () => {
  const quoted = 'node "/x/bin/repo-fit.mjs" apply /r --steps A-01 --hooks none';
  const r = checkTranscript([start, bash(quoted), bash(`${quoted} --apply`)].join("\n"));
  assert.match(r.problems.join(), /wrote without an answer/);
  const edit = line({ type: "assistant", message: { content: [{ type: "tool_use", id: "e", name: "Edit", input: { file_path: "/r/CLAUDE.md" } }] } });
  assert.match(checkTranscript([start, edit].join("\n")).problems.join(), /Edit \/r\/CLAUDE\.md/);
  const opt = line({ type: "assistant", message: { content: [{ type: "tool_use", id: "q", name: "AskUserQuestion", input: { questions: [{ question: "Which small edits?", options: [{ label: "Link the June note" }] }] } }] } });
  assert.match(checkTranscript([start, opt].join("\n")).problems.join(), /off-topic/);
});
