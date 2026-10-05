// The review queue: notes nothing links to, notes untouched for a long time, notes whose review_after date has passed.
import assert from "node:assert/strict";
import { test } from "node:test";
import { cli, git, json, read, repo, sandboxed, script, write } from "./helpers.mjs";

// Git accepts a commit date from the environment, so a test can commit "long ago".
const LONG_AGO = { GIT_AUTHOR_DATE: "2024-01-01T12:00:00Z", GIT_COMMITTER_DATE: "2024-01-01T12:00:00Z" };

function ready(sb) {
  const d = repo(sb, "r");
  assert.equal(cli(sb, ["init", d, "--tool", "claude", "--autosave", "off"]).status, 0);
  commit(sb, d, "set up");
  return d;
}
function commit(sb, d, msg, env = {}) {
  git(sb, d, ["add", "-A"]);
  assert.equal(git(sb, d, ["commit", "-q", "-m", msg], env).status, 0);
}
const check = (sb, d) => script(sb, d, "check.mjs");
const brief = (sb, d) => script(sb, d, "brief.mjs", ["--text"]);

test("a fresh starter kit has an empty review queue", sandboxed((sb) => {
  const d = ready(sb);
  const c = check(sb, d);
  assert.equal(c.status, 0, c.out);
  assert.doesNotMatch(c.out, /nothing links to|untouched|due for review/);
  assert.doesNotMatch(brief(sb, d).out, /Review queue/);
}));

test("a note nothing links to is a warning in check and a line in the session brief", sandboxed((sb) => {
  const d = ready(sb);
  write(d, "docs/notes/lonely.md", "# Lonely\n\nNo one links here.\n");
  commit(sb, d, "add a note");
  const c = check(sb, d);
  assert.equal(c.status, 0, c.out); // a warning, never a failure
  assert.match(c.out, /WARNING 1 note\(s\) nothing links to: docs\/notes\/lonely\.md/);
  assert.match(brief(sb, d).out, /🧹 Review queue: 1 nobody links to \(docs\/notes\/lonely\.md\)/);
  // Link it from the current view and it leaves the queue.
  write(d, "docs/00-home/current.md", `${read(d, "docs/00-home/current.md")}\nSee [lonely](../notes/lonely.md).\n`);
  assert.doesNotMatch(check(sb, d).out, /nothing links to/);
  assert.doesNotMatch(brief(sb, d).out, /Review queue/);
}));

test("a note untouched for longer than staleNoteDays is listed; an uncommitted edit counts as today", sandboxed((sb) => {
  const d = ready(sb);
  write(d, "docs/notes/README.md", "# Notes\n\n- [old](old.md)\n- [fresh](fresh.md)\n");
  write(d, "docs/notes/old.md", "# Old\n");
  write(d, "docs/notes/fresh.md", "# Fresh\n");
  commit(sb, d, "long ago", LONG_AGO);
  write(d, "docs/notes/fresh.md", "# Fresh\n\nEdited today.\n");
  const c = check(sb, d);
  assert.equal(c.status, 0, c.out);
  assert.match(c.out, /WARNING 1 note\(s\) untouched for 180\+ days: docs\/notes\/old\.md \(2024-01-01\)/);
  assert.doesNotMatch(c.out, /fresh\.md/);
  assert.match(brief(sb, d).out, /1 untouched 180\+ days \(docs\/notes\/old\.md 2024-01-01\)/);
}));

test("a review_after date keeps a note off the stale list until it passes; then the note is due", sandboxed((sb) => {
  const d = ready(sb);
  write(d, "docs/notes/README.md", "# Notes\n\n- [plan](plan.md)\n");
  write(d, "docs/notes/plan.md", "---\nreview_after: 2099-01-01\n---\n# Plan\n");
  commit(sb, d, "long ago", LONG_AGO);
  let c = check(sb, d);
  assert.doesNotMatch(c.out, /plan\.md/, "a planned review date is not stale");
  write(d, "docs/notes/plan.md", "---\nreview_after: 2020-01-01\n---\n# Plan\n");
  commit(sb, d, "the date passed", LONG_AGO);
  c = check(sb, d);
  assert.match(c.out, /WARNING 1 note\(s\) due for review: docs\/notes\/plan\.md \(2020-01-01\)/);
  assert.doesNotMatch(c.out, /untouched/);
  assert.match(brief(sb, d).out, /1 due for review \(docs\/notes\/plan\.md 2020-01-01\)/);
}));

