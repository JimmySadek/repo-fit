// Repo checks: required files, board, links, folder indexes. Read-only. Exit 1 on errors.
//   node scripts/playbook/check.mjs
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { root, config, readBoard, analyseBoard, paths, coverage } from "./lib.mjs";

const cfg = config();
const P = paths();
const errors = [];
const warnings = [];

// The full Starter kit unless playbook.json lists only the files this repo adopted (`required`).
const full = ["README.md", "AGENTS.md", P.lessons, "playbook.json", P.current, P.board, P.log, P.questions, P.people, P.decisions];
for (const f of cfg.required ?? full) if (!existsSync(join(root, f))) errors.push(`missing ${f}`);

// The current view has a word cap so it stays a front door, not a log.
const cur = join(root, P.current);
if (existsSync(cur)) {
  const words = readFileSync(cur, "utf8").split(/\s+/).filter(Boolean).length;
  if (words > cfg.currentWordCap) errors.push(`${P.current} is ${words} words, over the cap of ${cfg.currentWordCap}`);
}

// Setup not finished: placeholders left in the front-door files.
for (const f of ["README.md", "AGENTS.md", P.current]) {
  if (existsSync(join(root, f)) && /\bTODO\b/.test(readFileSync(join(root, f), "utf8"))) warnings.push(`${f} still has TODO placeholders`);
}

// Claude Code reads only CLAUDE.md when one exists, so it must import the rulebook (guidance C1).
const claudeMd = join(root, "CLAUDE.md");
if (cfg.tools.includes("claude-code") && existsSync(claudeMd) && existsSync(join(root, "AGENTS.md")) && !/(^|\s)@AGENTS\.md\b/.test(readFileSync(claudeMd, "utf8"))) {
  warnings.push("CLAUDE.md does not import AGENTS.md, so Claude Code will not read the rulebook. Add a line @AGENTS.md");
}

// The board: valid rows, and stale rows shown as failures.
const board = readBoard();
let rowCount = 0;
if (!board.missing && !board.external) {
  rowCount = board.rows.length;
  const r = analyseBoard(board.rows, cfg);
  errors.push(...r.errors.map((e) => `board: ${e}`));
  warnings.push(...r.warnings.map((w) => `board: ${w}`));
  for (const s of r.stale) (cfg.staleIsError ? errors : warnings).push(`board: ${s.id} is stale (${s.why})`);
}

function walk(dir, keep, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, keep, acc);
    else if (keep(e.name)) acc.push(p);
  }
  return acc;
}

const docs = [
  ...new Set([
    ...["README.md", "AGENTS.md", "CLAUDE.md", P.lessons, P.current, P.log, P.questions, P.people, P.decisions].map((f) => join(root, f)).filter((f) => existsSync(f) && f.endsWith(".md")),
    ...walk(join(root, "docs"), (n) => n.endsWith(".md")),
    ...walk(join(root, P.outputs), (n) => n === "README.md"),
  ]),
];

// Every relative Markdown link must resolve. Fenced code is skipped.
for (const file of docs) {
  let fenced = false;
  readFileSync(file, "utf8").split("\n").forEach((line, i) => {
    if (line.trim().startsWith("```")) {
      fenced = !fenced;
      return;
    }
    if (fenced) return;
    for (const m of line.matchAll(/\]\(([^)\s]+)\)/g)) {
      const target = m[1];
      if (/^(https?:|mailto:|#|<)/.test(target) || target.includes("://")) continue;
      const path = decodeURIComponent(target.split("#")[0].split("?")[0]);
      if (path && !existsSync(resolve(dirname(file), path))) errors.push(`${relative(root, file)}:${i + 1} broken link ${target}`);
    }
  });
}

// A docs folder with a README must list every note beside it.
for (const dir of new Set(walk(join(root, "docs"), (n) => n.endsWith(".md")).map((f) => dirname(f)))) {
  const readme = join(dir, "README.md");
  if (!existsSync(readme)) continue;
  const text = readFileSync(readme, "utf8");
  for (const f of readdirSync(dir)) {
    if (f.endsWith(".md") && f !== "README.md" && !text.includes(f)) errors.push(`${relative(root, readme)} does not list ${f}`);
  }
}

// Every outputs folder has a README and is listed in the outputs index. A repo that adopted only part of the kit gets warnings, not errors.
const outputs = join(root, P.outputs);
const outLevel = cfg.required ? warnings : errors;
if (existsSync(outputs)) {
  const index = existsSync(join(outputs, "README.md")) ? readFileSync(join(outputs, "README.md"), "utf8") : "";
  for (const e of readdirSync(outputs, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name.startsWith(".")) continue;
    if (!existsSync(join(outputs, e.name, "README.md"))) outLevel.push(`${P.outputs}/${e.name} has no README.md`);
    if (index && !index.includes(e.name)) outLevel.push(`${P.outputs}/README.md does not list ${e.name}`);
  }
}

// The review queue: notes nothing links to, notes untouched for a long time, notes past their review_after date.
// Warnings, never failures: on a content-heavy repo the counts are leads to look at, not faults.
const cov = coverage(cfg);
const names = (xs, n = 5) => xs.slice(0, n).join(", ") + (xs.length > n ? ` and ${xs.length - n} more` : "");
if (cov.orphans.length) warnings.push(`${cov.orphans.length} note(s) nothing links to: ${names(cov.orphans)}`);
if (cov.stale.length) warnings.push(`${cov.stale.length} note(s) untouched for ${cov.staleNoteDays}+ days: ${names(cov.stale.map((s) => `${s.path} (${s.date})`))}`);
if (cov.due.length) warnings.push(`${cov.due.length} note(s) due for review: ${names(cov.due.map((s) => `${s.path} (${s.date})`))}`);

// Unknown recorder names are a warning, not a failure.
for (const file of docs) {
  if (file.includes("/docs/templates/")) continue;
  const m = readFileSync(file, "utf8").match(/^---\n([\s\S]*?)\n---/);
  const who = m?.[1].match(/^recorded_by:\s*"?([^"\n]+?)"?\s*$/m)?.[1];
  if (who && !cfg.recorders.includes(who)) warnings.push(`${relative(root, file)}: unknown recorded_by "${who}"`);
}

for (const w of warnings) console.log(`WARNING ${w}`);
if (errors.length) {
  for (const e of errors) console.log(`ERROR ${e}`);
  console.log(`Playbook checks failed: ${errors.length} error(s), ${warnings.length} warning(s).`);
  process.exit(1);
}
console.log(`Playbook checks passed: ${docs.length} Markdown files, ${rowCount} board rows, ${warnings.length} warning(s).`);
