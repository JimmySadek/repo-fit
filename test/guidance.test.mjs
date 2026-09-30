import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { ROOT, cli, has, repo, sandboxed } from "./helpers.mjs";

// Found by CI on Windows: Git there checks files out with \r\n line endings, and the dates in the guidance files read as missing.
test("guidance check reads files that have Windows line endings", sandboxed((sb) => {
  const copy = join(sb.dir, "copy");
  cpSync(ROOT, copy, { recursive: true, filter: (src) => !/[\\/](\.git|claudedocs|test|node_modules)([\\/]|$)/.test(src) });
  for (const f of readdirSync(join(copy, "guidance")).filter((f) => f.endsWith(".md"))) {
    const p = join(copy, "guidance", f);
    writeFileSync(p, readFileSync(p, "utf8").replace(/\r?\n/g, "\r\n"));
  }
  const r = spawnSync(process.execPath, [join(copy, "bin", "repo-fit.mjs"), "guidance", "check"], { env: { ...sb.env, REPO_FIT_TODAY: retrieved }, encoding: "utf8" });
  assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
}));

// The newest `retrieved` date in the guidance files: on that day nothing can be overdue.
const dir = join(ROOT, "guidance");
const retrieved = readdirSync(dir)
  .filter((f) => f.endsWith(".md") && f !== "README.md")
  .map((f) => /^retrieved:\s*(\S+)/m.exec(readFileSync(join(dir, f), "utf8"))?.[1])
  .filter(Boolean)
  .sort()
  .pop();

test("every guidance file has dates the tool can read", () => {
  assert.match(retrieved, /^\d{4}-\d{2}-\d{2}$/);
});

test("guidance check passes on the day the guidance was retrieved", sandboxed((sb) => {
  const r = cli(sb, ["guidance", "check"], { env: { REPO_FIT_TODAY: retrieved } });
  assert.equal(r.status, 0, r.out);
}));

test("guidance check fails and says overdue once the review dates pass", sandboxed((sb) => {
  const r = cli(sb, ["guidance", "check"], { env: { REPO_FIT_TODAY: "2099-01-01" } });
  assert.equal(r.status, 1);
  assert.match(r.out, /overdue/i);
}));

test("init warns about stale guidance and still sets the repo up", sandboxed((sb) => {
  const d = repo(sb, "r");
  const r = cli(sb, ["init", d, "--tool", "claude", "--autosave", "off"], { env: { REPO_FIT_TODAY: "2099-01-01" } });
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /past its review date/);
  assert.ok(has(d, "AGENTS.md") && has(d, "playbook.json"));
}));

test("init --strict stops on stale guidance and writes nothing", sandboxed((sb) => {
  const d = repo(sb, "r");
  const r = cli(sb, ["init", d, "--tool", "claude", "--strict"], { env: { REPO_FIT_TODAY: "2099-01-01" } });
  assert.notEqual(r.status, 0);
  assert.match(r.out, /past its review date/);
  assert.ok(!has(d, "AGENTS.md") && !has(d, "playbook.json"));
}));
