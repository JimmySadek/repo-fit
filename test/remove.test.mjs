// A clean way out: `remove` shows before → after, then sets repo-fit's own files and rules aside (never the person's
// files: the folder stays organized as it is), and one `undo` brings all of it back.
import assert from "node:assert/strict";
import { test } from "node:test";
import { makeFixture } from "../dev/fixtures.mjs";
import { sameTree, snapshot } from "../dev/score.mjs";
import { cli, has, read, sandboxed } from "./helpers.mjs";

const ME = { REPO_FIT_TODAY: "2026-10-05", GIT_AUTHOR_NAME: "Test Person", GIT_AUTHOR_EMAIL: "test@example.com", GIT_COMMITTER_NAME: "Test Person", GIT_COMMITTER_EMAIL: "test@example.com" };

function setUp(sb) {
  const { dir } = makeFixture("spaghetti", sb.dir);
  const rec = JSON.parse(cli(sb, ["audit", dir, "--json"], { env: ME }).stdout).plan.recommended;
  const code = cli(sb, ["organize", dir], { env: ME }).stdout.match(/--apply --plan (\w+)/)[1];
  assert.equal(cli(sb, ["organize", dir, "--apply", "--plan", code], { env: ME }).status, 0);
  assert.equal(cli(sb, ["apply", dir, "--steps", rec.steps.join(","), ...rec.flags.split(" "), "--apply"], { env: ME }).status, 0);
  assert.equal(cli(sb, ["hooks", dir, "--hooks", "brief", "--apply"], { env: ME }).status, 0);
  return dir;
}

test("remove shows before → after first and changes nothing", sandboxed((sb) => {
  const dir = setUp(sb);
  const before = snapshot(dir);
  const r = cli(sb, ["remove", dir], { env: ME });
  assert.equal(r.status, 0, r.out);
  assert.match(r.stdout, /scripts\/playbook\/ .*→ set aside/);
  assert.match(r.stdout, /AGENTS\.md .*→ repo-fit's parts taken out; your own text stays/);
  assert.match(r.stdout, /Your files stay/);
  assert.match(r.stdout, /Nothing was changed/);
  assert.equal(sameTree(before, snapshot(dir)).same, true);
}));

test("remove --apply sets repo-fit's own parts aside, keeps the person's files and the organized folders; one undo brings it back", sandboxed((sb) => {
  const dir = setUp(sb);
  const before = snapshot(dir);
  const r = cli(sb, ["remove", dir, "--apply"], { env: ME });
  assert.equal(r.status, 0, r.out);
  for (const p of ["scripts/playbook/brief.mjs", "playbook.json", "MAP.md", "notes/INDEX.md", "inbox/rules.json"]) assert.ok(!has(dir, p), `${p} set aside`);
  for (const p of ["notes/recipe-lasagna.md", "media/IMG_2041.jpg", "AGENTS.md", "website/app.js"]) assert.ok(has(dir, p), `${p} stays`);
  assert.doesNotMatch(read(dir, "AGENTS.md"), /repo-fit:pointer|playbook:core/);
  assert.doesNotMatch(read(dir, ".claude/settings.json"), /scripts\/playbook/);
  assert.ok(has(dir, ".playbook/removed"), "set aside, not deleted");
  const u = cli(sb, ["undo", dir, "--apply"]);
  assert.equal(u.status, 0, u.out);
  const back = sameTree(before, snapshot(dir));
  assert.equal(back.same, true, JSON.stringify(back));
}));
