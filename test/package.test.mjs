// The two install routes: `npx skills add JimmySadek/repo-fit` (needs a valid SKILL.md at the root)
// and `npx repo-fit` (needs package.json to match VERSION and ship every folder the CLI reads).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { ROOT, git, repo, sandboxed, write } from "./helpers.mjs";

test("SKILL.md sits at the root with a front matter the skills installer accepts", () => {
  const t = readFileSync(join(ROOT, "SKILL.md"), "utf8").replace(/\r\n?/g, "\n");
  const fm = t.match(/^---\n([\s\S]*?)\n---\n/)?.[1];
  assert.ok(fm, "front matter block");
  assert.match(fm, /^name: repo-fit$/m);
  // A one-line description containing ": " is invalid YAML and the installer skips the skill. Use a block (>-) instead.
  const line = fm.match(/^description:(.*)$/m)?.[1].trim();
  assert.ok(line === ">-" || line === ">" || (line && !line.includes(": ")), `description must be a block or have no ": " (got "${line}")`);
});

test("package.json matches VERSION and ships what the CLI reads at run time", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  assert.equal(pkg.name, "repo-fit");
  assert.equal(pkg.version, readFileSync(join(ROOT, "VERSION"), "utf8").trim(), "bump package.json with VERSION");
  assert.equal(pkg.bin["repo-fit"], "bin/repo-fit.mjs");
  assert.match(readFileSync(join(ROOT, pkg.bin["repo-fit"]), "utf8"), /^#!\/usr\/bin\/env node/);
  for (const need of ["bin/", "lib/", "scripts/", "kits/", "core/", "guidance/", "VERSION", "SKILL.md", "INSTALL.md"]) {
    assert.ok(pkg.files.includes(need), `files must include ${need}`);
    assert.ok(existsSync(join(ROOT, need)), `${need} exists`);
  }
});

test("a new version on main publishes itself to npm, and only a new one", () => {
  const w = readFileSync(join(ROOT, ".github/workflows/publish.yml"), "utf8");
  assert.match(w, /branches: \[main\]/);
  assert.match(w, /id-token: write/, "npm trusted publishing needs an OIDC token");
  assert.match(w, /npm view "repo-fit@\$v" version/, "a version already on npm is skipped");
  assert.match(w, /run: node --test[\s\S]*run: npm publish/, "tests run before publishing");
  assert.doesNotMatch(w, /NPM_TOKEN|NODE_AUTH_TOKEN/, "no stored token");
});

// The release (`gh release create`) makes its tag right after the merge, while this workflow is still testing and
// publishing. The tag step must then leave the tag alone and stay green, also when the tag is on another commit.
test("the publish workflow's tag step makes the tag once and stays green when the release made it first", { skip: process.platform === "win32" }, sandboxed((sb) => {
  const w = readFileSync(join(ROOT, ".github/workflows/publish.yml"), "utf8").replace(/\r\n?/g, "\n").split("\n");
  const at = w.findIndex((l) => /^\s*- name: Tag the release\s*$/.test(l));
  assert.ok(at >= 0, "a step named Tag the release");
  const run = w.findIndex((l, i) => i > at && /^\s*run: \|\s*$/.test(l));
  const ind = w[run].match(/^\s*/)[0].length;
  const body = [];
  for (let i = run + 1; i < w.length && (w[i].trim() === "" || w[i].match(/^\s*/)[0].length > ind); i++) body.push(w[i]);
  const sh = body.join("\n").replace(/\$\{\{\s*steps\.check\.outputs\.version\s*\}\}/g, "1.0.0");

  const origin = join(sb.dir, "origin.git");
  git(sb, sb.dir, ["init", "-q", "--bare", origin]);
  const d = repo(sb, "work", { files: { "VERSION": "1.0.0\n" }, commit: true });
  git(sb, d, ["commit", "-q", "--allow-empty", "-m", "second"]);
  git(sb, d, ["remote", "add", "origin", origin]);
  assert.equal(git(sb, d, ["push", "-q", "origin", "HEAD:main"]).status, 0);
  const head = git(sb, d, ["rev-parse", "HEAD"]).stdout.trim();
  const older = git(sb, d, ["rev-parse", "HEAD~1"]).stdout.trim();
  const remoteTag = () => git(sb, d, ["ls-remote", "--tags", "origin", "refs/tags/v1.0.0"]).stdout.split(/\s/)[0];
  const step = () => {
    git(sb, d, ["tag", "-d", "v1.0.0"]); // a fresh checkout has no tags
    return spawnSync("bash", ["-e", "-c", sh], { cwd: d, env: { ...sb.env, V: "1.0.0" }, encoding: "utf8" });
  };

  let r = step();
  assert.equal(r.status, 0, `no tag yet: ${r.stderr}`);
  assert.equal(remoteTag(), head, "the tag is made on the published commit");

  r = step();
  assert.equal(r.status, 0, `the release made the same tag first: ${r.stderr}`);
  assert.doesNotMatch(r.stdout, /::warning::/, "the same commit needs no warning");

  git(sb, d, ["push", "-q", "-f", "origin", `${older}:refs/tags/v1.0.0`]);
  r = step();
  assert.equal(r.status, 0, `the release made the tag on another commit: ${r.stderr}`);
  assert.equal(remoteTag(), older, "a tag that is already there is never moved");
  assert.match(r.stdout, /::warning::Tag v1\.0\.0 points at /, "a tag on another commit is named in the run");

  // The race: no tag when the step looks, but the release makes it on another commit just before the push.
  git(sb, origin, ["update-ref", "-d", "refs/tags/v1.0.0"]);
  write(d, ".git/hooks/pre-push", `#!/bin/sh\ngit --git-dir="${origin}" update-ref refs/tags/v1.0.0 ${older}\n`);
  chmodSync(join(d, ".git/hooks/pre-push"), 0o755);
  r = step();
  assert.equal(r.status, 0, `the release made the tag during the push: ${r.stderr}`);
  assert.equal(remoteTag(), older, "the tag the release made is never moved");
}));
