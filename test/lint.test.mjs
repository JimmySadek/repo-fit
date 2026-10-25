// The scripts copied into every repo stay lint-clean: a person's own linter runs over them too. A small check with no
// dependencies, for the mistakes a linter would flag there: unused imports, a useless `?? {}` in an object spread, a
// useless copy before `.slice()`, and a regex that only tests how a text starts or ends.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { ROOT } from "./helpers.mjs";

const DIR = join(ROOT, "scripts/playbook");
const scripts = readdirSync(DIR).filter((f) => f.endsWith(".mjs"));
const lineOf = (text, i) => text.slice(0, i).split("\n").length;

function problems(file, text = readFileSync(join(DIR, file), "utf8")) {
  const out = [];
  // Unused named imports.
  for (const m of text.matchAll(/^import\s*\{([^}]*)\}\s*from\s*["'][^"']+["'];?$/gm)) {
    const rest = text.slice(0, m.index) + text.slice(m.index + m[0].length);
    for (const part of m[1].split(",").map((s) => s.trim()).filter(Boolean)) {
      const local = part.split(/\s+as\s+/).pop();
      if (!new RegExp(`(?<![\\w$])(?<![^.]\\.)${local.replace(/\$/g, "\\$")}(?![\\w$])`).test(rest)) out.push(`${file}:${lineOf(text, m.index)} unused import ${local}`);
    }
  }
  // `{ ...(x ?? {}) }`: spreading undefined into an object is already a no-op.
  for (const m of text.matchAll(/\.\.\.\(\s*[\w$.?]+\s*\?\?\s*\{\s*\}\s*\)/g)) out.push(`${file}:${lineOf(text, m.index)} useless "?? {}" in a spread`);
  // `[...x.slice(...)]`: slice already returns a new array.
  for (const m of text.matchAll(/\[\.\.\.[\w$.]+\.slice\(/g)) out.push(`${file}:${lineOf(text, m.index)} useless spread of .slice()`);
  // `/^abc/.test(s)` or `/abc$/.test(s)`: startsWith or endsWith says it plainly.
  for (const m of text.matchAll(/\/((?:\\.|[^/\\\n])+)\/\.test\(/g)) {
    const body = m[1];
    const start = body.startsWith("^");
    const end = body.endsWith("$") && !body.endsWith("\\$");
    if (start === end) continue;
    const core = body.slice(start ? 1 : 0, end ? -1 : undefined);
    if (/^(?:\\[^A-Za-z0-9]|[^\\.*+?()[\]{}|^$])+$/.test(core)) out.push(`${file}:${lineOf(text, m.index)} use ${start ? "startsWith" : "endsWith"} instead of a regex`);
  }
  return out;
}

test("the scripts copied into every repo are lint-clean", () => {
  assert.ok(scripts.length >= 5);
  assert.deepEqual(scripts.flatMap((f) => problems(f)), []);
});

test("the lint check finds each kind of problem it looks for", () => {
  const sample = 'import { used, spread, unused } from "x";\nused(...spread);\nconst a = { ...(b ?? {}) };\nconst c = [...d.slice(1)];\n/\\/$/.test(e);\n/^x[0-9]/.test(f);\n/^#/.test(g);\n';
  assert.deepEqual(problems("sample", sample), [
    "sample:1 unused import unused",
    'sample:3 useless "?? {}" in a spread',
    "sample:4 useless spread of .slice()",
    "sample:5 use endsWith instead of a regex",
    "sample:7 use startsWith instead of a regex",
  ]);
});
