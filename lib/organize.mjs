// Organize: one plan for the whole folder, shown as before → after → why, applied with one yes and undone with one
// command. It proposes only moves and archives of non-code files; the safe move engine (move.mjs) refuses whatever must
// stay and rewrites the links. Nothing is deleted, nothing is merged, code never moves.
//   organizePlan(root, { today, protect })  → { batches, stays, suggestions, plan, ... }   read-only
//   screen(p) / list(p)                     → the one-screen view / every move with its why
//   organizeApply(root, p)                  → the moves, the link edits and the rebuilt map, in one receipt
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, join, posix } from "node:path";
import { applyMoves, files, planMoves } from "./move.mjs";
import { pages, scan } from "../scripts/playbook/map.mjs";

// Plain folder names for each kind of file, used when the folder has no folder of its own for that kind.
const PLAIN = { note: "notes", image: "media", media: "media", document: "documents", data: "data" };
// Existing folder names that already mean "this kind", in order of preference. "docs" means documentation, so it is a
// home for notes only when the folder itself is a program. A name with a year in it is about
// something specific ("photos-2025"), so it is never reused for everything of that kind.
const ROLE = {
  note: ["notes", "note", "wiki", "pages", "writing", "knowledge"],
  image: ["media", "images", "image", "img", "pictures", "photos", "screenshots", "assets", "attachments"],
  media: ["media", "videos", "video", "audio", "recordings"],
  document: ["documents", "docs", "pdfs", "pdf", "papers", "files", "scans"],
  data: ["data", "datasets"],
};
const KIND_WORD = { note: "note", image: "image", media: "media file", document: "document", data: "data file" };
const DATA = /\.(csv|tsv|json|jsonl|xml|parquet|sqlite|db)$/i;
const OLD = /^(old|older|backups?|bak|temp|tmp|unsorted|new folder( \(?\d+\)?)?|untitled folder( \d+)?|copy of .+|.+ copy|old[ _-].+|.+ \(old\))$/i;
const COPYISH = /(\bcopy\b|\(\d+\)|duplicate|\bold\b)/i;
const STOP = new Set(["at", "the", "of", "and", "a", "an", "copy", "final", "old", "draft", "new"]);

const sha = (abs) => createHash("sha256").update(readFileSync(abs)).digest("hex");
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "folder";
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

// The words a file name starts with, without dates, times, numbers and words like "copy" or "final".
function words(name) {
  const stem = name.replace(/\.[^.]+$/, "").replace(/\(\d+\)/g, " ").replace(/\d{4}[-_.]?\d{2}([-_.]?\d{2})?/g, " ").replace(/\d{1,2}[.:]\d{2}([.:]\d{2})?/g, " ").replace(/\bv\d+\b/gi, " ");
  return stem.split(/[\s\-_.()]+/).map((w) => w.toLowerCase()).filter((w) => w && !/^\d+$/.test(w) && !STOP.has(w));
}

// Files that share a name start (3 or more) get a folder: first by their first two words, then by their first word
// when it is long enough to mean something ("img" is not).
function nameGroups(paths) {
  const group = new Map();
  for (const n of [2, 1]) {
    const by = new Map();
    for (const p of paths.filter((x) => !group.has(x))) {
      const w = words(basename(p));
      if (w.length < n) continue;
      const key = w.slice(0, n).join("-");
      by.set(key, [...(by.get(key) ?? []), p]);
    }
    for (const [key, list] of by) if (list.length >= 3 && key.length >= 4) for (const p of list) group.set(p, key);
  }
  return group;
}

