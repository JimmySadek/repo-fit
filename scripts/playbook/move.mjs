// Managed by repo-fit: change it there and run `repo-fit update`, not here.
// The safe move engine. It plans a batch of moves, refuses what must stay, rewrites links in both directions in each
// link's own style, ties the yes to the exact plan (a fingerprint), journals before the first move, verifies after,
// rolls back on any failure, recovers after a crash, and writes a receipt that `undo` replays. It never deletes a file.
//   planMoves(root, [{ from, to, why }], { protect })  → the plan: moves, refused (with why), link edits, mentions
//   applyMoves(root, plan)                             → moves, rewrites, verifies; rolls back on failure
//   recover(root)                                      → puts back an interrupted run (also runs before apply and undo)
// Paths are relative to the root, with forward slashes. Works with and without Git; never commits.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, rmdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join, posix } from "node:path";

const SKIP = new Set([".git", ".playbook", "node_modules", ".venv", "venv", "__pycache__", ".cache"]);
const NOTE = /\.(md|mdx|markdown)$/i;
const PLAIN = /\.(md|mdx|markdown|txt)$/i; // a mention here is listed for the person, never a reason to stay
const RULES = /(^|\/)(AGENTS|CLAUDE|GEMINI)\.md$/;
const CODE = /\.(js|mjs|cjs|ts|tsx|jsx|py|rs|go|java|kt|rb|php|swift|c|cc|cpp|h|hpp|cs|sh|bash|zsh|ps1|sql|vue|svelte|astro|html?|css|scss|sass|less|r|jl|lua|pl|ipynb)$/i;
const CONFIG = /(^|\/)(package(-lock)?\.json|tsconfig[^/]*\.json|jsconfig\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb|pyproject\.toml|setup\.cfg|setup\.py|requirements[^/]*\.txt|Pipfile(\.lock)?|poetry\.lock|Cargo\.(toml|lock)|go\.(mod|sum)|Gemfile(\.lock)?|composer\.(json|lock)|Makefile|Dockerfile|docker-compose[^/]*|\.env[^/]*|[^/]+\.config\.[a-z]+)$|\.(toml|ini|cfg|ya?ml|lock)$/i;
const MEDIA = /\.(png|jpe?g|gif|webp|svg|heic|bmp|tiff?|ico|pdf|docx?|xlsx?|pptx?|odt|rtf|pages|key|numbers|epub|zip|gz|tar|7z|mp[34]|mov|webm|avi|mkv|wav|m4a|aac|flac|ogg|psd|ai|sketch|fig|pt|pth|onnx|bin|ttf|otf|woff2?)$/i;
const MANIFEST =/^(package\.json|pyproject\.toml|Cargo\.toml|go\.mod|Gemfile|composer\.json|setup\.py)$/;
const BIG = 1024 * 1024;

const shaText = (s) => createHash("sha256").update(s).digest("hex");
const shaFile = (abs) => createHash("sha256").update(readFileSync(abs)).digest("hex");
const nfc = (s) => s.normalize("NFC");
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const dirOf = (p) => posix.dirname(p);