test("archives, outputs, templates and folder READMEs are never on the queue", sandboxed((sb) => {
  const d = ready(sb);
  write(d, "docs/archive/2020-old.md", "# Old\n");
  write(d, "docs/notes/README.md", "# Notes\n");
  write(d, "outputs/deck/README.md", "# Deck\n");
  write(d, "outputs/README.md", `${read(d, "outputs/README.md")}\n- deck\n`);
  commit(sb, d, "long ago", LONG_AGO);
  const c = check(sb, d);
  assert.equal(c.status, 0, c.out);
  assert.doesNotMatch(c.out, /nothing links to|untouched|due for review/);
  assert.doesNotMatch(brief(sb, d).out, /Review queue/);
}));

test("wiki-style [[links]] count as links", sandboxed((sb) => {
  const d = ready(sb);
  write(d, "docs/notes/README.md", "# Notes\n\n- [a](a.md)\n- b.md is reached from a\n");
  write(d, "docs/notes/a.md", "# A\n\nSee [[b]].\n");
  write(d, "docs/notes/b.md", "# B\n");
  commit(sb, d, "notes");
  assert.doesNotMatch(check(sb, d).out, /nothing links to/);
}));

test("staleNoteDays and reviewIgnore in playbook.json are respected", sandboxed((sb) => {
  const d = ready(sb);
  write(d, "docs/notes/README.md", "# Notes\n\n- [old](old.md)\n- [skip](skip.md)\n");
  write(d, "docs/notes/old.md", "# Old\n");
  write(d, "docs/notes/skip.md", "# Skip\n");
  commit(sb, d, "long ago", LONG_AGO);
  const pj = json(d, "playbook.json");
  write(d, "playbook.json", `${JSON.stringify({ ...pj, staleNoteDays: 2000, reviewIgnore: ["docs/notes/skip.md"] }, null, 2)}\n`);
  assert.doesNotMatch(check(sb, d).out, /untouched/, "2000 days is longer than the fixture's age");
  write(d, "playbook.json", `${JSON.stringify({ ...pj, staleNoteDays: 30, reviewIgnore: ["docs/notes/skip.md"] }, null, 2)}\n`);
  const c = check(sb, d);
  assert.match(c.out, /untouched for 30\+ days: docs\/notes\/old\.md/);
  assert.doesNotMatch(c.out, /skip\.md/);
}));

test("audit maps an existing hubs folder and apply records it in playbook.json", sandboxed((sb) => {
  const d = repo(sb, "h", { files: { "00-home/current.md": "# Current\n", "00-home/hubs/README.md": "# Hubs\n" } });
  assert.equal(cli(sb, ["apply", d, "--steps", "A-01", "--tool", "claude", "--autosave", "off", "--apply"]).status, 0);
  assert.equal(json(d, "playbook.json").paths.hubs, "00-home/hubs");
}));

test("the core rules say to merge into the note that exists, and the brief carries the review queue", sandboxed((sb) => {
  const d = ready(sb);
  assert.match(read(d, "AGENTS.md"), /Merge into the note that exists/);
}));

test("a long review queue is a count in the brief, and check lists the notes", sandboxed((sb) => {
  const d = ready(sb);
  for (const n of ["a", "b", "c", "d", "e"]) write(d, `docs/notes/${n}.md`, `# ${n}\n`);
  commit(sb, d, "add notes");
  const b = brief(sb, d).out;
  assert.match(b, /🧹 Review queue: 5 nobody links to\. `node scripts\/playbook\/check\.mjs` lists them\./);
  assert.doesNotMatch(b, /docs\/notes\/a\.md/);
  assert.match(check(sb, d).out, /5 note\(s\) nothing links to: .*docs\/notes\/a\.md/);
}));
