// A rulebook change lands in one copy of the folder. The screen names the other working copies (Git worktrees) and the
// unmerged branches that change the rulebook too, and says that open sessions keep the old rules until they restart.
import assert from "node:assert/strict";
import { test } from "node:test";
import { join } from "node:path";
import { cli, git, repo, sandboxed, write } from "./helpers.mjs";

const ME = { REPO_FIT_TODAY: "2026-10-25", GIT_AUTHOR_NAME: "Test Person", GIT_AUTHOR_EMAIL: "test@example.com", GIT_COMMITTER_NAME: "Test Person", GIT_COMMITTER_EMAIL: "test@example.com" };

test("a rulebook change names other worktrees and unmerged branches that change the rulebook", sandboxed((sb) => {
  const d = repo(sb, "main-copy", { commit: true, files: { "notes/a.md": "# A\n\nNote.\n" } });
  git(sb, d, ["worktree", "add", "-q", "-b", "side", join(sb.dir, "side-copy")]);
  git(sb, d, ["checkout", "-q", "-b", "rules"]);
  write(d, "CLAUDE.md", "# Rules on a branch\n");
  git(sb, d, ["add", "-A"]);
  git(sb, d, ["commit", "-q", "-m", "rules"]);
  git(sb, d, ["checkout", "-q", "-b", "other", "main"]);
  write(d, "notes/b.md", "# B\n");
  git(sb, d, ["add", "-A"]);
  git(sb, d, ["commit", "-q", "-m", "other"]);
  git(sb, d, ["checkout", "-q", "main"]);

  const dry = cli(sb, ["apply", d, "--steps", "A-11"], { env: ME }).out;
  assert.match(dry, /Other working copies keep their old rules until they take this change: `[^`]*side-copy` \(branch `side`\)/, dry);
  assert.match(dry, /A branch not merged here also changes AGENTS\.md or CLAUDE\.md: `rules`\./);
  assert.doesNotMatch(dry, /`other`/, "a branch that leaves the rulebook alone is not named");
  assert.match(dry, /Sessions already open keep the old rules until they restart/);
  assert.doesNotMatch(dry, /main-copy`/, "this copy is not listed as another one");
}));

test("a change that leaves the rulebook alone says nothing about other copies", sandboxed((sb) => {
  const d = repo(sb, "plain", { commit: true, files: { "notes/a.md": "# A\n\nNote.\n" } });
  git(sb, d, ["worktree", "add", "-q", "-b", "side", join(sb.dir, "side-copy")]);
  const dry = cli(sb, ["apply", d, "--steps", "A-01"], { env: ME }).out;
  assert.doesNotMatch(dry, /Other working copies|Sessions already open/, dry);
}));

test("a branch is found even when a tag has the same name", sandboxed((sb) => {
  const d = repo(sb, "tagged", { commit: true, files: { "notes/a.md": "# A\n" } });
  git(sb, d, ["checkout", "-q", "-b", "foo"]);
  write(d, "AGENTS.md", "# Rules on a branch\n");
  git(sb, d, ["add", "-A"]);
  git(sb, d, ["commit", "-q", "-m", "rules"]);
  git(sb, d, ["checkout", "-q", "main"]);
  git(sb, d, ["tag", "foo"]);
  assert.match(cli(sb, ["apply", d, "--steps", "A-11"], { env: ME }).out, /A branch not merged here also changes AGENTS\.md or CLAUDE\.md: `foo`\./);
}));
