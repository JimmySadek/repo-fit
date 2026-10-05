// Managed by repo-fit: change it there and run `repo-fit update`, not here.
// The fit check: what is off in this folder, as plain facts, for the briefing (one short line each) and for the
// checkup a re-run starts with. Read-only, except `rebuildMap`, which rewrites repo-fit's own map and index pages
// (never the person's) when notes were added, renamed or removed, and `markReviewed`.
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { root, config, coverage, today } from "./lib.mjs";
import { files, linkReport, planMoves } from "./move.mjs";
import { nameWords, ownPages, scan, title } from "./map.mjs";
import { capture, readRules } from "./file.mjs";

const REVIEW_DAYS = 14;
const FRONT = /(^|\/)(README|AGENTS|CLAUDE|GEMINI|CHANGELOG|LICEN[CS]E|CONTRIBUTING|SECURITY|MAP|INDEX)\.md$/i;
const SKIPPED = /^(archive|archives|_archive|inbox|scripts\/playbook)\/|(^|\/)\./;
const protect = (cfg) => cfg.protectedPaths ?? [];

// repo-fit's own map and index pages, rebuilt from the folder. Returns the pages it rewrote.
export function rebuildMap(cfg = config()) {
  const out = ownPages(root, { protect: protect(cfg) }); // only a map the person chose
  for (const [p, content] of out) {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, `${p}.tmp`), content); // written whole, then swapped in
    renameSync(join(root, `${p}.tmp`), join(root, p));
  }
  return [...out.keys()];
}

// The date of the last deeper review, else of repo-fit's first change here (its oldest receipt), else none.
function lastReview() {
  try {
    return JSON.parse(readFileSync(join(root, ".playbook/review.json"), "utf8")).last;
  } catch {
    const dir = join(root, ".playbook/receipts");
    const first = existsSync(dir) ? readdirSync(dir).filter((n) => n.endsWith(".json")).sort()[0] : null;
    return first ? first.slice(0, 10) : null;
  }
}
export const markReviewed = () => {
  mkdirSync(join(root, ".playbook"), { recursive: true });
  writeFileSync(join(root, ".playbook/review.json"), `${JSON.stringify({ last: today() })}\n`);
};

export function fitFacts(cfg = config()) {
  const list = files(root);
  const { edges, broken } = linkReport(root, list);
  const s = scan(root, { protect: protect(cfg) });
  const codeAreas = new Set(s.areas.filter((a) => a.code).map((a) => a.name));
  const live = (p) => !SKIPPED.test(p) && !codeAreas.has(p.split("/")[0]);

  // Notes no one can reach within two links of the map (map → index page → note).
  let offIndex = [];
  if (list.includes("MAP.md")) {
    const reach = new Set();
    for (const a of edges.get("MAP.md") ?? []) {
      reach.add(a);
      for (const b of edges.get(a) ?? []) reach.add(b);
    }
    offIndex = list.filter((p) => /\.mdx?$/i.test(p) && p.includes("/") && live(p) && !FRONT.test(p) && !reach.has(p));
  }
  // Files back at the top, in a folder that was organized: only the ones that could move (the rest stay for a reason).
  let loose = [];
  if (readRules(root)) {
    const cand = s.loose.map((l) => l.path);
    loose = cand.length ? planMoves(root, cand.map((p) => ({ from: p, to: `inbox/${p}` })), { protect: protect(cfg) }).moves.map((m) => m.from) : [];
  }
  const cov = coverage(cfg);
  // Without a map, a note that nothing links to is how a note gets lost.
  const orphans = list.includes("MAP.md") ? [] : cov.orphans.filter((p) => live(p));
  const last = lastReview();
  const reviewDue = Boolean(last) && (Date.parse(today()) - Date.parse(last)) / 864e5 >= REVIEW_DAYS;
  return {
    mapStale: [...ownPages(root, { protect: protect(cfg) }).keys()],
    broken: broken.filter((b) => live(b.file)),
    offIndex,
    orphans,
    loose,
    inbox: capture(root, { apply: false, protect: protect(cfg) }).waiting ?? [],
    old: cov.stale.filter((x) => live(x.path)),
    due: cov.due,
    reviewDue,
  };
}

const names = (list, n = 3) => list.slice(0, n).join(", ") + (list.length > n ? `, and ${list.length - n} more` : "");
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// One short line per real problem, for the briefing. Nothing when all is well.
export function fitLines(f) {
  const out = [];
  if (f.broken.length) out.push(`⚠️ ${plural(f.broken.length, "broken link", "broken links")}: ${names(f.broken.map((b) => `${b.file} → ${b.dest}`), 2)}`);
  if (f.offIndex.length) out.push(`⚠️ ${plural(f.offIndex.length, "note is", "notes are")} not on any index page: ${names(f.offIndex)}`);
  if (f.orphans?.length) out.push(`⚠️ ${plural(f.orphans.length, "note", "notes")} nothing links to: ${names(f.orphans)}`);
  if (f.loose.length) out.push(`⚠️ ${plural(f.loose.length, "file is", "files are")} loose at the top again: ${names(f.loose)}. Ask the assistant to file ${f.loose.length === 1 ? "it" : "them"}.`);
  if (f.old.length) out.push(`⚠️ ${plural(f.old.length, "old note", "old notes")} (not changed for 180+ days): ${names(f.old.map((x) => x.path))}`);
  if (f.due.length) out.push(`⚠️ ${plural(f.due.length, "note is", "notes are")} past ${f.due.length === 1 ? "its" : "their"} review date: ${names(f.due.map((x) => x.path))}`);
  if (f.reviewDue) out.push("🆕 Two weeks since the last look: ask the assistant for a short review of your notes (copies, contradictions, outdated parts). Nothing changes without your yes.");
  return out;
}

// The deeper review: what a script can find for the assistant to judge. It proposes; nothing changes without a yes.
export function reviewText(cfg = config()) {
  const notes = files(root).filter((p) => /\.mdx?$/i.test(p) && !SKIPPED.test(p) && !FRONT.test(p));
  const key = (p) => {
    let t = "";
    try {
      t = title(readFileSync(join(root, p), "utf8"), p);
    } catch {
      /* unreadable: use the name */
    }
    return nameWords(t || posix.basename(p)).join(" ");
  };
  const groups = new Map();
  for (const p of notes) {
    const k = key(p);
    if (k) groups.set(k, [...(groups.get(k) ?? []), p]);
  }
  const near = [...groups.values()].filter((g) => g.length > 1);
  const old = coverage(cfg).stale;
  const out = ["# A short review of your notes", ""];
  out.push(near.length ? "These may cover the same topic: read them and propose one note (merging needs a yes):" : "No notes look like copies of each other.");
  for (const g of near) out.push(`- may cover the same topic: ${g.join(", ")}`);
  if (old.length) out.push("", "Not changed for 180+ days: still true? Propose a dated \"Outdated\" line, an update, or the archive:", ...old.map((x) => `- ${x.path} (${x.date})`));
  out.push("", "Also look for claims that contradict each other. Mark them with a dated \"Disputed\" line; never rewrite in silence.", "Nothing changes without the person's yes.");
  return out.join("\n");
}
