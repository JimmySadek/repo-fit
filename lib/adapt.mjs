// What a repo already has, so repo-fit adapts to it instead of competing with it.
// Read-only: it reads rule files, scripts and hook files. It never writes, runs or installs anything.
//   ownSystems(root, mapping): the repo's own checks, hooks, word cap, recorder list, protected paths and rules by topic
//   conflicts(own, mapping, cfg): where the full core block would contradict those rules
// Used by audit, apply, status and update. Not vendored into repos.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { globToRegExp } from "../scripts/playbook/lib.mjs";

const BLOCK_RE = /<!-- playbook:core v\S+ begin[^>]*-->[\s\S]*?<!-- playbook:core end -->/g;
const read = (root, rel) => {
  try {
    return readFileSync(join(root, rel), "utf8");
  } catch {
    return "";
  }
};
const exists = (root, rel) => Boolean(rel) && existsSync(join(root, rel.replace(/\/+$/, "")));
const isDir = (root, rel) => exists(root, rel) && statSync(join(root, rel.replace(/\/+$/, ""))).isDirectory();

// Lines of the repo's own rules: AGENTS.md and CLAUDE.md without the managed block, and the README.
// The block is blanked out, not removed, so line numbers stay true.
function ruleLines(root) {
  const out = [];
  for (const file of ["AGENTS.md", "CLAUDE.md", "README.md"]) {
    const text = read(root, file).replace(BLOCK_RE, (m) => m.replace(/[^\n]/g, ""));
    let fenced = false;
    text.split("\n").forEach((line, i) => {
      if (line.trim().startsWith("```")) fenced = !fenced;
      out.push({ file, line: i + 1, text: line, fenced, rules: file !== "README.md" });
    });
  }
  return out;
}
const where = (l) => `${l.file}:${l.line}`;
const short = (s, n = 110) => {
  const t = s.replace(/\*\*|__/g, "").replace(/^[\s>*-]*(?:\d+\.\s+)?|\s+$/g, "").replace(/\s+/g, " ");
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

// Path-like words on a line that exist in the repo (`source-archive/`, scripts/check.py, ...).
function pathsOn(root, text) {
  const found = new Set();
  for (const m of text.matchAll(/(?:^|[\s(`"'[])((?:\.?[\w-]+\/)+(?:[\w.*-]+)?|[\w-]+\.[a-z]{1,5})(?=$|[\s`"'),.:;\]])/gi)) {
    const p = m[1].replace(/[.,:;]+$/, "");
    if (p.includes("*") || exists(root, p)) found.add(isDir(root, p) && !p.endsWith("/") ? `${p}/` : p);
  }
  return [...found];
}

// Commands the repo runs to check itself, from its rules (the definition of done) and from its scripts folder.
const CHECK_CMD = /(?:^|[\s`$])((?:python3?|node|bash|sh|npm run|pnpm run|yarn|make|pytest|uv run)\s+[^\s`]*(?:check|valid|verif|lint|test|coverage|audit|build_index)[^\s`]*(?:\s+--?[\w-]+)*)/i;
const CHECK_FILE = /^(check|validate|verify|lint|coverage)[\w-]*\.(py|mjs|js|cjs|ts|sh)$|^[\w-]*(check|validat|coverage)[\w-]*\.(py|mjs|js|cjs|ts|sh)$/i;

const DONE_LINE = /definition of done|before (?:you )?commit|then (?:a )?(?:local )?commit|^#+\s*(?:validation|checks?|testing)\b/i;
function ownChecks(root, lines) {
  const found = [];
  let heading = "";
  for (const l of lines) {
    if (/^#+\s/.test(l.text)) heading = l.text;
    if (!l.rules || /scripts\/playbook\//.test(l.text)) continue;
    for (const m of l.text.matchAll(new RegExp(CHECK_CMD.source, "gi"))) {
      const run = m[1].trim();
      const script = run.split(/\s+/).find((w) => /[/.]/.test(w)) ?? run;
      if (found.some((c) => c.script === script)) continue;
      found.push({ run, script, where: where(l), done: DONE_LINE.test(l.text) || DONE_LINE.test(heading) });
    }
  }
  // Checks named in the repo's definition of done (or under a Validation heading) come first.
  const fromRules = [...found.filter((c) => c.done), ...found.filter((c) => !c.done)].map(({ run, where: w }) => ({ run, where: w }));
  const files = [];
  for (const dir of ["scripts", "bin", "tools"]) {
    try {
      for (const f of readdirSync(join(root, dir))) if (CHECK_FILE.test(f)) files.push(`${dir}/${f}`);
    } catch {
      /* no such folder */
    }
  }
  return { fromRules, files };
}

// Hooks the repo already runs, other than repo-fit's own.
function ownHooks(root) {
  const out = [];
  for (const [tool, rel] of [["Claude Code", ".claude/settings.json"], ["Claude Code", ".claude/settings.local.json"], ["Codex", ".codex/hooks.json"]]) {
    let j;
    try {
      j = JSON.parse(read(root, rel) || "null");
    } catch {
      continue;
    }
    for (const [event, groups] of Object.entries(j?.hooks ?? {})) {
      for (const g of groups ?? []) for (const h of g?.hooks ?? []) if (h?.command && !h.command.includes("scripts/playbook/")) out.push({ tool, event, command: h.command, file: rel });
    }
  }
  return out;
}

// A word cap the repo states for its current view: in a check script, in the file itself, or on a rule line that names it.
const CAP_LINE = [
  /\b(?:under|below|at most|max(?:imum)?(?: of)?|no more than|cap(?:ped)?(?: at| of)?|limit(?:ed)?(?: to| of)?|within)\s+(\d{1,2},\d{3}|\d{2,5})\s+words\b/i,
  /\b(\d{1,2},\d{3}|\d{2,5})[- ]words?\s+(?:cap|limit|max(?:imum)?)\b/i,
  /\bword[- ]?(?:cap|limit)\b[^0-9\n]{0,20}(\d{1,2},\d{3}|\d{2,5})\b/i,
];
const CAP_CODE = /\b[A-Z_]*(?:CURRENT|HOME|SUMMARY)[A-Z_]*(?:MAX|CAP|LIMIT)[A-Z_]*\s*[:=]\s*(\d{2,5})\b|\b(?:MAX|CAP|LIMIT)[A-Z_]*WORDS?[A-Z_]*\s*[:=]\s*(\d{2,5})\b/;
function ownWordCap(root, lines, current, checkFiles) {
  if (!current) return null;
  for (const f of checkFiles) {
    const text = read(root, f);
    if (!text.includes(basename(current)) && !/current/i.test(text)) continue;
    const ls = text.split("\n");
    for (let i = 0; i < ls.length; i++) {
      const m = ls[i].match(CAP_CODE);
      if (m) return { cap: Number(m[1] ?? m[2]), where: `${f}:${i + 1}`, enforced: true };
    }
  }
  const curLines = read(root, current).split("\n").map((text, i) => ({ file: current, line: i + 1, text }));
  for (const l of [...curLines, ...lines.filter((x) => x.text.includes(basename(current)) || /current (view|state|page)/i.test(x.text))]) {
    for (const re of CAP_LINE) {
      const n = Number(l.text.match(re)?.[1]?.replace(",", ""));
      if (n >= 50) return { cap: n, where: where(l), enforced: false };
    }
  }
  return null;
}

// The names a repo allows in `recorded_by`, from a RECORDERS list in its own scripts.
function ownRecorders(root, checkFiles) {
  for (const f of checkFiles) {
    const text = read(root, f);
    const m = text.match(/\bRECORDERS\s*[:=]\s*(?:new Set\(|frozenset\(|set\()?\s*[[{(]([^\]})]*)[\]})]/);
    if (!m) continue;
    const names = [...m[1].matchAll(/["']([^"']+)["']/g)].map((x) => x[1]);
    if (names.length) return { names, where: `${f}:${text.slice(0, m.index).split("\n").length}` };
  }
  return null;
}

// Paths the repo says must not be edited: wording in its rules, plus `protectedPaths` in playbook.json.
const PROTECT_WORDS = /append[- ]only|read[- ]only|immutable|never (?:edit|modify|rewrite|rename|change|delete)|do not (?:edit|modify|rewrite|rename|change)|must not be (?:edited|changed|modified)/i;
function ownProtected(root, lines, cfg) {
  const out = [];
  for (const p of cfg.protectedPaths ?? []) if (typeof p === "string" && p) out.push({ path: p, why: "protectedPaths in playbook.json", where: "playbook.json" });
  for (const l of lines) {
    if (l.fenced || !PROTECT_WORDS.test(l.text)) continue;
    for (const p of pathsOn(root, l.text)) if (!out.some((x) => x.path === p) && p.endsWith("/")) out.push({ path: p, why: short(l.text, 90), where: where(l) });
  }
  return out;
}

const COMMIT_WHEN = /\bcommit(?:s|ted|ting)?\b.{0,160}\b(only|after|when asked|unless|never|standing|authori[sz]|validat|pass|done)\b|\b(only|after|then|when asked|never|standing|authori[sz]|definition of done)\b.{0,160}\bcommit/i;
const COMMIT_WHERE = /\b(main|master|secrets?|credentials?|tokens?|api keys?|\.env|big files?|large files?)\b/i;

// Rules on the topics the core block also covers. Each entry quotes the line, so the user can check it.
function ownTopics(root, lines, mapping) {
  const t = {};
  const rules = lines.filter((l) => l.rules && !l.fenced && l.text.trim());
  const firstMatch = (re) => rules.find((l) => re.test(l.text));
  // A rule about when to commit. Rules about where or what (main, secrets, big files) do not conflict with autosave.
  const commit = rules.find((l) => COMMIT_WHEN.test(l.text) && !COMMIT_WHERE.test(l.text));
  if (commit) t.commits = { where: where(commit), quote: short(commit.text) };
  const dec = mapping.decisions;
  const lifecycle = dec && isDir(root, dec) && readdirSync(join(root, dec)).filter((f) => /^(proposed|accepted|superseded|rejected|draft|active|retired)$/i.test(f));
  const decLine = firstMatch(/decision[^.]*\b(lifecycle|proposed|accepted|superseded)\b|\b(proposed|accepted)\b[^.]*decision/i);
  if ((lifecycle && lifecycle.length) || decLine) t.decisions = { where: decLine ? where(decLine) : dec, quote: decLine ? short(decLine.text) : `${dec} has ${lifecycle.join(", ")} folders` };
  const inputs = mapping.inputs?.replace(/\/+$/, "");
  const inLine = inputs && firstMatch(new RegExp(inputs.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  if (inLine) t.inputs = { where: where(inLine), quote: short(inLine.text) };
  const status = firstMatch(/\bstatus (?:lives|is kept|belongs|is tracked)\b|\bonly place (?:status|work) (?:lives|is tracked)\b/i);
  if (status) t.status = { where: where(status), quote: short(status.text) };
  return t;
}

export function ownSystems(root, mapping = {}) {
  let cfg = {};
  try {
    cfg = JSON.parse(read(root, "playbook.json") || "{}");
  } catch {
    /* not valid JSON: no settings */
  }
  const lines = ruleLines(root);
  const checks = ownChecks(root, lines);
  const current = mapping.current && !isDir(root, mapping.current) ? mapping.current : null;
  return {
    checks,
    hooks: ownHooks(root),
    wordCap: ownWordCap(root, lines, current, checks.files),
    recorders: ownRecorders(root, checks.files),
    protected: ownProtected(root, lines, cfg),
    topics: ownTopics(root, lines, mapping),
    playbook: cfg,
  };
}

// Is a repo path protected? Folders end in "/", anything else is a glob.
export function protectedBy(list, rel) {
  for (const p of list) {
    if (p.path.endsWith("/") ? rel.startsWith(p.path) : globToRegExp(p.path).test(rel) || rel === p.path) return p;
  }
  return null;
}

// Where the full core block would contradict the repo's own rules. The slim block (the default) defers on each of these.
export function conflicts(own, mapping = {}) {
  const out = [];
  const checks = own.checks.fromRules.map((c) => `\`${c.run}\``);
  if (checks.length) out.push({ topic: "checks", block: "Capture step 5: run `node scripts/playbook/check.mjs`, then commit", repo: `Runs its own checks: ${checks.slice(0, 3).join(", ")}${checks.length > 3 ? ` and ${checks.length - 3} more` : ""}`, where: own.checks.fromRules[0].where });
  if (own.topics.commits) out.push({ topic: "commits", block: "Autosave commits allow-listed paths to a `wip/<date>-<tool>` branch", repo: own.topics.commits.quote, where: own.topics.commits.where });
  if (own.topics.decisions) out.push({ topic: "decisions", block: "A decision is binding when recorded with who decided and their words", repo: own.topics.decisions.quote, where: own.topics.decisions.where });
  if (own.topics.inputs) out.push({ topic: "inputs", block: `Exact wording goes to \`${mapping.inputs?.replace(/\/+$/, "")}/YYYY-MM-DD-topic.md\``, repo: own.topics.inputs.quote, where: own.topics.inputs.where });
  if (own.topics.status && mapping.board) out.push({ topic: "status", block: `\`${mapping.board}\` is the only place status lives`, repo: own.topics.status.quote, where: own.topics.status.where });
  const pjCap = own.playbook.currentWordCap;
  if (own.wordCap && pjCap && pjCap !== own.wordCap.cap) out.push({ topic: "word cap", block: `currentWordCap ${pjCap} in playbook.json`, repo: `${own.wordCap.cap} words (${own.wordCap.where})`, where: own.wordCap.where });
  return out;
}

// The core block's switches for a repo: a topic the repo covers itself defers to its rules.
export function deferVars(own, mapping = {}) {
  const v = {};
  if (own.checks.fromRules.length) v.own_checks = own.checks.fromRules.slice(0, 3).map((c) => `\`${c.run}\``).join(", ");
  if (own.topics.commits) v.own_commits = own.topics.commits.where;
  if (own.topics.decisions) v.own_decisions = own.topics.decisions.where;
  if (own.topics.inputs) v.own_inputs = own.topics.inputs.where;
  if (own.topics.status && mapping.board) v.own_status = own.topics.status.where;
  return v;
}

// A written policy for big files: a heading such as "Big files", "Large files" or "Media" in the README or the
// rule files, or Git LFS in .gitattributes.
export function bigFilePolicy(root) {
  for (const file of ["README.md", "AGENTS.md", "CLAUDE.md"]) {
    const lines = read(root, file).replace(BLOCK_RE, (m) => m.replace(/[^\n]/g, "")).split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (/^#{1,4}\s+(?:.*\b(?:big|large|heavy)\s+(?:files?|media|assets)\b|(?:media|assets|binaries)(?:\s+policy)?\s*$)/i.test(lines[i])) return { where: `${file}:${i + 1}`, heading: lines[i].replace(/^#+\s*/, "").trim() };
    }
  }
  if (/filter=lfs/.test(read(root, ".gitattributes"))) return { where: ".gitattributes", heading: "Git LFS" };
  return null;
}