// Every file under the root, except Git's and repo-fit's own folders.
export function files(root) {
  const out = [];
  const walk = (rel) => {
    let list;
    try {
      list = readdirSync(join(root, rel), { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of list) {
      if (SKIP.has(e.name)) continue;
      const p = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(p);
      else if (e.isFile() || e.isSymbolicLink()) out.push(p);
    }
  };
  walk("");
  return out.sort();
}

function readText(root, p) {
  if (MEDIA.test(p)) return null;
  try {
    const abs = join(root, p);
    if (statSync(abs).size > BIG) return null;
    const buf = readFileSync(abs);
    if (buf.subarray(0, 8000).includes(0)) return null; // binary
    return buf.toString("utf8");
  } catch {
    return null;
  }
}

// ---------- the link scanner ----------

// Every link in a Markdown text, in order: { kind, dest, start, end, angle, embed }. `dest` is the destination as
// written (for wikilinks: the target with its #heading, without the alias); start/end locate it in the text.
// Code blocks and inline code are not links. External links and same-page anchors are left out.
export function scanLinks(text) {
  const out = [];
  let offset = 0;
  let fence = null;
  for (const line of text.split("\n")) {
    const lineStart = offset;
    offset += line.length + 1;
    const f = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (f) {
      if (!fence) fence = f[1][0];
      else if (f[1][0] === fence) fence = null;
      continue;
    }
    if (fence) continue;
    const masked = line.replace(/(`+)[^`]*?\1/g, (m) => " ".repeat(m.length)); // inline code is not a link
    const add = (kind, dest, at, extra = {}) => {
      if (!dest || /^[a-z][a-z0-9+.-]*:/i.test(dest) || dest.startsWith("#") || dest.startsWith("//")) return;
      out.push({ kind, dest, start: lineStart + at, end: lineStart + at + dest.length, ...extra });
    };
    const ref = masked.match(/^(\s{0,3}\[[^\]]+\]:\s*)(?:<([^>]*)>|(\S+))/);
    if (ref) add("ref", ref[2] ?? ref[3], ref[1].length + (ref[2] !== undefined ? 1 : 0), { angle: ref[2] !== undefined });
    for (const m of masked.matchAll(/!?\[[^\]\n]*\]\(\s*(?:<([^>\n]*)>|([^)\s]+))/g)) {
      const angle = m[1] !== undefined;
      const dest = angle ? m[1] : m[2];
      add("inline", dest, m.index + m[0].length - dest.length - (angle ? 1 : 0), { angle });
    }
    for (const m of masked.matchAll(/<(?:img|a|source|video|audio|iframe)\b[^>]*?\s(?:src|href)\s*=\s*(["'])(.*?)\1/gi)) {
      add("html", m[2], m.index + m[0].length - 1 - m[2].length);
    }
    for (const m of masked.matchAll(/(!?)\[\[([^\]|\n]+?)(\|[^\]\n]*)?\]\]/g)) {
      add("wiki", m[2], m.index + m[1].length + 2, { embed: m[1] === "!" });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

// The file (or folder) a link points at, in a folder whose files are `index` (NFC path → real path) and whose file
// names are `names` (lower-case name, with and without .md → paths). Returns { path, folder, noExt, root, bare, frag }
// or null when it points at nothing.
function resolve(index, folders, names, from, link) {
  let raw = link.dest;
  let frag = "";
  const cut = raw.search(link.kind === "wiki" ? /#/ : /[#?]/);
  if (cut >= 0) {
    frag = raw.slice(cut);
    raw = raw.slice(0, cut);
  }
  if (link.kind === "wiki") {
    const name = raw.trim();
    if (!name.includes("/")) {
      // A bare [[name]] finds its file by name wherever it is (the one beside the note first, then the nearest), so
      // only a new name can break it.
      const hits = names.get(nfc(name).toLowerCase()) ?? [];
      if (!hits.length) return null;
      const pick = hits.find((p) => dirOf(p) === dirOf(from)) ?? [...hits].sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b))[0];
      return { path: pick, bare: true, noExt: !/\.[a-z0-9]+$/i.test(name) || (NOTE.test(pick) && !NOTE.test(name)), frag };
    }
    for (const base of ["", dirOf(from)]) {
      const p = posix.normalize(posix.join(base === "." ? "" : base, name));
      for (const [cand, noExt] of [[p, false], [`${p}.md`, true]]) {
        const real = index.get(nfc(cand));
        if (real) return { path: real, noExt, root: base === "", frag };
      }
    }
    return null;
  }
  let path = raw;
  try {
    path = decodeURIComponent(raw);
  } catch {
    /* keep the raw path */
  }
  if (!path) return null;
  const rootRel = path.startsWith("/");
  const p = posix.normalize(rootRel ? path.slice(1) : posix.join(dirOf(from), path));
  if (p.startsWith("..")) return null;
  const real = index.get(nfc(p));
  if (real) return { path: real, noExt: false, root: rootRel, frag };
  const md = index.get(nfc(`${p}.md`));
  if (md && !/\.[a-z0-9]+$/i.test(p)) return { path: md, noExt: true, root: rootRel, frag };
  const dir = p.replace(/\/$/, "");
  if (folders.has(nfc(dir))) return { path: dir, folder: true, root: rootRel, frag };
  return null;
}

const folderSet = (list, root) => {
  const s = new Set();
  for (const f of list) for (let d = dirOf(f); d !== "."; d = dirOf(d)) s.add(nfc(d));
  // An empty folder on disk is still a folder a link can point at.
  return { has: (d) => s.has(d) || (root !== undefined && d !== "" && existsSync(join(root, d)) && statSync(join(root, d)).isDirectory()) };
};
const nameMap = (list) => {
  const m = new Map();
  const add = (k, p) => m.set(k, [...(m.get(k) ?? []), p]);
  for (const p of list) {
    const b = nfc(posix.basename(p)).toLowerCase();
    add(b, p);
    if (NOTE.test(b)) add(b.replace(NOTE, ""), p);
  }
  return m;
};

// Working links: links from Markdown files that point at a file or folder that exists.
function workingLinks(root, list) {
  const index = new Map(list.map((p) => [nfc(p), p]));
  const folders = folderSet(list, root);
  const names = nameMap(list);
  let n = 0;
  const folderTargets = new Set();
  for (const f of list.filter((p) => NOTE.test(p))) {
    const text = readText(root, f);
    if (text === null) continue;
    for (const l of scanLinks(text)) {
      const r = resolve(index, folders, names, f, l);
      if (r) {
        n++;
        if (r.folder) folderTargets.add(r.path);
      }
    }
  }
  return { n, folderTargets };
}

// Every link between notes: where each one goes, and which ones point at nothing (broken). For the fit check.
export function linkReport(root, list = files(root)) {
  const index = new Map(list.map((p) => [nfc(p), p]));
  const folders = folderSet(list, root);
  const names = nameMap(list);
  const edges = new Map();
  const broken = [];
  for (const f of list.filter((p) => NOTE.test(p))) {
    const text = readText(root, f);
    if (text === null) continue;
    const to = new Set();
    for (const l of scanLinks(text)) {
      const r = resolve(index, folders, names, f, l);
      if (r) to.add(r.path);
      else if (!l.dest.startsWith("/")) broken.push({ file: f, dest: l.dest }); // "/..." may be a website address
    }
    edges.set(f, to);
  }
  return { edges, broken };
}

// The new destination text for a link, in the old one's style.
function rewrite(link, r, fromNow, target) {
  if (r.bare) {
    const b = posix.basename(target);
    return `${r.noExt ? b.replace(NOTE, "") : b}${r.frag}`;
  }
  if (link.kind === "wiki") {
    const p = r.root ? target : posix.relative(dirOf(fromNow), target);
    return `${r.noExt ? p.replace(/\.md$/i, "") : p}${r.frag}`;
  }
  let p = r.root ? `/${target}` : posix.relative(dirOf(fromNow), target) || posix.basename(target);
  if (r.noExt) p = p.replace(/\.md$/i, "");
  if (!r.root && link.dest.startsWith("./") && !p.startsWith("../")) p = `./${p}`;
  if (!link.angle) {
    // Keep %-encoding where the old link had it; a bare destination cannot hold spaces or brackets, so encode those.
    if (/%[0-9a-f]{2}/i.test(link.dest)) p = p.split("/").map((s) => encodeURIComponent(s).replace(/%2F/gi, "/")).join("/");
    p = p.replace(/ /g, "%20").replace(/\(/g, "%28").replace(/\)/g, "%29");
  }
  if (r.folder && /\/$/.test(link.dest.split(/[#?]/)[0])) p = `${p.replace(/\/$/, "")}/`;
  return `${p}${r.frag}`;
}

// ---------- the plan ----------

function gitIgnored(root, paths) {
  if (!existsSync(join(root, ".git")) || !paths.length) return new Set();
  const r = spawnSync("git", ["-C", root, "check-ignore", "-z", "--stdin"], { input: paths.join("\0"), encoding: "utf8" });
  return new Set((r.stdout ?? "").split("\0").filter(Boolean));
}

// Any case: on macOS and Windows, config that says TODO.md finds todo.md.
const mentionRe = (s) => new RegExp(`(?<![\\w.-])${esc(s)}(?![\\w-])`, "i");

export function planMoves(root, wanted, { protect = [] } = {}) {
  const list = files(root);
  const index = new Map(list.map((p) => [nfc(p), p]));
  const lower = new Set(list.map((p) => nfc(p).toLowerCase()));
  const folders = folderSet(list, root);
  const names = nameMap(list);
  const ignored = gitIgnored(root, wanted.map((m) => m.from).filter((p) => index.has(nfc(p))));
  const projects = [...list].filter((p) => p.includes("/") && MANIFEST.test(posix.basename(p))).map(dirOf);
  const isProt = (p) => protect.some((x) => (x.endsWith("/") ? p.startsWith(x) : p === x || p.startsWith(`${x}/`)));
  const texts = new Map();
  const text = (p) => (texts.has(p) ? texts.get(p) : texts.set(p, readText(root, p)).get(p));

  const moves = [];
  const refused = [];
  const seenFrom = new Set();
  const seenTo = new Set();
  for (const w of wanted) {
    const from = posix.normalize(w.from);
    const to = posix.normalize(w.to);
    const no = (why) => refused.push({ from: w.from, to: w.to, why });
    const real = index.get(nfc(from));
    if (!real) no("It is not there (missing, or already moved).");
    else if (seenFrom.has(real)) no("The same file is in the plan twice.");
    else if (to.startsWith("..") || posix.isAbsolute(to) || to.split("/").some((s) => s.startsWith(".") || SKIP.has(s))) no("The new place is outside the folder or in a hidden folder.");
    else if (nfc(to) === nfc(real)) no("It is already in that place.");
    else if (lower.has(nfc(to).toLowerCase())) no(`A file is already at ${to}.`);
    else if (seenTo.has(nfc(to).toLowerCase())) no(`Two files would go to the same place, ${to}.`);
    else if (dirOf(to) !== "." && dirOf(to).split("/").some((_, i, a) => index.has(nfc(a.slice(0, i + 1).join("/"))))) no(`A file has the name of a folder on the way to ${to}.`);
    else if (real.split("/").slice(0, -1).some((s) => s.startsWith("."))) no("It is in a hidden (dot) folder, which tools use.");
    else if (isProt(real)) no("It is in a protected path.");
    else if (lstatSync(join(root, real)).isSymbolicLink()) no("It is a shortcut (symlink); those stay where they are.");
    else if (ignored.has(real)) no("Git is told to ignore it, so it stays where it is.");
    else if (CODE.test(real) || CONFIG.test(real)) no("It is code or configuration. Code never moves.");
    else if (projects.some((d) => real.startsWith(`${d}/`))) no(`It belongs to the program in ${projects.find((d) => real.startsWith(`${d}/`))}/, which stays as it is.`);
    else {
      seenFrom.add(real);
      seenTo.add(nfc(to).toLowerCase());
      moves.push({ from: real, to, why: w.why ?? "" });
    }
  }

  // Code-reference check: a file named by code, config or rule files stays, and so does a file leaving a folder they
  // name. Links in rule files are rewritten like any link, so only plain-text mentions count there.
  const mentions = [];
  const blocked = new Map();
  // repo-fit's own scripts and inbox rules name files and folders in general, never load one of the person's files,
  // so they are not read here.
  const others = list.filter((p) => !moves.some((m) => m.from === p) && !p.startsWith("scripts/playbook/") && p !== "inbox/rules.json");
  for (const p of others) {
    const t = text(p);
    if (t === null) continue;
    const plain = PLAIN.test(p) && !RULES.test(p);
    const note = NOTE.test(p);
    let body = t;
    if (note) for (const l of [...scanLinks(t)].reverse()) body = body.slice(0, l.start) + " ".repeat(l.end - l.start) + body.slice(l.end);
    for (const m of moves) {
      const name = posix.basename(m.from);
      const hit = mentionRe(name).test(body);
      const dir = dirOf(m.from);
      // A rule file naming a folder says where things belong, not a path a tool loads, so only code and config lock a folder.
      const leaves = dir !== "." && dirOf(m.to) !== dir && !plain && !RULES.test(p) && mentionRe(`${dir}/`).test(body);
      if (plain) {
        if (hit) {
          const line = body.split("\n").findIndex((l) => mentionRe(name).test(l)) + 1;
          mentions.push({ file: p, line, name, of: m.from });
        }
      } else if ((hit || leaves) && !blocked.has(m.from)) {
        blocked.set(m.from, hit ? `${p} mentions it by name, so it stays where it is.` : `${p} names its folder ${dir}/, so it stays there.`);
      }
    }
  }
  for (const [from, why] of blocked) {
    const i = moves.findIndex((m) => m.from === from);
    refused.push({ from, to: moves[i].to, why });
    moves.splice(i, 1);
  }

  // Link edits, resolved against the folder after the moves: links to each moved file, and links inside it.
  const next = new Map(moves.map((m) => [m.from, m.to]));
  const now = (p) => next.get(p) ?? p;
  // A folder whose files all move to the same new place (an archived folder) has moved as a whole: links to it follow.
  const folderNext = new Map();
  const allFolders = new Set(list.flatMap((p) => p.split("/").slice(0, -1).map((_, i, a) => a.slice(0, i + 1).join("/"))));
  for (const d of allFolders) {
    const inside = list.filter((p) => p.startsWith(`${d}/`));
    if (!inside.every((p) => next.has(p))) continue;
    const to = new Set(inside.map((p) => {
      const rest = p.slice(d.length + 1);
      const t = next.get(p);
      return t.endsWith(`/${rest}`) ? t.slice(0, -rest.length - 1) : null;
    }));
    if (to.size === 1 && [...to][0]) folderNext.set(nfc(d), [...to][0]);
  }
  const keepFolders = new Set(); // folders a link still points at: never removed when the moves empty them
  const edits = [];
  for (const f of list.filter((p) => NOTE.test(p))) {
    const t = text(f);
    if (t === null) continue;
    let out = t;
    let count = 0;
    for (const l of [...scanLinks(t)].reverse()) {
      const r = resolve(index, folders, names, f, l);
      if (!r) continue;
      if (r.folder && !folderNext.has(nfc(r.path))) keepFolders.add(r.path);
      const target = r.folder ? folderNext.get(nfc(r.path)) ?? r.path : now(r.path);
      if (target === r.path && now(f) === f) continue;
      if (r.bare && posix.basename(target) === posix.basename(r.path)) continue; // same name: still found
      const dest = rewrite(l, r, now(f), target);
      if (dest === l.dest) continue;
      out = out.slice(0, l.start) + dest + out.slice(l.end);
      count++;
    }
    if (count) edits.push({ path: f, at: now(f), old: t, content: out, links: count });
  }

  const fingerprint = shaText(JSON.stringify({ moves: moves.map((m) => [m.from, m.to]), files: [...new Set([...moves.map((m) => m.from), ...edits.map((e) => e.path)])].sort().map((p) => [p, shaFile(join(root, p))]) }));
  return { moves, refused, edits, mentions, fingerprint, wanted, protect, keepFolders: [...keepFolders] };
}

// ---------- apply, verify, roll back, recover ----------

const stamp = () => new Date().toISOString().replace(/[:.]/g, "-");
const journalPath = (root) => join(root, ".playbook/journal.json");
const saveJournal = (root, j) => writeFileSync(journalPath(root), `${JSON.stringify(j, null, 2)}\n`);

function ensurePlaybook(root) {
  mkdirSync(join(root, ".playbook"), { recursive: true });
  const ignore = join(root, ".playbook/.gitignore");
  if (!existsSync(ignore) || readFileSync(ignore, "utf8") === "backups/\nundone/\n") writeFileSync(ignore, "*\n");
}

// Puts back every step a journal says was done, newest first. Backups and the person's files are never deleted.
function rollback(root, j) {
  for (const s of [...j.steps.slice(0, j.done)].reverse()) {
    try {
      if (s.t === "mkdir") rmdirSync(join(root, s.dir));
      else if (s.t === "rmdir") mkdirSync(join(root, s.dir), { recursive: true });
      else if (s.t === "create") unlinkSync(join(root, s.path)); // a page this run made, never the person's file
      else if (s.t === "edit") copyFileSync(join(root, s.backup), join(root, s.path));
      else if (s.t === "move" && existsSync(join(root, s.to)) && !existsSync(join(root, s.from))) {
        mkdirSync(join(root, dirOf(s.from)), { recursive: true });
        renameSync(join(root, s.to), join(root, s.from));
      }
    } catch {
      /* a folder that is not empty stays; everything else was checked above */
    }
  }
  unlinkSync(journalPath(root));
}

export function recover(root) {
  if (!existsSync(journalPath(root))) return { recovered: false, text: "" };
  const j = JSON.parse(readFileSync(journalPath(root), "utf8"));
  rollback(root, j);
  return { recovered: true, text: `↩️ An earlier run of repo-fit stopped halfway (${j.date}). Its ${j.done} change(s) were put back first, so the folder is as it was before that run.` };
}

// `writes(root)`, when given, returns pages to write after the moves (path → content), such as the rebuilt map; they go
// in the same journal and receipt, so one undo takes back the moves, the link edits and the pages.
export function applyMoves(root, plan, { step = "organize", crashAfter, extra = {}, writes } = {}) {
  const out = [];
  const rec = recover(root);
  if (rec.recovered) out.push(rec.text);
  const fresh = planMoves(root, plan.wanted, { protect: plan.protect });
  if (fresh.fingerprint !== plan.fingerprint) return { ok: false, text: [...out, "❌ Something in the folder changed since the plan was shown, so nothing was moved. Look at the new plan and say yes again."].join("\n") };
  if (!fresh.moves.length) return { ok: true, text: [...out, "Nothing to move."].join("\n") };

  const before = files(root);
  const linksBefore = workingLinks(root, before);
  const hashes = new Map(fresh.moves.map((m) => [m.from, shaFile(join(root, m.from))]));
  const ts = stamp();
  ensurePlaybook(root);

  // The journal lists every step before the first one runs, with backups of every file whose links change.
  const steps = [];
  const made = new Set();
  for (const m of fresh.moves) {
    for (let d = dirOf(m.to), chain = []; ; d = dirOf(d)) {
      if (d === "." || existsSync(join(root, d)) || made.has(d)) {
        for (const c of chain.reverse()) steps.push({ t: "mkdir", dir: c });
        break;
      }
      chain.push(d);
      made.add(d);
    }
    steps.push({ t: "move", from: m.from, to: m.to });
  }
  for (const e of fresh.edits) {
    const backup = join(".playbook/backups", ts, e.path);
    mkdirSync(join(root, dirOf(backup)), { recursive: true });
    copyFileSync(join(root, e.path), join(root, backup));
    steps.push({ t: "edit", path: e.at, backup, content: e.content });
  }
  const j = { date: new Date().toISOString(), state: "applying", done: 0, steps };
  saveJournal(root, j);

  const run = (s) => {
    if (s.t === "mkdir") mkdirSync(join(root, s.dir));
    else if (s.t === "move") renameSync(join(root, s.from), join(root, s.to));
    else if (s.t === "edit") writeFileSync(join(root, s.path), s.content);
    else if (s.t === "create") writeFileSync(join(root, s.path), s.content, { flag: "wx" });
    else if (s.t === "rmdir") rmdirSync(join(root, s.dir));
  };
  const runAdded = (s) => {
    j.steps.push(s);
    run(s);
    j.done++;
    saveJournal(root, j);
  };
  const pageEntries = [];
  let failure = null;
  try {
    for (const s of steps) {
      if (crashAfter !== undefined && j.done >= crashAfter) return { ok: false, crashed: true, text: "Stopped on purpose (test)." };
      run(s);
      j.done++;
      saveJournal(root, j);
    }
    // Folders the moves emptied are removed, unless a link points at them. Undo brings them back.
    const emptied = [...new Set(fresh.moves.flatMap((m) => {
      const chain = [];
      for (let d = dirOf(m.from); d !== "."; d = dirOf(d)) chain.push(d);
      return chain;
    }))].sort((a, b) => b.length - a.length);
    for (const d of emptied) {
      if (fresh.keepFolders.includes(d) || !existsSync(join(root, d)) || readdirSync(join(root, d)).length) continue;
      runAdded({ t: "rmdir", dir: d });
    }
    // Verify: the same files, the same content (only link lines edited), and no fewer working links.
    const after = files(root);
    const linksAfter = workingLinks(root, after);
    const editedAt = new Map(fresh.edits.map((e) => [e.at, e.content]));
    const wrong = fresh.moves.filter((m) => !existsSync(join(root, m.to)) || (editedAt.has(m.to) ? readFileSync(join(root, m.to), "utf8") !== editedAt.get(m.to) : shaFile(join(root, m.to)) !== hashes.get(m.from)));
    if (after.length !== before.length) failure = `the folder had ${before.length} files before and ${after.length} after`;
    else if (wrong.length) failure = `${wrong[0].to} is not the same file after the move`;
    else if (linksAfter.n < linksBefore.n) failure = `working links went from ${linksBefore.n} to ${linksAfter.n}`;
    // Pages written after the moves (the map, index pages): an edit is backed up first, a new page is created.
    if (!failure) for (const [p, content] of writes ? writes(root) : []) {
      if (existsSync(join(root, p))) {
        const old = readFileSync(join(root, p), "utf8");
        if (old === content) continue;
        const backup = join(".playbook/backups", ts, "pages", p);
        mkdirSync(join(root, dirOf(backup)), { recursive: true });
        copyFileSync(join(root, p), join(root, backup));
        runAdded({ t: "edit", path: p, backup, content });
        pageEntries.push({ step, type: "edit", path: p, before: shaText(old), after: shaText(content), backup });
      } else {
        const chain = [];
        for (let d = dirOf(p); d !== "." && !existsSync(join(root, d)); d = dirOf(d)) chain.push(d);
        for (const d of chain.reverse()) runAdded({ t: "mkdir", dir: d });
        runAdded({ t: "create", path: p, content });
        pageEntries.push({ step, type: "create", path: p, after: shaText(content) });
      }
    }
  } catch (e) {
    failure = e.code === "EACCES" || e.code === "EPERM" ? `the system did not allow a change (${e.code})` : e.message;
  }
  if (failure) {
    rollback(root, j);
    return { ok: false, text: [...out, `❌ The moves did not go as planned (${failure}). Everything was put back as it was. Nothing was lost.`].join("\n") };
  }

  // The receipt: moves first, then link edits, so undo restores the links before it moves each file back.
  const entries = [
    ...fresh.moves.map((m) => ({ step, type: "move", from: m.from, to: m.to, hash: hashes.get(m.from), why: m.why })),
    ...fresh.edits.map((e) => ({ step, type: "edit", path: e.at, before: shaText(e.old), after: shaText(e.content), backup: steps.find((s) => s.t === "edit" && s.path === e.at).backup })),
    ...pageEntries,
  ];
  mkdirSync(join(root, ".playbook/receipts"), { recursive: true });
  const receipt = join(".playbook/receipts", `${ts}.json`);
  const dirs = j.steps.filter((s) => s.t === "mkdir").map((s) => s.dir).sort((a, b) => b.length - a.length);
  writeFileSync(join(root, receipt), `${JSON.stringify({ playbook: "move", date: j.date, steps: [step], entries, dirs, removedDirs: j.steps.filter((s) => s.t === "rmdir").map((s) => s.dir), ...extra }, null, 2)}\n`);
  unlinkSync(journalPath(root));
  const n = fresh.moves.length;
  return { ok: true, receipt, text: [...out, `✅ Moved ${n} file(s) and updated ${fresh.edits.reduce((a, e) => a + e.links, 0)} link(s) in ${fresh.edits.length} note(s). Checked after: no file lost, links still work. Undo puts everything back.`].join("\n") };
}
