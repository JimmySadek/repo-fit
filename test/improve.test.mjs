// Improve (opt-in): repo-fit learns from what repeats, never from reading chats, and writes nothing without a yes.
// A correction the assistant notices is proposed once it comes back; filing the same kind to the same folder by hand
// twice proposes a standing rule; a correction that repeats an approved preference says the written rule is not
// working. Rejected proposals are not asked again. Off unless the person turns it on.
import assert from "node:assert/strict";
import { test } from "node:test";
import { makeFixture } from "../dev/fixtures.mjs";
import { cli, read, sandboxed, script, write } from "./helpers.mjs";

const ME = { REPO_FIT_TODAY: "2026-10-05", GIT_AUTHOR_NAME: "Test Person", GIT_AUTHOR_EMAIL: "test@example.com", GIT_COMMITTER_NAME: "Test Person", GIT_COMMITTER_EMAIL: "test@example.com" };
function setUp(sb, name = "spaghetti") {
  const { dir } = makeFixture(name, sb.dir);
  const rec = JSON.parse(cli(sb, ["audit", dir, "--json"], { env: ME }).stdout).plan.recommended;
  const code = cli(sb, ["organize", dir], { env: ME }).stdout.match(/--apply --plan (\w+)/)?.[1];
  if (code) assert.equal(cli(sb, ["organize", dir, "--apply", "--plan", code], { env: ME }).status, 0);
  assert.equal(cli(sb, ["apply", dir, "--steps", rec.steps.join(","), ...rec.flags.split(" "), "--apply"], { env: ME }).status, 0);
  return dir;
}
const on = (sb) => cli(sb, ["prefs", "set", "improve", "on"]);
const check = (sb, dir, ...args) => script(sb, dir, "check.mjs", args);
const brief = (sb, dir) => script(sb, dir, "brief.mjs", ["--text"]).out;
const LINE = "Write dates as 5 Oct 2026, never as 10/5";

test("off by default: nothing is remembered and nothing is proposed", sandboxed((sb) => {
  const dir = setUp(sb);
  const r = check(sb, dir, "--remember", LINE);
  assert.match(r.out, /Improve is off/);
  assert.doesNotMatch(brief(sb, dir), /🆕 A rule to consider/);
}));

test("a correction is proposed only once it comes back, and a yes writes it to Your preferences", sandboxed((sb) => {
  const dir = setUp(sb);
  on(sb);
  assert.match(check(sb, dir, "--remember", LINE).out, /seen 1 time/);
  assert.doesNotMatch(brief(sb, dir), /🆕/);
  const second = check(sb, dir, "--remember", LINE).out;
  assert.match(second, /seen 2 times/);
  const id = second.match(/--accept ([\w-]+)/)[1];
  assert.match(brief(sb, dir), /🆕 A rule to consider: "Write dates as 5 Oct 2026, never as 10\/5" \(it came up 2 times\)/);
  assert.equal(check(sb, dir, "--accept", id).status, 0);
  assert.match(read(dir, "AGENTS.md"), /<!-- repo-fit:preferences begin -->[\s\S]*- Write dates as 5 Oct 2026, never as 10\/5[\s\S]*<!-- repo-fit:preferences end -->/);
  assert.doesNotMatch(brief(sb, dir), /🆕 A rule to consider/);
}));

test("a no is remembered: the same correction is not proposed again", sandboxed((sb) => {
  const dir = setUp(sb);
  on(sb);
  check(sb, dir, "--remember", LINE);
  const id = check(sb, dir, "--remember", LINE).out.match(/--reject ([\w-]+)/)[1];
  assert.equal(check(sb, dir, "--reject", id).status, 0);
  assert.match(check(sb, dir, "--remember", LINE).out, /said no/);
  assert.doesNotMatch(brief(sb, dir), /🆕 A rule to consider/);
}));

test("a rule text is checked: one short line, no secrets", sandboxed((sb) => {
  const dir = setUp(sb);
  on(sb);
  assert.match(check(sb, dir, "--remember", "Use the key sk-live-abcdefghijklmnopqrstuvwxyz123456 for the API").out, /looks like a secret/);
  assert.match(check(sb, dir, "--remember", "x".repeat(200)).out, /too long/);
}));

test("a correction that repeats an approved preference says the written rule is not working", sandboxed((sb) => {
  const dir = setUp(sb);
  on(sb);
  check(sb, dir, "--remember", LINE);
  check(sb, dir, "--accept", check(sb, dir, "--remember", LINE).out.match(/--accept ([\w-]+)/)[1]);
  assert.match(check(sb, dir, "--remember", LINE).out, /already in your preferences.*not working.*check or a script/s);
}));

test("filing the same kind to the same folder by hand twice proposes a standing rule; a yes adds it", sandboxed((sb) => {
  const dir = setUp(sb);
  on(sb);
  for (const n of ["a", "b"]) {
    write(dir, `inbox/idea-${n}.md`, `# Idea ${n}\n\nSomething.\n`);
    assert.equal(script(sb, dir, "file.mjs", [`inbox/idea-${n}.md`, "--to", "notes", "--apply"]).status, 0);
  }
  const out = brief(sb, dir);
  assert.match(out, /🆕 A rule to consider: new notes in inbox\/ go to notes\/ \(you did this by hand 2 times\)/);
  const id = check(sb, dir, "--proposals").out.match(/--accept (rule-[\w-]+)/)[1];
  assert.equal(check(sb, dir, "--accept", id).status, 0);
  assert.ok(JSON.parse(read(dir, "inbox/rules.json")).rules.some((r) => r.kind === "note" && !r.starts && r.to === "notes"));
}));

test("tidy folder with Improve on: nothing to propose, nothing said", sandboxed((sb) => {
  const dir = setUp(sb, "tidy");
  on(sb);
  assert.doesNotMatch(brief(sb, dir), /🆕/);
}));
