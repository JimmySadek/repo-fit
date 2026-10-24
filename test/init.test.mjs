import assert from "node:assert/strict";
import { test } from "node:test";
import { cli, git, has, json, read, repo, sandboxed, script, tree, write } from "./helpers.mjs";

test("init builds a working foundation in a new repo", sandboxed((sb) => {
  const d = repo(sb, "new");
  const r = cli(sb, ["init", d, "--tool", "claude", "--name", "Demo", "--owner", "Sam", "--autosave", "off"]);
  assert.equal(r.status, 0, r.out);
  for (const f of ["AGENTS.md", "CLAUDE.md", "playbook.json", "LEARNINGS.md", "docs/00-home/board.md", "docs/00-home/current.md", "scripts/playbook/check.mjs", ".claude/settings.json"]) {
    assert.ok(has(d, f), `${f} should exist`);
  }
  assert.match(read(d, "CLAUDE.md"), /@AGENTS\.md/, "CLAUDE.md imports AGENTS.md");
  assert.equal(script(sb, d, "check.mjs").status, 0, "the repo's own checks pass");
  const s = cli(sb, ["status", d]);
  assert.equal(s.status, 0, s.out);
  assert.match(s.out, /Up to date/);
}));

test("init --dry-run writes nothing", sandboxed((sb) => {
  const d = repo(sb, "new");
  const before = tree(d);
  const r = cli(sb, ["init", d, "--tool", "both", "--dry-run"]);
  assert.equal(r.status, 0, r.out);
  assert.deepEqual(tree(d), before);
}));

test("init never overwrites a file that exists", sandboxed((sb) => {
  const d = repo(sb, "new", { files: { "AGENTS.md": "my own rules\n", "docs/00-home/board.md": "my own board\n" } });
  write(d, "README.md", "my own readme\n");
  const r = cli(sb, ["init", d, "--tool", "claude"]);
  assert.equal(r.status, 0, r.out);
  assert.equal(read(d, "README.md"), "my own readme\n");
  assert.equal(read(d, "AGENTS.md"), "my own rules\n");
  assert.equal(read(d, "docs/00-home/board.md"), "my own board\n");
}));

test("undo after init puts the repo back", sandboxed((sb) => {
  const d = repo(sb, "new");
  const before = tree(d);
  assert.equal(cli(sb, ["init", d, "--tool", "claude"]).status, 0);
  assert.ok(has(d, "AGENTS.md"));
  const u = cli(sb, ["undo", d, "--apply"]);
  assert.equal(u.status, 0, u.out);
  assert.ok(!has(d, "AGENTS.md") && !has(d, "docs/00-home/board.md") && !has(d, "playbook.json"));
  assert.ok(has(d, "README.md"));
  assert.deepEqual(tree(d).filter((f) => !f.startsWith(".playbook/")), before);
}));

// Who is named as owner: --owner, then a saved preference, then git user.name, then the word "Owner".
const ownerOf = (d) => json(d, "playbook.json").recorders.at(-1);

test("owner: git user.name is used when nothing else is set", sandboxed((sb) => {
  const d = repo(sb, "a");
  assert.equal(cli(sb, ["init", d, "--tool", "claude"]).status, 0);
  assert.equal(ownerOf(d), "Test Person");
  assert.match(read(d, "docs/00-home/people.md"), /Test Person/);
}));

test("owner: falls back to the plain word Owner", sandboxed((sb) => {
  const d = repo(sb, "a");
  git(sb, d, ["config", "--unset", "user.name"]);
  assert.equal(cli(sb, ["init", d, "--tool", "claude"]).status, 0);
  assert.equal(ownerOf(d), "Owner");
}));

test("owner: a saved preference beats git user.name, and --owner beats both", sandboxed((sb) => {
  assert.equal(cli(sb, ["prefs", "set", "owner", "Pref Owner"]).status, 0);
  const a = repo(sb, "a");
  assert.equal(cli(sb, ["init", a, "--tool", "claude"]).status, 0);
  assert.equal(ownerOf(a), "Pref Owner");
  const b = repo(sb, "b");
  assert.equal(cli(sb, ["init", b, "--tool", "claude", "--owner", "Flag Owner"]).status, 0);
  assert.equal(ownerOf(b), "Flag Owner");
  assert.match(read(b, "docs/00-home/board.md"), /Flag Owner/);
}));

test("status notices drift and update fixes it", sandboxed((sb) => {
  const d = repo(sb, "a");
  assert.equal(cli(sb, ["init", d, "--tool", "claude"]).status, 0);
  write(d, "scripts/playbook/lib.mjs", `${read(d, "scripts/playbook/lib.mjs")}\n// a local edit\n`);
  const behind = cli(sb, ["status", d]);
  assert.equal(behind.status, 1);
  assert.match(behind.out, /Behind/);
  const dry = cli(sb, ["update", d]);
  assert.equal(dry.status, 0);
  assert.match(read(d, "scripts/playbook/lib.mjs"), /a local edit/, "a dry run changes nothing");
  assert.equal(cli(sb, ["update", d, "--apply"]).status, 0);
  assert.equal(cli(sb, ["status", d]).status, 0);
}));

test("the repo's own check catches a broken link", sandboxed((sb) => {
  const d = repo(sb, "a");
  assert.equal(cli(sb, ["init", d, "--tool", "claude"]).status, 0);
  write(d, "docs/00-home/current.md", "# Current\n\nSee [nothing](does-not-exist.md).\n");
  const r = script(sb, d, "check.mjs");
  assert.equal(r.status, 1);
  assert.match(r.out, /broken link/);
}));

// Claude Code reads CLAUDE.md on every version; a thin one that imports AGENTS.md costs nothing, so no tool choice leaves it out.
test("init with --tool codex still adds a CLAUDE.md that imports AGENTS.md, without Claude hooks", sandboxed((sb) => {
  const d = repo(sb, "new");
  const r = cli(sb, ["init", d, "--tool", "codex"]);
  assert.equal(r.status, 0, r.out);
  assert.match(read(d, "CLAUDE.md"), /@AGENTS\.md/);
  assert.ok(!has(d, ".claude/settings.json"), "no Claude hooks for a Codex-only setup");
}));

test("adding AGENTS.md (A-11) adds CLAUDE.md with it, also without A-10 and for Codex only", sandboxed((sb) => {
  for (const tool of ["codex", "claude"]) {
    const d = repo(sb, `a11-${tool}`, { commit: true });
    const r = cli(sb, ["apply", d, "--steps", "A-11", "--tool", tool, "--hooks", "none", "--autosave", "off", "--apply"]);
    assert.equal(r.status, 0, r.out);
    assert.ok(has(d, "AGENTS.md"));
    assert.match(read(d, "CLAUDE.md"), /@AGENTS\.md/, `${tool}: CLAUDE.md imports the new AGENTS.md`);
  }
}));

test("A-10 with --tool codex adds the missing CLAUDE.md next to an AGENTS.md that exists", sandboxed((sb) => {
  const d = repo(sb, "codex-only", { commit: true, files: { "AGENTS.md": "# Rules\n\nBe kind.\n" } });
  const r = cli(sb, ["apply", d, "--steps", "A-10", "--tool", "codex", "--hooks", "none", "--autosave", "off", "--apply"]);
  assert.equal(r.status, 0, r.out);
  assert.match(read(d, "CLAUDE.md"), /@AGENTS\.md/);
  assert.equal(read(d, "AGENTS.md"), "# Rules\n\nBe kind.\n");
}));
