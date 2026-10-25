// Deep mode, sweep 2, the first look (read-only): the project type, the best-practices note the assistant researched,
// the tools used (the repo's own knip, jscpd or dependency-cruiser when installed, else repo-fit's built-in analysis),
// how each step will be proven (the repo's own commands, run once now in a throwaway copy with its installed packages
// linked in), and what the analysis found. The person's folder, branch and files never change, and nothing is
// downloaded. Synthetic fixtures only.
import assert from "node:assert/strict";
import { chmodSync, existsSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { makeFixture } from "../dev/fixtures.mjs";
import { analyze, projectType } from "../lib/analyze.mjs";
import { runCommands } from "../lib/proof.mjs";
import { cli, git, read, repo, sandboxed, write } from "./helpers.mjs";

const ME = { REPO_FIT_TODAY: "2026-10-25", GIT_AUTHOR_NAME: "Test Person", GIT_AUTHOR_EMAIL: "test@example.com", GIT_COMMITTER_NAME: "Test Person", GIT_COMMITTER_EMAIL: "test@example.com" };
const deep = (sb, dir, extra = [], env = {}) => cli(sb, ["deep", dir, "--sweep", "code", ...extra], { env: { ...ME, ...env } });
const state = (sb, dir) => [git(sb, dir, ["rev-parse", "HEAD"]).stdout, git(sb, dir, ["status", "--porcelain", "--ignored"]).stdout, git(sb, dir, ["worktree", "list"]).stdout.split("\n").length, git(sb, dir, ["branch", "--list"]).stdout];
const commitAll = (sb, dir, msg) => {
  git(sb, dir, ["add", "-A"], ME);
  git(sb, dir, ["commit", "-q", "-m", msg], ME);
};
const exe = (dir, rel, body) => {
  write(dir, rel, `#!/usr/bin/env node\n${body}\n`);
  chmodSync(join(dir, rel), 0o755);
};
const NOTE = (date, sources) => `# Web app structure\n\nDate: ${date}\n\n## Rules for this repo\n\n- Group code by feature, not by kind.\n- No files that only re-export other files.\n- One place for colours and spacing (design tokens).\n- Name files after what they hold.\n\n## Sources\n\n${sources.map((u) => `- ${u}`).join("\n")}\n`;

test("the first look: project type, tools, proof commands run now in a throwaway copy, and what the analysis found", sandboxed((sb) => {
  const { dir } = makeFixture("field-app", sb.dir);
  const before = state(sb, dir);
  const r = deep(sb, dir);
  assert.equal(r.status, 0, r.out);
  const s = r.stdout;
  assert.match(s, /# Deep sweep 2 of 2: code and design · field-app/);
  assert.match(s, /Project type: web app, plain JavaScript \(from package\.json and index\.html\)/, s);
  assert.match(s, /Best practices: not researched yet/);
  assert.match(s, /Tools: repo-fit's built-in import graph and copy finder \(knip, jscpd and dependency-cruiser are not installed\)/);
  assert.match(s, /How each step is proven: npm run test ✔ now \(2 tests\) · npm run build ✔ now · screenshots: not checked \(no Playwright\)/);
  assert.match(s, /🪦 1 file and 1 export that nothing uses/);
  assert.match(s, /👯 1 block of copied code, 9 lines/);
  assert.match(s, /🔁 1 import loop: cart → checkout → cart/);
  assert.match(s, /🏷️ 2 misleading names: src\/ui\/NewHeader\.js \(the only header\), src\/utils\/helpers2\.js \(the only helpers\)/);
  assert.match(s, /🎨 4 colours typed by hand in 2 files; 2 are near copies of 2 others/);
  assert.match(s, /📏 2 spacing values typed by hand; 1 is a pixel off another/);
  assert.match(s, /docs\/research\/2026-10-25-web-app-structure\.md/, "says where the research note goes");
  assert.match(s, /\.playbook\/deep\/code\.json/, "says where the plan goes");
  assert.deepEqual(state(sb, dir), before, "this folder, its branches and its files are as they were; no working copy is left");

  const j = JSON.parse(deep(sb, dir, ["--json"]).stdout);
  assert.equal(j.base, git(sb, dir, ["rev-parse", "HEAD"]).stdout.trim());
  assert.deepEqual(j.project, { kind: "web app", stack: ["plain JavaScript"], from: ["package.json", "index.html"], slug: "web-app" });
  assert.deepEqual(j.analysis.unusedFiles, ["src/old/legacy.js"]);
  assert.deepEqual(j.analysis.unusedExports, [{ file: "src/utils/helpers2.js", name: "slugify" }]);
  assert.deepEqual(j.analysis.cycles, [["src/cart/cart.js", "src/checkout/checkout.js"]]);
  assert.deepEqual(j.analysis.copies.map((c) => [c.a.file, c.b.file, c.lines]), [["src/cart/cart.js", "src/checkout/checkout.js", 9]]);
  assert.deepEqual(j.analysis.colours.near, [["#0f766e", "#0f776e"], ["#e11d48", "#e11d49"]]);
  assert.deepEqual(j.proof.commands.map((c) => [c.run, c.ok]), [["npm run test", true], ["npm run build", true]]);
  assert.equal(j.proof.limited, null);
}));

test("the research note counts only when it is dated, recent and cites 2 or more sources", sandboxed((sb) => {
  const { dir } = makeFixture("field-app", sb.dir);
  const p = "docs/research/2026-10-20-web-app-structure.md";
  write(dir, p, NOTE("2026-10-20", ["https://react.dev/learn/thinking-in-react", "https://vite.dev/guide/"]));
  let s = deep(sb, dir).stdout;
  assert.match(s, /Best practices, read 5 days ago: docs\/research\/2026-10-20-web-app-structure\.md \(2 sources\)\n  - Group code by feature, not by kind\.\n  - No files that only re-export other files\.\n  - One place for colours and spacing \(design tokens\)\.\n/, s);
  write(dir, p, NOTE("2026-10-20", ["https://vite.dev/guide/", "https://vite.dev/guide/"]));
  assert.match(deep(sb, dir).stdout, /Best practices: docs\/research\/2026-10-20-web-app-structure\.md cites 1 source; it needs 2 or more/);
  write(dir, "docs/research/2026-09-01-web-app-structure.md", NOTE("2026-09-01", ["https://a.example/x", "https://b.example/y"]));
  rmSync(join(dir, p));
  const old = deep(sb, dir).stdout;
  assert.match(old, /Best practices: docs\/research\/2026-09-01-web-app-structure\.md is 54 days old; it needs to be 30 days or newer/, old);
}));

test("the repo's own tools are used when installed, from its own node_modules, and nothing is downloaded", sandboxed((sb) => {
  const { dir } = makeFixture("field-app", sb.dir);
  // A stand-in knip in the folder's own node_modules (ignored by Git): repo-fit links node_modules into its throwaway copy.
  exe(dir, "node_modules/.bin/knip", `if (!process.argv.includes("--reporter")) process.exit(2);
console.log(JSON.stringify({ issues: [
  { file: "src/old/legacy.js", files: [{ name: "src/old/legacy.js" }], exports: [] },
  { file: "src/ui/NewHeader.js", files: [], exports: [{ name: "onlyKnipSeesThis", line: 1, col: 1, pos: 0 }] },
] }));
process.exit(1);`);
  const bin = join(sb.dir, "bin");
  exe(bin, "npx", `require("node:fs").writeFileSync(${JSON.stringify(join(sb.dir, "npx-was-called"))}, "x");`);
  const before = state(sb, dir);
  const env = { PATH: `${bin}:${process.env.PATH}` };
  const s = deep(sb, dir, [], env).stdout;
  assert.match(s, /Tools: knip \(yours\) · repo-fit's built-in import graph and copy finder \(jscpd and dependency-cruiser are not installed\)/, s);
  assert.match(s, /🪦 1 file and 1 export that nothing uses/);
  const j = JSON.parse(deep(sb, dir, ["--json"], env).stdout);
  assert.deepEqual(j.analysis.unusedExports, [{ file: "src/ui/NewHeader.js", name: "onlyKnipSeesThis" }], "knip's answer is used");
  assert.equal(j.analysis.from.unused, "knip");
  assert.equal(existsSync(join(sb.dir, "npx-was-called")), false, "nothing is downloaded");
  assert.ok(existsSync(join(dir, "node_modules/.bin/knip")), "the folder's own packages are still there after the copy is removed");
  assert.deepEqual(state(sb, dir), before);
}));

test("the proof says when it is limited, and a command that fails now is not used as proof", sandboxed((sb) => {
  const { dir } = makeFixture("field-app", sb.dir);
  const pkg = JSON.parse(read(dir, "package.json"));
  pkg.dependencies = { "left-pad": "1.3.0" };
  pkg.scripts.lint = "node -e \"process.exit(3)\"";
  write(dir, "package.json", `${JSON.stringify(pkg, null, 2)}\n`);
  commitAll(sb, dir, "a dependency and a failing lint");
  const s = deep(sb, dir).stdout;
  assert.match(s, /⚠️ Proof limited: this folder's packages are not installed \(no node_modules\/\), and repo-fit never downloads them\./, s);
  assert.match(s, /npm run lint ✖ now \(not used as proof\)/);
}));

test("sweep 2 needs Git too, and a folder without code says so", sandboxed((sb) => {
  const plain = repo(sb, "plain", { files: { "notes/a.md": "# A\n" } });
  assert.match(deep(sb, plain).out, /Deep mode works with Git/);
  const notes = repo(sb, "notes-only", { files: { "notes/a.md": "# A\n" }, commit: true });
  const r = deep(sb, notes);
  assert.equal(r.status, 0, r.out);
  assert.match(r.stdout, /No code found/);
}));

test("the analysis reads code, not the text inside strings and comments, and never calls a script or a computed import unused", sandboxed((sb) => {
  const files = {
    "package.json": JSON.stringify({ name: "app", type: "module", main: "src/main.js" }),
    "src/main.js": `import { real } from "./lib.js";\nconst lang = "en";\nconst pick = (n) => import(n);\nawait import(\`./locales/\${lang}.js\`);\nreal(pick);\n`,
    // Code inside a template, a string and a comment is text; a regular expression with a quote does not end the lexer.
    "src/lib.js": "const page = `export function inTemplate() {}\\nimport x from \"./ghost.js\"`;\nconst s = \"export const inString = 1\";\n/* export const inComment = 1 */\nconst q = /\"/;\nexport const real = () => [page, s, q];\nexport const notUsed = 1;\n",
    "src/locales/en.js": "export default { hi: \"Hello\" };\n",
    "src/locales/sv.js": "export default { hi: \"Hej\" };\n",
    "dev/report.mjs": "#!/usr/bin/env node\nexport const x = 1;\n",
    "dev/notes.mjs": "export const y = 1;\n",
    "dev/once.mjs": "import { readFileSync } from \"node:fs\";\nconsole.log(readFileSync(\"a\", \"utf8\").length);\n",
    "README.md": "Run `node dev/notes.mjs` for the notes.\n",
    "src/old.js": "export const gone = 1;\n",
  };
  const dir = repo(sb, "app", { files, commit: true });
  const a = analyze(dir, Object.keys(files), projectType(dir, Object.keys(files)));
  assert.deepEqual(a.unusedFiles, ["src/old.js"], "a script with #!, one the docs name, one that exports nothing, and computed imports are not unused");
  assert.deepEqual(a.unusedExports, [{ file: "src/lib.js", name: "notUsed" }], "exports in strings and comments are not exports");
  assert.deepEqual(a.unsure, ["src/main.js"], "a file that loads code by a name only known when it runs");
  assert.match(deep(sb, dir).stdout, /🪦 1 file and 1 export that nothing uses\n  ⚠️ 1 file loads code by a name it only knows when it runs \(src\/main\.js\), so a file that looks unused may still be loaded/);
}));

test("files a framework, a config file, a document or a loader reaches are never called unused", sandboxed((sb) => {
  const files = {
    "package.json": JSON.stringify({ name: "mono", private: true, main: "dist/index.js", workspaces: ["apps/*", "packages/*"] }),
    "tsconfig.json": JSON.stringify({ compilerOptions: { baseUrl: "src" } }),
    // The package's main points at build output: its source is the entry. A folder named build inside src is source.
    "src/index.tsx": "import { Button } from \"components/Button\";\nimport W from \"./w.ts?worker\";\nimport sub from \"./sub/\";\nimport { b } from \"./build\";\nconst mods = import.meta.glob(\"./modules/*.ts\");\nconst ctx = require.context(\"./ctx\", true);\nconst wk = new Worker(new URL(\"./worker2.ts\", import.meta.url));\nexport const app = [Button, W, sub, b, mods, ctx, wk];\n",
    "src/components/Button.tsx": "export const Button = 1;\n",
    "src/w.ts": "export default 1;\n",
    "src/sub/index.ts": "export default 1;\n",
    "src/build/index.ts": "import { deep } from \"../deepthing\";\nexport const b = deep;\n",
    "src/deepthing.ts": "export const deep = 1;\n",
    "src/modules/a.ts": "export const a = 1;\n",
    "src/ctx/c.js": "export const c = 1;\n",
    "src/worker2.ts": "export const w = 1;\n",
    // A nested app: its framework loads pages and middleware by their place.
    "apps/web/package.json": JSON.stringify({ dependencies: { next: "15.0.0" } }),
    "apps/web/app/page.tsx": "import X from \"../components/X\";\nexport default function Page() { return X; }\n",
    "apps/web/components/X.tsx": "export default 1;\n",
    "apps/web/middleware.ts": "export function middleware() {}\n",
    "packages/lib/package.json": JSON.stringify({ name: "lib", main: "dist/index.js" }),
    "packages/lib/src/index.ts": "export const lib = 1;\n",
    // Stories, Storybook's own files and mocks are loaded by their tools.
    "src/Only.stories.tsx": "import { Only } from \"./OnlyStory\";\nexport default {};\nexport const Primary = Only;\n",
    "src/OnlyStory.tsx": "export const Only = 1;\n",
    ".storybook/main.ts": "export default { stories: [] };\n",
    "src/__mocks__/fs.js": "export const readFileSync = 1;\n",
    // A document that imports a component, a config file and a CI file that name source files as text.
    "docs/page.mdx": "import Chart from \"../src/Chart\";\n\n# Page\n\n<Chart />\n",
    "src/Chart.tsx": "export default 1;\n",
    "webpack.config.js": "module.exports = { entry: \"./src/app.js\" };\n",
    "src/app.js": "export const app = 1;\n",
    "serverless.yml": "functions:\n  hello:\n    handler: src/handlers/hello.main\n",
    "src/handlers/hello.js": "export const main = () => 1;\n",
    "src/old.js": "export const gone = 1;\n",
  };
  const dir = repo(sb, "mono", { files, commit: true });
  const a = analyze(dir, Object.keys(files), projectType(dir, Object.keys(files)));
  assert.deepEqual(a.unusedFiles, ["src/old.js"]);
}));

test("a research note dated in the future, sources that differ only in how they are written, and a folder named like a note", sandboxed((sb) => {
  const { dir } = makeFixture("field-app", sb.dir);
  write(dir, "docs/research/2026-11-01-web-app-structure.md", NOTE("2026-11-01", ["https://a.example/x", "https://b.example/y"]));
  assert.match(deep(sb, dir).stdout, /Best practices: docs\/research\/2026-11-01-web-app-structure\.md is dated 2026-11-01, a day that has not come yet/);
  rmSync(join(dir, "docs/research"), { recursive: true });
  write(dir, "docs/research/2026-10-20-web-app-structure.md", NOTE("2026-10-20", ["**https://vite.dev/guide/**", "`https://vite.dev/guide`", "https://vite.dev/guide/#start", "https://VITE.dev/guide"]));
  assert.match(deep(sb, dir).stdout, /cites 1 source; it needs 2 or more/);
  rmSync(join(dir, "docs/research"), { recursive: true });
  write(dir, "docs/research/2026-10-24-web-app-structure.md/x.md", "# a folder, not a note\n");
  const r = deep(sb, dir);
  assert.equal(r.status, 0, r.out);
  assert.match(r.stdout, /Best practices: not researched yet/);
}));

test("the proof never installs, never runs the repo's Git hooks, stops what a slow command started, and leaves other worktrees alone", sandboxed((sb) => {
  const { dir } = makeFixture("field-app", sb.dir);
  const mark = (n) => join(sb.dir, `${n}-ran`);
  const pkg = JSON.parse(read(dir, "package.json"));
  pkg.scripts.pretest = `node -e "require('fs').writeFileSync(${JSON.stringify(mark("pretest"))}, 'x')" && npm install --no-audit --no-fund`;
  write(dir, "package.json", `${JSON.stringify(pkg, null, 2)}\n`);
  write(dir, ".githooks/post-checkout", `#!/bin/sh\ntouch ${JSON.stringify(mark("hook"))}\n`);
  chmodSync(join(dir, ".githooks/post-checkout"), 0o755);
  commitAll(sb, dir, "an install before the tests, and a hook");
  // Another worktree whose folder is away (an unplugged drive): it stays registered.
  const away = join(sb.dir, "away");
  git(sb, dir, ["worktree", "add", "-q", "--detach", away], ME);
  rmSync(away, { recursive: true });
  // A copy left by a killed run, with the folder's packages linked in: removed, and the packages are still there.
  write(dir, "node_modules/kept/index.js", "x\n");
  const left = join(sb.dir, "repo-fit-proof-999999-left");
  git(sb, dir, ["worktree", "add", "-q", "--detach", left], ME);
  symlinkSync(join(dir, "node_modules"), join(left, "node_modules"));
  git(sb, dir, ["config", "core.hooksPath", ".githooks"]);
  const s = deep(sb, dir).stdout;
  assert.match(s, /npm run test not run \(it installs packages, and repo-fit never downloads\)/, s);
  assert.equal(existsSync(mark("pretest")), false, "the install script did not run");
  assert.equal(existsSync(mark("hook")), false, "the repo's post-checkout hook did not run");
  const list = git(sb, dir, ["worktree", "list", "--porcelain"]).stdout;
  assert.match(list, /away/, "the other worktree is still registered");
  assert.doesNotMatch(list, /repo-fit-proof-999999/);
  assert.equal(existsSync(left), false);
  assert.equal(read(dir, "node_modules/kept/index.js"), "x\n");
}));

test("a command that takes too long is stopped with everything it started", sandboxed((sb) => {
  const mark = join(sb.dir, "late");
  const late = `node -e "setTimeout(() => require('fs').writeFileSync(${JSON.stringify(mark).replaceAll('"', '\\"')}, 'x'), 2500)"`;
  const [r] = runCommands(sb.dir, [{ name: "test", run: `${late} & sleep 20` }], { timeout: 800 });
  assert.equal(r.timedOut, true);
  assert.equal(r.ok, false);
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3500);
  assert.equal(existsSync(mark), false, "the command's background child was stopped too");
}));
