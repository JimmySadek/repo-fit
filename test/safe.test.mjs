// Safe start: before repo-fit changes anything, the folder is saved in Git as it is (a snapshot commit), as part of
// the one yes. No Git in the folder: Git is started there. Git not installed: the person is told how, and repo-fit's
// own undo still works. Secrets are never put in the snapshot. If Git will not save, nothing changes.
import assert from "node:assert/strict";
import { chmodSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { makeFixture } from "../dev/fixtures.mjs";
import { cli, git, has, repo, sandboxed, write } from "./helpers.mjs";

const ME = { GIT_AUTHOR_NAME: "Test Person", GIT_AUTHOR_EMAIL: "test@example.com", GIT_COMMITTER_NAME: "Test Person", GIT_COMMITTER_EMAIL: "test@example.com", REPO_FIT_TODAY: "2026-10-05" };
const code = (sb, dir, env = ME) => cli(sb, ["organize", dir], { env }).stdout.match(/--apply --plan (\w+)/)?.[1];
const organize = (sb, dir, env = ME, extra = []) => cli(sb, ["organize", dir, "--apply", "--plan", code(sb, dir, env), ...extra], { env });
const log = (sb, dir) => git(sb, dir, ["log", "--format=%s"]).stdout.trim().split("\n");
const inCommit = (sb, dir, ref) => git(sb, dir, ["show", "--name-only", "--format=", ref]).stdout.trim().split("\n");

test("unsaved changes are saved in a snapshot commit before anything moves, and the screen says so first", sandboxed((sb) => {
  const { dir } = makeFixture("spaghetti", sb.dir);
  write(dir, "new-idea.md", "# New idea\n\nNot saved yet.\n");
  const screen = cli(sb, ["organize", dir], { env: ME }).stdout;
  assert.match(screen, /Safety first: repo-fit saves a snapshot of your 1 unsaved file in Git before it changes anything/);
  assert.ok(screen.indexOf("Safety first") < screen.indexOf("Your folder today"), "the snapshot is on the screen, before the plan");
  const r = organize(sb, dir);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /Saved a snapshot/);
  assert.equal(log(sb, dir)[0], "repo-fit: snapshot before changes");
  assert.deepEqual(inCommit(sb, dir, "HEAD"), ["new-idea.md"], "the snapshot holds the folder as it was, before the moves");
  assert.ok(has(dir, "notes/new-idea.md"), "then the plan ran");
}));

test("a folder already saved needs no snapshot: the screen says the last save is the way back", sandboxed((sb) => {
  const { dir } = makeFixture("spaghetti", sb.dir);
  assert.match(cli(sb, ["organize", dir], { env: ME }).stdout, /everything is already saved in Git/);
  const before = log(sb, dir).length;
  assert.equal(organize(sb, dir).status, 0);
  assert.equal(log(sb, dir).length, before, "no empty commit");
}));

test("a folder without Git gets Git started and a snapshot of everything, within the same yes", sandboxed((sb) => {
  const { dir } = makeFixture("spaghetti-nogit", sb.dir);
  assert.match(cli(sb, ["organize", dir], { env: ME }).stdout, /not saved in Git yet\. repo-fit starts Git here and saves a snapshot/);
  const r = organize(sb, dir);
  assert.equal(r.status, 0, r.out);
  assert.ok(has(dir, ".git"));
  assert.ok(inCommit(sb, dir, "HEAD").includes("recipe-lasagna.md"), "the snapshot has the files where they were");
  assert.ok(has(dir, "notes/recipe-lasagna.md"));
}));

test("secret-like files are left out of the snapshot and named", sandboxed((sb) => {
  const d = repo(sb, "s", { commit: true, files: { "a.md": "# A\n\nA note.\n" } });
  write(d, ".env", "TOKEN=x\n");
  write(d, "b.md", "# B\n\nAnother note.\n");
  const r = organize(sb, d);
  assert.equal(r.status, 0, r.out);
  assert.ok(!inCommit(sb, d, "HEAD").includes(".env"));
  assert.match(r.out, /Left out of the snapshot.*\.env/);
}));

