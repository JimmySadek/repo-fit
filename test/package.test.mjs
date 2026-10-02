// The two install routes: `npx skills add JimmySadek/repo-fit` (needs a valid SKILL.md at the root)
// and `npx repo-fit` (needs package.json to match VERSION and ship every folder the CLI reads).
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { ROOT } from "./helpers.mjs";

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