export function organizePlan(root, { today = process.env.REPO_FIT_TODAY ?? new Date().toLocaleDateString("sv-SE"), protect } = {}) {
  if (!protect) {
    try {
      protect = JSON.parse(readFileSync(join(root, "playbook.json"), "utf8")).protectedPaths ?? [];
    } catch {
      protect = [];
    }
  }
  const s = scan(root, { protect });
  const all = files(root);
  const areaOf = new Map(s.areas.map((a) => [a.name, a]));
  const codeAreas = s.areas.filter((a) => a.code);
  const isProt = (p) => protect.some((x) => (x.endsWith("/") ? p.startsWith(x) : p === x || p.startsWith(`${x}/`)));
  const archiveName = s.areas.find((a) => a.special === "archive")?.name ?? "archive";
  const inside = (p) => {
    const a = areaOf.get(p.split("/")[0]);
    return !a || a.code || a.special || p.split("/").some((x) => x.startsWith(".")) || isProt(p);
  };
  const wanted = [];
  const want = (from, to, why, batch) => wanted.push({ from, to, why, batch });
  const taken = new Set();

  // Exact copies: same bytes. One stays (not the one called "copy"), the others go to the archive.
  const bySum = new Map();
  for (const p of all) {
    if ((p.includes("/") && inside(p)) || (!p.includes("/") && !s.loose.some((l) => l.path === p))) continue;
    let size = 0;
    try {
      size = statSync(join(root, p)).size;
    } catch {
      continue;
    }
    if (!size) continue;
    const h = sha(join(root, p));
    bySum.set(h, [...(bySum.get(h) ?? []), p]);
  }
  for (const list of bySum.values()) {
    if (list.length < 2) continue;
    const keep = [...list].sort((a, b) => Number(COPYISH.test(basename(a))) - Number(COPYISH.test(basename(b))) || Number(OLD.test(a.split("/")[0])) - Number(OLD.test(b.split("/")[0])) || a.length - b.length || a.localeCompare(b))[0];
    for (const p of list.filter((x) => x !== keep)) {
      let to = `${archiveName}/${today}-copies/${basename(p)}`;
      if (taken.has(to)) to = `${archiveName}/${today}-copies/${slug(posix.dirname(p))}-${basename(p)}`;
      taken.add(to);
      want(p, to, `an exact copy, same as ${keep}`, "copies");
    }
  }
  const handled = new Set(wanted.map((w) => w.from));

  // Old-looking folders go to the archive whole, under today's date. Nothing is deleted.
  const oldFolders = s.areas.filter((a) => !a.code && !a.special && OLD.test(a.name) && !isProt(`${a.name}/`));
  for (const a of oldFolders) {
    for (const p of all.filter((x) => x.startsWith(`${a.name}/`) && !handled.has(x))) {
      want(p, `${archiveName}/${today}-${slug(a.name)}/${p.slice(a.name.length + 1)}`, `"${a.name}/" looks like an old folder, so it goes to the archive (nothing deleted)`, "archive");
    }
  }

  // Loose files at the top: into the folder for their kind (the folder's own name first), in a subfolder when 3 or
  // more share a name start. Empty files and unknown kinds go to inbox/, to file later.
  const home = {};
  for (const k of Object.keys(PLAIN)) {
    const roles = k === "note" && s.rootManifest ? [...ROLE.note, "docs", "doc", "documentation"] : ROLE[k];
    const own = roles.map((n) => s.areas.find((a) => a.name.toLowerCase() === n && !a.code && !a.special && !isProt(`${a.name}/`))).find(Boolean);
    home[k] = own ? { dir: own.name, own: true } : { dir: PLAIN[k], own: false };
  }
  const loose = s.loose.filter((l) => !handled.has(l.path));
  const stays = [];
  const byKind = {};
  for (const l of loose) {
    let size = 1;
    try {
      size = statSync(join(root, l.path)).size;
    } catch {
      /* counted as not empty */
    }
    if (l.kind === "code") stays.push({ path: l.path, why: "it is code. Code never moves." });
    else if (!size) want(l.path, `inbox/${l.path}`, "an empty file: not sure where it belongs, so it waits in inbox/", "inbox");
    else if (l.kind === "data" && !DATA.test(l.path)) want(l.path, `inbox/${l.path}`, "an unknown kind of file: it waits in inbox/ for you to decide", "inbox");
    else (byKind[l.kind] ??= []).push(l.path);
  }
  for (const [k, list] of Object.entries(byKind)) {
    const groups = nameGroups(list);
    const h = home[k];
    for (const p of list) {
      const g = groups.get(p);
      const where = h.own ? `your ${PLAIN[k]} are in ${h.dir}/` : `${PLAIN[k]} go together in ${h.dir}/`;
      if (g) want(p, `${h.dir}/${g}/${p}`, `${[...groups.values()].filter((x) => x === g).length} files start with "${g}", so they get their own folder in ${h.dir}/`, k);
      else want(p, `${h.dir}/${p}`, `a loose ${KIND_WORD[k]}; ${where}`, k);
    }
  }

  // The safe move engine has the last word: what code, config or rule files need stays, with its reason.
  const plan = planMoves(root, wanted, { protect });
  const accepted = new Map(plan.moves.map((m) => [m.from, m]));
  for (const r of plan.refused) stays.push({ path: r.from, why: r.why.replace(/^It is /, "it is ").replace(/^It /, "it ") });
  for (const a of codeAreas) stays.push({ path: `${a.name}/`, why: a.ownScripts ? "repo-fit's own scripts" : `a program (${a.manifest ?? "code"}). It stays exactly where it is, with the files it uses.` });
  if (s.rootManifest) stays.push({ path: "(the folder itself)", why: `it is also a program (${s.rootManifest}): its code stays where it is` });

  const LABEL = { copies: "Exact copies to the archive", archive: "Old folders to the archive", note: "Notes", image: "Images", media: "Media", document: "Documents", data: "Data files", inbox: "Not sure yet: to inbox/" };
  const batches = Object.keys(LABEL).map((key) => ({ key, label: LABEL[key], moves: wanted.filter((w) => w.batch === key && accepted.has(w.from)).map((w) => ({ from: w.from, to: w.to, why: w.why })) })).filter((b) => b.moves.length);

  // Two folders for the same role are only suggested: their names are often written in rules and tools.
  const suggestions = [];
  for (const k of ["note", "image", "document"]) {
    const same = s.areas.filter((a) => !a.code && !a.special && ROLE[k].includes(a.name.toLowerCase()));
    if (same.length > 1) suggestions.push(`${same.map((a) => `${a.name}/`).join(" and ")} hold the same kind of thing. You could join them; repo-fit does not, because folder names are often written in rules and tools.`);
  }

  const looseKinds = {};
  for (const l of s.loose) looseKinds[l.kind] = (looseKinds[l.kind] ?? 0) + 1;
  return { root, today, protect, scan: s, home, batches, stays, suggestions, mentions: plan.mentions, plan, looseKinds, oldFolders: oldFolders.map((a) => a.name), archiveName, links: plan.edits.reduce((n, e) => n + e.links, 0) };
}

