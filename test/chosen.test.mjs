// After the person picks a set of steps: the rulebook block and the scripts, when left out, are recorded as decided
// (not nagged about as undecided), naming them later still runs them, and the screen's counts add up.
import assert from "node:assert/strict";
import { test } from "node:test";
import { cli, json, repo, sandboxed, write } from "./helpers.mjs";

const ME = { REPO_FIT_TODAY: "2026-10-25", GIT_AUTHOR_NAME: "Test Person", GIT_AUTHOR_EMAIL: "test@example.com", GIT_COMMITTER_NAME: "Test Person", GIT_COMMITTER_EMAIL: "test@example.com" };

test("the scripts and the rules block, left out of the chosen set, are recorded as not chosen; naming them later runs them", sandboxed((sb) => {
  const d = repo(sb, "pick", { commit: true, files: { "AGENTS.md": "# Our rules\n\nBe kind.\n", "notes/a.md": "# A\n\nNote.\n" } });
  assert.equal(cli(sb, ["apply", d, "--steps", "A-01", "--tool", "claude", "--apply"], { env: ME }).status, 0);
  const pj = json(d, "playbook.json");
  assert.equal(pj.skipped?.["A-10"], "left out of the set chosen on 2026-10-25");
  assert.equal(pj.skipped?.["D-01"], "left out of the set chosen on 2026-10-25");
  const update = cli(sb, ["update", d], { env: ME }).out;
  assert.match(update, /➖ Not chosen: the scripts and hooks \(A-10\), left out of the set chosen on 2026-10-25\. Add it any time with "apply --steps A-10"\./, update);
  assert.doesNotMatch(update, /Not adopted|Worth a second look/);

  const later = cli(sb, ["apply", d, "--steps", "A-10", "--tool", "claude", "--hooks", "none", "--autosave", "off", "--apply"], { env: ME });
  assert.equal(later.status, 0, later.out);
  assert.doesNotMatch(later.out, /skipped on purpose/);
  const after = json(d, "playbook.json");
  assert.ok(after.adopted.includes("A-10"));
  assert.equal(after.skipped?.["A-10"], undefined, "no longer skipped once chosen");
  assert.equal(after.skipped?.["D-01"], "left out of the set chosen on 2026-10-25");
}));

test("a skip the person gave a reason for is kept: naming the step does not undo it", sandboxed((sb) => {
  const d = repo(sb, "own", { commit: true, files: { "notes/a.md": "# A\n\nNote.\n" } });
  assert.equal(cli(sb, ["apply", d, "--steps", "A-01", "--tool", "claude", "--apply"], { env: ME }).status, 0);
  assert.equal(cli(sb, ["skip", d, "A-10", "--reason", "we have our own hooks", "--apply"], { env: ME }).status, 0);
  const again = cli(sb, ["apply", d, "--steps", "A-10", "--tool", "claude"], { env: ME }).out;
  assert.match(again, /A-10: skipped on purpose \(we have our own hooks\)/);
}));

test("files already in place are counted apart, so the dry run and the result add up", sandboxed((sb) => {
  const d = repo(sb, "count", { commit: true, files: { "notes/a.md": "# A\n\nNote.\n", "media/x.md": "# X\n" } });
  assert.equal(cli(sb, ["apply", d, "--steps", "A-01,A-13", "--tool", "claude", "--apply"], { env: ME }).status, 0);
  write(d, "notes/b.md", "# B\n\nAnother.\n");
  const dry = cli(sb, ["apply", d, "--steps", "A-13"], { env: ME }).out;
  const m = dry.match(/(\d+) file\(s\) would be written\. (\d+) already in place, so not written again\./);
  assert.ok(m, dry);
  const done = cli(sb, ["apply", d, "--steps", "A-13", "--apply"], { env: ME }).out;
  assert.match(done, new RegExp(`✅ Wrote ${m[1]} file\\(s\\)\\. ${m[2]} already in place, so not written again\\.`), done);
}));
