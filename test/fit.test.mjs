// Checkup and fit check: the full life of a folder. The map rebuilds itself at session start; the briefing names
// real problems in one short line each and is quiet otherwise; loose files at the top follow the standing rules; a
// re-run starts with a checkup; about every 2 weeks the briefing suggests a deeper review. Silent on a tidy folder.
import assert from "node:assert/strict";
import { renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { makeFixture, makeBytes } from "../dev/fixtures.mjs";
import { cli, git, has, read, sandboxed, script, write } from "./helpers.mjs";

const ME = { REPO_FIT_TODAY: "2026-10-05", GIT_AUTHOR_NAME: "Test Person", GIT_AUTHOR_EMAIL: "test@example.com", GIT_COMMITTER_NAME: "Test Person", GIT_COMMITTER_EMAIL: "test@example.com" };

// The first run, as the skill does it: organize (if there is anything to organize), then the setup.
function setUp(sb, name) {
  const { dir } = makeFixture(name, sb.dir);
  const rec = JSON.parse(cli(sb, ["audit", dir, "--json"], { env: ME }).stdout).plan.recommended;
  const code = cli(sb, ["organize", dir], { env: ME }).stdout.match(/--apply --plan (\w+)/)?.[1];
  if (code) assert.equal(cli(sb, ["organize", dir, "--apply", "--plan", code], { env: ME }).status, 0);
  assert.equal(cli(sb, ["apply", dir, "--steps", rec.steps.join(","), ...rec.flags.split(" "), "--apply"], { env: ME }).status, 0);
  return dir;
}
const start = (sb, dir) => script(sb, dir, "brief.mjs", ["--text", "--file"]).out; // what a session start does
const checkup = (sb, dir) => cli(sb, ["status", dir], { env: ME }).out;
const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

test("tidy folder: the session start and the checkup say nothing is wrong, and change nothing", sandboxed((sb) => {
  const dir = setUp(sb, "tidy");
  const out = start(sb, dir);
  assert.doesNotMatch(out, /⚠️|🆕|📥/, out);
  const c = checkup(sb, dir);
  assert.match(c, /✅ Your folder is fit/);
  assert.match(c, /Nothing to change/);
  assert.doesNotMatch(c.split("\n\n")[0], /⚠️/);
}));

test("a new, renamed or removed note: the map and index pages rebuild themselves at session start", sandboxed((sb) => {
  const dir = setUp(sb, "spaghetti");
  write(dir, "notes/new-plan.md", "# New plan\n\nA fresh note.\n");
  renameSync(join(dir, "notes/recipe-lasagna.md"), join(dir, "notes/lasagna.md"));
  const out = start(sb, dir);
  const index = read(dir, "notes/INDEX.md");
  assert.match(index, /\(new-plan\.md\)/);
  assert.match(index, /\(lasagna\.md\)/);
  assert.doesNotMatch(index, /recipe-lasagna/);
  assert.match(out, /✅ Map updated/);
  assert.doesNotMatch(start(sb, dir), /Map updated/, "only when something changed");
}));

test("the briefing names real problems in one short line each", sandboxed((sb) => {
  const dir = setUp(sb, "spaghetti");
  const out = start(sb, dir);
  assert.match(out, /⚠️ 1 broken link: notes\/todo\.md → missing-file\.md/);
  assert.match(out, /⚠️ 2 old notes \(not changed for 180\+ days\): .*book-notes-atomic-habits\.md/);
  assert.match(out, /📥 Inbox: 1 waiting: untitled\.md/);
  write(dir, "notes/orphan-ish.md", "# Off the map\n\nNot listed yet.\n");
  // The map rebuilds at the start, so a new note is never "missing from an index" for long.
  assert.doesNotMatch(start(sb, dir), /not on any index page/);
}));

test("loose files at the top follow the standing rules; the rest is named once; files the code needs are left alone", sandboxed((sb) => {
  const dir = setUp(sb, "spaghetti");
  write(dir, "IMG_3009.jpg", makeBytes.jpg("top photo"));
  write(dir, "thoughts.md", "# Thoughts\n\nJust saved here.\n");
  const out = start(sb, dir);
  assert.ok(has(dir, "media/IMG_3009.jpg") && !has(dir, "IMG_3009.jpg"));
  assert.match(out, /📥 Filed by your rules: 1/);
  assert.match(out, /⚠️ 1 file is loose at the top again: thoughts\.md/);
  assert.doesNotMatch(out, /logo\.png|prices-2026\.csv/, "the website uses them: they stay, quietly");
}));

test("without Git history, old notes are dated by the file's own date", sandboxed((sb) => {
  const dir = setUp(sb, "spaghetti-nogit");
  assert.match(start(sb, dir), /⚠️ 2 old notes .*book-notes-atomic-habits\.md/);
}));

test("the checkup on an organized folder shows only what is off, in plain words, before anything else", sandboxed((sb) => {
  const dir = setUp(sb, "spaghetti");
  write(dir, "thoughts.md", "# Thoughts\n\nJust saved here.\n");
  start(sb, dir); // a session started since: the map follows by itself; a note with no rule stays where it is
  const c = checkup(sb, dir);
  const screen = c.split("\n\n")[0];
  assert.match(screen, /^⚠️ Your folder needs a look: \d+ thing/);
  assert.match(c, /✅ Map up to date/);
  assert.match(c, /⚠️ 1 file loose at the top: thoughts\.md/);
  assert.match(c, /⚠️ 1 item waiting in inbox\//);
  assert.match(c, /⚠️ 1 broken link/);
  assert.doesNotMatch(screen, /fingerprint|receipt|hook|vendored|pathspec|journal|playbook \d|guidance/i);
}));

test("about every 2 weeks the briefing suggests a deeper review; the review stamps the date and lists near copies", sandboxed((sb) => {
  const dir = setUp(sb, "spaghetti");
  assert.doesNotMatch(start(sb, dir), /🆕/, "not right after the setup");
  writeFileSync(join(dir, ".playbook/review.json"), JSON.stringify({ last: daysAgo(15) }));
  assert.match(start(sb, dir), /🆕 .*review/i);
  const r = script(sb, dir, "check.mjs", ["--review"]);
  assert.match(r.out, /may cover the same topic: .*Meeting notes\.md.*meeting-notes \(1\)\.md/);
  assert.match(r.out, /Nothing changes without/);
  assert.doesNotMatch(start(sb, dir), /🆕/, "after a review, quiet for 2 weeks");
}));

test("when something can be fixed, the checkup itself shows before → after → why, so it is on screen before any question", sandboxed((sb) => {
  const dir = setUp(sb, "spaghetti");
  write(dir, "thoughts.md", "# Thoughts\n\nJust saved here.\n");
  write(dir, "inbox/piano-idea.md", "# Piano\n\nMaybe learn the piano.\n");
  start(sb, dir);
  const c = checkup(sb, dir);
  assert.match(c, /Your folder today[\s\S]*After one yes/);
  assert.match(c, /--apply --plan \w+/);
  assert.match(c, /inbox\/piano-idea\.md → notes\/piano-idea\.md/);
  assert.ok(c.indexOf("Your folder today") < c.indexOf("What can fix it"));
}));

test("the end-of-reply reminder does not ask to keep or commit what repo-fit itself just changed", sandboxed((sb) => {
  const dir = setUp(sb, "spaghetti");
  git(sb, dir, ["add", "-A"], ME);
  git(sb, dir, ["commit", "-q", "-m", "organized last week"], ME); // as in the live run
  write(dir, "inbox/IMG_3001.jpg", makeBytes.jpg("photo"));
  write(dir, "thoughts.md", "# Thoughts\n\nSaved at the top.\n");
  start(sb, dir); // files the photo and rebuilds the map
  const code = checkup(sb, dir).match(/--apply --plan (\w+)/)[1];
  assert.equal(cli(sb, ["organize", dir, "--apply", "--plan", code], { env: ME }).status, 0); // a yes to the plan
  const r = script(sb, dir, "autosave.mjs", ["--event", "stop", "--host", "Claude Code"], { input: "{}" });
  assert.doesNotMatch(r.out, /MAP\.md|IMG_3001|notes\/INDEX\.md|thoughts\.md/, r.out);
}));