const KINDS_PLURAL = { note: "notes", image: "images and screenshots", media: "videos and audio", document: "documents (PDFs and similar)", data: "data files", code: "code files" };
const NOUNS = { note: ["note", "notes"], image: ["image", "images"], media: ["media file", "media files"], document: ["document", "documents"], data: ["data file", "data files"], code: ["code file", "code files"] };
const kinds = (c) => Object.entries(c).map(([k, n]) => `${n} ${(NOUNS[k] ?? [k, k])[n === 1 ? 0 : 1]}`);

// The one screen: today → after → why. Nothing is changed by showing it.
export function screen(p, target = p.root) {
  const moves = p.batches.flatMap((b) => b.moves);
  const n = (key) => p.batches.find((b) => b.key === key)?.moves.length ?? 0;
  if (!moves.length) return [`# ${basename(p.root)} is already organized`, "", "✅ Nothing to move. The map (MAP.md) and the index pages are all it needs.", ...(p.stays.length ? ["", ...p.stays.map((x) => `- \`${x.path}\` stays: ${x.why}`)] : [])].join("\n");
  const today = [];
  const looseTotal = p.scan.loose.length;
  if (looseTotal) {
    today.push(`${looseTotal} things loose at the top`);
    for (const [k, c] of Object.entries(p.looseKinds)) today.push(`  ${c} ${c === 1 ? (NOUNS[k] ?? [k])[0] : KINDS_PLURAL[k] ?? k}`);
  }
  if (p.oldFolders.length) today.push(`Old-looking folders: ${p.oldFolders.map((x) => `"${x}/"`).join(", ")}`);
  if (n("copies")) today.push(n("copies") === 1 ? "1 exact copy of another file" : `${n("copies")} exact copies of other files`);
  for (const x of p.stays.filter((y) => y.path.endsWith("/"))) today.push(`${x.path} (${x.why.startsWith("a program") ? "a program" : "tool files"})`);

  const after = ["MAP.md: start here, it says what lives where"];
  const into = new Map(); // folder → { kind: count }
  for (const b of p.batches.filter((x) => !["copies", "archive"].includes(x.key))) {
    for (const m of b.moves) {
      const top = m.to.split("/")[0];
      const c = into.get(top) ?? {};
      const k = b.key === "inbox" ? "inbox" : b.key;
      c[k] = (c[k] ?? 0) + 1;
      into.set(top, c);
    }
  }
  for (const [dir, c] of into) {
    if (dir === "inbox") after.push(`inbox/: new things land here (${c.inbox} waiting now)`);
    else after.push(`${dir}/: your ${kinds(c).join(" and ")}${existsSync(join(p.root, dir)) ? ", beside what is already there" : ""}`);
  }
  if (!into.has("inbox")) after.push("inbox/: new things land here");
  const archived = [...new Set(p.batches.filter((b) => ["copies", "archive"].includes(b.key)).flatMap((b) => b.moves.map((m) => m.to.split("/").slice(0, 2).join("/"))))];
  if (archived.length) {
    const what = [...p.oldFolders.filter((o) => p.batches.some((b) => b.key === "archive" && b.moves.some((m) => m.from.startsWith(`${o}/`)))).map((o) => `"${o}/"`), ...(n("copies") ? [n("copies") === 1 ? "1 copy" : `${n("copies")} copies`] : [])];
    after.push(`${p.archiveName}/: ${what.join(", ")}, dated ${p.today}. Nothing deleted`);
  }
  for (const x of p.stays.filter((y) => y.path.endsWith("/") && !y.why.startsWith("repo-fit"))) after.push(`${x.path}: the program stays exactly where it is`);

  const width = Math.max(...today.map((l) => l.length), 26) + 4;
  const rows = Math.max(today.length, after.length);
  const table = [`${"Your folder today".padEnd(width)}After one yes (undo any time)`];
  for (let i = 0; i < rows; i++) table.push(`${(today[i] ?? "").padEnd(width)}${after[i] ?? ""}`);

  const why = [];
  const notes = p.looseKinds.note ?? 0;
  why.push(`You and your assistant can find any note in two steps from MAP.md${notes ? `. Today ${notes === 1 ? "1 note sits" : `${notes} notes sit`} loose at the top; after, each one has a place and is listed on an index page or in the map` : ""}.`);
  why.push("New things get one landing place, inbox/, so the top of the folder stays clear.");
  if (archived.length) why.push(`Nothing is deleted. Old folders${n("copies") ? " and exact copies" : ""} go to ${p.archiveName}/, still there and still findable.`);
  else why.push("Nothing is deleted.");
  const kept = p.stays.filter((x) => !x.path.endsWith("/") && !x.path.startsWith("("));
  if (p.stays.some((x) => x.path.endsWith("/") || x.path.startsWith("(")) || kept.length) why.push(`Code stays put, and so ${kept.length ? `do the ${plural(kept.length, "file")} that code or your rules use (${kept.slice(0, 3).map((x) => x.path).join(", ")}${kept.length > 3 ? ", …" : ""})` : "does everything it uses"}.`);
  if (p.links) why.push(`${plural(p.links, "link")} inside your notes ${p.links === 1 ? "is" : "are"} updated, so none of them break.`);

  const q = (s) => (/\s/.test(s) ? `"${s}"` : s);
  return [
    `# Organize ${basename(p.root)}: ${plural(moves.length, "move")}`,
    "",
    "```",
    ...table,
    "```",
    "",
    "**Why this is better for you**",
    ...why.map((w) => `- ${w}`),
    ...(p.suggestions.length ? ["", "**Only a suggestion** (not in the plan)", ...p.suggestions.map((x) => `- ${x}`)] : []),
    "",
    `Nothing was changed. See every move and its reason: \`repo-fit organize ${q(target)} --list\`. Do it: \`repo-fit organize ${q(target)} --apply\`. Undo it all later with one command: \`repo-fit undo ${q(target)} --apply\`.`,
  ].join("\n");
}

