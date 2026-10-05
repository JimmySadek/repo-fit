#!/usr/bin/env node
// Scores a folder on the outcomes in claudedocs/2026-10-05-redesign-design.md, section 7. Read-only. Not shipped to npm.
// It judges repo-fit from the outside: its own file walk and its own link reader, no repo-fit code, so a bug in
// repo-fit cannot hide itself in the scores.
//   node dev/score.mjs <folder>     scores what can be judged from the folder alone (map, find, loose files, open work)
// dev/measure.mjs uses the exports for the full before/after measurement on the test folders.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, posix, resolve } from "node:path";

const SKIP = new Set([".git", "node_modules", ".playbook"]);
const MD = /\.mdx?$/i;
// Files that belong at the top of a folder: front doors, rule files, manifests, lock files, config.
const STANDARD_ROOT = /^((README|LICEN[CS]E|CHANGELOG|CONTRIBUTING|SECURITY|CODE_OF_CONDUCT|AGENTS|CLAUDE|GEMINI|MAP)(\.(md|txt))?|package(-lock)?\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|pyproject\.toml|requirements\.txt|uv\.lock|poetry\.lock|Cargo\.(toml|lock)|go\.(mod|sum)|Gemfile(\.lock)?|composer\.(json|lock)|pom\.xml|build\.gradle|Package\.swift|Makefile|Dockerfile|docker-compose\.ya?ml|playbook\.json|tsconfig(\..+)?\.json|.+\.config\.(js|mjs|cjs|ts|json)|alembic\.ini|ruff\.toml|setup\.(py|cfg))$/i;
// Top-level notes that are front doors, not notes to find through the map.
const FRONT = /^(README|AGENTS|CLAUDE|GEMINI|CHANGELOG|LICEN[CS]E|CONTRIBUTING|SECURITY|MAP)\.md$/i;

const sha = (b) => createHash("sha256").update(b).digest("hex");
// A Markdown note keeps its fingerprint when only its links change (a move rewrites links, nothing else).
const linkless = (t) => t.replace(/\r\n?/g, "\n").replace(/\]\([^)]*\)/g, "]()").replace(/\[\[[^\]]*\]\]/g, "[[]]").replace(/^(\s{0,3}\[[^\]]+\]:)[^\n]*/gm, "$1");

// Every file under the folder (except .git, node_modules and repo-fit's own .playbook), with fingerprints.
export function snapshot(dir) {
  const files = new Map();
  const walk = (rel) => {
    for (const e of readdirSync(join(dir, rel), { withFileTypes: true })) {
      if (SKIP.has(e.name)) continue;
      const p = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) {
        const buf = readFileSync(join(dir, p));
        const md = MD.test(e.name);
        files.set(p, { hash: sha(buf), fp: md ? sha(linkless(buf.toString("utf8"))) : sha(buf), md, text: md ? buf.toString("utf8") : null });
      }
    }
  };
  walk("");
  return files;
}