test("Git not installed: the screen explains how to add it, and repo-fit's own undo still covers the change", sandboxed((sb) => {
  const { dir } = makeFixture("spaghetti-nogit", sb.dir);
  const noGit = { ...ME, PATH: join(sb.dir, "empty-bin") };
  const screen = cli(sb, ["organize", dir], { env: noGit }).stdout;
  assert.match(screen, /Git is not installed/);
  assert.match(screen, /xcode-select --install|winget install|package manager/);
  const r = organize(sb, dir, noGit);
  assert.equal(r.status, 0, r.out);
  assert.ok(has(dir, "notes/recipe-lasagna.md") && !has(dir, ".git"));
}));

test("Git without a name and email: nothing changes, and the person gets the two lines to run", sandboxed((sb) => {
  const { dir } = makeFixture("spaghetti-nogit", sb.dir);
  const env = { REPO_FIT_TODAY: "2026-10-05" };
  assert.match(cli(sb, ["organize", dir], { env }).stdout, /does not know your name and email/);
  const r = organize(sb, dir, env);
  assert.equal(r.status, 1);
  assert.match(r.out, /git config --global user\.name/);
  assert.ok(has(dir, "recipe-lasagna.md"), "nothing moved");
}));

test("if Git will not save the snapshot (a rule blocks the commit), nothing changes", sandboxed((sb) => {
  const { dir } = makeFixture("spaghetti", sb.dir);
  write(dir, "new-idea.md", "# New idea\n");
  write(dir, ".git/hooks/pre-commit", "#!/bin/sh\necho 'commits on main are blocked here'\nexit 1\n");
  chmodSync(join(dir, ".git/hooks/pre-commit"), 0o755);
  const r = organize(sb, dir);
  assert.equal(r.status, 1);
  assert.match(r.out, /Git did not save the snapshot/);
  assert.match(r.out, /commits on main are blocked here/);
  assert.ok(has(dir, "recipe-lasagna.md"), "nothing moved");
}));

test("a repo whose rules say commit only when asked: the screen says the yes is that ask", sandboxed((sb) => {
  const d = repo(sb, "rules", { commit: true, files: { "AGENTS.md": "# Rules\n\nCommit only when asked.\n", "a.md": "# A\n\nNote.\n", "b.md": "# B\n\nNote.\n" } });
  write(d, "c.md", "# C\n\nNew.\n");
  assert.match(cli(sb, ["organize", d], { env: ME }).stdout, /Your rules say to commit only when asked: your yes is that ask/);
}));

test("the setup (apply --apply) also saves a snapshot first", sandboxed((sb) => {
  const d = repo(sb, "setup", { commit: true, files: { "notes/a.md": "# A\n" } });
  write(d, "notes/b.md", "# B\n");
  const rec = JSON.parse(cli(sb, ["audit", d, "--json"], { env: ME }).stdout).plan.recommended;
  const r = cli(sb, ["apply", d, "--steps", rec.steps.join(","), ...rec.flags.split(" "), "--apply"], { env: ME });
  assert.equal(r.status, 0, r.out);
  assert.equal(log(sb, d)[0], "repo-fit: snapshot before changes");
  assert.deepEqual(inCommit(sb, d, "HEAD"), ["notes/b.md"]);
}));

test("one snapshot per run: repo-fit's own changes since the snapshot are not saved as another snapshot", sandboxed((sb) => {
  const { dir } = makeFixture("spaghetti-nogit", sb.dir);
  const rec = JSON.parse(cli(sb, ["audit", dir, "--json"], { env: ME }).stdout).plan.recommended;
  assert.equal(organize(sb, dir).status, 0);
  const r = cli(sb, ["apply", dir, "--steps", rec.steps.join(","), ...rec.flags.split(" "), "--apply"], { env: ME });
  assert.equal(r.status, 0, r.out);
  assert.deepEqual(log(sb, dir), ["repo-fit: snapshot before changes"], "only the snapshot of the person's folder");
  assert.match(r.out, /already saved/);
}));
