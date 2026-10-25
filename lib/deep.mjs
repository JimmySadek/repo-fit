// Deep mode, sweep 1 (0.9.0): everything that is not code, inside every folder. Decided by the maintainer on 25 Oct 2026
// (claudedocs/2026-10-25-deep-mode-design-note.md).
//   inventory(root)              → what is inside: documents, kinds, status lines, copies, rulebooks   read-only
//   docsScreen(root, target)     → the first look, or the plan screen with its one yes when a plan file exists   read-only
//   docsList(root)               → every change in the plan with its reason   read-only
//   docsApply(root, code)        → applies the plan in a separate working copy (a Git worktree) on its own branch, one
//                                  commit per step, each step proven; a step that fails is taken back. This folder, its
//                                  branch and its files never change.
// The assistant reads the documents and writes the plan (.playbook/deep/docs.json, ignored by Git). repo-fit checks it,
// shows it, proves it and commits it. Judgment is the assistant's; every change goes through here.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, posix } from "node:path";
import { PATH_DEFAULTS } from "../scripts/playbook/lib.mjs";
import { hasOwnMap } from "../scripts/playbook/map.mjs";
import { applyMoves, files, linkReport, planMoves } from "../scripts/playbook/move.mjs";
import { analyze, projectType } from "./analyze.mjs";
import { addCopy, cleanUpKilled, hasPlaywright, linkPackages, proofCommands, runCommands, withCopy } from "./proof.mjs";

const PLAN = ".playbook/deep/docs.json";
const DOC = /\.(md|markdown|mdx|txt|rst|adoc)$/i;
const PAGE = /\.html?$/i;
const RULEBOOK = /(^|\/)(AGENTS|CLAUDE|GEMINI)\.md$/;
const SKIP = /(^|\/)(\.[^/]+|node_modules|scripts\/playbook)(\/|$)/;
const OWN_PAGES = new Set(["MAP.md"]);
const BUILD_DIR = /^(public|static)\//; // copied as they are into the built site, so they ship to every visitor
const ENTRY_PAGE = /^(index|404|200)\.html?$/i;
const TOOL_DIR = /^(claudedocs|superpowers|cursor|codex|gemini|copilot|aider|windsurf|kiro|ai-docs)$/i;
const CODE = /\.(js|mjs|cjs|ts|tsx|jsx|vue|svelte|astro|html?|css|scss|json|ya?ml|toml)$/i;
const STATUS = /^(Current|Draft|Done|Accepted|Rejected|Deprecated|Replaced by .+|Superseded by .+)$/;
const STATUS_LINE = /^\s*(?:[-*]\s+)?\**status\**\s*:\s*(.+?)\s*$/i;
const CLAUDE_LINES = 200; // guidance/claude-code.md C2
// Files tools find by their name and place: the front pages and policies Git hosts show, and files a web server or a
// build reads. They stay where they are; the ones that are not documents are not counted as documents either.
const NOT_DOC = /(^|\/)((robots|llms|llms-full|ads|app-ads|humans|security)\.txt|CMakeLists\.txt|(requirements|constraints)[^/]*\.txt)$/i;
const NAMED = /(^|\/)(README|CHANGELOG|CHANGES|HISTORY|CONTRIBUTING|SECURITY|CODE_OF_CONDUCT|SUPPORT|LICENSE|LICENCE|COPYING|NOTICE|AUTHORS|CITATION|FUNDING)(\.[a-z]+)?$/i;
const OWN_INDEX = "<!-- repo-fit:index begin"; // an index page repo-fit made and rebuilds (scripts/playbook/map.mjs)
const isOwnIndex = (p, text) => basename(p) === "INDEX.md" && text.includes(OWN_INDEX);

