// Deep mode, sweep 2 (0.9.0): what is inside the code. It reads a copy of the last commit, never the person's folder.
//   projectType(dir, files)          → the kind of project and its stack, from the manifests and config files
//   importSites(code)                → where each import names its file, to write it again after a move
//   importLoops(dir, files)          → the import loops, built in, to prove a step makes no new one
//   analyze(dir, files, project)     → files and exports nothing uses, import loops, copied blocks, misleading names,
//                                      colours and spacing typed by hand. A folder below the top with its own
//                                      package.json is its own app: left out, and the top's files it imports stay used. Built in, no dependencies. When the repo has
//                                      knip, jscpd or dependency-cruiser installed (its node_modules/.bin, or PATH), their
//                                      answer is used instead for that part. It never runs npx and never downloads.
// Built in means plain reading: JavaScript and TypeScript imports by pattern, not a full parser. Imports built from
// strings at run time are not followed, and the screen says which tool gave each answer.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, delimiter, isAbsolute, join, posix, relative } from "node:path";
import { offline } from "./proof.mjs";

const GRAPH = /\.(js|mjs|cjs|jsx|ts|tsx|mts|cts|vue|svelte|astro)$/i;
const VALUES = /\.(css|scss|sass|less|js|mjs|cjs|jsx|ts|tsx|vue|svelte|astro|html?)$/i;
const STYLE = /\.(css|scss|sass|less)$/i;
const OTHER_CODE = { py: "Python", rb: "Ruby", go: "Go", rs: "Rust", java: "Java", kt: "Kotlin", php: "PHP", swift: "Swift", cs: "C#", c: "C", cc: "C++", cpp: "C++", sh: "shell" };
// Built output and installed packages. build/, out/ and vendor/ count only outside src/: src/build/ is source.
const OUT_ANY = /(^|\/)(node_modules|dist|coverage|\.next|\.nuxt|\.svelte-kit|scripts\/playbook)(\/|$)|\.min\.(js|css)$|\.d\.[cm]?ts$/;
const OUT = { test: (f) => OUT_ANY.test(f) || (/(^|\/)(build|out|vendor)\//.test(f) && !/(^|\/)src\/(.*\/)?(build|out|vendor)\//.test(f)) };
// Tests, stories, mocks and benchmarks: their tools load them by name.
const TEST = /(^|\/)(test|tests|__tests__|__mocks__|__fixtures__|spec|e2e|\.storybook)\/|\.(test|spec|stories|story|bench|e2e-spec)\.[cm]?[jt]sx?$/;
const CONFIGISH = /(^|\/)[^/]+\.config\.[cm]?[jt]s$|(^|\/)\.[^/]+rc\.[cm]?js$/;
const BY_HAND = /^(scripts|bin|tools)\//; // run by people or by package scripts, not imported
// Frameworks that load files by their place (pages, routes), found in any package.json of the repo.
const ROUTED = new Set(["Next.js", "Nuxt", "SvelteKit", "Astro", "Remix"]);
const ROUTER_DEPS = ["next", "nuxt", "@sveltejs/kit", "astro", "@remix-run/react", "@remix-run/node", "gatsby", "@docusaurus/core", "expo-router", "@tanstack/react-router", "@tanstack/start", "@solidjs/start", "@builder.io/qwik-city", "vike", "@react-router/dev"];
const ROUTES = /(^|\/)(src\/)?(pages|app|routes)\//;
// Files a framework loads by their name: Next.js and Astro middleware, SvelteKit hooks, and the like.
const CONVENTION = /(^|\/)(src\/)?(middleware|instrumentation|instrumentation-client|mdx-components|hooks\.(server|client|universal)|content\.config)\.[cm]?[jt]sx?$/;
const NUXT_DIRS = /(^|\/)(composables|utils|server|plugins|middleware|stores|layouts|components)\//; // Nuxt imports these by itself
const TOKENS = /(^|\/)(tokens?|theme|variables|vars|design-tokens)(\/|\.[a-z]+$)/i;
const EXTS = ["", ".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx", ".mts", ".cts", ".vue", ".svelte", "/index.js", "/index.mjs", "/index.cjs", "/index.jsx", "/index.ts", "/index.tsx", "/index.mts", "/index.cts", "/index.vue", "/index.svelte"];
const COPY_LINES = 6; // a copied block is at least this many lines that say something

const text = (dir, p) => {
  try {
    return readFileSync(join(dir, p), "utf8");
  } catch {
    return "";
  }
};
const json = (dir, p) => {
  try {
    // tsconfig.json and jsconfig.json may hold comments and trailing commas
    return JSON.parse(text(dir, p).replace(/("(?:\\.|[^"\\])*")|\/\*[\s\S]*?\*\/|\/\/.*$/gm, (m, s) => s ?? "").replace(/,(\s*[}\]])/g, "$1"));
  } catch {
    return null;
  }
};
const norm = (p) => posix.normalize(String(p).replace(/^\.\//, ""));
const stem = (p) => basename(p).replace(/\.[^.]+$/, "");

// The kind of project, from what it says about itself: its manifests, then its config files.
export function projectType(dir, files) {
  const has = (p) => files.includes(p);
  const from = [];
  const stack = [];
  let kind = null;
  const pkg = has("package.json") ? json(dir, "package.json") : null;
  if (pkg) {
    from.push("package.json");
    const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
    const dep = (n) => Object.hasOwn(deps, n);
    const pick = (list) => list.find(([n]) => dep(n))?.[1];
    const ui = pick([["next", "Next.js"], ["nuxt", "Nuxt"], ["@sveltejs/kit", "SvelteKit"], ["astro", "Astro"], ["@remix-run/react", "Remix"], ["@angular/core", "Angular"], ["react", "React"], ["vue", "Vue"], ["svelte", "Svelte"], ["solid-js", "Solid"], ["preact", "Preact"]]);
    const server = pick([["express", "Express"], ["fastify", "Fastify"], ["koa", "Koa"], ["hono", "Hono"], ["@nestjs/core", "NestJS"]]);
    const builder = pick([["vite", "Vite"], ["webpack", "webpack"], ["parcel", "Parcel"], ["esbuild", "esbuild"]]);
    const ts = dep("typescript") || has("tsconfig.json");
    const config = files.find((f) => /^(vite|next|nuxt|svelte|astro|webpack)\.config\.[cm]?[jt]s$/.test(f));
    if (config) from.push(config);
    else if (ts && has("tsconfig.json")) from.push("tsconfig.json");
    if (ui) stack.push(builder && !ROUTED.has(ui) && ui !== "Angular" ? `${ui} with ${builder}` : ui);
    else if (server) stack.push(server);
    else if (builder) stack.push(builder);
    stack.push(ts ? "TypeScript" : stack.length ? null : "plain JavaScript");
    if (ui || has("index.html")) {
      kind = "web app";
      if (!ui && has("index.html")) from.push("index.html");
    } else if (server) kind = "web server";
    else if (pkg.bin) kind = "command-line tool";
    else if (pkg.main || pkg.exports || pkg.module) kind = "library";
    else kind = "Node project";
  } else {
    const py = ["pyproject.toml", "requirements.txt", "setup.py"].find(has);
    const manifest = py ?? ["Cargo.toml", "go.mod", "Gemfile", "composer.json", "pom.xml", "build.gradle", "Package.swift"].find(has);
    if (manifest) {
      from.push(manifest);
      const t = text(dir, manifest).toLowerCase();
      const lang = { "Cargo.toml": "Rust", "go.mod": "Go", Gemfile: "Ruby", "composer.json": "PHP", "pom.xml": "Java", "build.gradle": "Java", "Package.swift": "Swift" }[manifest] ?? "Python";
      const web = [["django", "Django", "web app"], ["rails", "Rails", "web app"], ["laravel", "Laravel", "web app"], ["fastapi", "FastAPI", "web server"], ["flask", "Flask", "web server"]].find(([w]) => t.includes(w));
      kind = web ? web[2] : `${lang} project`;
      stack.push(web ? web[1] : null, lang);
    } else {
      const ext = files.map((f) => f.split(".").pop().toLowerCase());
      const js = files.some((f) => GRAPH.test(f) && !OUT.test(f));
      const other = Object.entries(OTHER_CODE).find(([e]) => ext.includes(e));
      if (!js && !other) return null;
      const lang = js ? "JavaScript" : other[1];
      kind = `${lang} code`;
      stack.push(lang);
    }
  }
  const s = [...new Set(stack.filter(Boolean))];
  return { kind, stack: s, from: [...new Set(from)].slice(0, 3), slug: kind.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") };
}

// ---- The import graph ----

// What one import names: "*" for everything (a namespace, a dynamic import, require), else the names it uses.
function names(clause) {
  if (/\*\s*as\s/.test(clause)) return "*";
  const out = [];
  const braces = clause.match(/\{([^}]*)\}/);
  if (/^\s*[\w$]+/.test(clause.replace(/^\s*type\s+/, "")) && !/^\s*\{/.test(clause)) out.push("default");
  for (const part of braces?.[1]?.split(",") ?? []) {
    const n = part.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim();
    if (n) out.push(n);
  }
  return out;
}

// The code with its comments blanked out, and with the text of its strings and templates blanked too unless keepText.
// Line breaks stay, so nothing moves. A line of code inside a string (a page, a file a test writes) is then never read
// as an import or an export. Regular expressions are skipped, so a quote inside one does not start a string.
const AFTER_WORD = /\b(return|typeof|case|in|of|void|delete|throw|yield|await|else|do)\s*$/;
export function codeOnly(code, keepText = false) {
  const out = code.split(""); // per UTF-16 unit, like every index below (an emoji is two)
  const blank = (a, b) => {
    for (let k = a; k < b && k < out.length; k++) if (out[k] !== "\n") out[k] = " ";
  };
  const open = []; // the brace depth at each ${ that is still open
  let depth = 0;
  let prev = "";
  for (let i = 0; i < code.length; ) {
    const c = code[i];
    const d = code[i + 1];
    if (c === "/" && d === "/") {
      const e = code.indexOf("\n", i) < 0 ? code.length : code.indexOf("\n", i);
      blank(i, e);
      i = e;
    } else if (c === "/" && d === "*") {
      const e = code.indexOf("*/", i + 2) < 0 ? code.length : code.indexOf("*/", i + 2) + 2;
      blank(i, e);
      i = e;
    } else if (c === "/" && (prev === "" || /[(,=:[!&|?{};+\-*%<>~^]/.test(prev) || AFTER_WORD.test(code.slice(Math.max(0, i - 8), i)))) {
      let j = i + 1;
      for (let cls = false; j < code.length && code[j] !== "\n"; j++) {
        if (code[j] === "\\") j++;
        else if (code[j] === "[") cls = true;
        else if (code[j] === "]") cls = false;
        else if (code[j] === "/" && !cls) break;
      }
      i = j + 1;
      prev = "x";
    } else if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < code.length && code[j] !== c && code[j] !== "\n") j += code[j] === "\\" ? 2 : 1;
      if (!keepText) blank(i + 1, j);
      i = j + 1;
      prev = c;
    } else if (c === "`" || (c === "}" && open.length && open.at(-1) === depth)) {
      if (c === "}") open.pop();
      let j = i + 1;
      while (j < code.length && code[j] !== "`" && !(code[j] === "$" && code[j + 1] === "{")) j += code[j] === "\\" ? 2 : 1;
      if (!keepText) blank(i + 1, j);
      if (code[j] === "$") {
        open.push(depth);
        i = j + 2;
        prev = "{";
      } else {
        i = j + 1;
        prev = "`";
      }
    } else {
      if (c === "{") depth++;
      else if (c === "}") depth--;
      if (!/\s/.test(c)) prev = c;
      i++;
    }
  }
  return out.join("");
}

function importsOf(code) {
  const t = codeOnly(code, true);
  const out = [];
  for (const m of t.matchAll(/\bimport\s+(type\s+)?([\w$*{}\s,]+?)\s+from\s*["']([^"']+)["']/g)) out.push({ spec: m[3], names: names(m[2]), type: !!m[1] });
  for (const m of t.matchAll(/\bimport\s*["']([^"']+)["']/g)) out.push({ spec: m[1], names: [] });
  for (const m of t.matchAll(/\bexport\s+(type\s+)?(\*(?:\s+as\s+[\w$]+)?|\{[^}]*\})\s+from\s*["']([^"']+)["']/g)) out.push({ spec: m[3], names: m[2].startsWith("*") ? "*" : names(m[2]), type: !!m[1] });
  for (const m of t.matchAll(/\b(?:import|require)\s*\(\s*["']([^"']+)["']\s*\)/g)) out.push({ spec: m[1], names: "*", dynamic: true });
  // import(`./locales/${lang}.js`): every file the fixed start can name counts as used.
  for (const m of t.matchAll(/\b(?:import|require)\s*\(\s*`([^`$]*)\$\{/g)) out.push({ spec: m[1], names: "*", dynamic: true, prefix: true });
  // Loaders that name files by a pattern or a folder: Vite's import.meta.glob, webpack's require.context. Every file
  // the fixed start of the pattern names counts as used. A worker: new URL("./w.ts", import.meta.url).
  for (const m of t.matchAll(/\bimport\.meta\.glob\w*\s*\(([^)]*)\)/g)) for (const g of m[1].matchAll(/["'`]([^"'`]+)["'`]/g)) out.push({ spec: g[1].replace(/^!/, "").split(/[*{[?]/)[0], names: "*", dynamic: true, prefix: true });
  for (const m of t.matchAll(/\brequire\.context\s*\(\s*["'`]([^"'`]+)["'`]/g)) out.push({ spec: `${m[1].replace(/\/$/, "")}/`, names: "*", dynamic: true, prefix: true });
  for (const m of t.matchAll(/\bnew\s+URL\s*\(\s*["'`]([^"'`]+)["'`]\s*,\s*import\.meta\.url/g)) out.push({ spec: m[1], names: "*", dynamic: true });
  return out;
}

// Where each import, export … from, require and import() names its file: the name and its place in the code, so a
// move can write it again. A path read at run time (new URL, readFileSync) is not an import and is left to the proof.
export function importSites(code) {
  const t = codeOnly(code, true);
  const seen = new Map();
  for (const re of [
    /\bimport\s+(?:type\s+)?[\w$*{}\s,]+?\s+from\s*["']([^"']+)["']/dg,
    /\bimport\s*["']([^"']+)["']/dg,
    /\bexport\s+(?:type\s+)?(?:\*(?:\s+as\s+[\w$]+)?|\{[^}]*\})\s+from\s*["']([^"']+)["']/dg,
    /\b(?:import|require)\s*\(\s*["']([^"']+)["']\s*\)/dg,
  ]) for (const m of t.matchAll(re)) seen.set(m.indices[1][0], { spec: m[1], start: m.indices[1][0], end: m.indices[1][1] });
  return [...seen.values()].sort((a, b) => a.start - b.start);
}

// import(name), require(name): code loaded by a name only known when it runs, which no reader of the code can follow.
const computed = (code) => /\b(?:import|require)\s*\(\s*(?![\s"'`)]|`[^`$]*\$\{)/.test(codeOnly(code)) || /\b(?:import|require)\s*\(\s*`\$\{/.test(codeOnly(code, true));

function exportsOf(code) {
  const t = codeOnly(code);
  const out = new Set();
  for (const m of t.matchAll(/\bexport\s+(?:declare\s+)?(?:async\s+)?(?:const|let|var|function\*?|class|abstract\s+class|enum)\s+([\w$]+)/g)) out.add(m[1]);
  for (const m of t.matchAll(/\bexport\s*\{([^}]*)\}(?!\s*from)/g)) {
    for (const part of m[1].split(",")) {
      const n = part.trim().replace(/^type\s+/, "").split(/\s+as\s+/).pop().trim();
      if (n) out.add(n);
    }
  }
  if (/\bexport\s+default\b/.test(t)) out.add("default");
  return [...out];
}

// tsconfig/jsconfig "paths": "@/*" → ["src/*"], and "baseUrl": "src" → "components/Button" is src/components/Button.
// Read from the usual config names at the top, and the file each one extends.
function aliases(dir) {
  const out = { paths: [], bases: [] };
  for (const name of ["tsconfig.json", "jsconfig.json", "tsconfig.app.json", "tsconfig.base.json"]) {
    const c = json(dir, name);
    const ext = typeof c?.extends === "string" && c.extends.startsWith(".") ? json(dir, norm(c.extends.endsWith(".json") ? c.extends : `${c.extends}.json`)) : null;
    const o = { ...ext?.compilerOptions, ...c?.compilerOptions };
    const base = norm(o.baseUrl ?? ".");
    if (o.baseUrl) out.bases.push(base);
    for (const [k, v] of Object.entries(o.paths ?? {})) out.paths.push({ from: k.replace(/\*$/, ""), to: [].concat(v).map((x) => norm(posix.join(base, String(x).replace(/\*$/, "")))) });
  }
  return out;
}

// A path to a file in the graph, with the endings and index files an import may leave out.
const finder = (set) => (p) => {
  const n = String(p).replace(/\/+$/, "");
  if (n === "" || n === ".") return EXTS.filter((e) => e.startsWith("/index")).map((e) => e.slice(1)).find((e) => set.has(e)) ?? null;
  for (const e of EXTS) if (set.has(n + e)) return n + e;
  const m = n.match(/^(.*)\.([cm]?js|jsx)$/); // TypeScript's own style: "./x.js" for x.ts
  if (m) for (const e of [".ts", ".tsx", ".mts", ".cts"]) if (set.has(m[1] + e)) return m[1] + e;
  return null;
};

export function resolver(files, dir) {
  const tryPath = finder(new Set(files));
  const al = aliases(dir);
  // Files by the last part of the name an import may use: "Header" for components/Header.tsx and Header/index.ts.
  const byName = new Map();
  for (const f of files) for (const k of [stem(f), stem(f) === "index" ? basename(posix.dirname(f)) : null].filter(Boolean)) byName.set(k, [...(byName.get(k) ?? []), f]);
  return (from, raw, prefix) => {
    const spec = raw.replace(/\?.*$/, "").replace(/(.)#.*$/, "$1"); // "./w.ts?worker", "./x.js#part"
    if (prefix) {
      const start = spec.startsWith(".") ? posix.join(posix.dirname(from), spec) : spec.startsWith("/") ? spec.slice(1) : null;
      return start === null ? null : { loose: files.filter((f) => f.startsWith(posix.normalize(start))) };
    }
    if (spec.startsWith(".")) return tryPath(posix.join(posix.dirname(from), spec));
    if (spec.startsWith("/")) return tryPath(norm(spec.slice(1)));
    for (const a of al.paths) if (a.from && spec.startsWith(a.from)) for (const to of a.to) {
      const r = tryPath(norm(posix.join(to, spec.slice(a.from.length))));
      if (r) return r;
    }
    for (const b of al.bases) {
      const r = tryPath(norm(posix.join(b, spec)));
      if (r) return r;
    }
    // A name repo-fit cannot place (a bundler alias, a module folder setting): the files it may name count as used, so
    // nothing is called unused by mistake. "@/components/Header" matches any file ending in components/Header, and
    // "components/Header" too. A package name ("react") names no file of the repo, so it changes nothing.
    const rest = /^[@~#$]/.test(spec) && spec.includes("/") ? spec.replace(/^[^/]*\//, "") : spec;
    const ways = [...new Set([rest, spec].flatMap((x) => [x, x.replace(/\.([cm]?js|jsx)$/, "")]))]; // "./x.js" may name x.ts
    const loose = (byName.get(basename(rest).replace(/\.[cm]?[jt]sx?$/, "")) ?? []).filter((f) => ways.some((w) => EXTS.some((e) => f.endsWith(`/${w}${e}`) || f === `${w}${e}`)));
    return loose.length ? { loose } : null;
  };
}

// Where the code starts: tests, config files, scripts run by hand (in scripts/, bin/ or tools/, with a #! line, named in
// the repo's own documents or CI, or exporting nothing: a script, not a module), the package's own entries, pages'
// scripts, and file-based routes. Everything else is used only if something reaches it.
function entriesOf(dir, files, graph, project, resolve) {
  const find = finder(new Set(graph));
  const live = files.filter((f) => !OUT.test(f));
  const docs = live.filter((f) => /\.(md|markdown|mdx|txt|ya?ml|toml)$/i.test(f) || /(^|\/)(Makefile|Justfile|Dockerfile|Procfile)$/.test(f));
  const named = docs.map((f) => text(dir, f)).join("\n");
  const script = (f) => {
    const t = text(dir, f);
    return t.startsWith("#!") || named.includes(f) || exportsOf(t).length === 0;
  };
  const pkgs = live.filter((f) => basename(f) === "package.json").map((f) => ({ at: posix.dirname(f), pkg: json(dir, f) ?? {} }));
  const deps = (p) => ({ ...p.dependencies, ...p.devDependencies, ...p.peerDependencies });
  const routed = project?.stack.some((s) => ROUTED.has(s.split(" ")[0])) || pkgs.some(({ pkg }) => ROUTER_DEPS.some((d) => Object.hasOwn(deps(pkg), d)));
  const nuxt = pkgs.some(({ pkg }) => Object.hasOwn(deps(pkg), "nuxt"));
  const out = new Set(graph.filter((f) => TEST.test(f) || CONFIGISH.test(f) || BY_HAND.test(f) || CONVENTION.test(f) || (routed && ROUTES.test(f)) || (nuxt && NUXT_DIRS.test(f)) || script(f)));
  const add = (p) => {
    const f = find(norm(p));
    if (f) out.add(f);
    return f;
  };
  for (const { at, pkg } of pkgs) {
    const here = (p) => norm(posix.join(at, String(p)));
    // An entry that points at built output (dist/index.js) starts in the source: src/index.ts.
    const entry = (p) => add(here(p)) || add(here(String(p).replace(/^(\.\/)?(dist|build|lib|out|es|esm|cjs|umd)\//, "src/"))) || (add(here("src/index")), add(here("src/main")), add(here("index")));
    const walk = (v) => (typeof v === "string" ? entry(v) : v && typeof v === "object" ? Object.values(v).forEach(walk) : null);
    walk([pkg.main ?? "index.js", pkg.module, pkg.browser, pkg.bin, pkg.exports, pkg.source]);
    for (const s of Object.values(pkg.scripts ?? {})) for (const m of String(s).matchAll(/[\w./@-]+\.[cm]?[jt]sx?/g)) add(here(m[0]));
  }
  // Paths written as text in config files, package.json files and CI or deploy files: "./src/app.js" in a webpack
  // config, "handler: src/handlers/hello.main" in serverless.yml.
  for (const f of live.filter((x) => (CONFIGISH.test(x) || /\.(json|ya?ml|toml)$/i.test(x)) && !/(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lock|composer\.lock)$/.test(x))) {
    for (const m of text(dir, f).matchAll(/[\w.@-]*\/[\w./@-]+/g)) {
      const p = m[0].replace(/^\.\//, "");
      add(norm(posix.join(posix.dirname(f), m[0]))) || add(norm(p)) || add(norm(p.replace(/\.[\w$]+$/, "")));
    }
  }
  // Imports in documents (MDX) and in a page's own module scripts, and a page's script files.
  for (const d of live.filter((f) => /\.mdx?$/i.test(f))) for (const im of importsOf(text(dir, d))) if (im.spec.startsWith(".")) add(posix.join(posix.dirname(d), im.spec));
  for (const h of live.filter((f) => /\.html?$/i.test(f))) {
    const page = text(dir, h);
    for (const m of page.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) {
      const src = m[1].split(/[?#]/)[0];
      if (/^[a-z]+:|^\/\//i.test(src)) continue;
      add(src.startsWith("/") ? src.slice(1) : posix.join(posix.dirname(h), src));
    }
    for (const m of page.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) for (const im of importsOf(m[1])) {
      const r = resolve(h, im.spec, im.prefix);
      for (const f of typeof r === "string" ? [r] : r?.loose ?? []) out.add(f);
    }
  }
  return out;
}

// Strongly connected parts of the graph with more than one file: each is an import loop.
function loops(nodes, edges) {
  let i = 0;
  const idx = new Map();
  const low = new Map();
  const stack = [];
  const on = new Set();
  const out = [];
  const visit = (v) => {
    idx.set(v, i);
    low.set(v, i++);
    stack.push(v);
    on.add(v);
    for (const w of edges.get(v) ?? []) {
      if (!idx.has(w)) {
        visit(w);
        low.set(v, Math.min(low.get(v), low.get(w)));
      } else if (on.has(w)) low.set(v, Math.min(low.get(v), idx.get(w)));
    }
    if (low.get(v) === idx.get(v)) {
      const part = [];
      let w;
      do {
        w = stack.pop();
        on.delete(w);
        part.push(w);
      } while (w !== v);
      if (part.length > 1 || (edges.get(v) ?? new Set()).has(v)) out.push(part.sort());
    }
  };
  for (const v of nodes) if (!idx.has(v)) visit(v);
  return out.sort((a, b) => a[0].localeCompare(b[0]));
}

// The import loops among these files, each as one way round it. Built in, the same for every step of a plan.
export function importLoops(dir, files) {
  const graph = files.filter((f) => !OUT.test(f) && GRAPH.test(f));
  const resolve = resolver(graph, dir);
  const edges = new Map(graph.map((f) => [f, new Set()]));
  for (const f of graph) for (const im of importsOf(text(dir, f))) {
    if (im.dynamic || im.type) continue;
    const r = resolve(f, im.spec);
    if (typeof r === "string") edges.get(f).add(r);
  }
  return loops(graph, edges).map((c) => loopPath(c, edges));
}

// One way round a loop, for the screen: cart → checkout → cart.
export function loopPath(part, edges) {
  const inside = new Set(part);
  const start = part[0];
  const seen = new Set([start]);
  const queue = [[start]];
  while (queue.length) {
    const path = queue.shift();
    for (const w of edges.get(path.at(-1)) ?? []) {
      if (w === start) return [...path, start];
      if (inside.has(w) && !seen.has(w)) {
        seen.add(w);
        queue.push([...path, w]);
      }
    }
  }
  return [...part, start];
}

// ---- Copied blocks: the same run of lines (spaces and comments aside) in two places ----

function copies(dir, files) {
  const seqs = new Map();
  const where = new Map();
  for (const f of files) {
    const seq = text(dir, f).split("\n").map((l, n) => ({ n: n + 1, t: l.trim() })).filter((x) => x.t && !/^(\/\/|\/\*|\*)/.test(x.t));
    seqs.set(f, seq);
    for (let i = 0; i + COPY_LINES <= seq.length; i++) {
      const w = seq.slice(i, i + COPY_LINES);
      if (w.filter((x) => x.t.length >= 8).length < 4) continue; // braces and short lines say little
      const key = w.map((x) => x.t).join("\n");
      where.set(key, [...(where.get(key) ?? []), { f, i }]);
    }
  }
  const pairs = new Map(); // one entry per pair of places and offset; consecutive windows join into one block
  for (const at of where.values()) {
    for (let x = 0; x < at.length; x++) for (let y = x + 1; y < at.length; y++) {
      const [a, b] = [at[x], at[y]];
      if (a.f === b.f && Math.abs(a.i - b.i) < COPY_LINES) continue;
      const k = `${a.f}\0${b.f}\0${b.i - a.i}`;
      pairs.set(k, [...(pairs.get(k) ?? []), a.i]);
    }
  }
  const out = [];
  for (const [k, starts] of pairs) {
    const [fa, fb, off] = k.split("\0");
    starts.sort((x, y) => x - y);
    let s = starts[0];
    for (let j = 1; j <= starts.length; j++) {
      if (j < starts.length && starts[j] === starts[j - 1] + 1) continue;
      const e = starts[j - 1] + COPY_LINES - 1;
      const A = seqs.get(fa);
      const B = seqs.get(fb);
      const a = { file: fa, start: A[s].n, end: A[e].n };
      const b = { file: fb, start: B[s + Number(off)].n, end: B[e + Number(off)].n };
      out.push({ a, b, lines: a.end - a.start + 1 });
      if (j < starts.length) s = starts[j];
    }
  }
  return out.sort((x, y) => y.lines - x.lines || x.a.file.localeCompare(y.a.file));
}

// ---- Names that mislead: helpers2.js, NewHeader.js, cart-old.js ----

const GENERIC = new Set(["helper", "helpers", "util", "utils", "common", "misc", "stuff", "shared", "lib", "tools", "functions", "component", "components"]);
function misleading(files) {
  const stems = new Map();
  for (const f of files) stems.set(stem(f).toLowerCase(), [...(stems.get(stem(f).toLowerCase()) ?? []), f]);
  const out = [];
  for (const f of files) {
    const s = stem(f);
    const word = s.match(/^(?:New|Old|Temp|Tmp|Copy|My)([A-Z]\w*)$/)?.[1] ?? s.match(/^(.+?)(?:[-_. ](?:[Cc]opy|[Oo]ld|[Nn]ew|[Ff]inal|[Tt]e?mp|[Bb]ackup|[Bb]ak)|Copy|Old|New|Final|Temp|Tmp|Backup|Bak)$/)?.[1] ?? null;
    const numbered = s.match(/^(.+?)[-_. ]?v?\d+$/i)?.[1];
    const base = word ?? (numbered && (GENERIC.has(numbered.toLowerCase()) || stems.has(numbered.toLowerCase())) ? numbered : null);
    if (!base) continue;
    const others = (stems.get(base.toLowerCase()) ?? []).filter((x) => x !== f);
    out.push({ file: f, plain: base, note: others.length ? `there is also ${others[0]}` : `the only ${base.toLowerCase()}` });
  }
  return out.sort((a, b) => a.file.localeCompare(b.file));
}

// ---- Design values typed by hand: colours and spacing ----

const hex = (h) => {
  let x = h.slice(1).toLowerCase();
  if (x.length <= 4) x = [...x].map((c) => c + c).join("");
  return `#${x}`;
};
const rgbHex = (m) => {
  const n = m.match(/[\d.]+%?/g)?.map(Number) ?? [];
  if (n.length < 3 || (n.length > 3 && n[3] !== 1)) return null;
  return `#${n.slice(0, 3).map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
};
const near = (a, b) => a.length === 7 && b.length === 7 && a !== b && [1, 3, 5].reduce((s, i) => s + Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)), 0) <= 6;

function designValues(dir, files) {
  const colours = new Map();
  const spacing = new Map();
  const note = (map, v, f) => map.set(v, [...new Set([...(map.get(v) ?? []), f])]);
  for (const f of files) {
    const t = text(dir, f).replace(/\/\*[\s\S]*?\*\//g, "");
    if (STYLE.test(f)) {
      for (const m of t.matchAll(/([\w-]+)\s*:\s*([^;{}]+)/g)) {
        if (m[1].startsWith("--")) continue; // a custom property is a token, not a value typed by hand
        for (const c of m[2].matchAll(/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?)\([^)]*\)/g)) {
          const v = c[0].startsWith("#") ? ([4, 5, 7, 9].includes(c[0].length) ? hex(c[0]) : null) : rgbHex(c[0]);
          if (v) note(colours, v, f);
        }
        if (/^(margin|padding|gap|row-gap|column-gap|inset|top|right|bottom|left)(-|$)/.test(m[1])) for (const px of m[2].matchAll(/(-?\d+(?:\.\d+)?)px\b/g)) note(spacing, Number(px[1]), f);
      }
    } else {
      for (const c of t.matchAll(/(?<=[\s:("'`,=])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?=[\s;,)"'`!]|$)/gm)) {
        const before = t.slice(Math.max(0, c.index - 6), c.index);
        if (/href=["']?$|--[\w-]*:\s*$/.test(before)) continue;
        note(colours, hex(c[0]), f);
      }
    }
  }
  const cvals = [...colours.keys()].sort();
  const svals = [...spacing.keys()].sort((a, b) => a - b);
  const nearC = [];
  for (let i = 0; i < cvals.length; i++) for (let j = i + 1; j < cvals.length; j++) if (near(cvals[i], cvals[j])) nearC.push([cvals[i], cvals[j]]);
  const nearS = [];
  for (let i = 0; i < svals.length; i++) for (let j = i + 1; j < svals.length; j++) if (Math.abs(svals[i] - svals[j]) === 1) nearS.push([svals[i], svals[j]]);
  // Near copies: in each group of colours that are near each other, all but one are copies.
  const group = new Map(cvals.map((c) => [c, c]));
  const root = (c) => (group.get(c) === c ? c : root(group.get(c)));
  for (const [a, b] of nearC) group.set(root(b), root(a));
  const sizes = new Map();
  for (const c of cvals) sizes.set(root(c), (sizes.get(root(c)) ?? 0) + 1);
  const groups = [...sizes.values()].filter((n) => n > 1);
  return {
    colours: { count: cvals.length, files: new Set([...colours.values()].flat()).size, values: cvals.map((v) => ({ value: v, files: colours.get(v) })), near: nearC, copies: groups.reduce((s, n) => s + n - 1, 0), groups: groups.length },
    spacing: { count: svals.length, files: new Set([...spacing.values()].flat()).size, values: svals, near: nearS },
  };
}

// ---- The repo's own tools, when installed ----

export const TOOLS = [["knip", "knip"], ["jscpd", "jscpd"], ["dependency-cruiser", "depcruise"]];
// On Windows npm puts a .cmd beside each tool, and that is the one Windows can run.
export function findTool(dir, bin) {
  const name = process.platform === "win32" ? `${bin}.cmd` : bin;
  for (const d of [join(dir, "node_modules", ".bin"), ...(process.env.PATH ?? "").split(delimiter).filter(Boolean)]) {
    const p = join(d, name);
    try {
      if (statSync(p).isFile()) return p;
    } catch {}
  }
  return null;
}
const TOOL_TIMEOUT = 5 * 60 * 1000;
// Node runs a .cmd only through cmd.exe, so there each word is quoted for it.
const runTool = (dir, bin, args) => {
  const opts = { cwd: dir, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, timeout: TOOL_TIMEOUT, killSignal: "SIGKILL", env: offline(process.env), windowsHide: true };
  const quote = (w) => `"${w.replaceAll('"', '""')}"`;
  const r = /\.cmd$/i.test(bin) ? spawnSync([bin, ...args].map(quote).join(" "), { ...opts, shell: true }) : spawnSync(bin, args, opts);
  return r.error ? null : r.stdout;
};
const parse = (s) => {
  try {
    return JSON.parse(s.slice(s.indexOf("{")));
  } catch {
    return null;
  }
};

function viaKnip(dir, bin) {
  const out = parse(runTool(dir, bin, ["--reporter", "json", "--no-progress", "--no-exit-code"]) ?? "");
  if (!out || !Array.isArray(out.issues)) return null;
  const rel = (p) => norm(isAbsolute(p) ? relative(dir, p) : p);
  const files = new Set((Array.isArray(out.files) ? out.files : []).map(rel));
  const exports = [];
  for (const i of out.issues) {
    if (i.files === true || (Array.isArray(i.files) && i.files.length)) files.add(rel(i.file));
    for (const e of Array.isArray(i.exports) ? i.exports : []) if (e?.name) exports.push({ file: rel(i.file), name: e.name });
  }
  return { unusedFiles: [...files].sort(), unusedExports: exports.sort((a, b) => a.file.localeCompare(b.file) || a.name.localeCompare(b.name)) };
}

function viaDepcruise(dir, bin) {
  const out = parse(runTool(dir, bin, ["--no-config", "--output-type", "json", "--exclude", "(^|/)(node_modules|dist|build|coverage)/", "."]) ?? "");
  if (!out || !Array.isArray(out.modules)) return null;
  const edges = new Map();
  let seen = false;
  for (const m of out.modules) for (const d of m.dependencies ?? []) {
    if (d.circular === undefined) continue;
    seen = true;
    if (d.circular) edges.set(norm(m.source), new Set([...(edges.get(norm(m.source)) ?? []), norm(d.resolved)]));
  }
  if (!seen) return null; // this version does not mark loops: the built-in graph answers
  return { edges };
}

function viaJscpd(dir, bin) {
  const outDir = mkdtempSync(join(tmpdir(), "repo-fit-jscpd-"));
  try {
    runTool(dir, bin, ["--silent", "--reporters", "json", "--output", outDir, "--min-lines", String(COPY_LINES), "--ignore", "**/node_modules/**,**/dist/**,**/build/**,**/coverage/**", "."]);
    const out = parse(text(outDir, "jscpd-report.json"));
    if (!out || !Array.isArray(out.duplicates)) return null;
    const real = realpathSync(dir);
    const rel = (p) => norm(isAbsolute(p) ? relative(real, realpathSync(p)) : p);
    return out.duplicates.flatMap((d) => {
      const a = d.firstFile;
      const b = d.secondFile;
      if (!a?.name || !b?.name) return [];
      const side = (x) => ({ file: rel(x.name), start: x.start ?? x.startLoc?.line, end: x.end ?? x.endLoc?.line });
      return [{ a: side(a), b: side(b), lines: d.lines ?? (side(a).end - side(a).start + 1) }];
    });
  } catch {
    return null;
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}

// Folders below the top with their own package.json: apps of their own, with their own import settings and checks.
// A package.json that only sets the module type is not one. Only the outermost counts, so an app inside an app is part
// of it.
const APP_KEYS = ["name", "dependencies", "devDependencies", "scripts", "workspaces"];
export function appsIn(dir, files) {
  const dirs = files.filter((f) => !OUT.test(f) && /\/package\.json$/.test(f) && APP_KEYS.some((k) => json(dir, f)?.[k] !== undefined)).map((f) => posix.dirname(f)).sort();
  return dirs.filter((d, i) => !dirs.slice(0, i).some((o) => d.startsWith(`${o}/`)));
}
const fold = (p) => String(p).normalize("NFC").toLowerCase(); // "Web/x" is web/x on a Mac or Windows disk
export const inApp = (apps, f) => apps.some((a) => fold(f).startsWith(`${fold(a)}/`));
const REF = /(?:\.\.?\/)+[\w@$.~+\/-]+/g; // "../../src/boot.js" in a page, a package.json script or a config file
const APP_CONFIG = /(^|\/)([^/]*\.config|\.[\w-]*rc)\.[cm]?[jt]s$/i; // vite.config.ts, .eslintrc.cjs: paths in them are text

// The top's files an app reaches: by a relative path or its own tsconfig/jsconfig paths, by a pattern or a folder
// (dynamic imports, import.meta.glob, require.context), from its pages, scripts and config files, and from its type
// files. Stylesheets, data and other files it names count too, so a plan cannot move them. A name its settings cannot
// place goes through the top's resolver, which counts every file it may name as used. An app file that loads code by
// a name only known when it runs is unsure, as at the top.
function reachedByApps(dir, files, apps, graph, resolve) {
  const findCode = finder(new Set(graph));
  const findAny = finder(new Set(files.filter((f) => !inApp(apps, f) && !/(^|\/)node_modules\//.test(f))));
  const find = (p) => findCode(p) ?? findAny(p);
  const byApp = new Map();
  const unsure = [];
  for (const app of apps) {
    const al = aliases(join(dir, app));
    const hit = (f) => f && !byApp.has(f) && byApp.set(f, app);
    const under = (start) => graph.filter((g) => g.startsWith(posix.normalize(start))).forEach(hit);
    const own = (spec) => [...al.paths.filter((a) => a.from && spec.startsWith(a.from)).flatMap((a) => a.to.map((to) => posix.join(app, to, spec.slice(a.from.length)))), ...al.bases.map((b) => posix.join(app, b, spec))];
    for (const f of files.filter((x) => inApp([app], x) && !/(^|\/)node_modules\//.test(x))) {
      const t = text(dir, f);
      if (/\.(html?|json|ya?ml|toml|md|mdx|txt)$|(^|\/)\.?[\w.-]*rc$/i.test(f) || APP_CONFIG.test(f)) for (const m of t.matchAll(REF)) hit(find(posix.normalize(posix.join(posix.dirname(f), m[0].replace(/[?#].*$/, "")))));
      if (!GRAPH.test(f)) continue;
      if (computed(t)) unsure.push(f);
      for (const im of importsOf(t)) {
        const spec = im.spec.replace(/\?.*$/, "").replace(/(.)#.*$/, "$1");
        const tries = spec.startsWith(".") ? [posix.join(posix.dirname(f), spec)] : own(spec);
        if (im.prefix) tries.forEach(under);
        else for (const x of tries) hit(find(posix.normalize(x)));
        if (!spec.startsWith(".")) {
          const r = resolve(f, im.spec, im.prefix);
          for (const x of r ? (typeof r === "string" ? [r] : r.loose) : []) hit(x);
        }
      }
    }
  }
  return { byApp, unsure };
}

// Everything the code sweep found. `files` are the paths in the last commit; `dir` is a copy of it.
export function analyze(dir, files, project) {
  const apps = appsIn(dir, files);
  const live = files.filter((f) => !OUT.test(f) && !inApp(apps, f));
  const graph = live.filter((f) => GRAPH.test(f));
  const resolve = resolver(graph, dir);
  const edges = new Map(graph.map((f) => [f, new Set()]));
  const loopEdges = new Map(graph.map((f) => [f, new Set()]));
  const used = new Map();
  const unsure = [];
  const tested = new Set(); // code files a test imports: where a deliberate break shows whether the tests notice
  const markUsed = (f, ns) => (ns === "*" ? used.set(f, "*") : used.get(f) !== "*" && used.set(f, new Set([...(used.get(f) ?? []), ...ns])));
  for (const f of graph) {
    const t = text(dir, f);
    if (computed(t)) unsure.push(f);
    for (const im of importsOf(t)) {
      const r = resolve(f, im.spec, im.prefix);
      if (!r) continue;
      for (const t of typeof r === "string" ? [r] : r.loose) {
        edges.get(f).add(t);
        if (!im.dynamic && !im.type && typeof r === "string") loopEdges.get(f).add(t);
        if (TEST.test(f) && typeof r === "string" && !TEST.test(t)) tested.add(t);
        markUsed(t, typeof r === "string" ? im.names : "*");
      }
    }
  }
  const entries = entriesOf(dir, files.filter((f) => !inApp(apps, f)), graph, project, resolve);
  const topEntries = entries.size; // without any, nothing is called unused; an inner app's imports do not change that
  const byApps = reachedByApps(dir, files, apps, graph, resolve);
  unsure.push(...byApps.unsure);
  for (const f of byApps.byApp.keys()) {
    if (!edges.has(f)) continue; // a stylesheet or data file: kept by usedByApps, not part of the import graph
    entries.add(f);
    markUsed(f, "*");
  }
  const appReach = new Set(); // the top's code an app reaches, also through other top files: knip does not see the app
  for (const queue = [...byApps.byApp.keys()]; queue.length; ) {
    const f = queue.pop();
    if (appReach.has(f)) continue;
    appReach.add(f);
    queue.push(...(edges.get(f) ?? []));
  }
  const reached = new Set();
  const queue = [...entries];
  while (queue.length) {
    const f = queue.pop();
    if (reached.has(f)) continue;
    reached.add(f);
    queue.push(...(edges.get(f) ?? []));
  }
  const code = graph.filter((f) => !TEST.test(f));
  let unusedFiles = topEntries ? code.filter((f) => !reached.has(f)) : [];
  let unusedExports = [];
  for (const f of code.filter((x) => reached.has(x) && !entries.has(x))) {
    const u = used.get(f) ?? new Set();
    if (u === "*") continue;
    for (const n of exportsOf(text(dir, f))) if (!u.has(n)) unusedExports.push({ file: f, name: n });
  }
  const from = { unused: "built-in", loops: "built-in", copies: "built-in" };
  const tools = Object.fromEntries(TOOLS.map(([name, bin]) => [name, Boolean(findTool(dir, bin))]));
  if (tools.knip) {
    const k = viaKnip(dir, findTool(dir, "knip"));
    if (k) {
      unusedFiles = k.unusedFiles.filter((f) => !inApp(apps, f) && !appReach.has(f));
      unusedExports = k.unusedExports.filter((e) => !inApp(apps, e.file) && !appReach.has(e.file));
      from.unused = "knip";
    }
  }
  let loopGraph = loopEdges;
  if (tools["dependency-cruiser"]) {
    const d = viaDepcruise(dir, findTool(dir, "depcruise"));
    if (d) {
      loopGraph = new Map([...d.edges].filter(([f]) => !inApp(apps, f)).map(([f, to]) => [f, new Set([...to].filter((t) => !inApp(apps, t)))]));
      from.loops = "dependency-cruiser";
    }
  }
  const cycles = loops([...loopGraph.keys()], loopGraph);
  let copied = copies(dir, code.filter((f) => GRAPH.test(f)));
  if (tools.jscpd) {
    const j = viaJscpd(dir, findTool(dir, "jscpd"));
    if (j) {
      copied = j.filter((c) => !inApp(apps, c.a.file) && !inApp(apps, c.b.file));
      from.copies = "jscpd";
    }
  }
  const values = designValues(dir, live.filter((f) => VALUES.test(f) && !TEST.test(f) && !TOKENS.test(f)));
  return {
    apps,
    usedByApps: Object.fromEntries([...byApps.byApp].sort(([a], [b]) => a.localeCompare(b))),
    files: graph.length,
    graph: graph.length > 0,
    from,
    tools,
    unusedFiles: unusedFiles.sort(),
    unsure: unsure.sort(),
    tested: [...tested].sort(),
    unusedExports: unusedExports.sort((a, b) => a.file.localeCompare(b.file) || a.name.localeCompare(b.name)),
    cycles,
    loopPaths: cycles.map((c) => loopPath(c, loopGraph)),
    copies: copied,
    misleading: misleading(code),
    ...values,
  };
}