// Every move with its reason, batch by batch, and everything that stays with its reason.
export function list(p) {
  const out = [`# Every move in the plan for ${basename(p.root)}`, ""];
  for (const b of p.batches) {
    out.push(`## ${b.label} (${b.moves.length})`, "");
    for (const m of b.moves) out.push(`- \`${m.from}\` → \`${m.to}\`: ${m.why}`);
    out.push("");
  }
  if (p.stays.length) {
    out.push(`## Stays where it is (${p.stays.length})`, "");
    for (const x of p.stays) out.push(`- \`${x.path}\` stays: ${x.why}`);
    out.push("");
  }
  if (p.mentions.length) {
    out.push("## Named in notes in plain text (not changed; worth a look after)", "");
    for (const m of p.mentions) out.push(`- \`${m.file}\` line ${m.line} names ${m.name}`);
    out.push("");
  }
  out.push("Nothing was changed.");
  return out.join("\n");
}

export function organizeApply(root, p) {
  if (!p.batches.length) return { ok: true, text: `✅ ${basename(root)} is already organized. Nothing to move.` };
  return applyMoves(root, p.plan, {
    step: "organize",
    extra: { plan: "organize" },
    // After the moves: the map and index pages rebuilt from the new folder, and inbox/ as the landing place.
    writes: (r) => {
      const inbox = existsSync(join(r, "inbox")) ? new Map() : new Map([["inbox/.gitkeep", ""]]);
      const out = pages(r, { protect: p.protect, virtual: inbox }); // the map already knows inbox/ is coming
      for (const [k, v] of inbox) out.set(k, v);
      return out;
    },
  });
}
