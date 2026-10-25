// Safe start: before repo-fit changes anything, the folder is saved in Git as it is, as part of the one yes. The
// snapshot is a commit kept apart from every branch (refs/repo-fit/snapshots/...): the person's branch, what they staged
// and their files stay exactly as they are, and a normal push does not send it. No Git in the folder: nothing changes
// until the person makes a separate choice, --git-init (start Git and save a snapshot) or --no-snapshot (go on with
// repo-fit's own undo). Git not installed: the person is told how, and repo-fit's own undo still works. Secrets are
// never put in the snapshot. If Git will not save, nothing changes.
import assert from "node:assert/strict";
import { chmodSync, readdirSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { makeFixture } from "../dev/fixtures.mjs";
import { cli, git, has, read, repo, sandboxed, write } from "./helpers.mjs";

const ME = { GIT_AUTHOR_NAME: "Test Person", GIT_AUTHOR_EMAIL: "test@example.com", GIT_COMMITTER_NAME: "Test Person", GIT_COMMITTER_EMAIL: "test@example.com", REPO_FIT_TODAY: "2026-10-05" };
const code = (sb, dir, env = ME) => cli(sb, ["organize", dir], { env }).stdout.match(/--apply --plan (\w+)/)?.[1];
const organize = (sb, dir, env = ME, extra = []) => cli(sb, ["organize", dir, "--apply", "--plan", code(sb, dir, env), ...extra], { env });
const log = (sb, dir) => git(sb, dir, ["log", "--format=%s"]).stdout.trim().split("\n");
const inCommit = (sb, dir, ref) => git(sb, dir, ["show", "--name-only", "--format=", ref]).stdout.trim().split("\n");
const snaps = (sb, dir) => git(sb, dir, ["for-each-ref", "--format=%(refname)", "refs/repo-fit/snapshots/"]).stdout.trim().split("\n").filter(Boolean);
const head = (sb, dir) => git(sb, dir, ["rev-parse", "-q", "--verify", "HEAD"]).stdout.trim();
const staged = (sb, dir) => git(sb, dir, ["ls-files", "--stage"]).stdout;

test("unsaved changes are saved in a snapshot apart from the branch before anything moves, and the screen names them first", sandboxed((sb) => {
  const { dir } = makeFixture("spaghetti", sb.dir);
  write(dir, "new-idea.md", "# New idea\n\nNot saved yet.\n");
  const screen = cli(sb, ["organize", dir], { env: ME }).stdout;
  assert.match(screen, /Safety first: before it changes anything, repo-fit saves a snapshot of your 1 unsaved file in Git: `new-idea\.md`/);
  assert.match(screen, /apart from your branches, on this computer only/);
  assert.ok(screen.indexOf("Safety first") < screen.indexOf("Your folder today"), "the snapshot is on the screen, before the plan");
  const [before, index] = [head(sb, dir), staged(sb, dir)];
  const r = organize(sb, dir);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /Saved a snapshot of your folder in Git, apart from your branches: `refs\/repo-fit\/snapshots\//);
  assert.equal(head(sb, dir), before, "no commit on the branch");
  assert.notEqual(log(sb, dir)[0], "repo-fit: snapshot before changes");
  assert.equal(staged(sb, dir), index, "the person's index is untouched");
  const [ref] = snaps(sb, dir);
  assert.equal(snaps(sb, dir).length, 1);
  assert.equal(git(sb, dir, ["rev-parse", `${ref}^`]).stdout.trim(), before, "the snapshot sits on the commit the person was on");
  assert.deepEqual(inCommit(sb, dir, ref), ["new-idea.md"], "the snapshot holds the folder as it was, before the moves");
  assert.ok(has(dir, "notes/new-idea.md"), "then the plan ran");
  assert.match(git(sb, dir, ["status", "--porcelain", "--untracked-files=all"]).stdout, /\?\? notes\/new-idea\.md/, "the person's file is still unsaved on the branch, as before");
  const receipt = readdirSync(join(dir, ".playbook/receipts")).find((f) => f.endsWith(".json"));
  assert.equal(JSON.parse(readFileSync(join(dir, ".playbook/receipts", receipt), "utf8")).snapshot, ref, "the receipt names the snapshot");
  const undo = cli(sb, ["undo", dir], { env: ME }).stdout;
  assert.ok(undo.includes(`git restore --source=${ref} -- <file>`), "undo names the way back through the snapshot");
  assert.equal(git(sb, dir, ["restore", `--source=${ref}`, "--", "new-idea.md"]).status, 0);
  assert.ok(has(dir, "new-idea.md"), "a file comes back from the snapshot");
}));

test("a repo whose rules say stage by explicit path: the snapshot stages nothing and commits to no branch", sandboxed((sb) => {
  const d = repo(sb, "rules", { commit: true, files: { "AGENTS.md": "# Rules\n\nStage files by explicit path, never `git add .`.\n", "a.md": "# A\n\nNote.\n", "b.md": "# B\n\nNote.\n" } });
  write(d, "a.md", "# A\n\nStaged change.\n");
  git(sb, d, ["add", "a.md"]);
  write(d, "b.md", "# B\n\nNot staged.\n");
  write(d, "c.md", "# C\n\nNew.\n");
  const screen = cli(sb, ["organize", d], { env: ME }).stdout;
  assert.match(screen, /Your rules about commits stay kept: this is no commit on a branch, and nothing is staged/);
  const [before, index] = [head(sb, d), staged(sb, d)];
  assert.equal(organize(sb, d).status, 0);
  assert.equal(head(sb, d), before);
  assert.equal(staged(sb, d), index, "what the person staged is exactly as it was");
  assert.deepEqual(git(sb, d, ["diff", "--cached", "--name-only"]).stdout.trim().split("\n"), ["a.md"]);
  assert.deepEqual(inCommit(sb, d, snaps(sb, d)[0]).sort(), ["a.md", "b.md", "c.md"], "the snapshot holds the files as they are on disk");
}));

test("a folder already saved needs no snapshot: the screen says the last save is the way back", sandboxed((sb) => {
  const { dir } = makeFixture("spaghetti", sb.dir);
  assert.match(cli(sb, ["organize", dir], { env: ME }).stdout, /everything is already saved in Git/);
  const before = log(sb, dir).length;
  assert.equal(organize(sb, dir).status, 0);
  assert.equal(log(sb, dir).length, before, "no empty commit");
}));

test("a folder without Git: the screen says so and nothing changes until the person chooses, separately", sandboxed((sb) => {
  const { dir } = makeFixture("spaghetti-nogit", sb.dir);
  const screen = cli(sb, ["organize", dir], { env: ME }).stdout;
  assert.match(screen, /🚨 No git tree/);
  assert.match(screen, /--git-init/);
  assert.match(screen, /--no-snapshot/);
  assert.doesNotMatch(screen, /repo-fit starts Git here/);
  const r = organize(sb, dir);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /Nothing was changed/);
  assert.ok(!has(dir, ".git"), "Git is never started without its own yes");
  assert.ok(has(dir, "recipe-lasagna.md"), "nothing moved");
}));

test("the setup's dry run also says so in a folder without Git, so the Git question comes before the yes", sandboxed((sb) => {
  const d = join(sb.dir, "plain");
  write(d, "a.md", "# A\n\nA note.\n");
  const r = cli(sb, ["apply", d, "--steps", "A-11", "--tool", "codex", "--hooks", "none", "--autosave", "off"], { env: ME });
  assert.equal(r.status, 0, r.out);
  assert.match(r.stdout, /🚨 No git tree/);
  assert.ok(!has(d, ".git") && !has(d, "AGENTS.md"), "a dry run writes nothing");
}));

test("--no-snapshot on every command that writes: organize, then the setup, without Git", sandboxed((sb) => {
  const { dir } = makeFixture("spaghetti-nogit", sb.dir);
  const rec = JSON.parse(cli(sb, ["audit", dir, "--json"], { env: ME }).stdout).plan.recommended;
  assert.equal(organize(sb, dir, ME, ["--no-snapshot"]).status, 0);
  const r = cli(sb, ["apply", dir, "--steps", rec.steps.join(","), ...rec.flags.split(" "), "--apply", "--no-snapshot"], { env: ME });
  assert.equal(r.status, 0, r.out);
  assert.ok(!has(dir, ".git") && has(dir, "playbook.json"));
}));

test("--no-snapshot in a folder without Git goes on, and Git stays off", sandboxed((sb) => {
  const { dir } = makeFixture("spaghetti-nogit", sb.dir);
  const r = organize(sb, dir, ME, ["--no-snapshot"]);
  assert.equal(r.status, 0, r.out);
  assert.ok(!has(dir, ".git"));
  assert.ok(has(dir, "notes/recipe-lasagna.md"));
}));

test("--git-init in a folder without Git starts Git and saves a snapshot of everything first, with no commit on the branch", sandboxed((sb) => {
  const { dir } = makeFixture("spaghetti-nogit", sb.dir);
  const r = organize(sb, dir, ME, ["--git-init"]);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /Git was started here first/);
  assert.ok(has(dir, ".git"));
  assert.equal(head(sb, dir), "", "the branch has no commit: the files are the person's to commit");
  assert.ok(inCommit(sb, dir, snaps(sb, dir)[0]).includes("recipe-lasagna.md"), "the snapshot has the files where they were");
  assert.ok(has(dir, "notes/recipe-lasagna.md"));
}));

test("secret-like files are left out of the snapshot and named", sandboxed((sb) => {
  const d = repo(sb, "s", { commit: true, files: { "a.md": "# A\n\nA note.\n" } });
  write(d, ".env", "TOKEN=x\n");
  write(d, "b.md", "# B\n\nAnother note.\n");
  const r = organize(sb, d);
  assert.equal(r.status, 0, r.out);
  assert.ok(!inCommit(sb, d, snaps(sb, d)[0]).includes(".env"));
  assert.ok(inCommit(sb, d, snaps(sb, d)[0]).includes("b.md"));
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

test("a hook that blocks commits does not stop the snapshot: it is no commit on the branch", sandboxed((sb) => {
  const { dir } = makeFixture("spaghetti", sb.dir);
  write(dir, "new-idea.md", "# New idea\n");
  write(dir, ".git/hooks/pre-commit", "#!/bin/sh\necho 'commits on main are blocked here'\nexit 1\n");
  chmodSync(join(dir, ".git/hooks/pre-commit"), 0o755);
  const r = organize(sb, dir);
  assert.equal(r.status, 0, r.out);
  assert.equal(snaps(sb, dir).length, 1);
}));

test("if Git will not save the snapshot, nothing changes", sandboxed((sb) => {
  const { dir } = makeFixture("spaghetti", sb.dir);
  write(dir, "new-idea.md", "# New idea\n");
  write(dir, ".git/refs/repo-fit", "not a folder\n"); // the ref cannot be made
  const r = organize(sb, dir);
  assert.equal(r.status, 1);
  assert.match(r.out, /Git did not save the snapshot/);
  assert.ok(has(dir, "recipe-lasagna.md"), "nothing moved");
}));

test("a repo whose rules say commit only when asked: the screen says the rules stay kept", sandboxed((sb) => {
  const d = repo(sb, "rules", { commit: true, files: { "AGENTS.md": "# Rules\n\nCommit only when asked.\n", "a.md": "# A\n\nNote.\n", "b.md": "# B\n\nNote.\n" } });
  write(d, "c.md", "# C\n\nNew.\n");
  assert.match(cli(sb, ["organize", d], { env: ME }).stdout, /Your rules about commits stay kept/);
}));

test("the setup (apply --apply) also saves a snapshot first", sandboxed((sb) => {
  const d = repo(sb, "setup", { commit: true, files: { "notes/a.md": "# A\n" } });
  write(d, "notes/b.md", "# B\n");
  const rec = JSON.parse(cli(sb, ["audit", d, "--json"], { env: ME }).stdout).plan.recommended;
  const r = cli(sb, ["apply", d, "--steps", rec.steps.join(","), ...rec.flags.split(" "), "--apply"], { env: ME });
  assert.equal(r.status, 0, r.out);
  assert.equal(log(sb, d)[0], "initial", "no commit on the branch");
  assert.deepEqual(inCommit(sb, d, snaps(sb, d)[0]), ["notes/b.md"]);
}));

test("one snapshot per run: repo-fit's own changes since the snapshot are not saved as another snapshot", sandboxed((sb) => {
  const { dir } = makeFixture("spaghetti-nogit", sb.dir);
  const rec = JSON.parse(cli(sb, ["audit", dir, "--json"], { env: ME }).stdout).plan.recommended;
  assert.equal(organize(sb, dir, ME, ["--git-init"]).status, 0);
  const screen = cli(sb, ["apply", dir, "--steps", rec.steps.join(","), ...rec.flags.split(" ")], { env: ME });
  const r = cli(sb, ["apply", dir, "--steps", rec.steps.join(","), ...rec.flags.split(" "), "--apply"], { env: ME });
  assert.equal(r.status, 0, `${screen.out}\n${r.out}`);
  assert.equal(snaps(sb, dir).length, 1, "only the snapshot of the person's folder");
  assert.match(r.out, /already saved in a snapshot/);
  const receipts = readdirSync(join(dir, ".playbook/receipts")).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(dir, ".playbook/receipts", f), "utf8")).snapshot);
  assert.deepEqual([...new Set(receipts)], snaps(sb, dir), "both receipts name the one snapshot");
}));

test("a new unsaved change after the snapshot gets a new snapshot; no change, no new one", sandboxed((sb) => {
  const d = repo(sb, "again", { commit: true, files: { "notes/a.md": "# A\n" } });
  write(d, "notes/b.md", "# B\n");
  const ignore = (x) => cli(sb, ["apply", d, "--ignore", x, "--apply"], { env: ME });
  assert.equal(ignore("tmp1/").status, 0);
  assert.equal(snaps(sb, d).length, 1);
  write(d, "notes/b.md", "# B\n\nChanged by the person.\n");
  assert.equal(ignore("tmp2/").status, 0);
  assert.equal(snaps(sb, d).length, 2);
  assert.match(ignore("tmp3/").out, /already saved in a snapshot/);
  assert.equal(snaps(sb, d).length, 2);
}));

test("the screen names the unsaved files, a folder as one name with its count, the rest as a count", sandboxed((sb) => {
  const d = repo(sb, "many", { commit: true, files: { "notes/a.md": "# A\n" } });
  for (let i = 0; i < 3; i++) write(d, `drafts/d${i}.md`, `# D${i}\n`);
  for (let i = 0; i < 11; i++) write(d, `top-${String(i).padStart(2, "0")}.md`, `# T${i}\n`);
  const line = cli(sb, ["organize", d], { env: ME }).stdout.split("\n").find((l) => l.includes("Safety first"));
  assert.match(line, /your 14 unsaved files in Git: `drafts\/` \(3 files\), `top-00\.md`/);
  assert.match(line, /, and 2 more\./);
}));

test("untracked folders that look private, or that the rules keep out of Git, are flagged with the way to keep them out", sandboxed((sb) => {
  const d = repo(sb, "priv", { commit: true, files: { "AGENTS.md": "# Rules\n\nNever commit `Intro context/`.\n", "notes/a.md": "# A\n" } });
  write(d, "Intro context/call.md", "# Call\n\nWith a customer.\n");
  write(d, "meetings/2026-10-01.md", "# Meeting\n");
  write(d, "meetings/2026-10-08.md", "# Meeting\n");
  write(d, "ideas/x.md", "# X\n");
  const screen = cli(sb, ["apply", d, "--steps", "A-01"], { env: ME }).stdout;
  assert.match(screen, /⚠️ Not in `\.gitignore`, and private by your rules or by name: `Intro context\/` \(1 file; your rules say to keep it out of Git\), `meetings\/` \(2 files\)/);
  assert.doesNotMatch(screen.split("⚠️ Not in")[1], /ideas/);
  assert.match(screen, /repo-fit apply \S+ --ignore "Intro context\/,meetings\/"/);
  const dry = cli(sb, ["apply", d, "--ignore", "Intro context/,meetings/"], { env: ME });
  assert.equal(dry.status, 0, dry.out);
  assert.match(dry.out, /^ +\/Intro context\/$/m);
  assert.ok(!has(d, ".gitignore"), "a dry run writes nothing");
  assert.match(dry.out, /Not saved in it: what you are keeping out of Git now \(`Intro context\/call\.md`, `meetings\/` \(2 files\)\)\./);
  assert.doesNotMatch(dry.out.split("🛟")[1] ?? "", /⚠️ Not in `\.gitignore`/, "no second offer for what is being ignored");
  const r = cli(sb, ["apply", d, "--ignore", "Intro context/,meetings/", "--apply"], { env: ME });
  assert.equal(r.status, 0, r.out);
  // The snapshot before it holds only ideas/: the folders being kept out of Git are never saved in Git first.
  const saved = git(sb, d, ["show", "--name-only", "--format=", ...snaps(sb, d).slice(0, 1)]).stdout;
  assert.match(saved, /ideas\/x\.md/);
  assert.doesNotMatch(saved, /meetings|Intro context/);
  assert.match(read(d, ".gitignore"), /^\/Intro context\/$/m);
  assert.match(read(d, ".gitignore"), /^\/meetings\/$/m);
  assert.doesNotMatch(git(sb, d, ["status", "--porcelain"]).stdout, /meetings|Intro/, "Git no longer offers them");
  assert.ok(!has(d, "playbook.json"), "only .gitignore changed: no other step ran");
  assert.equal(cli(sb, ["undo", d, "--apply"], { env: ME }).status, 0);
  assert.ok(!has(d, ".gitignore"), "undo takes it back");
}));

// Edge cases from the review of 25 Oct: each one used to stop the run, leak a file, or save a needless snapshot.
const setupStep = ["--steps", "A-01", "--tool", "claude", "--hooks", "none", "--autosave", "off", "--apply"];

test("--ignore ./folder/ keeps the folder out of the snapshot too", sandboxed((sb) => {
  const d = repo(sb, "dot", { commit: true });
  write(d, "meetings/a.md", "# A\n");
  write(d, "other.md", "# Other\n");
  assert.equal(cli(sb, ["apply", d, "--ignore", "./meetings/", "--apply"], { env: ME }).status, 0);
  const saved = inCommit(sb, d, snaps(sb, d)[0]);
  assert.deepEqual(saved, ["other.md"]);
}));

test("a file staged and then deleted, and an ignored file added with -f, do not stop the snapshot", sandboxed((sb) => {
  const d = repo(sb, "odd", { commit: true, files: { ".gitignore": "dist/\n" } });
  git(sb, d, ["add", "-A"]);
  git(sb, d, ["commit", "-q", "-m", "ignore"]);
  write(d, "gone.md", "# Gone\n");
  git(sb, d, ["add", "gone.md"]);
  rmSync(join(d, "gone.md"));
  write(d, "dist/x.js", "x\n");
  git(sb, d, ["add", "-f", "dist/x.js"]);
  const before = staged(sb, d);
  const r = cli(sb, ["apply", d, ...setupStep], { env: ME });
  assert.equal(r.status, 0, r.out);
  assert.ok(inCommit(sb, d, snaps(sb, d)[0]).includes("dist/x.js"));
  assert.equal(staged(sb, d), before, "what was staged is untouched");
}));

test("a Git repo inside the folder is left out of the snapshot and named, and does not stop the run", sandboxed((sb) => {
  const d = repo(sb, "nest", { commit: true });
  git(sb, d, ["init", "-q", "inner"]);
  write(d, "inner/z.md", "# Z\n");
  write(d, "mine.md", "# Mine\n");
  const r = cli(sb, ["apply", d, ...setupStep], { env: ME });
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /Left out of the snapshot[^.]*inner\/ \(its own Git repo\)/);
  assert.deepEqual(inCommit(sb, d, snaps(sb, d)[0]), ["mine.md"]);
}));

test("a folder inside a repo: the snapshot saves that folder's changes only", sandboxed((sb) => {
  const d = repo(sb, "outer", { commit: true, files: { "sub/s.md": "# S\n" } });
  write(d, "sub/t.md", "# T\n");
  write(d, "outside.md", "# Outside\n");
  const r = cli(sb, ["apply", join(d, "sub"), ...setupStep], { env: ME });
  assert.equal(r.status, 0, r.out);
  assert.deepEqual(inCommit(sb, d, snaps(sb, d)[0]), ["sub/t.md"]);
}));

test("a link to a file, saved once, is not saved again on the next run", sandboxed((sb) => {
  const d = repo(sb, "link", { commit: true });
  write(d, "target.md", "# Target\n");
  symlinkSync("target.md", join(d, "link.md"));
  assert.equal(cli(sb, ["apply", d, "--ignore", "tmp1/", "--apply"], { env: ME }).status, 0);
  assert.equal(snaps(sb, d).length, 1);
  assert.equal(cli(sb, ["apply", d, "--ignore", "tmp2/", "--apply"], { env: ME }).status, 0);
  assert.equal(snaps(sb, d).length, 1, "already saved: no second snapshot");
}));
