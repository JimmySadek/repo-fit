import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { ROOT, cli, git, repo, sandboxed } from "./helpers.mjs";

const SKIP = new Set([".git", "node_modules", "claudedocs", "test"]);
function files(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...files(p));
    else out.push(p);
  }
  return out;
}

test("every script compiles", () => {
  const list = [join(ROOT, "bin", "repo-fit.mjs"), ...files(join(ROOT, "lib")), ...files(join(ROOT, "scripts"))].filter((f) => f.endsWith(".mjs"));
  assert.ok(list.length >= 10, "expected to find the scripts");
  for (const f of list) {
    const r = spawnSync(process.execPath, ["--check", f], { encoding: "utf8" });
    assert.equal(r.status, 0, `${f}: ${r.stderr}`);
  }
});

test("help prints the version from the VERSION file", sandboxed((sb) => {
  const version = readFileSync(join(ROOT, "VERSION"), "utf8").trim();
  const r = cli(sb, ["help"]);
  assert.equal(r.status, 0, r.out);
  assert.ok(r.stdout.includes(`repo-fit ${version}`), r.stdout.slice(0, 120));
}));

test("no personal names or machine paths in the code, templates or guidance", () => {
  // Built from pieces so this file does not match its own patterns.
  const bad = new RegExp([`Jim${"my"}`, `gam${"al"}`, `/Us${"ers"}/`].join("|"), "i");
  for (const dir of ["bin", "lib", "scripts", "kits", "core", "skill", "guidance"]) {
    for (const f of files(join(ROOT, dir))) {
      assert.doesNotMatch(readFileSync(f, "utf8"), bad, `${f} contains a personal name or a machine path`);
    }
  }
});

test("no secret-looking strings anywhere in the repo", () => {
  const re = /ghp_[A-Za-z0-9]{20,}|gho_[A-Za-z0-9]{20,}|glpat-[A-Za-z0-9_-]{15,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-[0-9A-Za-z]|-----BEGIN [A-Z ]*PRIVATE KEY-----/;
  for (const f of files(ROOT)) assert.doesNotMatch(readFileSync(f, "utf8"), re, `${f} looks like it holds a secret`);
});

test("detect --json describes a repo", sandboxed((sb) => {
  const d = repo(sb, "r", { commit: true });
  const r = cli(sb, ["detect", d, "--json"]);
  assert.equal(r.status, 0, r.out);
  const j = JSON.parse(r.stdout);
  assert.ok(j.machine && j.repo && j.offers);
  assert.ok(j.repo.git);
  assert.ok(["notes", "mixed", "technical"].includes(j.repo.kind.value));
}));

test("a token inside a remote URL never appears in detect or audit output", sandboxed((sb) => {
  const d = repo(sb, "r", { commit: true });
  git(sb, d, ["remote", "add", "origin", "https://someone:tok3n-value-123@github.com/o/r.git"]);
  for (const cmd of [["detect", d, "--json"], ["detect", d], ["audit", d]]) {
    const r = cli(sb, cmd);
    assert.equal(r.status, 0, r.out);
    assert.ok(!r.out.includes("tok3n-value-123"), `${cmd[0]} leaked the token`);
  }
}));

test("connect says so when the repo already has a remote", sandboxed((sb) => {
  const d = repo(sb, "r", { commit: true });
  git(sb, d, ["remote", "add", "origin", "https://github.com/o/r.git"]);
  const r = cli(sb, ["connect", d]);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /Already connected/);
}));

test("tools --json runs offline", sandboxed((sb) => {
  const d = repo(sb, "r", { commit: true });
  const r = cli(sb, ["tools", d, "--offline", "--json"]);
  assert.equal(r.status, 0, r.out);
  assert.ok(JSON.parse(r.stdout).claude);
}));
