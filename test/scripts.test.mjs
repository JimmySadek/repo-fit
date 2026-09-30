// The scripts that are copied into a repo and run by hooks: the session brief and autosave.
import assert from "node:assert/strict";
import { test } from "node:test";
import { cli, git, has, json, read, repo, sandboxed, script, write } from "./helpers.mjs";

// A repo set up with autosave on, everything committed on main, so later changes are the only changes.
function ready(sb) {
  const d = repo(sb, "r");
  assert.equal(cli(sb, ["init", d, "--tool", "claude", "--autosave", "on"]).status, 0);
  git(sb, d, ["add", "-A"]);
  assert.equal(git(sb, d, ["commit", "-q", "-m", "set up"]).status, 0);
  return d;
}
const stop = (sb, d, input) => script(sb, d, "autosave.mjs", ["--event", "stop", "--host", "Test Host"], { input: JSON.stringify(input) });
const head = (sb, d, ref) => git(sb, d, ["rev-parse", ref]).stdout.trim();

test("the session brief hook prints valid JSON for Claude Code", sandboxed((sb) => {
  const d = ready(sb);
  const r = script(sb, d, "brief.mjs", ["--hook"]);
  assert.equal(r.status, 0, r.out);
  const j = JSON.parse(r.stdout);
  assert.ok(j.systemMessage);
  assert.equal(j.hookSpecificOutput.hookEventName, "SessionStart");
  assert.ok(j.hookSpecificOutput.additionalContext);
}));

test("autosave moves off a protected branch and commits only allow-listed files", sandboxed((sb) => {
  const d = ready(sb);
  const mainBefore = head(sb, d, "main");
  write(d, "docs/00-home/log.md", `${read(d, "docs/00-home/log.md")}\n- a change worth saving\n`);
  const r = stop(sb, d, { session_id: "s1" });
  assert.equal(r.status, 0, r.out);
  assert.match(JSON.parse(r.stdout).systemMessage, /Autosaved 1 file/);
  const branch = git(sb, d, ["branch", "--show-current"]).stdout.trim();
  assert.match(branch, /^wip\/\d{4}-\d{2}-\d{2}-test-host$/);
  assert.equal(head(sb, d, "main"), mainBefore, "main is untouched");
  const msg = git(sb, d, ["log", "-1", "--format=%B"]).stdout;
  assert.match(msg, /Host: Test Host/);
}));

test("autosave skips secret-looking files and leaves other files uncommitted", sandboxed((sb) => {
  const d = ready(sb);
  write(d, "docs/notes.md", "worth saving\n");
  write(d, "docs/server.pem", "not a real key\n");
  write(d, "scratch.txt", "outside the allow-list\n");
  stop(sb, d, { session_id: "s1" });
  const saved = git(sb, d, ["show", "--name-only", "--format=", "HEAD"]).stdout;
  assert.match(saved, /docs\/notes\.md/);
  assert.doesNotMatch(saved, /server\.pem/);
  assert.doesNotMatch(saved, /scratch\.txt/);
  const left = git(sb, d, ["status", "--porcelain"]).stdout;
  assert.match(left, /server\.pem/);
  assert.match(left, /scratch\.txt/);
}));

test("the Stop hook blocks once per session for the same leftovers, then stays quiet", sandboxed((sb) => {
  const d = ready(sb);
  write(d, "scratch.txt", "outside the allow-list\n");
  const first = stop(sb, d, { session_id: "s1" });
  assert.equal(first.status, 0, first.out);
  const block = JSON.parse(first.stdout);
  assert.equal(block.decision, "block");
  assert.match(block.reason, /scratch\.txt/);
  assert.ok(has(d, ".git/playbook-state.json"), "the guard remembers the session");
  assert.equal(stop(sb, d, { session_id: "s1" }).stdout.trim(), "", "same session, same leftovers: no second block");
  assert.equal(JSON.parse(stop(sb, d, { session_id: "s2" }).stdout).decision, "block", "a new session is reminded once");
}));

test("the Stop hook does nothing when the app says the turn already continued", sandboxed((sb) => {
  const d = ready(sb);
  write(d, "scratch.txt", "outside the allow-list\n");
  const r = stop(sb, d, { session_id: "s9", stop_hook_active: true });
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), "");
}));

test("the Stop hook stays quiet when nothing is left over", sandboxed((sb) => {
  const d = ready(sb);
  const r = stop(sb, d, { session_id: "s1" });
  assert.equal(r.status, 0, r.out);
  assert.equal(r.stdout.trim(), "");
  assert.equal(json(d, "playbook.json").autosave, true);
}));

test("PreCompact saves allow-listed changes without blocking anything", sandboxed((sb) => {
  const d = ready(sb);
  write(d, "docs/00-home/log.md", `${read(d, "docs/00-home/log.md")}\n- saved before a compact\n`);
  write(d, "scratch.txt", "outside the allow-list\n");
  const r = script(sb, d, "autosave.mjs", ["--event", "precompact", "--host", "Test Host"], { input: JSON.stringify({ session_id: "s1" }) });
  assert.equal(r.status, 0, r.out);
  assert.doesNotMatch(r.stdout, /"decision"/);
  assert.match(JSON.parse(r.stdout).systemMessage, /Autosaved 1 file/);
}));

test("autosave never commits when it is switched off", sandboxed((sb) => {
  const d = repo(sb, "off");
  assert.equal(cli(sb, ["init", d, "--tool", "claude", "--autosave", "off"]).status, 0);
  git(sb, d, ["add", "-A"]);
  git(sb, d, ["commit", "-q", "-m", "set up"]);
  const before = head(sb, d, "HEAD");
  write(d, "docs/00-home/log.md", `${read(d, "docs/00-home/log.md")}\n- not to be saved\n`);
  stop(sb, d, { session_id: "s1" });
  assert.equal(head(sb, d, "HEAD"), before);
  assert.equal(git(sb, d, ["branch", "--show-current"]).stdout.trim(), "main");
}));