// Links in one Markdown text: inline links and images, reference definitions, [[wiki links]] and ![[embeds]].
// Code blocks and inline code are not links.
export function parseLinks(text) {
  const out = [];
  let fenced = false;
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    if (/^\s{0,3}(```|~~~)/.test(raw)) {
      fenced = !fenced;
      continue;
    }
    if (fenced || /^( {4}|\t)/.test(raw)) continue;
    const line = raw.replace(/`[^`]*`/g, "");
    for (const m of line.matchAll(/\]\(\s*(<[^>]*>|[^)\s]+)(?:\s+"[^"]*")?\s*\)/g)) out.push({ kind: "md", target: m[1].replace(/^<|>$/g, "") });
    const def = line.match(/^\s{0,3}\[[^\]]+\]:\s*(<[^>]*>|\S+)/);
    if (def) out.push({ kind: "md", target: def[1].replace(/^<|>$/g, "") });
    for (const m of line.matchAll(/\[\[([^\]|#]*)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g)) if (m[1].trim()) out.push({ kind: "wiki", target: m[1].trim() });
  }
  return out;
}

// Where a link points, as a path in the snapshot, or null when it points at nothing. External links are skipped.
export function resolveLink(files, from, link) {
  if (link.kind === "md") {
    const t = link.target;
    if (/^([a-z][a-z0-9+.-]*:|#|\/\/)/i.test(t)) return undefined;
    let p = t.split("#")[0].split("?")[0];
    try {
      p = decodeURIComponent(p);
    } catch {
      /* keep the raw path */
    }
    if (!p) return undefined;
    const base = p.startsWith("/") ? p.slice(1) : posix.join(posix.dirname(from), p);
    const rel = posix.normalize(base).replace(/\/$/, "");
    for (const c of [rel, `${rel}.md`, `${rel}/INDEX.md`, `${rel}/README.md`]) if (files.has(c)) return c;
    // A link to a folder that exists counts as working.
    if ([...files.keys()].some((k) => k.startsWith(`${rel}/`))) return rel;
    return null;
  }
  const name = link.target.replace(/\\/g, "/");
  const want = /\.[a-z0-9]+$/i.test(name) ? name : `${name}.md`;
  if (name.includes("/")) return files.has(want) ? want : null;
  const hits = [...files.keys()].filter((k) => basename(k).toLowerCase() === want.toLowerCase());
  return hits.sort((a, b) => a.split("/").length - b.split("/").length)[0] ?? null;
}

export function linkEdges(files, only) {
  const edges = [];
  for (const [p, f] of files) {
    if (!f.md || (only && !only.has(p))) continue;
    for (const l of parseLinks(f.text)) {
      const to = resolveLink(files, p, l);
      if (to !== undefined) edges.push({ from: p, target: l.target, to });
    }
  }
  return edges;
}

// Finds where each original file went: same fingerprint (links may differ), preferring the same path, then the same name.
export function locator(before, after) {
  const byFp = new Map();
  for (const [p, f] of after) byFp.set(f.fp, [...(byFp.get(f.fp) ?? []), p]);
  const claimed = new Set();
  const where = new Map();
  const order = [...before.keys()].sort((a, b) => Number(!after.has(b)) - Number(!after.has(a)) || a.localeCompare(b));
  for (const p of order) {
    const cands = (byFp.get(before.get(p).fp) ?? []).filter((c) => !claimed.has(c));
    const pick = cands.find((c) => c === p) ?? cands.find((c) => basename(c) === basename(p)) ?? cands[0] ?? null;
    if (pick) claimed.add(pick);
    where.set(p, pick);
  }
  return (p) => where.get(p) ?? null;
}

const inArchive = (p) => /(^|\/)(archive|archives|_archive)\//i.test(p);
const top = (p) => p.split("/")[0];
const isNote = (p, f) => f.md && !p.split("/").some((s) => s.startsWith(".")) && !(p === "MAP.md" || basename(p) === "INDEX.md" || (!p.includes("/") && FRONT.test(p)));

// Notes to find: the original notes where they are now (not archived). Without a "before", the notes in the folder now.
function notesNow(after, before, locate) {
  if (!before) return [...after].filter(([p, f]) => isNote(p, f) && !inArchive(p)).map(([p]) => p);
  return [...before].filter(([p, f]) => isNote(p, f)).map(([p]) => locate(p)).filter((p) => p && !inArchive(p) && isNote(p, after.get(p)));
}

export function orient(dir, after) {
  const map = after.get("MAP.md");
  const entries = new Set([...after.keys()].map(top).filter((e) => !e.startsWith(".") && e !== "MAP.md"));
  const covered = new Set();
  if (map) for (const l of parseLinks(map.text)) {
    const to = resolveLink(after, "MAP.md", l);
    if (to) covered.add(top(to));
    covered.add(top(l.target.replace(/^\.\//, "").replace(/^<|>$/g, "")));
  }
  const rules = ["AGENTS.md", "CLAUDE.md"].map((f) => after.get(f)?.text ?? "").join("\n");
  return {
    map: Boolean(map),
    covered: [...entries].filter((e) => covered.has(e)).length,
    entries: entries.size,
    pointer: /\bMAP\.md\b/.test(rules),
    briefing: existsSync(join(dir, "scripts/playbook/brief.mjs")),
  };
}

// Share of notes reachable within two links from MAP.md (map → area index → note).
export function find(after, { before, locate } = {}) {
  const notes = notesNow(after, before, locate);
  const reach = new Set();
  if (after.has("MAP.md")) {
    const step = (from) => linkEdges(after, new Set([from])).map((e) => e.to).filter(Boolean);
    for (const a of step("MAP.md")) {
      reach.add(a);
      if (after.get(a)?.md) for (const b of step(a)) reach.add(b);
    }
  }
  const found = notes.filter((n) => reach.has(n));
  return { found: found.length, total: notes.length, unreachable: notes.filter((n) => !reach.has(n)) };
}

export function loose(files, truth = {}) {
  const keep = new Set(truth.referenced ?? []);
  return [...files.keys()].filter((p) => !p.includes("/") && !p.startsWith(".") && !STANDARD_ROOT.test(p) && !keep.has(p)).sort();
}

// A planted duplicate group is resolved when at most one copy is left outside the archive.
export function oneHome(after, truth, locate) {
  const res = { exact: { resolved: 0, total: 0 }, near: { resolved: 0, total: 0 } };
  for (const g of truth.dupGroups ?? []) {
    const live = g.files.map(locate).filter((p) => p && after.has(p) && !inArchive(p));
    res[g.kind].total++;
    if (live.length <= 1) res[g.kind].resolved++;
  }
  return res;
}

// Open work in one list: the most planted open items that any single page (or command output) holds.
export function openWork(after, truth, extra = {}) {
  const items = truth.openItems ?? [];
  const pages = [...[...after].filter(([, f]) => f.md).map(([p, f]) => [p, f.text]), ...Object.entries(extra)];
  let best = { where: null, found: 0 };
  for (const [p, text] of pages) {
    const n = items.filter((i) => text.includes(i)).length;
    if (n > best.found) best = { where: p, found: n };
  }
  return { ...best, total: items.length };
}

// Planted problems that show up in what the person sees (the check and briefing output): a line that names the file
// and says what kind of problem it is. A file name in a list of something else does not count.
const KIND_WORDS = { orphan: /links? to|orphan|unlinked|no inbound|not linked/i, stale: /untouched|stale|\bdays\b|not changed/i, empty: /empty|stub|no text/i, duplicate: /duplicate|copy|same as|identical/i };
export function surfaced(output, truth, locate) {
  const missed = [];
  let found = 0;
  const lines = output.split("\n");
  for (const pr of truth.problems ?? []) {
    const p = locate(pr.file) ?? pr.file;
    const hit = pr.kind === "broken-link" ? lines.some((l) => l.includes(pr.target) && /broken|missing|not found|points at nothing/i.test(l)) : lines.some((l) => l.includes(p) && KIND_WORDS[pr.kind]?.test(l.replace(p, "")));
    hit ? found++ : missed.push(`${pr.kind}: ${p}`);
  }
  return { found, total: (truth.problems ?? []).length, missed };
}

// New input that landed in the right place: next to its family (never loose at the top), or in inbox/ when it has none.
export function landed(after, truth, dropHashes, locate) {
  const wrong = [];
  let found = 0;
  for (const d of truth.drops ?? []) {
    const now = [...after].find(([, f]) => f.hash === dropHashes[d.name])?.[0] ?? null;
    const anchor = d.anchor ? locate(d.anchor) : null;
    const ok = now && (d.anchor ? dirname(now) !== "." && anchor && dirname(now) === dirname(anchor) : top(now) === "inbox" && now.includes("/"));
    ok ? found++ : wrong.push(`${d.name} → ${now ?? "missing"}`);
  }
  return { found, total: (truth.drops ?? []).length, wrong };
}

// Safety: no file lost, code and the files code uses untouched, working links not fewer.
// A file is lost when it is neither where it was (edited or not) nor anywhere else with the same content.
export function safety(before, after, truth, locate) {
  const lost = [...before.keys()].filter((p) => !locate(p) && !after.has(p)).sort();
  const moved = [...(truth.code ?? []), ...(truth.referenced ?? [])].filter((p) => after.get(p)?.hash !== before.get(p)?.hash);
  const origNotes = new Set([...before].filter(([, f]) => f.md).map(([p]) => p));
  const working = (files, only) => linkEdges(files, only).filter((e) => e.to).length;
  const nowNotes = new Set([...origNotes].map(locate).filter(Boolean));
  return { lost, codeMoved: moved, linksBefore: working(before, origNotes), linksAfter: working(after, nowNotes) };
}

export function sameTree(a, b) {
  const added = [...b.keys()].filter((p) => !a.has(p));
  const removed = [...a.keys()].filter((p) => !b.has(p));
  const changed = [...a.keys()].filter((p) => b.has(p) && a.get(p).hash !== b.get(p).hash);
  return { same: !added.length && !removed.length && !changed.length, added, removed, changed };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2];
  if (!dir || !existsSync(dir) || !statSync(dir).isDirectory()) {
    console.error("Usage: node dev/score.mjs <folder>");
    process.exit(2);
  }
  const files = snapshot(resolve(dir));
  const o = orient(resolve(dir), files);
  const f = find(files);
  const l = loose(files);
  console.log(`Map: ${o.map ? `yes, covers ${o.covered} of ${o.entries} top-level items` : "no"} · pointer in the rulebook: ${o.pointer ? "yes" : "no"} · briefing: ${o.briefing ? "yes" : "no"}`);
  console.log(`Find: ${f.found} of ${f.total} notes reachable within two links from MAP.md`);
  console.log(`Loose at the top: ${l.length}${l.length ? ` (${l.slice(0, 5).join(", ")}${l.length > 5 ? ", …" : ""})` : ""}`);
}
