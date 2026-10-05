// The map of a folder: MAP.md (one line per area) and an index page per area (one line per note).
// Built from the folder like a cache: each list sits between two marker lines and is rebuilt; the text above and below
// is the person's. A MAP.md or INDEX.md without the markers is theirs and is never touched (it is used as is).
// It never moves, renames or deletes anything.
//   node scripts/playbook/map.mjs            what would change (nothing is written)
//   node scripts/playbook/map.mjs --write    write MAP.md and the index pages
import { existsSync, readdirSync, readFileSync, realpathSync, renameSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SKIP = new Set([".git", "node_modules", ".venv", "venv", "dist", "build", ".next", ".astro", "__pycache__", ".cache", "coverage", "worktrees", ".playbook"]);
const LIMIT = 50000;
const EXT = {
  note: [".md", ".mdx"],
  image: [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".heic", ".bmp", ".tif", ".tiff"],
  document: [".pdf", ".doc", ".docx", ".odt", ".rtf", ".txt", ".pages", ".ppt", ".pptx", ".key", ".xls", ".xlsx", ".numbers", ".epub"],
  media: [".mp4", ".mov", ".webm", ".avi", ".mkv", ".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg"],
  code: [".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".py", ".rs", ".go", ".java", ".kt", ".rb", ".php", ".swift", ".c", ".cc", ".cpp", ".h", ".cs", ".sh", ".sql", ".vue", ".svelte", ".astro", ".html", ".css", ".scss"],
};
export const kindOf = (name) => {
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")).toLowerCase() : "";
  return Object.keys(EXT).find((k) => EXT[k].includes(ext)) ?? "data";
};
// The words a file name starts with, without dates, times, numbers and words like "copy" or "final". Files whose
// first words match are a family ("japan-trip-plan.md", "japan-trip-budget.md" → "japan-trip").
const STOP = new Set(["at", "the", "of", "and", "a", "an", "copy", "final", "old", "draft", "new"]);
export function nameWords(name) {
  const stem = name.replace(/\.[^.]+$/, "").replace(/\(\d+\)/g, " ").replace(/\d{4}[-_.]?\d{2}([-_.]?\d{2})?/g, " ").replace(/\d{1,2}[.:]\d{2}([.:]\d{2})?/g, " ").replace(/\bv\d+\b/gi, " ");
  return stem.split(/[\s\-_.()]+/).map((w) => w.toLowerCase()).filter((w) => w && !/^\d+$/.test(w) && !STOP.has(w));
}
const MANIFEST = /^(package\.json|pyproject\.toml|requirements\.txt|Cargo\.toml|go\.mod|pom\.xml|build\.gradle|Gemfile|composer\.json|Package\.swift|Makefile|Dockerfile)$/;
// Files that belong at the top of a folder: front doors, rule files, manifests, lock files and config. Not "loose".
const FRONT = /^(README|AGENTS|CLAUDE|GEMINI|CHANGELOG|LICEN[CS]E|CONTRIBUTING|SECURITY|CODE_OF_CONDUCT|MAP|LEARNINGS)(\.(md|txt))?$/i;
const STANDARD = /^(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|uv\.lock|poetry\.lock|Cargo\.lock|go\.sum|Gemfile\.lock|composer\.lock|playbook\.json|docker-compose\.ya?ml|tsconfig(\..+)?\.json|.+\.config\.(js|mjs|cjs|ts|json)|setup\.(py|cfg)|alembic\.ini|ruff\.toml)$/i;
const NOUN = { note: ["note", "notes"], image: ["image", "images"], document: ["document", "documents"], media: ["media file", "media files"], data: ["data file", "data files"], code: ["code file", "code files"] };
const count = (n, k) => `${n} ${NOUN[k][n === 1 ? 0 : 1]}`;
const counts = (c, kinds = ["note", "image", "document", "media", "data", "code"]) => kinds.filter((k) => c[k]).map((k) => count(c[k], k)).join(", ");
const byPath = (a, b) => (a < b ? -1 : a > b ? 1 : 0); // the same order on every computer
const MARK = (kind) => new RegExp(`<!-- repo-fit:${kind} begin[^>]*-->[\\s\\S]*?<!-- repo-fit:${kind} end -->`);
const begin = (kind) => `<!-- repo-fit:${kind} begin: made by repo-fit from the folder and rebuilt. Write your own words above or below these lines. -->`;
const end = (kind) => `<!-- repo-fit:${kind} end -->`;

// A link that works for any file name: names with spaces or brackets go inside <...>.
const href = (p) => (/[\s()<>]/.test(p) ? `<${p}>` : p);
const label = (t) => t.replace(/([[\]])/g, "\\$1");
const link = (text, p) => `[${label(text)}](${href(p)})`;

const frontmatter = (t) => t.replace(/\r\n?/g, "\n").match(/^﻿?---\n([\s\S]*?)\n---[ \t]*(\n|$)/);
const clip = (s, n = 100) => (s.length <= n ? s : `${s.slice(0, n).replace(/\s+\S*$/, "")}…`);
const plain = (s) => s.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/!?\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2").replace(/[*_`]+/g, "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

// One line about a note: its description or summary in the frontmatter, else its first real paragraph.
export function summary(text) {
  const fm = frontmatter(text);
  const d = fm?.[1].match(/^(description|summary):\s*["']?(.+?)["']?\s*$/m);
  if (d) return clip(plain(d[2]));
  const body = fm ? text.replace(/\r\n?/g, "\n").slice(fm[0].length) : text.replace(/\r\n?/g, "\n");
  for (const para of body.split(/\n\s*\n/)) {
    const p = para.trim();
    if (!p || /^(#|```|~~~|\||<!--|>|[-*+] |\d+[.)] |!\[|<img|---|===|\[[^\]]+\]:)/.test(p)) continue;
    const s = plain(p);
    if (s.length >= 12) return clip(s);
  }
  return "";
}
export function title(text, file) {
  const fm = frontmatter(text)?.[1].match(/^title:\s*["']?(.+?)["']?\s*$/m);
  if (fm) return plain(fm[1]);
  const h = text.match(/^#\s+(.+)$/m);
  return h ? plain(h[1]) : posix.basename(file).replace(/\.mdx?$/i, "");
}

// All files under root as relative paths, plus files about to be created (`virtual`: path → content).
function listFiles(root, virtual) {
  const out = new Set([...virtual.keys()].filter((p) => !p.split("/").some((s) => s.startsWith("."))));
  let n = 0;
  const walk = (rel) => {
    let entries = [];
    try {
      entries = readdirSync(join(root, rel), { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (++n > LIMIT) return;
      if (SKIP.has(e.name) || e.name.startsWith(".")) continue;
      const p = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) out.add(p);
    }
  };
  walk("");
  return [...out].sort(byPath);
}

// What the folder holds, area by area. An area is a top-level folder, in its own name.
export function scan(root, { virtual = new Map(), protect = [] } = {}) {
  const read = (p) => {
    if (virtual.has(p)) return virtual.get(p);
    try {
      return readFileSync(join(root, p), "utf8").slice(0, 65536);
    } catch {
      return "";
    }
  };
  const files = listFiles(root, virtual);
  const areas = new Map();
  const loose = [];
  for (const p of files) {
    const i = p.indexOf("/");
    if (i < 0) {
      if (!FRONT.test(p) && !STANDARD.test(p) && !MANIFEST.test(p)) loose.push(p);
      continue;
    }
    const name = p.slice(0, i);
    if (!areas.has(name)) areas.set(name, { name, files: [] });
    areas.get(name).files.push(p);
  }
  // The inbox and the archive are areas even while empty (only a hidden placeholder inside): the map says where they are.
  for (const name of ["inbox", "archive"]) {
    const there = (existsSync(join(root, name)) && statSync(join(root, name)).isDirectory()) || [...virtual.keys()].some((p) => p.startsWith(`${name}/`));
    if (!areas.has(name) && there) areas.set(name, { name, files: [] });
  }
  const isProtected = (name) => protect.some((x) => x.replace(/\/+$/, "") === name);
  const out = [];
  for (const a of areas.values()) {
    const c = {};
    if (a.name === "inbox") a.files = a.files.filter((p) => p !== "inbox/rules.json");
    for (const p of a.files) c[kindOf(p)] = (c[kindOf(p)] ?? 0) + 1;
    const notes = a.files.filter((p) => kindOf(p) === "note" && !/(^|\/)INDEX\.md$/.test(p));
    c.note = notes.length; // index pages are not notes
    const manifest = a.files.find((p) => MANIFEST.test(p.slice(a.name.length + 1)));
    const ownScripts = a.name === "scripts" && a.files.every((p) => p.startsWith("scripts/playbook/"));
    const code = ownScripts || Boolean(manifest) || ((c.code ?? 0) >= 2 && (c.code ?? 0) >= (c.note ?? 0));
    const readme = ["README.md", "readme.md", "index.md"].map((f) => `${a.name}/${f}`).find((f) => a.files.includes(f));
    const special = /^(archive|archives|_archive)$/i.test(a.name) ? "archive" : /^inbox$/i.test(a.name) ? "inbox" : null;
    // The area's index page: the person's own README or index when it links every note, else their own INDEX.md, else ours.
    let index = null;
    let generate = false;
    if (!code && !special && notes.length) {
      const own = `${a.name}/INDEX.md`;
      const ownText = a.files.includes(own) ? read(own) : null;
      const listsAll = (f) => {
        const t = read(f);
        return notes.filter((n) => n !== f).every((n) => t.includes(`](${href(posix.relative(a.name, n))})`) || t.includes(`](./${posix.relative(a.name, n)})`) || t.includes(`](${encodeURI(posix.relative(a.name, n))})`));
      };
      if (readme && listsAll(readme)) index = readme;
      else if (ownText !== null && !MARK("index").test(ownText)) index = own;
      else if (!isProtected(a.name)) [index, generate] = [own, true];
    }
    out.push({
      name: a.name, counts: c, code, ownScripts, manifest: manifest ? manifest.slice(a.name.length + 1) : null, special, index, generate,
      readme, notes: notes.map((p) => ({ path: p, title: title(read(p), p), summary: summary(read(p)) })),
      about: readme ? summary(read(readme)) : "",
    });
  }
  const order = (a) => (a.special ? 3 : a.code ? 2 : a.notes.length ? 0 : 1);
  out.sort((x, y) => order(x) - order(y) || byPath(x.name, y.name));
  const rootManifest = files.find((p) => !p.includes("/") && MANIFEST.test(p)) ?? null;
  return { areas: out, rootManifest, readme: files.includes("README.md"), loose: loose.map((p) => ({ path: p, kind: kindOf(p), title: kindOf(p) === "note" ? title(read(p), p) : p, summary: kindOf(p) === "note" ? summary(read(p)) : "" })) };
}

function mapBlock(s) {
  const lines = [begin("map"), "**Start here.** Each line is one area of this folder: what it holds and where its index is.", ""];
  if (s.readme) lines.push(`About this folder: ${link("README", "README.md")}.`, "");
  if (s.rootManifest) lines.push(`This folder is also a program (${s.rootManifest}). Code stays where it is.`, "");
  for (const a of s.areas) {
    const target = a.index ?? (a.readme && a.code ? a.readme : `${a.name}/`);
    const what = a.special === "archive" ? `old things, kept and out of the way (${counts(a.counts) || "empty"})`
      : a.special === "inbox" ? `new things waiting to be filed (${counts(a.counts) || "empty"})`
      : a.ownScripts ? "repo-fit's own scripts: the session briefing and the checks"
      : a.code ? `a program (${a.manifest ?? counts(a.counts, ["code"])}). It stays where it is`
      : counts(a.counts) || "empty";
    lines.push(`- ${link(`${a.name}/`, target)}: ${what}.${a.about && !a.special && !a.ownScripts ? ` ${a.about}` : ""}`);
    // What waits in the inbox is listed here (it has no index page), so it can be found until it is filed.
    if (a.special === "inbox") for (const n of a.notes.slice(0, 10)) lines.push(`  - ${link(n.title, n.path)}`);
    if (a.special === "inbox" && a.notes.length > 10) lines.push(`  - and ${a.notes.length - 10} more in ${link("inbox/", "inbox/")}`);
  }
  const notes = s.loose.filter((l) => l.kind === "note");
  if (s.loose.length) {
    const c = {};
    for (const l of s.loose) c[l.kind] = (c[l.kind] ?? 0) + 1;
    lines.push("", `**Loose at the top of the folder:** ${counts(c)}.`);
    for (const n of notes) lines.push(`- ${link(n.title, n.path)}${n.summary ? `: ${n.summary}` : ""}`);
  }
  lines.push(end("map"));
  return lines.join("\n");
}

function indexBlock(a) {
  const lines = [begin("index")];
  for (const n of a.notes) lines.push(`- ${link(n.title, posix.relative(a.name, n.path))}${n.summary ? `: ${n.summary}` : ""}`);
  const others = counts(a.counts, ["image", "document", "media", "data", "code"]);
  if (others) lines.push("", `Also in this folder: ${others}.`);
  lines.push(end("index"));
  return lines.join("\n");
}

// The page with the new list: created with a heading, or the list replaced between its markers. Null when the page is
// the person's own (no markers): it is left alone.
function withBlock(cur, heading, kind, block) {
  if (cur === null) return `# ${heading}\n\n${block}\n`;
  if (!MARK(kind).test(cur)) return null;
  return cur.replace(MARK(kind), () => block);
}

// The pages to write: path → full new content, only for pages that are new or change.
export function pages(root, opts = {}) {
  const s = scan(root, opts);
  const out = new Map();
  const current = (p) => (opts.virtual?.has(p) ? opts.virtual.get(p) : existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : null);
  const put = (p, next) => {
    if (next !== null && next !== current(p)) out.set(p, next);
  };
  put("MAP.md", withBlock(current("MAP.md"), "Map", "map", mapBlock(s)));
  for (const a of s.areas) if (a.generate) put(a.index, withBlock(current(a.index), a.name, "index", indexBlock(a)));
  return out;
}

// The pointer the rulebook carries: a few lines that send every session to the map first.
export const POINTER = `<!-- repo-fit:pointer begin -->\n**Start at [MAP.md](MAP.md).** It lists every area of this folder in one line; each area's index page lists its notes. Open only what the task needs. New things go in \`inbox/\`; when the briefing says items are waiting, ask the person once per kind (Yes, Yes and always, Not now) and run \`node scripts/playbook/file.mjs <item> --to <folder> [--always]\` or \`--not-now\`, as a dry run first, then with \`--apply\`.\n<!-- repo-fit:pointer end -->`;
export const withPointer = (text) => (MARK("pointer").test(text) ? text.replace(MARK("pointer"), () => POINTER) : `${text.trimEnd()}\n\n${POINTER}\n`);
export const hasPointer = (text) => MARK("pointer").test(text);

// Run directly (not imported). The real path, because a folder can have two names (macOS: /var and /private/var).
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  let protect = [];
  try {
    protect = JSON.parse(readFileSync(join(root, "playbook.json"), "utf8")).protectedPaths ?? [];
  } catch {
    /* no playbook.json: nothing extra protected */
  }
  const out = pages(root, { protect });
  if (!out.size) console.log("✅ The map and index pages are up to date.");
  for (const [p, content] of out) {
    if (process.argv.includes("--write")) {
      mkdirSync(dirname(join(root, p)), { recursive: true });
      writeFileSync(join(root, `${p}.tmp`), content); // written whole, then swapped in
      renameSync(join(root, `${p}.tmp`), join(root, p));
      console.log(`✏️ wrote ${p}`);
    } else console.log(`would write ${p}`);
  }
}
