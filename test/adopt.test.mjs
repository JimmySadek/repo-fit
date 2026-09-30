// Adopting a repo that already exists: audit, then apply chosen steps. Nothing is moved, nothing is duplicated.
import assert from "node:assert/strict";
import { test } from "node:test";
import { cli, has, json, read, repo, sandboxed, script, tree, write } from "./helpers.mjs";

const ALL = "A-01,A-02,A-07,A-08,A-10";
const apply = (sb, d, steps, extra = []) => cli(sb, ["apply", d, "--steps", steps, "--tool", "claude", "--hooks", "brief", "--autosave", "off", ...extra]);

// A repo that keeps its notes in 00-home/ at the root, not in docs/00-home/.
const homeRepo = (sb) => repo(sb, "notes", { files: { "00-home/current.md": "# Current\n", "00-home/log.md": "# Log\n", "00-home/open-questions.md": "# Questions\n" } });

test("audit plans new files next to the ones the repo already has", sandboxed((sb) => {
  const d = homeRepo(sb);
  const r = cli(sb, ["audit", d]);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /00-home[\\/]board\.md/);
  assert.match(r.out, /00-home[\\/]people\.md/);
  assert.doesNotMatch(r.out, /docs[\\/]00-home[\\/]board\.md/);
}));

test("apply without --apply is a dry run and writes nothing", sandboxed((sb) => {
  const d = homeRepo(sb);
  const before = tree(d);
  const r = apply(sb, d, ALL);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /Dry run/);
  assert.deepEqual(tree(d), before);
}));

test("new files land beside their siblings and are recorded in playbook.json", sandboxed((sb) => {
  const d = homeRepo(sb);
  const r = apply(sb, d, ALL, ["--apply"]);
  assert.equal(r.status, 0, r.out);
  assert.ok(has(d, "00-home/board.md") && has(d, "00-home/people.md"));
  assert.ok(!has(d, "docs"), "no second home folder is created");
  const pj = json(d, "playbook.json");
  assert.equal(pj.paths.board, "00-home/board.md");
  assert.equal(pj.paths.current, "00-home/current.md");
  assert.ok(pj.autosaveAllow.includes("00-home/board.md"), "autosave may commit the new file");
  assert.ok(pj.required.includes("00-home/people.md"));
  assert.equal(script(sb, d, "check.mjs").status, 0, "the repo's own checks pass");
}));

test("applying everything never creates a duplicate set of starter files", sandboxed((sb) => {
  const d = homeRepo(sb);
  const r = cli(sb, ["apply", d, "--tool", "claude", "--hooks", "brief", "--autosave", "off", "--apply"]);
  assert.equal(r.status, 0, r.out);
  assert.ok(!has(d, "docs/00-home/current.md") && !has(d, "docs/00-home/log.md"));
}));

test("existing files are never overwritten", sandboxed((sb) => {
  const d = homeRepo(sb);
  assert.equal(apply(sb, d, ALL, ["--apply"]).status, 0);
  assert.equal(read(d, "00-home/current.md"), "# Current\n");
  assert.equal(read(d, "00-home/log.md"), "# Log\n");
}));

test("a repo with only STATUS.md gets the board at the default place and passes its checks", sandboxed((sb) => {
  const d = repo(sb, "s", { files: { "STATUS.md": "# Status\n" } });
  assert.equal(apply(sb, d, "A-01,A-02,A-10", ["--apply"]).status, 0);
  assert.ok(has(d, "docs/00-home/board.md"));
  assert.equal(json(d, "playbook.json").paths.current, "STATUS.md");
  assert.equal(script(sb, d, "check.mjs").status, 0);
}));

test("a file added in a later run is recorded in playbook.json too", sandboxed((sb) => {
  const d = repo(sb, "later", { files: { "00-home/current.md": "# Current\n" } });
  assert.equal(apply(sb, d, "A-01,A-10", ["--apply"]).status, 0);
  assert.equal(json(d, "playbook.json").paths.board, undefined);
  assert.equal(apply(sb, d, "A-02", ["--apply"]).status, 0);
  const pj = json(d, "playbook.json");
  assert.equal(pj.paths.board, "00-home/board.md");
  assert.ok(pj.required.includes("00-home/board.md"));
  assert.equal(script(sb, d, "check.mjs").status, 0);
}));

test("a board with no current view still passes its checks", sandboxed((sb) => {
  const d = repo(sb, "b");
  assert.equal(apply(sb, d, "A-01,A-10", ["--apply"]).status, 0);
  assert.equal(apply(sb, d, "A-02", ["--apply"]).status, 0);
  assert.ok(!has(d, "docs/00-home/current.md"));
  assert.equal(script(sb, d, "check.mjs").status, 0);
}));

test("applying only some steps leaves no broken links in the new files", sandboxed((sb) => {
  const d = repo(sb, "partial");
  assert.equal(apply(sb, d, "A-01,A-02,A-03,A-10", ["--apply"]).status, 0);
  assert.ok(has(d, "docs/00-home/current.md") && !has(d, "docs/00-home/log.md"));
  const r = script(sb, d, "check.mjs");
  assert.equal(r.status, 0, r.out);
}));

test("undo of a later run restores playbook.json and removes the new file", sandboxed((sb) => {
  const d = repo(sb, "u", { files: { "00-home/current.md": "# Current\n" } });
  assert.equal(apply(sb, d, "A-01,A-10", ["--apply"]).status, 0);
  assert.equal(apply(sb, d, "A-02", ["--apply"]).status, 0);
  assert.ok(has(d, "00-home/board.md"));
  assert.equal(cli(sb, ["undo", d, "--apply"]).status, 0);
  assert.ok(!has(d, "00-home/board.md"));
  assert.equal(json(d, "playbook.json").paths.board, undefined);
}));

test("undo leaves a file alone when the user has edited it since", sandboxed((sb) => {
  const d = repo(sb, "u");
  assert.equal(apply(sb, d, "A-02", ["--apply"]).status, 0);
  write(d, "docs/00-home/board.md", "my own edits, made after the apply\n");
  cli(sb, ["undo", d, "--apply"]);
  assert.equal(read(d, "docs/00-home/board.md"), "my own edits, made after the apply\n");
}));

test("a step the tool cannot do on its own is listed, not done", sandboxed((sb) => {
  const d = repo(sb, "m", { files: { "CLAUDE.md": "Some rules.\n" } });
  const before = tree(d);
  const r = apply(sb, d, "D-09", ["--apply"]);
  assert.equal(r.status, 0, r.out);
  assert.deepEqual(tree(d).filter((f) => !f.startsWith(".playbook/")), before);
}));
