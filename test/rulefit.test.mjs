// A small repo whose only rulebook is CLAUDE.md, which commits finished steps on main and keeps its task list as a checklist.
// repo-fit must see both rules as conflicts with the core block, offer to move CLAUDE.md's rules into AGENTS.md,
// and keep template folders out of the unlinked-notes list. Generic names only.
import assert from "node:assert/strict";
import { test } from "node:test";
import { cli, has, json, read, repo, sandboxed, script } from "./helpers.mjs";

const flags = ["--tool", "both", "--hooks", "brief", "--autosave", "off"];
const apply = (sb, d, steps, extra = []) => cli(sb, ["apply", d, "--steps", steps, ...flags, ...extra]);
const audit = (sb, d) => JSON.parse(cli(sb, ["audit", d, "--json"]).stdout);
const block = (t) => t.match(/<!-- playbook:core v\S+ begin[\s\S]*?<!-- playbook:core end -->/)?.[0] ?? "";

const CLAUDE = `# Rules for this writing repo

Read STYLE.md before writing anything.

## Workflow

1. Draft the chapter.
2. Build the PDF and look at it.

## Git

Local repo, branch \`main\`. Commit finished steps with clear messages. Never push without the owner's OK.
`;
const TASKS = "# Tasks\n\n## Now\n- [ ] Draft chapter 1\n\n## Done\n- [x] Repo created\n";

function writer(sb, extra = {}, name = "writer") {
  return repo(sb, name, {
    commit: true,
    files: {
      "CLAUDE.md": CLAUDE,
      "TASKS.md": TASKS,
      "STYLE.md": "# Style\n",
      "books/_template/outline.md": "# Outline\n",
      "worlds/_template/world.md": "# World\n",
      "notes/template/idea.md": "# Idea\n",
      ...extra,
    },
  });
}

test("R1: a rule to commit on main is a conflict; a rule never to commit on main is not", sandboxed((sb) => {
  const c = audit(sb, writer(sb)).details.conflicts;
  const main = c.find((x) => x.topic === "main branch");
  assert.ok(main, JSON.stringify(c));
  assert.match(main.repo, /branch `main`\. Commit finished steps/);
  assert.equal(main.where, "CLAUDE.md:12");

  const plain = repo(sb, "plain", { commit: true, files: { "AGENTS.md": "# Rules\n\n- Never commit on main.\n- Do not commit to `master`.\n- The owner merges into `main`; commit on your branch.\n" } });
  assert.ok(!audit(sb, plain).details.conflicts.some((x) => x.topic === "main branch"));
}));

test("R2: the block defers on the branch rule, and playbook.json stops guarding main", sandboxed((sb) => {
  const d = writer(sb);
  const r = apply(sb, d, "A-01,A-11,D-02", ["--apply"]);
  assert.equal(r.status, 0, r.out);
  const b = block(read(d, "AGENTS.md"));
  assert.doesNotMatch(b, /Never commit on `main`/);
  assert.match(b, /Which branch to commit on follows this repo's own rules above/);
  assert.match(b, /Never push unasked/);
  assert.deepEqual(json(d, "playbook.json").protectedBranches, []);
}));

test("R3: a checklist board is a conflict, and the Board section keeps the repo's format", sandboxed((sb) => {
  const d = writer(sb);
  const board = audit(sb, d).details.conflicts.find((x) => x.topic === "board format");
  assert.ok(board);
  assert.match(board.repo, /TASKS\.md.*not a table/);
  assert.equal(apply(sb, d, "A-11,D-02", ["--apply"]).status, 0);
  const b = block(read(d, "AGENTS.md"));
  assert.match(b, /`TASKS\.md` keeps this repo's own format/);
  assert.doesNotMatch(b, /stable ID|verified date/);
}));

test("R4: with only CLAUDE.md, D-02 moves its rules into AGENTS.md and CLAUDE.md imports it", sandboxed((sb) => {
  const d = writer(sb);
  const d02 = audit(sb, d).plan.decide.find((s) => s.id === "D-02");
  assert.ok(d02, "D-02 is offered when only CLAUDE.md exists");
  assert.match(d02.step, /Move CLAUDE\.md's rules into AGENTS\.md/);

  const r = apply(sb, d, "D-02", ["--apply"]);
  assert.equal(r.status, 0, r.out);
  const agents = read(d, "AGENTS.md");
  assert.match(agents, /^# Rules for this writing repo\n/);
  assert.match(agents, /Codex reads this file directly/);
  assert.match(agents, /Local repo, branch `main`\. Commit finished steps/);
  assert.equal(block(agents), "", "D-02 alone adds no core block");
  const claude = read(d, "CLAUDE.md");
  assert.match(claude, /^# CLAUDE\.md\n\n@AGENTS\.md\n/);
  assert.doesNotMatch(claude, /Commit finished steps/);
  assert.equal(audit(sb, d).detect.repo.claudeVsAgents, "imports AGENTS.md");
}));

test("R4: A-11 with D-02 keeps the moved rules first and the core block after them", sandboxed((sb) => {
  const d = writer(sb);
  assert.equal(apply(sb, d, "A-10,A-11,D-02", ["--apply"]).status, 0);
  const agents = read(d, "AGENTS.md");
  assert.ok(agents.indexOf("Read STYLE.md") < agents.indexOf("<!-- playbook:core"), "own rules come first");
  assert.doesNotMatch(agents, /TODO/);
  const c = script(sb, d, "check.mjs");
  assert.doesNotMatch(c.out, /does not import AGENTS\.md/, c.out);
}));

test("R5: A-11 leaves out the people section when the repo has no people page", sandboxed((sb) => {
  const d = writer(sb, { "CLAUDE.md": "@AGENTS.md\n" });
  assert.equal(apply(sb, d, "A-11", ["--apply"]).status, 0);
  assert.doesNotMatch(read(d, "AGENTS.md"), /People who are always known/);

  const p = writer(sb, {}, "writer-people");
  assert.equal(apply(sb, p, "A-07,A-11,D-02", ["--apply"]).status, 0);
  assert.ok(has(p, "docs/00-home/people.md"));
  assert.match(read(p, "AGENTS.md"), /docs\/00-home\/people\.md/);
}));

test("R6: files in _template/ and template/ folders are not unlinked notes", sandboxed((sb) => {
  const d = writer(sb);
  const orphans = audit(sb, d).details.orphans;
  assert.ok(!orphans.some((f) => /(^|\/)_?templates?\//.test(f)), orphans.join(", "));
  assert.equal(apply(sb, d, "A-01,A-10", ["--apply"]).status, 0);
  const c = script(sb, d, "check.mjs");
  assert.doesNotMatch(c.out, /_template|template\/idea/, c.out);
}));