const git = (cwd, args, { input, env } = {}) => {
  const r = spawnSync("git", args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, input, env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", ...env } });
  return { ok: !r.error && r.status === 0, stdout: r.stdout ?? "", out: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim() };
};
const sha = (buf) => createHash("sha256").update(buf).digest("hex");
const lineCount = (t) => (t === "" ? 0 : t.split("\n").length - (t.endsWith("\n") ? 1 : 0));
const today = () => process.env.REPO_FIT_TODAY ?? new Date().toLocaleDateString("sv-SE");
const place = (p) => (p.includes("/") ? `${p.split("/").slice(0, -1).slice(0, 2).join("/")}/` : "(top)");
const tick = (p) => `\`${p}\``;
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function kindOf(p) {
  if (PAGE.test(p)) return "page";
  const w = p.toLowerCase().split(/[/._\-\s]+/);
  const has = (...xs) => xs.some((x) => w.includes(x));
  if (has("decision", "decisions", "adr", "adrs")) return "decision";
  if (has("spec", "specs", "rfc", "prd", "requirements")) return "spec";
  if (has("plan", "plans", "roadmap")) return "plan";
  if (has("research")) return "research";
  if (has("review", "reviews", "audit")) return "review";
  if (has("meeting", "meetings", "minutes", "standup")) return "meeting";
  if (has("design", "brand", "style", "mockup", "mockups")) return "design";
  return "note";
}

function statusOf(text) {
  const head = text.split("\n").slice(0, 20);
  for (const l of head) {
    const m = l.match(STATUS_LINE);
    if (m) return m[1].replace(/\*+$/, "").trim();
  }
  return null;
}

// Where YAML front matter ends: the index of its closing line, or -1 when there is none.
function frontMatterEnd(ls) {
  if (ls[0]?.trimEnd() !== "---") return -1;
  return ls.findIndex((l, i) => i > 0 && /^(---|\.\.\.)\s*$/.test(l));
}
const frontMatterStatus = (text) => {
  const ls = text.split("\n");
  return ls.slice(1, Math.max(frontMatterEnd(ls), 0)).some((l) => /^status\s*:/i.test(l));
};

function sections(text) {
  const ls = text.split("\n");
  const heads = [];
  let fenced = false;
  ls.forEach((l, i) => {
    if (/^\s*(```|~~~)/.test(l)) fenced = !fenced;
    const m = !fenced && l.match(/^(#{1,6})\s+\S/);
    if (m) heads.push({ heading: l.trimEnd(), level: m[1].length, line: i + 1 });
  });
  return heads.map((h, i) => {
    const next = heads.slice(i + 1).find((x) => x.level <= h.level);
    const end = next ? next.line - 1 : lineCount(text);
    return { heading: h.heading, level: h.level, line: h.line, lines: end - h.line + 1 };
  });
}

// What is inside: every document Git has in the last commit, unchanged since. Files with unsaved changes, or not in the
// last commit, stay out (they are not on the branch the sweep starts from).
export function inventory(root) {
  const top = git(root, ["rev-parse", "--show-toplevel"]);
  if (!top.ok) return { error: "nogit" };
  const base = git(root, ["rev-parse", "-q", "--verify", "HEAD"]).stdout.trim();
  if (!base) return { error: "nocommit" };
  if (git(root, ["rev-parse", "--show-prefix"]).stdout.trim()) return { error: "subfolder", top: top.stdout.trim() };
  const tracked = git(root, ["ls-files", "-z"]).stdout.split("\0").filter(Boolean);
  const changed = new Map();
  const st = git(root, ["status", "--porcelain", "-z", "--untracked-files=all"]).stdout.split("\0");
  for (let i = 0; i < st.length; i++) {
    const e = st[i];
    if (!e) continue;
    changed.set(e.slice(3), e.startsWith("??") ? "new" : "changed");
    if (/^[RC]/.test(e)) i++; // the old name of a rename follows
  }
  const keep = (p) => !SKIP.test(p) && !OWN_PAGES.has(p);
  // A page in public/ or static/ that no code, configuration or other page names is a mockup nobody loads.
  const loose = (p) => PAGE.test(p) && BUILD_DIR.test(p) && !ENTRY_PAGE.test(basename(p));
  const codeText = tracked.filter((p) => keep(p) && CODE.test(p) && !loose(p)).map((p) => {
    try {
      return readFileSync(join(root, p), "utf8");
    } catch {
      return "";
    }
  });
  const loaded = (p) => codeText.some((t) => t.includes(basename(p)));
  const documents = [];
  const rulebooks = [];
  const indexPages = [];
  for (const p of tracked) {
    if (!keep(p) || changed.has(p)) continue;
    const page = loose(p) && !loaded(p);
    if ((!DOC.test(p) || NOT_DOC.test(p)) && !page) continue;
    let buf;
    try {
      buf = readFileSync(join(root, p));
    } catch {
      continue;
    }
    const text = buf.toString("utf8");
    if (isOwnIndex(p, text)) {
      indexPages.push(p);
      continue;
    }
    if (RULEBOOK.test(p)) {
      rulebooks.push({ path: p, lines: lineCount(text), bytes: buf.length, sections: sections(text) });
      continue;
    }
    documents.push({
      path: p,
      place: place(p),
      kind: kindOf(p),
      title: text.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? null,
      date: basename(p).match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null,
      status: page ? null : statusOf(text),
      lines: lineCount(text),
      sha256: sha(buf),
      inBuildFolder: BUILD_DIR.test(p),
    });
  }
  const groups = new Map();
  for (const d of documents) groups.set(d.sha256, [...(groups.get(d.sha256) ?? []), d.path]);
  const copies = [...groups.values()].filter((g) => g.length > 1);
  const toolFolders = [...new Set(documents.flatMap((d) => {
    const parts = d.path.split("/").slice(0, -1);
    const i = parts.findIndex((x) => TOOL_DIR.test(x));
    return i < 0 ? [] : [`${parts.slice(0, i + 1).join("/")}/`];
  }))].sort();
  const leftOut = [...changed.keys()].filter((p) => keep(p) && (DOC.test(p) || PAGE.test(p))).sort().map((p) => ({ path: p, why: changed.get(p) === "new" ? "not in your last commit" : "unsaved changes" }));
  return { root, base, documents, rulebooks, indexPages, copies, toolFolders, mockups: documents.filter((d) => d.kind === "page").map((d) => d.path), leftOut, changed };
}

function gitNeeded(inv, target, sweep = "docs") {
  const how = {
    nogit: "This folder has no Git yet. Start it with `git init`, save a first commit, then run this again.",
    nocommit: "This folder has no commit yet. Save a first commit, then run this again.",
    subfolder: `Run it from the top of the repository: \`repo-fit deep ${inv.top} --sweep ${sweep}\`.`,
  }[inv.error];
  return `❌ Deep mode works with Git: every step is a commit you can undo. ${how}${inv.error === "subfolder" ? "" : ` (${target})`}`;
}

function found(inv) {
  const docs = inv.documents;
  const places = [...new Set(docs.map((d) => d.place))].sort();
  const sp = docs.filter((d) => d.kind === "spec" || d.kind === "plan");
  const dec = docs.filter((d) => d.kind === "decision");
  const copies = inv.copies.reduce((n, g) => n + g.length - 1, 0);
  const copiesBuilt = inv.copies.flat().filter((p) => BUILD_DIR.test(p)).length;
  const out = ["What I found inside your folders", `  📄 ${plural(docs.length, "document")} in ${plural(places.length, "place")}: ${places.join(", ")}`];
  if (sp.length) out.push(`  📋 ${plural(sp.length, "spec and plan", "specs and plans")}, ${sp.filter((d) => !d.status).length} without a status line`);
  if (dec.length) out.push(`  🧭 ${plural(dec.length, "decision")} in ${plural(new Set(dec.map((d) => d.place)).size, "place")}`);
  if (copies) out.push(`  👯 ${plural(copies, "exact copy", "exact copies")}${copiesBuilt ? `, ${copiesBuilt} of them in public/ (it ships to every visitor)` : ""}`);
  if (inv.toolFolders.length) out.push(`  🧰 ${plural(inv.toolFolders.length, "folder")} named after a tool: ${inv.toolFolders.map(tick).join(", ")}`);
  for (const dir of ["public", "static"]) {
    const inside = docs.filter((d) => d.path.startsWith(`${dir}/`));
    const notes = inside.filter((d) => d.kind !== "page").length;
    const pages = inside.length - notes;
    if (inside.length) out.push(`  🌐 ${dir}/ ships to visitors and holds ${[notes ? plural(notes, "note") : "", pages ? `${plural(pages, "page")} nothing loads` : ""].filter(Boolean).join(" and ")}`);
  }
  for (const b of inv.rulebooks.filter((x) => !x.path.includes("/"))) out.push(`  📏 ${b.path} has ${b.lines} lines${b.lines > CLAUDE_LINES ? ` (Claude Code follows rules best under ${CLAUDE_LINES})` : ""}`);
  return out.join("\n");
}

const leftOutLine = (inv) => (inv.leftOut.length ? `⚠️ ${plural(inv.leftOut.length, "file")} ${inv.leftOut.length === 1 ? "has" : "have"} unsaved changes or ${inv.leftOut.length === 1 ? "is" : "are"} not in your last commit, so ${inv.leftOut.length === 1 ? "it stays" : "they stay"} out of this sweep: ${inv.leftOut.slice(0, 10).map((x) => tick(x.path)).join(", ")}${inv.leftOut.length > 10 ? `, and ${inv.leftOut.length - 10} more` : ""}.` : "");

function readPlan(root) {
  const p = join(root, PLAN);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    return { invalid: e.message };
  }
}

const configOf = (root) => {
  try {
    return JSON.parse(readFileSync(join(root, "playbook.json"), "utf8"));
  } catch {
    return null;
  }
};
const protectOf = (root) => configOf(root)?.protectedPaths ?? [];
// repo-fit's own settings name folders by role; deep mode changes them itself (a step's "paths"), so they lock nothing.
const OWN_CONFIG = (p) => p === "playbook.json";
const trim = (p) => String(p).replace(/^\.\//, "").replace(/\/+$/, "");
const inside = (p) => typeof p === "string" && p.trim() && !p.startsWith("/") && !trim(p).split("/").some((x) => x === ".." || x.startsWith("."));

// The places playbook.json counts on (its required files and folders, and each role's file or folder that is there
// today), checked against the folder after the whole plan. One that would be gone needs a "paths" change in the plan.
function rolesKept(inv, tracked, plan, moves) {
  const cfg = configOf(inv.root);
  if (!cfg) return [];
  const own = new Set(inv.indexPages);
  const to = new Map(moves.map((m) => [m.from, m.to]));
  const later = [...tracked].filter((p) => !own.has(p)).map((p) => to.get(p) ?? p).concat(plan.steps.flatMap((s) => (s.split ?? []).map((x) => x.to)));
  const there = (p) => later.some((x) => x === trim(p) || x.startsWith(`${trim(p)}/`));
  const now = (p) => [...tracked].some((x) => !own.has(x) && (x === trim(p) || x.startsWith(`${trim(p)}/`)));
  const roles = { ...PATH_DEFAULTS, ...Object.fromEntries(Object.entries(cfg.paths ?? {}).filter(([, v]) => v)) };
  const changes = Object.assign({}, ...plan.steps.map((s) => s.paths ?? {}));
  const renamed = (p) => changes[Object.keys(roles).find((r) => trim(roles[r]) === trim(p) && changes[r])] ?? p;
  const watched = [...new Set([...(cfg.required ?? []), ...Object.values(roles).filter(now)].map(trim))];
  const out = [];
  for (const p of watched) {
    if (there(renamed(p))) continue;
    const role = Object.keys(roles).find((r) => trim(roles[r]) === p);
    const dest = [...new Set(moves.filter((m) => m.from === p || m.from.startsWith(`${p}/`)).map((m) => (m.from === p ? m.to : posix.dirname(m.to))))];
    const why = (cfg.required ?? []).map(trim).includes(p) ? `playbook.json lists \`${p}\` as required, and the plan empties it.` : `playbook.json keeps its ${role} in \`${p}\`, and the plan moves it away.`;
    out.push(role ? `${why} Add "paths": { "${role}": "${dest.length === 1 ? dest[0] : "<its new place>"}" } to the step that moves it.` : `${why} Keep it where it is.`);
  }
  for (const [role, p] of Object.entries(changes)) if (!inside(p)) out.push(`"paths": "${role}" must be a place inside the folder.`);
  return out;
}

// Splits a rulebook: the section (its heading to the next heading of the same or a higher level) goes word for word to
// its own document, and a link line takes its place. Returns null when the heading is not there exactly once.
function splitText(text, section, linkTo) {
  const ls = text.split("\n");
  const hits = sections(text).filter((x) => x.heading === section); // a heading inside a code block is not a heading
  if (hits.length !== 1) return null;
  const at = hits[0].line - 1;
  let end = at + hits[0].lines;
  while (end > at + 1 && !ls[end - 1].trim()) end--;
  const moved = ls.slice(at, end);
  const rest = [...ls.slice(0, at), section, "", `Moved word for word to [${linkTo}](${linkTo}). Read it when the work touches this.`, "", ...ls.slice(end).filter((_, i, a) => i > 0 || a[0].trim())];
  return { rulebook: rest.join("\n"), doc: `${moved.join("\n")}\n` };
}

// Every non-empty line of the old rulebook is still in the new rulebook or in the documents split off from it.
const keptAll = (old, news) => {
  const have = new Set(news.flatMap((t) => t.split("\n").map((l) => l.trim())).filter(Boolean));
  return old.split("\n").map((l) => l.trim()).filter((l) => l && !have.has(l));
};

function addSection(text, heading, body) {
  const block = `${heading}\n\n${body.trimEnd()}\n`;
  // Above repo-fit's own blocks (the core rules and the map pointer), which it rewrites.
  const core = Math.min(...["<!-- playbook:core", "<!-- repo-fit:pointer"].map((m) => text.indexOf(m)).filter((i) => i >= 0), Infinity);
  if (core < Infinity) return `${text.slice(0, core).trimEnd()}\n\n${block}\n${text.slice(core)}`;
  return `${text.trimEnd()}\n\n${block}`;
}

// Sets or adds the status line: below the title, after any front matter, never inside a code block. Only the line it
// adds and the blank lines around it change; the rest of the document stays byte for byte.
function setStatus(text, line) {
  const ls = text.split("\n");
  const start = frontMatterEnd(ls) + 1;
  let fenced = false;
  const body = ls.map((l, i) => {
    if (i >= start && /^\s*(```|~~~)/.test(l)) fenced = !fenced;
    return i >= start && !fenced && !/^\s*(```|~~~)/.test(l);
  });
  const at = ls.findIndex((l, i) => body[i] && i < start + 20 && STATUS_LINE.test(l));
  if (at >= 0) {
    ls[at] = `Status: ${line}`;
    return ls.join("\n");
  }
  const h = ls.findIndex((l, i) => body[i] && /^#\s+\S/.test(l));
  const put = h >= 0 ? h + 1 : start;
  const add = [...(put > 0 && ls[put - 1]?.trim() !== "" ? [""] : []), `Status: ${line}`];
  if (ls[put] === undefined || ls[put].trim() !== "") add.push("");
  ls.splice(put, 0, ...add);
  return ls.join("\n");
}

// The plan's shape, checked before anything reads it: a plan written by hand or by an assistant gets a message, not a crash.
const FIELDS = { moves: ["from", "to"], status: ["path", "line"], split: ["from", "section", "to"], sections: ["path", "heading", "text"] };
const ONE = { moves: "move", status: "status line", split: "split", sections: "section" };
function shape(plan) {
  const problems = [];
  plan.steps.forEach((s, i) => {
    const n = i + 1;
    if (!s || typeof s !== "object" || Array.isArray(s)) {
      problems.push(`Step ${n} is not a step. Write it as { "title": …, "why": …, and what it changes }.`);
      return;
    }
    for (const [k, fields] of Object.entries(FIELDS)) {
      if (s[k] === undefined) continue;
      if (!Array.isArray(s[k])) {
        problems.push(`Step ${n}: "${k}" must be a list.`);
        continue;
      }
      for (const x of s[k]) {
        if (!x || typeof x !== "object" || fields.some((f) => typeof x[f] !== "string")) {
          problems.push(`Step ${n}: each ${ONE[k]} needs ${fields.map((f) => `"${f}"`).join(" and ").replace(/ and (?=.* and )/g, ", ")} as text (${JSON.stringify(x)?.slice(0, 80)}).`);
          continue;
        }
        for (const f of ["from", "to", "path"]) if (typeof x[f] === "string" && x[f].includes("\\")) problems.push(`${x[f]}: write paths with /, not \\.`);
      }
    }
    if (s.paths !== undefined && (!s.paths || typeof s.paths !== "object" || Array.isArray(s.paths) || Object.values(s.paths).some((v) => typeof v !== "string"))) problems.push(`Step ${n}: "paths" must be { "<role>": "<folder>" }.`);
  });
  return problems;
}

// What a page or a non-Markdown document points at by a relative path (Markdown links are rewritten by every move).
const REFS = [
  [/\.html?$/i, /\b(?:href|src)\s*=\s*["']([^"']+)["']/gi],
  [/\.rst$/i, /^\s*\.\.\s+(?:include|literalinclude|image|figure|csv-table)::\s*(\S+)/gim],
  [/\.adoc$/i, /\b(?:include|image|link)::?([^\s[]+)\[/g],
];
function relativeRefs(p, text) {
  const re = REFS.find(([ext]) => ext.test(p))?.[1];
  if (!re) return [];
  return [...new Set([...text.matchAll(re)].map((m) => m[1].split(/[?#]/)[0]).filter((r) => r && !/^([a-z][a-z0-9+.-]*:|\/|#)/i.test(r)))];
}

// The plan checked against the folder as it is now. Every path in a plan is where the file is now; `to` is where it goes.
function check(root, inv, plan) {
  const problems = [];
  if (!plan || plan.invalid) return [`${PLAN} is not valid JSON${plan?.invalid ? ` (${plan.invalid})` : ""}.`];
  if (plan.sweep !== "docs") problems.push(`"sweep" must be "docs".`);
  if (!Array.isArray(plan.steps) || !plan.steps.length) return [...problems, "The plan has no steps."];
  const bad = shape(plan);
  if (bad.length) return [...problems, ...bad];
  if (plan.base !== inv.base) problems.push(`The plan was made on commit ${String(plan.base).slice(0, 7)}, but the folder is now at ${inv.base.slice(0, 7)}. Make the plan again.`);
  const docs = new Map(inv.documents.map((d) => [d.path, d]));
  const books = new Map(inv.rulebooks.map((b) => [b.path, b]));
  const tracked = new Set(git(root, ["ls-files", "-z"]).stdout.split("\0").filter(Boolean));
  const notHere = (p) => (inv.changed.get(p) === "new" ? "it is not in your last commit" : inv.changed.has(p) ? "it has unsaved changes" : !tracked.has(p) ? "it is not in your last commit" : null);
  const moves = plan.steps.flatMap((s) => s.moves ?? []);
  const seen = new Set();
  for (const m of moves) {
    if (seen.has(m.from)) problems.push(`${m.from}: it moves twice in the plan.`);
    seen.add(m.from);
    const why = notHere(m.from);
    if (why) problems.push(`${m.from}: ${why}, so it stays out of this sweep.`);
    else if (books.has(m.from)) problems.push(`${m.from}: a rulebook stays where Claude Code and Codex look for it.`);
    else if (NAMED.test(m.from) || NOT_DOC.test(m.from)) problems.push(`${m.from}: tools look for it by its name and place, so it stays.`);
  }
  // A page or a non-Markdown document keeps working only if what it points at is still at the same relative place.
  const finalAt = new Map(moves.map((m) => [m.from, m.to]));
  for (const m of moves) {
    if (/\.(md|markdown|mdx)$/i.test(m.from) || !tracked.has(m.from)) continue;
    let text;
    try {
      text = readFileSync(join(root, m.from), "utf8");
    } catch {
      continue;
    }
    for (const ref of relativeRefs(m.from, text)) {
      let r = ref;
      try {
        r = decodeURI(ref);
      } catch {}
      const target = posix.normalize(posix.join(posix.dirname(m.from), r));
      if (!tracked.has(target)) continue;
      if (posix.normalize(posix.join(posix.dirname(m.to), r)) !== (finalAt.get(target) ?? target)) problems.push(`${m.from}: it points at \`${ref}\` by a relative path, which would point at nothing after the move. Leave it, or move it together with what it points at.`);
    }
  }
  const clean = moves.filter((m) => !notHere(m.from));
  const pm = planMoves(root, clean.map((m) => ({ from: m.from, to: m.to, why: m.why })), { protect: protectOf(root), allow: (p) => inv.mockups.includes(p), skip: OWN_CONFIG });
  for (const r of pm.refused) problems.push(`${r.from}: ${r.why.replace("Code never moves.", "Code is sweep 2.")}`);
  const targets = new Set(moves.map((m) => m.to));
  plan.steps.forEach((s, i) => {
    const n = i + 1;
    if (typeof s.title !== "string" || !s.title.trim()) problems.push(`Step ${n} has no title.`);
    if (!["moves", "status", "split", "sections", "paths", "map"].some((k) => s[k])) problems.push(`Step ${n} changes nothing.`);
    if (s.paths && !configOf(root)) problems.push(`Step ${n}: "paths" changes playbook.json, and this folder has none.`);
    for (const x of s.status ?? []) {
      if (!docs.has(x.path) || docs.get(x.path).kind === "page") problems.push(`${x.path}: ${notHere(x.path) ?? "it is not a document repo-fit found"}.`);
      else if (frontMatterStatus(readFileSync(join(root, x.path), "utf8"))) problems.push(`${x.path}: its front matter has a status key, and tools read that one. Change it there by hand, or leave this document out.`);
      else if (!STATUS.test(String(x.line))) problems.push(`${x.path}: "${x.line}" is not a status repo-fit knows (Current, Draft, Done, Accepted, Rejected, Deprecated, Replaced by …, Superseded by …).`);
    }
    for (const x of s.split ?? []) {
      const b = books.get(x.from);
      if (!b) problems.push(`${x.from}: ${notHere(x.from) ?? "it is not a rulebook"}.`);
      else if (b.sections.filter((h) => h.heading === x.section).length !== 1) problems.push(`${x.from}: the heading "${x.section}" is not in it exactly once.`);
      if (!/\.md$/.test(String(x.to)) || String(x.to).startsWith("..") || String(x.to).split("/").some((p) => p.startsWith("."))) problems.push(`${x.to}: a split goes to a Markdown file inside the folder.`);
      else if (existsSync(join(root, x.to)) || targets.has(x.to)) problems.push(`${x.to}: a file is already there.`);
    }
    for (const x of s.sections ?? []) {
      const b = books.get(x.path);
      if (!b) problems.push(`${x.path}: ${notHere(x.path) ?? "it is not a rulebook"}.`);
      else if (!/^#{1,6}\s+\S/.test(String(x.heading))) problems.push(`${x.path}: "${x.heading}" is not a heading.`);
      else if (b.sections.some((h) => h.heading === x.heading)) problems.push(`${x.path}: it already has "${x.heading}".`);
      if (!String(x.text ?? "").trim()) problems.push(`${x.path}: the section "${x.heading}" has no text.`);
    }
  });
  return [...problems, ...rolesKept(inv, tracked, plan, clean)];
}

const codeFor = (inv, plan) => sha(JSON.stringify({ base: inv.base, plan, leftOut: inv.leftOut })).slice(0, 6);

function branchName(root) {
  const base = `repo-fit/deep-${today()}`;
  for (let i = 1; ; i++) {
    const b = i === 1 ? base : `${base}-${i}`;
    if (!git(root, ["rev-parse", "-q", "--verify", `refs/heads/${b}`]).ok) return b;
  }
}

// Where each document ends up, and the rulebooks' sizes, after the whole plan.
function after(inv, plan) {
  const to = new Map(plan.steps.flatMap((s) => (s.moves ?? []).map((m) => [m.from, m.to])));
  const paths = inv.documents.map((d) => to.get(d.path) ?? d.path);
  const books = new Map(inv.rulebooks.map((b) => [b.path, readFileSync(join(inv.root, b.path), "utf8")]));
  for (const s of plan.steps) {
    for (const x of s.split ?? []) {
      const r = splitText(books.get(x.from), x.section, posix.relative(posix.dirname(x.from), x.to));
      if (r) books.set(x.from, r.rulebook);
      paths.push(x.to);
    }
    for (const x of s.sections ?? []) books.set(x.path, addSection(books.get(x.path), x.heading, x.text));
  }
  return { paths, books };
}

const count = (paths) => {
  const m = new Map();
  for (const p of paths) m.set(place(p), (m.get(place(p)) ?? 0) + 1);
  return [...m].sort((a, b) => a[0].localeCompare(b[0])).map(([k, n]) => `${k.padEnd(28)}${plural(n, "document")}`);
};

function twoColumns(inv, plan) {
  const a = after(inv, plan);
  const left = count(inv.documents.map((d) => d.path));
  const right = count(a.paths);
  // The rulebook rows sit side by side, under the longer list of places.
  while (left.length < right.length) left.push("");
  while (right.length < left.length) right.push("");
  for (const b of inv.rulebooks.filter((x) => !x.path.includes("/"))) {
    const next = a.books.get(b.path);
    if (next !== readFileSync(join(inv.root, b.path), "utf8")) {
      left.push(`${b.path.padEnd(28)}${b.lines} lines`);
      right.push(`${b.path.padEnd(28)}${lineCount(next)} lines`);
    }
  }
  const w = 46;
  const rows = [`${"Your folder today".padEnd(w)}After one yes`];
  for (let i = 0; i < Math.max(left.length, right.length); i++) rows.push(`  ${(left[i] ?? "").padEnd(w - 2)}  ${right[i] ?? ""}`.trimEnd());
  return `\`\`\`\n${rows.join("\n")}\n\`\`\``;
}

export function docsScreen(root, target = root) {
  const inv = inventory(root);
  if (inv.error) return { ok: false, text: gitNeeded(inv, target) };
  const plan = readPlan(root);
  const title = `# Deep sweep 1 of 2: everything that is not code · ${basename(root)}`;
  const left = leftOutLine(inv);
  if (!plan) {
    return { ok: true, text: [title, left, found(inv), `Next: the assistant reads these documents and writes a plan to \`${PLAN}\` (Git ignores that folder). Run this command again to see the plan and its one question.\nThe full list for the assistant: repo-fit deep ${target} --sweep docs --json`].filter(Boolean).join("\n\n") };
  }
  const problems = check(root, inv, plan);
  if (problems.length) return { ok: true, text: [title, left, `❌ The plan cannot be used yet. Fix these in \`${PLAN}\`, then run this again:\n${problems.map((p) => `  - ${p}`).join("\n")}`].filter(Boolean).join("\n\n") };
  const branch = branchName(root);
  const steps = plan.steps;
  const safety = `🛟 Every change goes on a new branch, \`${branch}\`, in a separate working copy of this folder (a Git worktree), one commit per step. This folder, its branch and your files stay exactly as they are. Undo one step: \`git revert <commit>\`. Undo everything: delete the branch.`;
  const why = `Why\n${steps.filter((s) => s.why).map((s) => `  - ${s.why}`).join("\n")}`;
  const list = `${plural(steps.length, "step")}, each one commit, each proven (no file lost, links still work, every rule kept):\n  ${steps.map((s, i) => `${i + 1} ${s.title}`).join(" · ")}`;
  const yes = `Every change with its reason: repo-fit deep ${target} --sweep docs --list\nYes: repo-fit deep ${target} --sweep docs --apply --plan ${codeFor(inv, plan)}          Or tell me what to change.`;
  return { ok: true, text: [title, safety, left, found(inv), twoColumns(inv, plan), why, list, yes].filter(Boolean).join("\n\n") };
}

export function docsList(root) {
  const inv = inventory(root);
  if (inv.error) return { ok: false, text: gitNeeded(inv, root) };
  const plan = readPlan(root);
  if (!plan || plan.invalid) return { ok: false, text: `No plan yet at \`${PLAN}\`.` };
  const bad = Array.isArray(plan.steps) ? shape(plan) : ["The plan has no steps."];
  if (bad.length) return { ok: false, text: `❌ The plan cannot be listed yet. Fix these in \`${PLAN}\`:\n${bad.map((p) => `  - ${p}`).join("\n")}` };
  const out = [];
  plan.steps.forEach((s, i) => {
    out.push(`${i + 1} ${s.title}`);
    for (const m of s.moves ?? []) out.push(`  ${m.from} → ${m.to}${m.why ? `: ${m.why}` : ""}`);
    for (const x of s.status ?? []) out.push(`  ${x.path}: Status: ${x.line}`);
    for (const x of s.split ?? []) out.push(`  ${x.from} "${x.section}" → ${x.to} (word for word, a link takes its place)`);
    for (const x of s.sections ?? []) out.push(`  ${x.path}: adds "${x.heading}"`);
    for (const [role, p] of Object.entries(s.paths ?? {})) out.push(`  playbook.json: the ${role} are in ${p} now`);
    if (s.map) out.push("  the map (MAP.md) and the index pages are rebuilt");
  });
  return { ok: true, text: out.join("\n") };
}

export function docsJson(root) {
  const inv = inventory(root);
  if (inv.error) return { ok: false, text: gitNeeded(inv, root) };
  const { changed, ...rest } = inv;
  return { ok: true, text: JSON.stringify(rest, null, 2) };
}

// One step in the separate copy. Returns what it did, or why it failed (then the caller takes it back).
// The folder's own check (scripts/playbook/check.mjs), when it has one: { ok, line } with the first error line.
function ownCheck(wt) {
  if (!existsSync(join(wt, "scripts/playbook/check.mjs"))) return null;
  const r = spawnSync(process.execPath, ["scripts/playbook/check.mjs"], { cwd: wt, encoding: "utf8" });
  return { ok: r.status === 0, line: `${r.stdout}${r.stderr}`.split("\n").find((l) => /^ERROR/.test(l)) ?? `${r.stdout}${r.stderr}`.trim().split("\n")[0] };
}

function runStep(wt, step, loc, inv, checked) {
  const did = [];
  const before = files(wt);
  const brokenBefore = linkReport(wt, before).broken.map((b) => `${b.file} → ${b.dest}`);
  let created = 0;
  const at = (p) => loc.get(p) ?? p;
  if (step.moves?.length) {
    // An index page repo-fit made, left alone in a folder this step empties, goes to the archive with it.
    const going = new Set(step.moves.map((m) => at(m.from)));
    const alone = before.filter((p) => basename(p) === "INDEX.md" && p.includes("/") && isOwnIndex(p, readFileSync(join(wt, p), "utf8")))
      .filter((ix) => !before.some((p) => p !== ix && p.startsWith(`${posix.dirname(ix)}/`) && !going.has(p)));
    const wanted = [...step.moves.map((m) => ({ from: at(m.from), to: m.to, why: m.why })), ...alone.map((ix) => ({ from: ix, to: `archive/${ix}`, why: "its folder is empty now" }))];
    const p = planMoves(wt, wanted, { protect: protectOf(wt), allow: (x) => inv.mockups.includes(x), skip: OWN_CONFIG });
    if (p.refused.length) return { ok: false, why: `${p.refused[0].from}: ${p.refused[0].why}` };
    const r = applyMoves(wt, p, { step: "deep" });
    if (!r.ok) return { ok: false, why: r.text.replace(/^❌ /, "") };
    for (const m of step.moves) loc.set(m.from, m.to);
    did.push(`${step.moves.length} moved${alone.length ? ` (and ${plural(alone.length, "empty folder's index page", "empty folders' index pages")} to archive/)` : ""}`);
  }
  for (const x of step.status ?? []) {
    const f = join(wt, at(x.path));
    writeFileSync(f, setStatus(readFileSync(f, "utf8"), x.line));
  }
  if (step.status?.length) did.push(`${step.status.length} status line${step.status.length === 1 ? "" : "s"}`);
  const books = new Map();
  for (const x of step.split ?? []) {
    const f = join(wt, x.from);
    const old = books.get(x.from)?.old ?? readFileSync(f, "utf8");
    const r = splitText(readFileSync(f, "utf8"), x.section, posix.relative(posix.dirname(x.from), x.to));
    if (!r) return { ok: false, why: `${x.from}: the heading "${x.section}" is not in it exactly once` };
    mkdirSync(join(wt, posix.dirname(x.to)), { recursive: true });
    writeFileSync(join(wt, x.to), r.doc, { flag: "wx" });
    writeFileSync(f, r.rulebook);
    created++;
    books.set(x.from, { old, docs: [...(books.get(x.from)?.docs ?? []), x.to] });
  }
  for (const [p, b] of books) {
    const lost = keptAll(b.old, [readFileSync(join(wt, p), "utf8"), ...b.docs.map((d) => readFileSync(join(wt, d), "utf8"))]);
    if (lost.length) return { ok: false, why: `a rule would be lost from ${p}: "${lost[0]}"` };
  }
  for (const x of step.sections ?? []) {
    const f = join(wt, x.path);
    writeFileSync(f, addSection(readFileSync(f, "utf8"), x.heading, x.text));
    did.push(`${x.path} gets "${x.heading.replace(/^#+\s*/, "")}"`);
  }
  for (const p of books.keys()) did.push(`${p} ${lineCount(readFileSync(join(wt, p), "utf8"))} lines, every rule kept`);
  if (step.paths) {
    const f = join(wt, "playbook.json");
    const cfg = JSON.parse(readFileSync(f, "utf8"));
    for (const [role, p] of Object.entries(step.paths)) {
      const old = cfg.paths?.[role] || PATH_DEFAULTS[role];
      cfg.paths = { ...cfg.paths, [role]: p };
      if (old && Array.isArray(cfg.required)) cfg.required = cfg.required.map((r) => (trim(r) === trim(old) ? p : r));
    }
    writeFileSync(f, `${JSON.stringify(cfg, null, 2)}\n`);
    did.push(`playbook.json: ${Object.entries(step.paths).map(([r, p]) => `${r} in ${p}`).join(", ")}`);
  }
  // The map follows every change to the folder's places when repo-fit keeps one here.
  if ((step.map || step.moves?.length || step.split?.length) && existsSync(join(wt, "scripts/playbook/map.mjs")) && (step.map || hasOwnMap(wt))) {
    const r = spawnSync(process.execPath, ["scripts/playbook/map.mjs", "--write"], { cwd: wt, encoding: "utf8" });
    if (r.status !== 0) return { ok: false, why: `the map could not be rebuilt: ${(r.stderr || r.stdout).trim().split("\n")[0]}` };
    did.push("map rebuilt");
  }
  // Proof: no file lost, no fewer working links, and the folder's own check still passes when it passed before.
  const now = files(wt);
  if (now.length < before.length + created) return { ok: false, why: `the folder had ${before.length} files before and ${now.length} after` };
  // Each move already proves its links still work (applyMoves). Here: no link anywhere points at nothing that did not
  // before. The rebuilt map drops its own lines to files that left an area; those are not broken links.
  const broken = linkReport(wt, now).broken.map((b) => `${b.file} → ${b.dest}`);
  if (broken.length > brokenBefore.length) return { ok: false, why: `${plural(broken.length - brokenBefore.length, "link")} would point at nothing (${broken.find((b) => !brokenBefore.includes(b)) ?? broken.at(-1)})` };
  did.push("links ✔");
  if (checked?.ok) {
    const c = ownCheck(wt);
    if (!c.ok) return { ok: false, why: `the folder's own check (scripts/playbook/check.mjs) failed: ${c.line}` };
    did.push("check ✔");
  }
  return { ok: true, did };
}

// What changed in the working copy, without repo-fit's own move records (.playbook/), which stay out of every commit.
const changedIn = (wt) => {
  const st = git(wt, ["status", "--porcelain", "-z", "--untracked-files=all"]).stdout.split("\0");
  const out = [];
  for (let i = 0; i < st.length; i++) {
    if (!st[i]) continue;
    out.push(st[i].slice(3));
    if (/^[RC]/.test(st[i])) i++; // the old name of a rename follows
  }
  return out.filter((p) => !p.startsWith(".playbook/"));
};

// The branch a plan was already applied on: each commit names its plan's code in a last line.
function appliedOn(root, base, code) {
  const heads = git(root, ["for-each-ref", "--format=%(refname:short)", "refs/heads/repo-fit/"]).stdout.split("\n").filter(Boolean);
  return heads.find((b) => git(root, ["log", "--format=%B", `${base}..${b}`]).stdout.includes(`Repo-fit-plan: ${code}`));
}

export function docsApply(root, code, target = root) {
  const inv = inventory(root);
  if (inv.error) return { ok: false, text: gitNeeded(inv, target) };
  const plan = readPlan(root);
  const problems = plan ? check(root, inv, plan) : ["no plan"];
  if (problems.length || code !== codeFor(inv, plan)) {
    return { ok: false, text: `❌ Something in the folder or the plan changed since the plan was shown, so nothing was applied. Here is the screen as it is now; say yes to this one instead.\n\n${docsScreen(root, target).text}` };
  }
  const done = appliedOn(root, inv.base, code);
  if (done) return { ok: true, text: `✅ This plan is already on branch \`${done}\`. Nothing was applied again.\nKeep it:       git merge ${done}` };
  cleanUpKilled(root);
  const branch = branchName(root);
  const wt = mkdtempSync(join(tmpdir(), `repo-fit-deep-${process.pid}-`));
  const add = addCopy(root, ["-q", "-b", branch, wt, inv.base]);
  if (!add.ok) {
    rmSync(wt, { recursive: true, force: true });
    return { ok: false, text: `❌ Git could not make the separate working copy, so nothing was applied. Git said: ${add.out.split("\n")[0]}` };
  }
  const from = git(root, ["symbolic-ref", "-q", "--short", "HEAD"]).stdout.trim() || inv.base.slice(0, 7);
  const lines = [`Working in a separate copy of this folder, on branch \`${branch}\`.`];
  const loc = new Map();
  let made = 0;
  let back = 0;
  const checked = ownCheck(wt); // proven after every step only if it passes before the first one
  try {
    plan.steps.forEach((s, i) => {
      const pre = git(wt, ["rev-parse", "HEAD"]).stdout.trim();
      const keepLoc = new Map(loc);
      let r;
      try {
        r = runStep(wt, s, loc, inv, checked);
      } catch (e) {
        r = { ok: false, why: e.message };
      }
      if (r.ok) {
        // Only this step's own paths are staged, never `git add .`; the repo's own hooks run as usual.
        // repo-fit's own move records (.playbook/) stay out of the commit.
        const paths = changedIn(wt);
        if (!paths.length) {
          lines.push(`  ✅ ${i + 1} ${s.title}: nothing left to change, so no commit.`);
          return;
        }
        const staged = git(wt, ["add", "-A", "--pathspec-from-file=-", "--pathspec-file-nul"], { input: paths.join("\0"), env: { GIT_LITERAL_PATHSPECS: "1" } });
        const c = staged.ok ? git(wt, ["commit", "-q", "-m", `repo-fit deep: ${s.title}`, ...(s.why ? ["-m", s.why] : []), "-m", `Repo-fit-plan: ${code}`]) : staged;
        if (!c.ok) r = { ok: false, why: `the commit was stopped${c.out ? `: ${c.out.split("\n").find((l) => l.trim()) ?? ""}` : ""}` };
        // A hook that changed files without adding them would leave them for the next step's commit: take the step back.
        const left = c.ok ? changedIn(wt) : [];
        if (left.length) r = { ok: false, why: `a commit hook changed files that are not in the commit (${left.slice(0, 3).join(", ")}${left.length > 3 ? ", …" : ""})` };
      }
      if (r.ok) {
        made++;
        lines.push(`  ✅ ${i + 1} ${s.title.padEnd(28)} ${git(wt, ["rev-parse", "--short", "HEAD"]).stdout.trim()}  ${r.did.join(" · ")}`);
      } else {
        git(wt, ["reset", "-q", "--hard", pre]);
        git(wt, ["clean", "-fdq"]);
        loc.clear();
        for (const [k, v] of keepLoc) loc.set(k, v);
        back++;
        lines.push(`  ↩️ ${i + 1} ${s.title}: taken back, because ${r.why}. Nothing from this step is on the branch.`);
      }
    });
  } finally {
    git(root, ["worktree", "remove", "--force", wt]);
    rmSync(wt, { recursive: true, force: true });
  }
  if (!made) {
    git(root, ["branch", "-D", branch]);
    return { ok: false, text: [...lines, "❌ No step could be applied, so there is no branch. This folder is as it was."].join("\n") };
  }
  return {
    ok: true,
    text: [
      ...lines,
      back
        ? `⚠️ Deep sweep 1 is partly done on branch \`${branch}\`: ${plural(back, "step was", "steps were")} taken back (↩️ above, with the reason). This folder, its branch \`${from}\` and your files are as they were.`
        : `✅ Deep sweep 1 is done on branch \`${branch}\`. This folder, its branch \`${from}\` and your files are as they were.`,
      `See it:        git log --stat ${from}..${branch}`,
      `Keep it:       git merge ${branch}`,
      `Undo one step: git revert <commit>      Drop it all: git branch -D ${branch}`,
    ].join("\n"),
  };
}

// ---- Sweep 2: code and design (0.9.0, slice B: the first look) ----
// The same way as sweep 1: repo-fit looks (read-only), the assistant researches best practices for the project type and
// writes a dated, sourced note, then a plan; repo-fit checks the plan and shows one screen. Here: the first look. The
// analysis and the proof commands run in a throwaway copy of the last commit with the folder's installed packages
// linked in, so the person's folder never changes and nothing is downloaded.

const CODE_PLAN = ".playbook/deep/code.json";
const NOTE_DIR = "docs/research";
const NOTE_DAYS = 30;
const NOTE_SOURCES = 2;
const CODEISH = /\.(js|mjs|cjs|jsx|ts|tsx|mts|cts|vue|svelte|astro|css|scss|sass|less|html?|json|py|rb|go|rs|java|kt|php|swift|cs)$/i;
const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

// The newest best-practices note the assistant wrote: docs/research/<date>-<type>-structure.md. It counts when it is
// at most 30 days old and cites 2 or more sources (distinct web addresses).
function researchNote(root) {
  let names = [];
  try {
    names = readdirSync(join(root, NOTE_DIR), { withFileTypes: true }).filter((d) => d.isFile() && /^\d{4}-\d{2}-\d{2}-.*structure\.md$/.test(d.name)).map((d) => d.name).sort().reverse();
  } catch {}
  if (!names.length) return null;
  const path = `${NOTE_DIR}/${names[0]}`;
  const date = names[0].slice(0, 10);
  const text = readFileSync(join(root, path), "utf8");
  const sources = new Set([...text.matchAll(/https?:\/\/[^\s)>\]"'`*]+/g)].map((m) => {
    // One address however it is written: in bold or code, with a trailing slash, a #part or capital letters in the host.
    const u = m[0].replace(/[.,;:_]+$/, "");
    try {
      const x = new URL(u);
      return `${x.host}${x.pathname.replace(/\/+$/, "")}${x.search}`;
    } catch {
      return u;
    }
  })).size;
  const age = days(date, today());
  const rules = text.split("\n").filter((l) => /^- /.test(l) && !/https?:\/\//.test(l)).slice(0, 3);
  const why = Number.isNaN(age) ? "has no date in its name" : age < 0 ? `is dated ${date}, a day that has not come yet` : age > NOTE_DAYS ? `is ${age} days old; it needs to be ${NOTE_DAYS} days or newer` : sources < NOTE_SOURCES ? `cites ${plural(sources, "source")}; it needs ${NOTE_SOURCES} or more` : null;
  return { path, date, days: age, sources, rules, ok: !why, why };
}

// What sweep 2 sees: the project, the note, the tools, the proof commands run once now, and the analysis.
export function codeLook(root) {
  const top = git(root, ["rev-parse", "--show-toplevel"]);
  if (!top.ok) return { error: "nogit" };
  const base = git(root, ["rev-parse", "-q", "--verify", "HEAD"]).stdout.trim();
  if (!base) return { error: "nocommit" };
  if (git(root, ["rev-parse", "--show-prefix"]).stdout.trim()) return { error: "subfolder", top: top.stdout.trim() };
  const files = git(root, ["ls-tree", "-r", "-z", "--name-only", "HEAD"]).stdout.split("\0").filter(Boolean);
  const st = git(root, ["status", "--porcelain", "-z", "--untracked-files=all"]).stdout.split("\0");
  const leftOut = [];
  for (let i = 0; i < st.length; i++) {
    if (!st[i]) continue;
    const p = st[i].slice(3);
    if (CODEISH.test(p) && !p.startsWith(".playbook/")) leftOut.push({ path: p, why: st[i].startsWith("??") ? "not in your last commit" : "unsaved changes" });
    if (/^[RC]/.test(st[i])) i++;
  }
  const research = researchNote(root);
  const look = withCopy(root, base, (wt) => {
    const project = projectType(wt, files);
    if (!project) return { project: null };
    const packages = linkPackages(root, wt);
    const analysis = analyze(wt, files, project);
    const cmds = runCommands(wt, proofCommands(wt));
    return { project, analysis, proof: { commands: cmds, limited: packages.limited, linked: packages.linked, playwright: hasPlaywright(wt) } };
  });
  if (look.error) return { error: "copy", why: look.error };
  return { root, base, research, leftOut: leftOut.sort((a, b) => a.path.localeCompare(b.path)), ...look };
}

const andList = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
const short = (p) => basename(p).replace(/\.[^.]+$/, "");

function codeFound(a) {
  const out = ["What I found"];
  const unused = [a.unusedFiles.length ? plural(a.unusedFiles.length, "file") : "", a.unusedExports.length ? plural(a.unusedExports.length, "export") : ""].filter(Boolean);
  if (unused.length) out.push(`  🪦 ${unused.join(" and ")} that nothing uses`);
  if (a.unusedFiles.length && a.unsure?.length) out.push(`  ⚠️ ${plural(a.unsure.length, "file")} ${a.unsure.length === 1 ? "loads" : "load"} code by a name it only knows when it runs (${a.unsure.slice(0, 3).join(", ")}${a.unsure.length > 3 ? ", …" : ""}), so a file that looks unused may still be loaded`);
  if (a.copies.length) {
    const ls = a.copies.map((c) => c.lines);
    out.push(`  👯 ${plural(a.copies.length, "block")} of copied code, ${Math.min(...ls) === Math.max(...ls) ? `${ls[0]} lines${a.copies.length > 1 ? " each" : ""}` : `${Math.min(...ls)} to ${Math.max(...ls)} lines each`}`);
  }
  if (a.cycles.length) out.push(`  🔁 ${plural(a.cycles.length, "import loop")}: ${a.loopPaths.slice(0, 3).map((l) => l.map(short).join(" → ")).join("; ")}${a.cycles.length > 3 ? "; …" : ""}`);
  if (a.misleading.length) out.push(`  🏷️ ${plural(a.misleading.length, "misleading name")}: ${a.misleading.slice(0, 4).map((m) => `${m.file} (${m.note})`).join(", ")}${a.misleading.length > 4 ? ", …" : ""}`);
  const c = a.colours;
  if (c.count) out.push(`  🎨 ${plural(c.count, "colour")} typed by hand in ${plural(c.files, "file")}${c.copies ? `; ${c.copies === 1 ? "1 is a near copy" : `${c.copies} are near copies`} of ${c.groups === 1 ? "another" : `${c.groups} others`}` : ""}`);
  const s = a.spacing;
  if (s.count) out.push(`  📏 ${plural(s.count, "spacing value")} typed by hand${s.near.length ? `; ${s.near.length === 1 ? "1 is a pixel off another" : `${s.near.length} are a pixel off another`}` : ""}`);
  if (out.length === 1) out.push("  ✅ nothing to tidy: no unused code, copies, import loops or misleading names");
  return out.join("\n");
}

function toolsLine(a) {
  if (!a.graph) return "Tools: file-level checks only (repo-fit's import graph reads JavaScript and TypeScript)";
  const names = ["knip", "jscpd", "dependency-cruiser"];
  const own = names.filter((n) => a.tools[n]).map((n) => `${n} (yours)`);
  const missing = names.filter((n) => !a.tools[n]);
  const builtIn = missing.length ? [`repo-fit's built-in import graph and copy finder (${andList(missing)} ${missing.length === 1 ? "is" : "are"} not installed)`] : [];
  return `Tools: ${[...own, ...builtIn].join(" · ")}`;
}

function proofLine(p) {
  const parts = p.commands.map((c) => (c.skipped ? `${c.run} not run (${c.skipped})` : c.ok ? `${c.run} ✔ now${c.tests ? ` (${plural(c.tests, "test")})` : ""}` : `${c.run} ✖ now (${c.timedOut ? "took too long, " : ""}not used as proof)`));
  const shots = p.playwright ? "screenshots: Playwright is installed" : "screenshots: not checked (no Playwright)";
  if (!parts.length) return `How each step is proven: no test, typecheck, lint or build command found, so only the files and the import graph are checked · ${shots}`;
  return `How each step is proven: ${[...parts, shots].join(" · ")}`;
}

function researchLine(r, slug) {
  const want = `\`${NOTE_DIR}/${today()}-${slug}-structure.md\``;
  if (!r) return `Best practices: not researched yet. The assistant reads the official guides for this project type and writes ${want} (dated, ${NOTE_SOURCES} or more sources). A code plan waits for it.`;
  if (!r.ok) return `Best practices: ${r.path} ${r.why}. The assistant researches again and writes ${want}.`;
  const when = r.days === 0 ? "today" : r.days === 1 ? "yesterday" : `${r.days} days ago`;
  return [`Best practices, read ${when}: ${r.path} (${plural(r.sources, "source")})`, ...r.rules.map((l) => `  ${l}`)].join("\n");
}

export function codeScreen(root, target = root) {
  const look = codeLook(root);
  if (look.error === "copy") return { ok: false, text: `❌ ${look.why}. Nothing was changed.` };
  if (look.error) return { ok: false, text: gitNeeded(look, target, "code") };
  const title = `# Deep sweep 2 of 2: code and design · ${basename(root)}`;
  if (!look.project) return { ok: true, text: `${title}\n\nNo code found in this folder's last commit, so sweep 2 has nothing to look at. Sweep 1 handles documents: repo-fit deep ${target} --sweep docs` };
  const { project: pr, analysis: a, proof: p } = look;
  const left = look.leftOut.length ? `⚠️ ${plural(look.leftOut.length, "file")} ${look.leftOut.length === 1 ? "has" : "have"} unsaved changes or ${look.leftOut.length === 1 ? "is" : "are"} not in your last commit. Sweep 2 works from the last commit, so ${look.leftOut.length === 1 ? "it stays" : "they stay"} out: ${look.leftOut.slice(0, 10).map((x) => tick(x.path)).join(", ")}${look.leftOut.length > 10 ? `, and ${look.leftOut.length - 10} more` : ""}.` : "";
  const head = [
    `Project type: ${pr.kind}, ${pr.stack.join(", ")} (from ${andList(pr.from)})`,
    researchLine(look.research, pr.slug),
    toolsLine(a),
    ...(p.limited ? [`⚠️ Proof limited: ${p.limited}.`] : []),
    proofLine(p),
  ].join("\n");
  const next = `Next: the assistant ${look.research?.ok ? "" : `researches best practices for this project type, writes \`${NOTE_DIR}/${today()}-${pr.slug}-structure.md\` (dated, ${NOTE_SOURCES} or more sources), then `}writes a plan to \`${CODE_PLAN}\` (Git ignores that folder). Run this command again to see the plan and its one question.\nThe full list for the assistant: repo-fit deep ${target} --sweep code --json`;
  return { ok: true, text: [title, left, head, codeFound(a), next].filter(Boolean).join("\n\n") };
}

export function codeJson(root) {
  const look = codeLook(root);
  if (look.error === "copy") return { ok: false, text: `❌ ${look.why}. Nothing was changed.` };
  if (look.error) return { ok: false, text: gitNeeded(look, root, "code") };
  return { ok: true, text: JSON.stringify(look, null, 2) };
}
