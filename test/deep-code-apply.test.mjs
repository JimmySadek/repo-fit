// Deep mode, sweep 2, the plan and the apply: the assistant's code plan (.playbook/deep/code.json) waits for a recent,
// sourced best-practices note; repo-fit checks the plan, shows one screen with one yes, then applies it on a new branch
// in a separate working copy, one commit per step. Each step is proven by the repo's own commands that passed before
// the first step, and by no new import loop. Moves fix the relative imports that point at the moved files. A step that
// fails its proof is taken back; later steps still run. A deliberate break first shows whether the tests notice
// anything. The person's folder, branch, files and installed packages never change. Synthetic fixtures only.
import assert from "node:assert/strict";
import { chmodSync, existsSync, readFileSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { makeFixture } from "../dev/fixtures.mjs";
import { analyze, importSites } from "../lib/analyze.mjs";
import { cssNorm, planned } from "../lib/deep.mjs";
import { cli, git, read, sandboxed, write } from "./helpers.mjs";

const ME = { REPO_FIT_TODAY: "2026-10-25", GIT_AUTHOR_NAME: "Test Person", GIT_AUTHOR_EMAIL: "test@example.com", GIT_COMMITTER_NAME: "Test Person", GIT_COMMITTER_EMAIL: "test@example.com" };
const deep = (sb, dir, extra = [], env = {}) => cli(sb, ["deep", dir, "--sweep", "code", ...extra], { env: { ...ME, ...env } });
const state = (sb, dir) => [git(sb, dir, ["rev-parse", "HEAD"]).stdout, git(sb, dir, ["status", "--porcelain", "--ignored"]).stdout, git(sb, dir, ["worktree", "list"]).stdout.split("\n").length];
const NOTE_PATH = "docs/research/2026-10-24-web-app-structure.md";
const NOTE = "# Web app structure\n\nDate: 2026-10-24\n\n## Rules for this repo\n\n- Group code by feature, not by kind.\n- One place for colours and spacing (design tokens).\n- Name files after what they hold.\n\n## Sources\n\n- https://vite.dev/guide/\n- https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties\n";
const TAX = "function taxFor(amount) {\n  const rate = 0.25;\n  const raw = amount * rate;\n  const cents = Math.round(raw * 100);\n  const value = cents / 100;\n  if (value < 0) return 0;\n  if (!Number.isFinite(value)) return 0;\n  return value;\n}\n";
const run = (sb, dir, code) => deep(sb, dir, ["--apply", "--plan", code]);
const codeOf = (s) => s.match(/--apply --plan (\w+)/)?.[1];
const show = (sb, dir, branch, path) => git(sb, dir, ["show", `${branch}:${path}`]).stdout;

// What an assistant would write for field-app, after the first look and the research note.
function plan(base, { renameTest = true, visible = true } = {}) {
  return {
    sweep: "code",
    base,
    research: NOTE_PATH,
    steps: [
      { title: "Remove code nothing uses", why: "nothing imports them", delete: [{ path: "src/old/legacy.js", why: "nothing imports it" }], edits: [{ path: "src/utils/helpers2.js", find: 'export const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");\n', replace: "", why: "nothing uses slugify" }] },
      {
        title: "Break the import loop",
        why: "cart and checkout import each other, and both hold the same tax code",
        add: [{ path: "src/tax.js", text: `export ${TAX}` }],
        edits: [
          { path: "src/checkout/checkout.js", find: 'import { items } from "../cart/cart.js";\n', replace: 'import { taxFor } from "../tax.js";\n' },
          { path: "src/checkout/checkout.js", find: "export const total = () => items().reduce(", replace: "export const total = (xs) => xs.reduce(" },
          { path: "src/checkout/checkout.js", find: `\n${TAX}`, replace: "" },
          { path: "src/cart/cart.js", find: 'import { total } from "../checkout/checkout.js";\n', replace: 'import { total } from "../checkout/checkout.js";\nimport { taxFor } from "../tax.js";\n' },
          { path: "src/cart/cart.js", find: "total() + taxFor(0)", replace: "total(items()) + taxFor(0)" },
          { path: "src/cart/cart.js", find: `\n${TAX}`, replace: "" },
        ],
      },
      { title: "Group code by feature", why: "the research note: group code by feature", moves: [{ from: "src/cart/cart.js", to: "src/features/cart/cart.js" }, { from: "src/checkout/checkout.js", to: "src/features/checkout/checkout.js" }] },
      {
        title: "Names that say what files hold",
        why: "NewHeader is the only header; helpers2 holds price formatting",
        moves: [{ from: "src/ui/NewHeader.js", to: "src/ui/Header.js" }, { from: "src/utils/helpers2.js", to: "src/utils/format.js" }],
        edits: renameTest ? [{ path: "test/header.test.js", find: "../src/ui/NewHeader.js", replace: "../src/ui/Header.js" }] : [],
      },
      {
        title: "One place for colours and spacing",
        why: "two near copies of the brand colours",
        visible: visible ? [{ from: "#0f776e", to: "#0f766e", why: "a near copy of the brand colour" }] : undefined,
        add: [{ path: "src/styles/tokens.css", text: ":root {\n  --brand: #0f766e;\n  --accent: #e11d48;\n  --space: 12px;\n}\n" }],
        edits: [
          { path: "src/styles/app.css", find: "body {", replace: '@import "./tokens.css";\n\nbody {' },
          { path: "src/styles/app.css", find: "body { color: #0f766e; padding: 12px; }", replace: "body { color: var(--brand); padding: var(--space); }" },
          { path: "src/styles/app.css", find: "header { background: #0f776e; margin: 12px; }", replace: "header { background: var(--brand); margin: var(--space); }" },
        ],
      },
    ],
  };
}

function setup(sb, opts) {
  const { dir } = makeFixture("field-app", sb.dir);
  write(dir, NOTE_PATH, NOTE);
  const base = git(sb, dir, ["rev-parse", "HEAD"]).stdout.trim();
  write(dir, ".playbook/deep/code.json", JSON.stringify(plan(base, opts), null, 2));
  return { dir, base };
}

test("a code plan waits for a recent, sourced best-practices note, and then shows one screen with one yes", sandboxed((sb) => {
  const { dir, base } = setup(sb);
  write(dir, NOTE_PATH, NOTE.replace(/\n- https:\/\/developer[^\n]*/, ""));
  let s = deep(sb, dir).stdout;
  assert.match(s, /❌ The plan cannot be used yet/, s);
  assert.match(s, /docs\/research\/2026-10-24-web-app-structure\.md cites 1 source; it needs 2 or more/);
  assert.doesNotMatch(s, /--apply --plan/);
  write(dir, NOTE_PATH, NOTE);
  const before = state(sb, dir);
  s = deep(sb, dir).stdout;
  assert.doesNotMatch(s, /❌/, s);
  assert.match(s, /🛟 Every change goes on a new branch, `repo-fit\/deep-2026-10-25`/);
  assert.match(s, /5 steps, each one commit, each proven before the next:/);
  assert.match(s, /  1 Remove code nothing uses +tests · build\n/);
  assert.match(s, /  3 Group code by feature +tests · build · no new import loops\n/);
  assert.match(s, /  5 One place for colours and spacing +tests · build · built CSS\n/);
  assert.match(s, /Looks different on purpose\n  - #0f776e → #0f766e: a near copy of the brand colour/);
  assert.match(s, /First, a deliberate break is made and undone, to see that your tests notice it\./);
  assert.match(s, /Every change with its reason: repo-fit deep .* --sweep code --list/);
  assert.ok(codeOf(s), s);
  const list = deep(sb, dir, ["--list"]).stdout;
  assert.match(list, /  delete src\/old\/legacy\.js: nothing imports it/);
  assert.match(list, /  src\/cart\/cart\.js → src\/features\/cart\/cart\.js \(imports that point at it are fixed\)/);
  assert.match(list, /  src\/styles\/app\.css: 3 edits/);
  assert.match(list, /  adds src\/tax\.js/);
  assert.match(list, /  looks different on purpose: #0f776e → #0f766e \(a near copy of the brand colour\)/);
  assert.deepEqual(state(sb, dir), before, "showing the plan changes nothing");
  assert.equal(base, git(sb, dir, ["rev-parse", "HEAD"]).stdout.trim());
}));

test("the plan is checked: only code nothing uses is deleted, edits must find their text once, paths are today's", sandboxed((sb) => {
  const { dir, base } = setup(sb);
  const p = plan(base);
  p.steps[0].delete.push({ path: "src/cart/cart.js", why: "wrong" });
  p.steps[0].edits.push({ path: "src/main.js", find: "not in the file", replace: "x" });
  p.steps[2].moves.push({ from: "src/ui/Gone.js", to: "src/ui/Here.js" });
  p.steps[4].add.push({ path: "src/main.js", text: "x" });
  write(dir, ".playbook/deep/code.json", JSON.stringify(p));
  const s = deep(sb, dir).stdout;
  assert.match(s, /src\/cart\/cart\.js: only code nothing uses is deleted, and something imports this file/, s);
  assert.match(s, /src\/main\.js: the text to change is not in it \("not in the file"\)/);
  assert.match(s, /src\/ui\/Gone\.js: not in your last commit/);
  assert.match(s, /src\/main\.js: already there, so it cannot be added/);
  assert.doesNotMatch(s, /--apply --plan/);
}));

test("after the yes: each step on its own commit in a separate copy, imports fixed after moves, the note committed, the folder as it was", sandboxed((sb) => {
  const { dir } = setup(sb);
  const before = state(sb, dir);
  const code = codeOf(deep(sb, dir).stdout);
  const r = run(sb, dir, code);
  assert.equal(r.status, 0, r.out);
  const s = r.stdout;
  assert.match(s, /Your tests noticed a deliberate break in src\/[\w/]+\.js, so they can prove each step\./, s);
  assert.match(s, /  ✅ 0 Best practices for this repo +\w{7}  docs\/research\/2026-10-24-web-app-structure\.md/);
  assert.match(s, /  ✅ 1 Remove code nothing uses +\w{7}  tests 2 ✔ · build ✔/);
  assert.match(s, /  ✅ 2 Break the import loop +\w{7}  tests 2 ✔ · build ✔ · no new import loops \(1 fewer\)/);
  assert.match(s, /  ✅ 3 Group code by feature +\w{7}  tests 2 ✔ · build ✔ · no new import loops/);
  assert.match(s, /  ✅ 5 One place for colours and spacing +\w{7}  tests 2 ✔ · build ✔ · built CSS the same, apart from 1 planned change\n/);
  assert.match(s, /✅ Deep sweep 2 is done on branch `repo-fit\/deep-2026-10-25`\. This folder, its branch `main` and your files are as they were\./);
  assert.deepEqual(state(sb, dir), before, "the folder, its branch and its files are as they were; no working copy is left");
  const b = "repo-fit/deep-2026-10-25";
  assert.match(show(sb, dir, b, "src/main.js"), /from "\.\/features\/cart\/cart\.js";\nimport \{ header \} from "\.\/ui\/Header\.js";\nimport \{ formatPrice \} from "\.\/utils\/format\.js";/);
  assert.match(show(sb, dir, b, "test/cart.test.js"), /from "\.\.\/src\/features\/cart\/cart\.js"/);
  assert.match(show(sb, dir, b, "src/features/cart/cart.js"), /from "\.\.\/checkout\/checkout\.js";\nimport \{ taxFor \} from "\.\.\/\.\.\/tax\.js";/);
  assert.equal(git(sb, dir, ["cat-file", "-e", `${b}:src/old/legacy.js`]).status === 0, false, "unused code is deleted on the branch");
  assert.equal(show(sb, dir, b, NOTE_PATH), NOTE, "the research note is on the branch");
  const log = git(sb, dir, ["log", "--format=%s", `main..${b}`]).stdout.trim().split("\n");
  assert.equal(log.length, 6);
  // The same yes twice makes no second branch.
  assert.match(run(sb, dir, code).stdout, /already on branch `repo-fit\/deep-2026-10-25`/);
}));

test("a step that fails its proof is taken back, and later steps still run", sandboxed((sb) => {
  const { dir } = setup(sb, { renameTest: false });
  const r = run(sb, dir, codeOf(deep(sb, dir).stdout));
  assert.equal(r.status, 0, r.out);
  assert.match(r.stdout, /  ↩️ 4 Names that say what files hold: taken back, because `npm run test` failed \(it passed before the first step\)[^\n]*\. Nothing from this step is on the branch\./, r.stdout);
  assert.match(r.stdout, /  ✅ 5 One place for colours and spacing/);
  assert.match(r.stdout, /⚠️ Deep sweep 2 is partly done/);
  assert.match(show(sb, dir, "repo-fit/deep-2026-10-25", "src/main.js"), /\.\/ui\/NewHeader\.js/);
}));

test("tests that notice nothing are named, and the folder's own installed packages are put in the copy, never committed, and kept", sandboxed((sb) => {
  const { dir } = setup(sb);
  const pkg = JSON.parse(read(dir, "package.json"));
  pkg.scripts.test = "node -e \"process.exit(0)\"";
  write(dir, "package.json", `${JSON.stringify(pkg, null, 2)}\n`);
  write(dir, "node_modules/.bin/keep-me", "#!/bin/sh\n");
  chmodSync(join(dir, "node_modules/.bin/keep-me"), 0o755);
  git(sb, dir, ["add", "package.json"], ME);
  git(sb, dir, ["commit", "-q", "-m", "tests that check nothing"], ME);
  const p = JSON.parse(read(dir, ".playbook/deep/code.json"));
  p.base = git(sb, dir, ["rev-parse", "HEAD"]).stdout.trim();
  write(dir, ".playbook/deep/code.json", JSON.stringify(p));
  const r = run(sb, dir, codeOf(deep(sb, dir).stdout));
  assert.equal(r.status, 0, r.out);
  assert.match(r.stdout, /⚠️ Your tests did not notice a deliberate break in src\/[\w/]+\.js, so they prove little\. Each step is still checked by the build and the import graph\./, r.stdout);
  const files = git(sb, dir, ["ls-tree", "-r", "--name-only", "repo-fit/deep-2026-10-25"]).stdout;
  assert.doesNotMatch(files, /node_modules/, "the linked packages are never committed");
  assert.ok(existsSync(join(dir, "node_modules/.bin/keep-me")), "the folder's own packages are still there");
  assert.equal(readFileSync(join(dir, "src/main.js"), "utf8").includes("NewHeader"), true);
}));

test("a step that changes the built CSS without saying so is taken back; the comparison sees through custom properties", sandboxed((sb) => {
  const { dir } = setup(sb, { visible: false });
  const s = deep(sb, dir).stdout;
  assert.doesNotMatch(s, /Looks different on purpose/, s);
  const r = run(sb, dir, codeOf(s));
  assert.equal(r.status, 0, r.out);
  assert.match(r.stdout, /  ↩️ 5 One place for colours and spacing: taken back, because the built CSS changed \(\S*#0f776e\S* became \S*#0f766e\S*\)\. Nothing from this step is on the branch\./, r.stdout);
  assert.match(show(sb, dir, "repo-fit/deep-2026-10-25", "src/styles/app.css"), /#0f776e/);
}));

test("installed packages are cloned into the copy, so a build that writes there leaves the folder's own packages as they were; linked only where cloning is not possible", sandboxed((sb) => {
  const { dir } = setup(sb);
  write(dir, "scripts/build.mjs", `${read(dir, "scripts/build.mjs")}import { writeFileSync } from "node:fs";\nmkdirSync("node_modules/.cache", { recursive: true });\nwriteFileSync("node_modules/.cache/built", "x");\n`);
  write(dir, "node_modules/.bin/keep-me", "#!/bin/sh\n");
  git(sb, dir, ["add", "scripts/build.mjs"], ME);
  git(sb, dir, ["commit", "-q", "-m", "a build that writes a cache"], ME);
  const p = JSON.parse(read(dir, ".playbook/deep/code.json"));
  p.base = git(sb, dir, ["rev-parse", "HEAD"]).stdout.trim();
  write(dir, ".playbook/deep/code.json", JSON.stringify(p));
  const s = deep(sb, dir).stdout;
  assert.doesNotMatch(s, /linked/, s);
  const r = run(sb, dir, codeOf(s));
  assert.equal(r.status, 0, r.out);
  assert.equal(existsSync(join(dir, "node_modules/.cache")), false, "the build wrote into the clone, not into the folder's packages");
  assert.ok(existsSync(join(dir, "node_modules/.bin/keep-me")));
  git(sb, dir, ["branch", "-D", "repo-fit/deep-2026-10-25"], ME);
  const off = deep(sb, dir, [], { REPO_FIT_CLONE: "off" }).stdout;
  assert.match(off, /⚠️ Your installed packages are linked into the copy, not cloned \(cloning is not possible here\), so a command that writes there \(a build cache\) writes into your packages\./, off);
  assert.ok(existsSync(join(dir, "node_modules/.bin/keep-me")), "removing the copy never reaches into the folder");
}));

// From the slice C review: each of these failed before its fix.
const only = (sb, dir, base, steps) => write(dir, ".playbook/deep/code.json", JSON.stringify({ sweep: "code", base, research: NOTE_PATH, steps }));

test("import positions stay right after an emoji in a comment", () => {
  const code = '// 🚀 the start\nimport { a } from "./x.js";\n';
  const [im] = importSites(code);
  assert.equal(im.spec, "./x.js");
  assert.equal(code.slice(im.start, im.end), "./x.js");
});

test("the plan is checked: no file inside the installed packages, none where Git ignores it", sandboxed((sb) => {
  const { dir, base } = setup(sb);
  only(sb, dir, base, [{ title: "Bad places", add: [{ path: "node_modules/x.js", text: "x" }] }]);
  let s = deep(sb, dir).stdout;
  assert.match(s, /node_modules\/x\.js: inside the installed packages, which deep mode never changes\./, s);
  assert.doesNotMatch(s, /--apply --plan/);
  only(sb, dir, base, [{ title: "Bad places", add: [{ path: "dist/y.js", text: "y" }] }]);
  s = deep(sb, dir).stdout;
  assert.match(s, /dist\/y\.js: Git ignores this place, so the file would not be committed\./, s);
  assert.doesNotMatch(s, /--apply --plan/);
}));

test("one step can delete, move and then edit an import as the move wrote it again", sandboxed((sb) => {
  const { dir, base } = setup(sb);
  only(sb, dir, base, [{
    title: "Rename and tidy",
    delete: [{ path: "src/old/legacy.js" }],
    moves: [{ from: "src/ui/NewHeader.js", to: "src/ui/Header.js" }],
    edits: [
      { path: "test/header.test.js", find: "../src/ui/NewHeader.js", replace: "../src/ui/Header.js" },
      { path: "src/main.js", find: 'import { header } from "./ui/Header.js";', replace: 'import { header } from "./ui/Header.js"; // the only header' },
    ],
  }]);
  const s = deep(sb, dir).stdout;
  assert.doesNotMatch(s, /❌/, s);
  const r = run(sb, dir, codeOf(s));
  assert.match(r.stdout, /  ✅ 1 Rename and tidy +\w{7}  tests 2 ✔ · build ✔ · no new import loops\n/, r.stdout);
  assert.match(show(sb, dir, "repo-fit/deep-2026-10-25", "src/main.js"), /"\.\/ui\/Header\.js"; \/\/ the only header/);
}));

test("a note that cannot be committed leaves nothing behind, and the yes is tied to the note's text", sandboxed((sb) => {
  const { dir, base } = setup(sb);
  only(sb, dir, base, [{ title: "Remove code nothing uses", delete: [{ path: "src/old/legacy.js" }] }]);
  const code = codeOf(deep(sb, dir).stdout);
  write(dir, NOTE_PATH, `${NOTE}\n- One more rule.\n`);
  assert.match(run(sb, dir, code).stdout, /❌ Something in the folder or the plan changed since the plan was shown/);
  write(dir, ".git/hooks/commit-msg", '#!/bin/sh\ngrep -q "Best practices" "$1" && exit 1\nexit 0\n');
  chmodSync(join(dir, ".git/hooks/commit-msg"), 0o755);
  const r = run(sb, dir, codeOf(deep(sb, dir).stdout));
  assert.match(r.stdout, /  ⚠️ 0 Best practices for this repo: not committed, because the commit was stopped/, r.stdout);
  assert.match(r.stdout, /  ✅ 1 Remove code nothing uses/);
  assert.doesNotMatch(git(sb, dir, ["ls-tree", "-r", "--name-only", "repo-fit/deep-2026-10-25"]).stdout, /docs\/research/, "the note stays off the branch");
}));

// From the second slice C review.
test("the built CSS comparison: BEM names stay, a token with two values is compared as written, a planned change is a whole value, and a big data URI is quick", () => {
  assert.notEqual(cssNorm([".btn--primary:hover { color: red; }"]), cssNorm([".btn--danger:hover { color: red; }"]));
  const bem = (c) => cssNorm([`:root { --primary: ${c}; } .btn--primary:hover { color: var(--primary); }`]);
  assert.match(bem("red"), /\.btn--primary:hover/, "a class named like a token is a selector, not a token");
  assert.equal(cssNorm(["body { color: #0F766E; }"]), cssNorm([":root { --b: #0f766e; }", "body { color: var(--b); }"]));
  const theme = (light) => cssNorm([`:root { --bg: ${light}; } .dark { --bg: #000; } body { background: var(--bg); }`]);
  assert.notEqual(theme("#fff"), theme("#eee"), "a light value that changes is a change, though .dark sets the same name");
  const dark = (v) => cssNorm([`:root { --bg: #fff; } .dark { --bg: ${v}; } body { background: var(--bg); }`]);
  assert.notEqual(dark("#000"), dark("#111"), "a dark value that changes is a change too");
  assert.equal(planned("a{margin:11px;padding:1px}", [{ from: "1px", to: "2px" }]), "a{margin:11px;padding:2px}");
  const big = `@font-face { src: url(data:font/woff2;base64,${"A".repeat(400000)}); }`;
  const t = Date.now();
  cssNorm([big]);
  assert.ok(Date.now() - t < 2000, `took ${Date.now() - t} ms`);
});

test("a symlinked node_modules is linked, not cloned, and the screen says so", sandboxed((sb) => {
  const { dir } = setup(sb);
  write(sb.dir, "store/node_modules/.bin/keep-me", "#!/bin/sh\n");
  symlinkSync(join(sb.dir, "store/node_modules"), join(dir, "node_modules"));
  const s = deep(sb, dir).stdout;
  assert.match(s, /⚠️ Your installed packages are linked into the copy, not cloned/, s);
  assert.ok(existsSync(join(sb.dir, "store/node_modules/.bin/keep-me")));
}));

test("the plan is checked against the last commit, also for a document with unsaved changes", sandboxed((sb) => {
  const { dir, base } = setup(sb);
  write(dir, "README.md", `${read(dir, "README.md")}Unsaved line\n`);
  only(sb, dir, base, [{ title: "Edit the readme", edits: [{ path: "README.md", find: "Unsaved line", replace: "Saved" }] }]);
  assert.match(deep(sb, dir).stdout, /README\.md: the text to change is not in it/);
}));

// From the snaprun-ui pilot: a folder with its own package.json is its own app, with its own import settings. Sweep 2
// leaves it out and says so; the root files it imports stay in use.
function nested(sb) {
  const { dir } = makeFixture("field-app", sb.dir);
  write(dir, "previews/demo/package.json", '{ "name": "demo", "private": true, "type": "module" }\n');
  write(dir, "previews/demo/tsconfig.json", '{ "compilerOptions": { "paths": { "@core/*": ["../../src/*"] } } }\n');
  write(dir, "previews/demo/src/App.js", 'import { Card } from "./Card.js";\nimport { tint } from "../../../src/shared/tint.js";\nimport { badge } from "@core/shared/badge.js";\n\nexport const App = () => Card(tint(badge()));\n');
  write(dir, "previews/demo/src/Card.js", "export const Card = (x) => `<div style=\"color: #0f776e\">${x}</div>`;\n");
  write(dir, "src/shared/tint.js", "export const tint = (x) => x;\n");
  write(dir, "src/shared/badge.js", 'export const badge = () => "new";\n');
  git(sb, dir, ["add", "-A"]);
  git(sb, dir, ["commit", "-q", "-m", "a preview app"]);
  write(dir, NOTE_PATH, NOTE);
  return { dir, base: git(sb, dir, ["rev-parse", "HEAD"]).stdout.trim() };
}

test("a folder with its own package.json is its own app: left out of sweep 2, said on the screen, no change inside it", sandboxed((sb) => {
  const { dir, base } = nested(sb);
  const a = JSON.parse(deep(sb, dir, ["--json"]).stdout).analysis;
  assert.deepEqual(a.apps, ["previews/demo"]);
  assert.ok(a.unusedFiles.includes("src/old/legacy.js"), a.unusedFiles.join(", "));
  assert.deepEqual(a.unusedFiles.filter((f) => f.startsWith("previews/") || f.startsWith("src/shared/")), [], "nothing inside the app, nor what it imports, is called unused");
  assert.ok(!a.copies.some((c) => c.a.file.startsWith("previews/") || c.b.file.startsWith("previews/")));
  assert.ok(!a.colours.values.some((v) => v.files.some((f) => f.startsWith("previews/"))));
  only(sb, dir, base, [{ title: "Tidy the preview", delete: [{ path: "previews/demo/src/Card.js" }], moves: [{ from: "previews/demo/src/App.js", to: "previews/demo/src/Main.js" }] }]);
  const s = deep(sb, dir).stdout;
  assert.match(s, /previews\/demo is its own app, so it was not checked\./, s);
  assert.match(s, /previews\/demo\/src\/Card\.js: inside previews\/demo, its own app, which sweep 2 leaves alone\./);
  assert.match(s, /previews\/demo\/src\/App\.js: inside previews\/demo, its own app, which sweep 2 leaves alone\./);
  assert.doesNotMatch(s, /--apply --plan/);
}));

// From the review of that change: every way an inner app reaches a file at the top keeps the file, also with knip.
test("the top's files an inner app reaches stay: dynamic imports, pages, scripts, type files, with knip too; a plan cannot move them", sandboxed((sb) => {
  const { dir } = nested(sb);
  write(dir, "previews/demo/package.json", '{ "name": "demo", "private": true, "scripts": { "seed": "node ../../src/seed.js" } }\n');
  write(dir, "previews/demo/src/i18n.js", "export const load = (l) => import(`../../../src/locales/${l}.js`);\n");
  write(dir, "previews/demo/src/plugins.js", "export const plug = (name) => import(name);\n");
  write(dir, "previews/demo/src/types.d.ts", 'import type { Shape } from "../../../src/shape";\nexport type Box = Shape;\n');
  write(dir, "previews/demo/index.html", '<!doctype html>\n<script type="module" src="../../src/boot.js#start"></script>\n');
  for (const f of ["src/locales/en.js", "src/locales/fr.js", "src/seed.js", "src/boot.js"]) write(dir, f, "export const x = 1;\n");
  write(dir, "src/shape.ts", "export type Shape = { w: number };\n");
  write(dir, "src/esm/package.json", '{ "type": "module" }\n');
  write(dir, "src/shared/tint.js", 'import { mix } from "./mix.js";\nexport const tint = (x) => mix(x);\n');
  write(dir, "src/shared/mix.js", "export const mix = (x) => x;\n");
  write(dir, "previews/demo/vite.config.ts", 'export default { test: { setupFiles: ["../../src/setup.js"] } };\n');
  write(dir, "src/setup.js", "export const setup = 1;\n");
  write(dir, "previews/demo/src/style.js", 'import "../../../src/styles/base.css";\n');
  write(dir, "src/styles/base.css", "body { margin: 0; }\n");
  git(sb, dir, ["add", "-A"]);
  git(sb, dir, ["commit", "-q", "-m", "more of the preview"]);
  const base = git(sb, dir, ["rev-parse", "HEAD"]).stdout.trim();
  const reached = ["src/locales/en.js", "src/locales/fr.js", "src/seed.js", "src/boot.js", "src/shape.ts", "src/shared/tint.js", "src/shared/badge.js", "src/setup.js", "src/styles/base.css"];
  let a = JSON.parse(deep(sb, dir, ["--json"]).stdout).analysis;
  assert.deepEqual(a.apps, ["previews/demo"], "a package.json that only sets the module type is not an app");
  assert.deepEqual(a.unusedFiles.filter((f) => reached.includes(f)), []);
  assert.ok(a.unusedFiles.includes("src/old/legacy.js"));
  assert.ok(a.unsure.includes("previews/demo/src/plugins.js"), "an inner app that loads code by a computed name keeps deletes off");
  assert.deepEqual(reached.filter((f) => !a.usedByApps[f]), [], "each is known as used by the app, so a plan cannot move it");
  write(dir, "node_modules/.bin/knip", `#!/usr/bin/env node
if (!process.argv.includes("--reporter")) process.exit(2);
console.log(JSON.stringify({ issues: [
  { file: "src/old/legacy.js", files: [{ name: "src/old/legacy.js" }], exports: [] },
  { file: "src/locales/en.js", files: [{ name: "src/locales/en.js" }], exports: [] },
  { file: "src/shared/mix.js", files: [{ name: "src/shared/mix.js" }], exports: [{ name: "mix" }] },
  { file: "previews/demo/src/Card.js", files: [{ name: "previews/demo/src/Card.js" }], exports: [{ name: "Card" }] },
] }));
`);
  chmodSync(join(dir, "node_modules/.bin/knip"), 0o755);
  write(dir, "node_modules/.bin/jscpd", `#!/usr/bin/env node
const out = process.argv[process.argv.indexOf("--output") + 1];
const side = (name) => ({ name, start: 1, end: 8 });
require("node:fs").writeFileSync(require("node:path").join(out, "jscpd-report.json"), JSON.stringify({ duplicates: [
  { firstFile: side("previews/demo/src/Card.js"), secondFile: side("src/shared/tint.js"), lines: 8 },
  { firstFile: side("src/old/legacy.js"), secondFile: side("src/shared/badge.js"), lines: 8 },
] }));
`);
  write(dir, "node_modules/.bin/depcruise", `#!/usr/bin/env node
console.log(JSON.stringify({ modules: [
  { source: "previews/demo/src/App.js", dependencies: [{ resolved: "previews/demo/src/Card.js", circular: true }] },
  { source: "previews/demo/src/Card.js", dependencies: [{ resolved: "previews/demo/src/App.js", circular: true }] },
  { source: "src/old/legacy.js", dependencies: [{ resolved: "src/shared/tint.js", circular: false }] },
] }));
`);
  for (const t of ["jscpd", "depcruise"]) chmodSync(join(dir, "node_modules/.bin", t), 0o755);
  a = JSON.parse(deep(sb, dir, ["--json"]).stdout).analysis;
  assert.equal(a.from.copies, "jscpd");
  assert.deepEqual(a.copies.map((c) => [c.a.file, c.b.file]), [["src/old/legacy.js", "src/shared/badge.js"]], "a copy with a side in the inner app is not the top's to fix");
  assert.equal(a.from.loops, "dependency-cruiser");
  assert.deepEqual(a.cycles, [], "a loop inside the inner app is that app's");
  assert.equal(a.from.unused, "knip");
  assert.deepEqual(a.unusedFiles, ["src/old/legacy.js"], "knip's answer, without the inner app and what it reaches");
  assert.deepEqual(a.unusedExports.filter((e) => e.file.startsWith("previews/") || e.file === "src/shared/mix.js"), [], "not the app's exports, nor those of top files it reaches through others");
  only(sb, dir, base, [{ title: "Move shared code", moves: [{ from: "src/shared/tint.js", to: "src/lib/tint.js" }, { from: "src/styles/base.css", to: "src/base.css" }], add: [{ path: "Previews/Demo/extra.js", text: "x" }] }]);
  const s = deep(sb, dir).stdout;
  assert.match(s, /src\/shared\/tint\.js: previews\/demo uses it, and sweep 2 does not check that app, so it stays as it is\./, s);
  assert.match(s, /src\/styles\/base\.css: previews\/demo uses it/);
  assert.match(s, /Previews\/Demo\/extra\.js: inside previews\/demo, its own app, which sweep 2 leaves alone\./);
  assert.doesNotMatch(s, /--apply --plan/);
}));

test("a top with no starting points calls nothing unused, even when an inner app imports one of its files", sandboxed((sb) => {
  const dir = join(sb.dir, "loose");
  const files = { "lib/a.js": "export const a = 1;\n", "lib/b.js": "export const b = 2;\n", "app/package.json": '{ "name": "app" }\n', "app/main.js": 'import { a } from "../lib/a.js";\n' };
  for (const [f, t] of Object.entries(files)) write(dir, f, t);
  const a = analyze(dir, Object.keys(files), { stack: [] });
  assert.deepEqual(a.usedByApps, { "lib/a.js": "app" });
  assert.deepEqual(a.unusedFiles, [], "without a starting point at the top, lib/b.js is not proven unused");
}));
