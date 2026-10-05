#!/usr/bin/env node
// repo-fit: install, update and check the playbook in a repository. No dependencies.
//   repo-fit detect <repo> [--json]                           read-only: machine, repo, existing tools, what it would ask
//   repo-fit audit <repo> [--area <folder>] [--json] [--out <file>]
//                                                             read-only report and plan for an existing repo
//   repo-fit preview <repo>                                   read-only: the session brief the recommended set would give
//   repo-fit map <repo> [--json]                              read-only: the folder's map (MAP.md) as repo-fit would write it
//   repo-fit organize <repo> [--list] [--apply] [--json]      the plan to organize the folder (before → after → why); --apply does it
//   repo-fit apply <repo> [--steps A-01,...] [--tool ..] [--hooks all|brief|none] [--autosave on|off] [--apply]
//                                                             dry run by default; --apply writes, backs up, and writes a receipt
//   repo-fit undo <repo> [--receipt <file>] [--apply]         put back what the last apply changed (dry run by default)
//   repo-fit tools <repo> [--json] [--offline] [--update claude [--apply]]
//                                                             version limits vs what runs here; optional official update
//   repo-fit prefs [set <key> <value> | unset <key>]          your standing choices (kept outside repos)
//   repo-fit connect <repo> [--host github|gitlab] [--owner O] [--name N] [--apply]
//                                                             no remote yet: dry run, then create an EMPTY PRIVATE remote. Never pushes
//   repo-fit guidance check                                   which guidance files are due for a refresh
//   repo-fit init <repo> [--name N] [--owner O] [--tool claude|codex|both] [--models a,b]
//                        [--autosave on|off] [--no-hooks] [--strict]
//                                                             add the Starter kit. Never overwrites a file.
//   repo-fit status <repo>                                    is the repo behind this playbook?
//   repo-fit update <repo> [--apply]                          show what would change (default), or apply it
//   repo-fit hooks <repo> [--hooks brief|all] [--apply]       turn on the start-of-session briefing; the person runs it
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultOwner, hookFile, mergeHooks, recordersFor, writeAll } from "../lib/apply.mjs";
import { since } from "../lib/versions.mjs";
import { coreBlock, repoCoreVars } from "../lib/core.mjs";

const here = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const version = readFileSync(join(here, "VERSION"), "utf8").trim();
const today = () => process.env.REPO_FIT_TODAY ?? new Date().toLocaleDateString("sv-SE"); // REPO_FIT_TODAY fakes the date. Used by the tests.
const fail = (msg, code = 1) => {
  console.error(msg);
  process.exit(code);
};

function parse(argv) {
  const pos = [];
  const opt = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const v = argv[i + 1];
      if (v !== undefined && !v.startsWith("--")) {
        opt[a.slice(2)] = v;
        i++;
      } else opt[a.slice(2)] = true;
    } else pos.push(a);
  }
  return { pos, opt };
}

// ---------- guidance layer ----------
const guidanceDir = join(here, "guidance");
function frontMatter(text) {
  // Windows checkouts have \r\n line endings. Read them like \n.
  const m = text.replace(/\r\n?/g, "\n").match(/^---\n([\s\S]*?)\n---/);
  const meta = {};
  if (m) for (const line of m[1].split("\n")) {
    const kv = line.match(/^([a-z_]+):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2];
  }
  return meta;
}
function guidanceState() {
  const t = today();
  const files = readdirSync(guidanceDir).filter((f) => f.endsWith(".md") && f !== "README.md").sort();
  const rows = files.map((file) => {
    const meta = frontMatter(readFileSync(join(guidanceDir, file), "utf8"));
    const left = Math.round((Date.parse(meta.review_after) - Date.parse(t)) / 864e5);
    return { file, meta, left };
  });
  return {
    rows,
    overdue: rows.filter((r) => Number.isNaN(r.left) || r.left < 0).map((r) => r.file),
    reviewed: rows.map((r) => r.meta.retrieved ?? "").sort().pop() ?? "",
    models: new Set(rows.flatMap((r) => (r.meta.models ?? "").split(",").map((m) => m.trim()).filter(Boolean))),
  };
}
function guidanceCheck() {
  const g = guidanceState();
  console.log("File                 Retrieved    Review after  Status");
  for (const r of g.rows) {
    const status = Number.isNaN(r.left) ? "❌ no review_after date" : r.left < 0 ? `❌ overdue by ${-r.left} days` : r.left <= 7 ? `⚠️ due in ${r.left} days` : `✅ ${r.left} days left`;
    console.log(`${r.file.padEnd(20)} ${(r.meta.retrieved ?? "?").padEnd(12)} ${(r.meta.review_after ?? "?").padEnd(13)} ${status}`);
  }
  if (g.overdue.length) {
    console.log(`\nRefresh needed: ${g.overdue.join(", ")}. See "Refresh routine" in SKILL.md.`);
    process.exit(1);
  }
}

// ---------- kit ----------
const fill = (text, v) =>
  text.replaceAll("{{version}}", version).replaceAll("{{name}}", v.name ?? "").replaceAll("{{owner}}", v.owner ?? "").replaceAll("{{current}}", "docs/00-home/current.md").replaceAll("{{date}}", today());
const BLOCK_RE = /<!-- playbook:core v\S+ begin[^>]*-->[\s\S]*?<!-- playbook:core end -->/;
const VENDORED = ["lib.mjs", "brief.mjs", "check.mjs", "autosave.mjs", "map.mjs"];
const vendoredSource = (f) => readFileSync(join(here, "scripts/playbook", f), "utf8");
function* files(dir, base = dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.name === ".DS_Store") continue;
    if (e.isDirectory()) yield* files(p, base);
    else yield relative(base, p);
  }
}

function init(target, opt) {
  if (!target || !existsSync(target)) fail(`No such folder: ${target}`);
  const g = guidanceState();
  if (g.overdue.length) {
    const msg = `Guidance is past its review date (${g.overdue.join(", ")}). The notes on tools and models may be out of date, so check them before relying on them.`;
    if (opt.strict) fail(`${msg} --strict stops here. Refresh it first (see "Refresh routine" in SKILL.md).`);
    console.log(`⚠️ ${msg} Setup goes on. Maintainers: see "Refresh routine" in SKILL.md, or use --strict to stop instead.\n`);
  }
  const tool = opt.tool ?? "both";
  if (!["claude", "codex", "both"].includes(tool)) fail("--tool must be claude, codex or both");
  const tools = tool === "both" ? ["claude-code", "codex"] : [tool === "claude" ? "claude-code" : "codex"];
  const models = typeof opt.models === "string" ? opt.models.split(",").map((s) => s.trim()).filter(Boolean) : [];
  const v = { name: typeof opt.name === "string" ? opt.name : basename(resolve(target)), owner: defaultOwner(opt.owner, target) };
  const made = [];
  const skipped = [];
  const items = [];
  const put = (rel, content) => {
    if (existsSync(join(target, rel))) return skipped.push(rel);
    items.push({ step: "init", type: "create", path: rel, content });
    made.push(rel);
  };

  for (const rel of files(join(here, "kits/starter"))) {
    let text = fill(readFileSync(join(here, "kits/starter", rel), "utf8"), v);
    if (rel === "AGENTS.md") text = text.replace("<!-- playbook:core -->", coreBlock());
    put(rel, text);
  }
  for (const t of tools) {
    for (const rel of files(join(here, "kits/tools", t))) {
      if (opt["no-hooks"] && /settings\.json$|hooks\.json$/.test(rel)) continue;
      put(rel, fill(readFileSync(join(here, "kits/tools", t, rel), "utf8"), v));
    }
  }
  for (const f of VENDORED) put(`scripts/playbook/${f}`, vendoredSource(f));
  put("playbook.json", `${JSON.stringify({
    playbook: version, profile: "knowledge", tools, models, guidance: { reviewed: g.reviewed },
    autosave: opt.autosave !== "off",
    autosaveAllow: ["docs/**", "outputs/**/README.md", "LEARNINGS.md"], autosaveMaxFileMB: 5,
    protectedBranches: ["main", "master"], currentWordCap: 900, staleDays: 30, staleIsError: true,
    recorders: recordersFor(v.owner),
  }, null, 2)}\n`);

  const dry = Boolean(opt["dry-run"]);
  const written = dry ? null : writeAll(resolve(target), items);
  console.log(`${dry ? "DRY RUN, nothing written. " : ""}Playbook ${version} (guidance reviewed ${g.reviewed}) → ${target}\nTools: ${tools.join(", ")}. Models: ${models.join(", ") || "none named"}.`);
  console.log(`\n${dry ? "Would create" : "Created"} (${made.length}):\n${made.map((f) => `  ${f}`).join("\n")}`);
  if (written) console.log(`\nReceipt: ${written.receipt}. Undo with: node bin/repo-fit.mjs undo ${target} --apply`);
  if (dry) console.log("\nRun again without --dry-run to write these files. Nothing existing is ever overwritten.");
  if (skipped.length) console.log(`\nAlready there, left alone (${skipped.length}):\n${skipped.map((f) => `  ${f}`).join("\n")}`);
  const unknown = models.filter((m) => !g.models.has(m));
  if (unknown.length) console.log(`\n⚠️ No guidance yet for: ${unknown.join(", ")}. Add it under guidance/ after this setup.`);
  if (skipped.includes("AGENTS.md")) console.log('\n⚠️ AGENTS.md already exists. To add the managed core block, run "repo-fit audit <repo>", then "repo-fit apply <repo> --steps D-01" (dry run first).');
  if (tools.includes("codex") && !opt["no-hooks"]) console.log("\n⏳ Codex: the hooks in .codex/hooks.json do nothing until you review and trust them with /hooks. They are untested.");
  if (tools.includes("claude-code")) console.log("\n💡 Claude Code: run /context and confirm CLAUDE.md is listed. /doctor prompt-audit works on 2.1.283 or later (see `repo-fit tools`).");
}

// What `update` manages: only what the repo adopted. The core block when AGENTS.md already has it, the vendored
// scripts when scripts/playbook/ exists, and the version stamps in playbook.json. A part that was never adopted,
// or was skipped on purpose (`skipped` in playbook.json), is reported, never added: adding is `apply`'s job.
function plan(target) {
  const g = guidanceState();
  const changes = [];
  const notAdopted = [];
  let pj = {};
  try {
    pj = JSON.parse(readFileSync(join(target, "playbook.json"), "utf8"));
  } catch {
    /* no playbook.json, or not valid JSON */
  }
  const skipped = pj.skipped && typeof pj.skipped === "object" ? pj.skipped : {};
  const agents = join(target, "AGENTS.md");
  if (existsSync(agents)) {
    const cur = readFileSync(agents, "utf8");
    if (BLOCK_RE.test(cur)) {
      const next = cur.replace(BLOCK_RE, () => coreBlock(repoCoreVars(target))); // with this repo's own paths and rules
      if (next !== cur) changes.push({ rel: "AGENTS.md", old: cur, next });
    } else notAdopted.push({ part: "the core block in AGENTS.md", step: "D-01", reason: skipped["D-01"] });
  }
  if (existsSync(join(target, "scripts/playbook"))) {
    for (const f of VENDORED) {
      const rel = `scripts/playbook/${f}`;
      const cur = existsSync(join(target, rel)) ? readFileSync(join(target, rel), "utf8") : "";
      if (cur !== vendoredSource(f)) changes.push({ rel, old: cur, next: vendoredSource(f) });
    }
  } else notAdopted.push({ part: "the scripts and hooks", step: "A-10", reason: skipped["A-10"] });
  const pjPath = join(target, "playbook.json");
  if (existsSync(pjPath)) {
    const cur = readFileSync(pjPath, "utf8");
    const next = `${JSON.stringify({ ...pj, playbook: version, guidance: { ...(pj.guidance ?? {}), reviewed: g.reviewed } }, null, 2)}\n`;
    if (next !== cur) changes.push({ rel: "playbook.json", old: cur, next, stamp: true });
  }
  return { changes, notAdopted, pj };
}

function hookNotes(target, pj) {
  const tools = pj.tools ?? [];
  const notes = [];
  const has = (rel) => existsSync(join(target, rel)) && readFileSync(join(target, rel), "utf8").includes("scripts/playbook/");
  // Hooks matter only where the scripts were adopted with hooks.
  if (existsSync(join(target, "scripts/playbook")) && pj.hooks !== "none") {
    const off = [tools.includes("claude-code") && !has(".claude/settings.json") ? "Claude Code" : null, tools.includes("codex") && !has(".codex/hooks.json") ? "Codex" : null].filter(Boolean);
    if (off.length) notes.push(`The start-of-session briefing is not turned on for ${off.join(" and ")}. The person turns it on with: repo-fit hooks ${target} --apply`);
    const noReminder = tools.includes("claude-code") && has(".claude/settings.json") && !readFileSync(join(target, ".claude/settings.json"), "utf8").includes("autosave.mjs");
    if (noReminder) notes.push(`The end-of-reply reminder ("did we write down what matters?") is not on. The person turns it on with: repo-fit hooks ${target} --apply`);
  }
  // guidance/claude-code.md C1: with a CLAUDE.md present, Claude Code reads only that file, so it must import AGENTS.md.
  const claudeMd = join(target, "CLAUDE.md");
  if (tools.includes("claude-code") && existsSync(claudeMd) && existsSync(join(target, "AGENTS.md")) && !/(^|\s)@AGENTS\.md\b/.test(readFileSync(claudeMd, "utf8"))) {
    notes.push("CLAUDE.md does not import AGENTS.md, so Claude Code will not read the rulebook. Add a line `@AGENTS.md` to CLAUDE.md (guidance C1).");
  }
  return notes;
}

const notAdoptedLines = (list) => list.map((n) => (n.reason !== undefined ? `➖ Skipped on purpose: ${n.part} (${n.step}): ${n.reason || "no reason given"}` : `➖ Not adopted: ${n.part} (${n.step}). Add it with "apply --steps ${n.step}", or record why not with "skip <repo> ${n.step} --reason ..."`));

// What changed since the version this repo has, and steps it skipped that changed since: worth a second look.
function newsLines(pj, notAdopted) {
  const { news, steps } = since(pj.playbook ?? "0.0.0");
  const out = news.length ? [`🆕 New since ${pj.playbook ?? "your version"}:`, ...news.map((n) => `   • ${n.text}`)] : [];
  for (const n of notAdopted) if (n.reason !== undefined && steps[n.step]) out.push(`👀 Worth a second look: ${n.part} (${n.step}), skipped because "${n.reason || "no reason given"}". ${steps[n.step]} To add it: skip <repo> ${n.step} --remove --apply, then apply <repo> --steps ${n.step}.`);
  return out;
}

// Turn on the start-of-session briefing (and autosave, with --hooks all): the hook files for the repo's tools, merged
// with the hooks already there. Claude Code's auto mode blocks an assistant from writing these, so the person runs it.
function hooks(target, opt) {
  if (!target || !existsSync(target)) fail("Usage: repo-fit hooks <repo> [--hooks brief|all] [--apply]");
  const root = resolve(target);
  if (!existsSync(join(root, "scripts/playbook/brief.mjs"))) fail(`${target}: the briefing script is not there yet. Add it first: repo-fit apply ${target} --steps A-10 --hooks none`, 2);
  const pjPath = join(root, "playbook.json");
  let pj = {};
  try {
    pj = JSON.parse(readFileSync(pjPath, "utf8"));
  } catch {
    /* no playbook.json: both tools, briefing only */
  }
  const mode = opt.hooks === "all" || opt.hooks === "brief" ? opt.hooks : pj.autosave ? "all" : "brief";
  const tools = pj.tools ?? ["claude-code", "codex"];
  const items = [];
  const add = (rel, kitRel) => {
    const old = existsSync(join(root, rel)) ? readFileSync(join(root, rel), "utf8") : "";
    const next = old ? mergeHooks(old, hookFile(kitRel, mode)) : `${JSON.stringify(hookFile(kitRel, mode), null, 2)}\n`;
    if (next !== old) items.push({ step: "hooks", type: old ? "edit" : "create", path: rel, old, content: next });
  };
  if (tools.includes("claude-code")) add(".claude/settings.json", "claude-code/.claude/settings.json");
  if (tools.includes("codex")) add(".codex/hooks.json", "codex/.codex/hooks.json");
  if (existsSync(pjPath) && pj.hooks !== mode) {
    const old = readFileSync(pjPath, "utf8");
    items.push({ step: "hooks", type: "edit", path: "playbook.json", old, content: `${JSON.stringify({ ...pj, hooks: mode }, null, 2)}\n` });
  }
  if (!items.length) return console.log("✅ The start-of-session briefing is already on.");
  for (const it of items) console.log(showDiff(it.path, it.old, it.content));
  if (!opt.apply) return console.log(`Dry run: ${items.length} file(s) would change. Run again with --apply to turn the briefing on.`);
  const w = writeAll(root, items);
  console.log(`✅ The briefing is on${mode === "all" ? ", with autosave" : ""}. Every new session in this folder starts with it.${tools.includes("codex") ? " Codex: run /hooks once and allow it." : ""}\nTo turn it off: repo-fit undo ${target} --apply   Receipt: ${w.receipt}`);
}

function status(target) {
  if (!target || !existsSync(join(target, "playbook.json"))) fail(`${target}: no playbook.json. Run "repo-fit init" first.`, 2);
  const g = guidanceState();
  const { changes, notAdopted, pj } = plan(target);
  console.log(`Repo:     playbook ${pj.playbook}, guidance reviewed ${pj.guidance?.reviewed ?? "never"}, tools ${(pj.tools ?? []).join(", ")}, models ${(pj.models ?? []).join(", ") || "none named"}`);
  console.log(`Playbook: ${version}, guidance reviewed ${g.reviewed}${g.overdue.length ? ` (⚠️ overdue: ${g.overdue.join(", ")})` : ""}`);
  const notes = hookNotes(target, pj);
  const managed = changes.filter((c) => !c.stamp);
  if (managed.length) console.log(`⏳ Behind. Files that would change: ${changes.map((c) => c.rel).join(", ")}`);
  else if (changes.length) console.log(`✅ The adopted parts are current. Only the version stamp in playbook.json would move to ${version} (update --apply).`);
  else console.log("✅ Up to date.");
  for (const l of notAdoptedLines(notAdopted)) console.log(l);
  for (const l of newsLines(pj, notAdopted)) console.log(l);
  for (const n of notes) console.log(`⚠️ ${n}`);
  if (managed.length || notes.length) process.exitCode = 1;
}

function showDiff(rel, oldText, newText) {
  const dir = mkdtempSync(join(tmpdir(), "playbook-"));
  writeFileSync(join(dir, "old"), oldText);
  writeFileSync(join(dir, "new"), newText);
  const r = spawnSync("diff", ["-u", "-L", `${rel} (repo)`, "-L", `${rel} (playbook ${version})`, join(dir, "old"), join(dir, "new")], { encoding: "utf8" });
  rmSync(dir, { recursive: true });
  return r.stdout;
}

// Safe start: save the folder in Git as it is before the first change (lib/safe.mjs). Stops the run if Git will not.
async function safeStart(target) {
  if (process.argv.includes("--no-snapshot")) return console.log("⚠️ No snapshot (--no-snapshot): repo-fit's own undo still takes back what it changes.\n");
  const { snapshot } = await import("../lib/safe.mjs");
  const s = snapshot(resolve(target));
  console.log(`${s.text}\n`);
  if (!s.ok) process.exit(1);
}
const safeLine = async (target) => (await import("../lib/safe.mjs")).snapshotPlan(resolve(target)).line;

async function update(target, apply) {
  if (!target || !existsSync(join(target, "playbook.json"))) fail(`${target}: no playbook.json. Run "repo-fit init" first (it never overwrites files).`, 2);
  const { changes, notAdopted, pj } = plan(target);
  for (const n of hookNotes(target, pj)) console.log(`⚠️ ${n}`);
  for (const l of notAdoptedLines(notAdopted)) console.log(l);
  for (const l of newsLines(pj, notAdopted)) console.log(l);
  if (!changes.length) return console.log("✅ Up to date. Nothing to change.");
  for (const c of changes) console.log(showDiff(c.rel, c.old, c.next));
  if (!apply) return console.log(`Dry run: ${changes.length} file(s) would change. Run again with --apply after review.\n\n${await safeLine(target)}`);
  await safeStart(target);
  const w = writeAll(resolve(target), changes.map((c) => ({ step: "update", type: existsSync(join(target, c.rel)) ? "edit" : "create", path: c.rel, old: c.old, content: c.next })));
  console.log(`Applied ${changes.length} file(s). Nothing was committed. Receipt: ${w.receipt}. Backups: .playbook/backups/${w.ts}/. Undo with: node bin/repo-fit.mjs undo ${target} --apply`);
}

// Record (or remove) a step skipped on purpose, with its reason, in playbook.json. Dry run unless --apply.
function skip(target, id, opt) {
  if (!target || !id || !/^[ADX]-\d\d$/.test(id)) fail('Usage: repo-fit skip <repo> <step id, for example D-01> --reason "why" [--remove] [--apply]');
  const pjPath = join(target, "playbook.json");
  if (!existsSync(pjPath)) fail(`${target}: no playbook.json, so there is nowhere to record the skip. Apply A-01 first (dry run: repo-fit apply <repo> --steps A-01).`, 2);
  const old = readFileSync(pjPath, "utf8");
  const pj = JSON.parse(old);
  const skipped = { ...(pj.skipped ?? {}) };
  if (opt.remove) delete skipped[id];
  else skipped[id] = typeof opt.reason === "string" && opt.reason.trim() ? opt.reason.trim() : "no reason given";
  const next = `${JSON.stringify({ ...pj, skipped }, null, 2)}\n`;
  if (next === old) return console.log(`✅ Nothing to change: ${id} is ${opt.remove ? "not skipped" : "already skipped with that reason"}.`);
  console.log(showDiff("playbook.json", old, next));
  if (!opt.apply) return console.log(`Dry run. Run again with --apply to ${opt.remove ? "remove the skip" : "record the skip"}.`);
  const w = writeAll(resolve(target), [{ step: `skip ${id}`, type: "edit", path: "playbook.json", old, content: next }]);
  console.log(`✅ ${opt.remove ? "Removed the skip of" : "Recorded the skip of"} ${id}. audit, status and update now ${opt.remove ? "offer it again" : "leave it out and show the reason"}. Receipt: ${w.receipt}`);
}

const HELP = `repo-fit ${version}: a small foundation for any repo, new or existing. Nothing here changes a repo unless you add --apply (or run init without --dry-run).

Look (read-only):
  detect <repo> [--json]                     machine, repo, existing tools, what it would ask
  audit <repo> [--area <folder>] [--json] [--out <file>]
                                             report and plan for an existing repo, with the recommended set
  preview <repo>                             the session brief the recommended set would give
  map <repo> [--json]                        the map of the folder (MAP.md) as repo-fit would write it
  organize <repo> [--list]                   the plan to organize the folder: before, after and why; --list shows every move
  tools <repo> [--json] [--offline]          tool versions vs the limits in guidance/gates.json
  status <repo>                              is the repo behind this playbook?
  guidance check                             which guidance is due for a refresh

Change (dry run first):
  init <repo> [--dry-run] [--tool claude|codex|both] [--models a,b] [--autosave on|off] [--no-hooks] [--name N] [--owner O]
  apply <repo> [--steps A-01,...] [--tool ..] [--hooks all|brief|none] [--autosave on|off] [--claude-link merge] [--word-cap N] [--show] [--apply]
  update <repo> [--apply]                    bring the adopted parts up to this playbook version
  hooks <repo> [--hooks brief|all] [--apply] turn on the start-of-session briefing (the person runs this)
  organize <repo> --apply                    organize the folder as the plan shows: moves, link updates, map; one undo
  skip <repo> <ID> --reason "..." [--remove] [--apply]
                                             record a step you leave out on purpose (audit, status, update respect it)
  undo <repo> [--receipt <file>] [--force] [--apply]
                                             put back what the last apply, init, update or organize changed
  connect <repo> [--host github|gitlab] [--owner O] [--name N] [--apply]
                                             no remote yet: create an EMPTY PRIVATE remote. Never pushes
  tools <repo> --update claude [--apply]     run Claude Code's own updater
  prefs [set <key> <value> | unset <key>]    your standing choices, kept outside repos

Any command that writes accepts --pin <version>: it refuses to run unless this playbook copy is that version.
Setup by an agent: see INSTALL.md.`;
if (typeof opt0(process.argv) === "string" && ["init", "update", "apply"].includes(process.argv[2]) && opt0(process.argv).replace(/^v/, "") !== version) fail(`Pinned to ${opt0(process.argv)}, but this playbook copy is ${version}. Check out the matching tag (git checkout v${opt0(process.argv).replace(/^v/, "")}) or drop --pin.`);
function opt0(argv) {
  const i = argv.indexOf("--pin");
  return i >= 0 ? argv[i + 1] : undefined;
}
const { pos, opt } = parse(process.argv.slice(3));
switch (process.argv[2]) {
  case "tools": {
    if (!pos[0]) fail("Usage: repo-fit tools <repo> [--json] [--offline] [--update claude [--apply]]");
    const { tools } = await import("../lib/tools.mjs");
    const res = tools(pos[0], { offline: Boolean(opt.offline), update: typeof opt.update === "string" ? opt.update : undefined, apply: Boolean(opt.apply) });
    console.log(opt.json && res.data ? JSON.stringify(res.data, null, 2) : res.text);
    if (!res.ok) process.exitCode = 1;
    break;
  }
  case "prefs": {
    const { readPrefs, setPref, prefsPath } = await import("../lib/prefs.mjs");
    if (pos[0] === "set" && pos[1] && pos[2] !== undefined) console.log(`Saved to ${setPref(pos[1], pos[2]).path}\n${JSON.stringify(readPrefs(), null, 2)}`);
    else if (pos[0] === "unset" && pos[1]) console.log(`Saved to ${setPref(pos[1], null).path}\n${JSON.stringify(readPrefs(), null, 2)}`);
    else console.log(`${prefsPath()}\n${JSON.stringify(readPrefs(), null, 2)}\n\nSet: repo-fit prefs set autoUpdate.claude-code when-required   (update Claude Code by itself only when a repo truly needs it)\nUnset: repo-fit prefs unset autoUpdate.claude-code`);
    break;
  }
  case "connect": {
    if (!pos[0]) fail("Usage: repo-fit connect <repo> [--host github|gitlab] [--owner <group-or-org>] [--name <repo-name>] [--apply]");
    const { connect } = await import("../lib/connect.mjs");
    const res = connect(pos[0], { host: typeof opt.host === "string" ? opt.host : undefined, owner: typeof opt.owner === "string" ? opt.owner : undefined, name: typeof opt.name === "string" ? opt.name : undefined, apply: Boolean(opt.apply) });
    console.log(res.text);
    if (!res.ok) process.exitCode = 1;
    else if (!opt.apply && /would be written/.test(res.text)) console.log(`\n${await safeLine(pos[0])}`);
    break;
  }
  case "apply": {
    if (!pos[0]) fail("Usage: repo-fit apply <repo> [--steps A-01,A-10,...] [--tool claude|codex|both] [--hooks all|brief|none] [--autosave on|off] [--claude-link merge] [--models a,b] [--word-cap N] [--apply]");
    const wordCap = opt["word-cap"] === undefined ? undefined : Number(opt["word-cap"]);
    if (wordCap !== undefined && !(Number.isInteger(wordCap) && wordCap > 0)) fail("--word-cap must be a whole number of words, for example --word-cap 1500");
    const { apply } = await import("../lib/apply.mjs");
    if (opt.apply) await safeStart(pos[0]);
    const list = (v) => (typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : null);
    const res = apply(pos[0], {
      steps: list(opt.steps), tool: typeof opt.tool === "string" ? opt.tool : "both", hooks: typeof opt.hooks === "string" ? opt.hooks : "all",
      autosave: opt.autosave !== "off", claudeLink: opt["claude-link"], models: list(opt.models) ?? [], name: typeof opt.name === "string" ? opt.name : undefined,
      owner: typeof opt.owner === "string" ? opt.owner : undefined, dry: !opt.apply, wordCap, show: Boolean(opt.show),
    });
    console.log(res.text);
    if (!res.ok) process.exitCode = 1;
    break;
  }
  case "undo": {
    if (!pos[0]) fail("Usage: repo-fit undo <repo> [--receipt <file>] [--force] [--apply]");
    const { undo } = await import("../lib/apply.mjs");
    const res = undo(pos[0], { receipt: typeof opt.receipt === "string" ? opt.receipt : undefined, dry: !opt.apply, force: Boolean(opt.force) });
    console.log(res.text);
    if (!res.ok) process.exitCode = 1;
    break;
  }
  case "audit": {
    if (!pos[0]) fail("Usage: repo-fit audit <repo> [--area <folder>] [--json] [--out <file>]");
    const { audit, markdown } = await import("../lib/audit.mjs");
    const a = audit(pos[0], { area: typeof opt.area === "string" ? opt.area : undefined });
    const text = opt.json ? JSON.stringify(a, null, 2) : markdown(a);
    if (typeof opt.out === "string") {
      writeFileSync(opt.out, `${text}\n`);
      console.log(`Audit written to ${opt.out}`);
    } else console.log(text);
    break;
  }
  case "preview": {
    if (!pos[0]) fail("Usage: repo-fit preview <repo>");
    const { audit, placeNew } = await import("../lib/audit.mjs");
    const a = audit(pos[0]);
    if (!a.detect.repo.exists) fail(`Not a folder: ${a.root}`);
    // The settings the recommended set would write, so the brief reads the repo the way it will after the apply.
    // A repo that already has playbook.json is shown with its own settings.
    const rec = a.plan.recommended;
    const role = { "A-02": "board", "A-03": "current" };
    const paths = Object.fromEntries(Object.entries(a.mapping).filter(([, p]) => p));
    for (const id of rec.steps) if (role[id]) paths[role[id]] = placeNew(a.mapping, role[id]);
    const quiet = rec.flags.includes("--autosave off");
    const cfg = {
      paths, required: Object.entries(paths).filter(([k]) => ["current", "board", "log", "questions", "people", "decisions", "lessons"].includes(k)).map(([, p]) => p),
      autosave: !quiet, protectedBranches: a.own.topics.mainBranch && quiet ? [] : ["main", "master"], currentWordCap: a.details.current?.cap ?? a.details.current?.playbookCap ?? 900,
    };
    const r = spawnSync(process.execPath, [join(here, "scripts/playbook/brief.mjs"), "--text"], { encoding: "utf8", env: { ...process.env, REPO_FIT_PREVIEW_ROOT: a.root, REPO_FIT_PREVIEW_CONFIG: JSON.stringify(cfg) } });
    if (r.status !== 0) fail(r.stderr || "The brief did not run.");
    console.log(`${existsSync(join(a.root, "scripts/playbook/brief.mjs")) ? "The briefing this repo's sessions start with today" : "The briefing this repo's sessions would start with after the recommended set"}. Nothing was written.\n\n${r.stdout.trimEnd()}`);
    break;
  }
  case "organize": {
    if (!pos[0]) fail("Usage: repo-fit organize <repo> [--list] [--apply] [--json]");
    const { organizePlan, organizeApply, screen, list } = await import("../lib/organize.mjs");
    const root = resolve(pos[0]);
    if (!existsSync(root)) fail(`Not a folder: ${root}`);
    const p = organizePlan(root);
    if (opt.json) console.log(JSON.stringify({ batches: p.batches, stays: p.stays, suggestions: p.suggestions, mentions: p.mentions, links: p.links }, null, 2));
    else if (opt.apply) {
      // The yes was for the plan on the screen: if the folder changed since, refuse and show the new plan instead.
      if (typeof opt.plan === "string" && opt.plan !== p.code) {
        console.log(`❌ The folder changed since you saw it, so nothing was moved. Here is the plan as it is now; say yes to this one instead.\n\n${screen(p, pos[0])}`);
        process.exit(1);
      }
      if (p.batches.length) await safeStart(root);
      const r = organizeApply(root, p);
      console.log(r.text);
      if (!r.ok) process.exit(1);
      if (p.batches.length) console.log(`\nThe map (MAP.md) and the index pages were rebuilt. Undo everything with one command: repo-fit undo ${pos[0]} --apply`);
    } else {
      const text = opt.list ? list(p) : screen(p, pos[0]);
      // The snapshot line goes right under the title, before the plan: the one yes covers it.
      console.log(p.batches.length ? text.replace(/\n\n/, `\n\n${await safeLine(root)}\n\n`) : text);
    }
    break;
  }
  case "map": {
    if (!pos[0]) fail("Usage: repo-fit map <repo> [--json]");
    const { pages, scan } = await import("../scripts/playbook/map.mjs");
    const root = resolve(pos[0]);
    if (!existsSync(root)) fail(`Not a folder: ${root}`);
    if (opt.json) {
      console.log(JSON.stringify(scan(root), null, 2));
      break;
    }
    const p = pages(root);
    const map = p.get("MAP.md") ?? (existsSync(join(root, "MAP.md")) ? readFileSync(join(root, "MAP.md"), "utf8") : "");
    console.log(`The map of ${basename(root)}${p.has("MAP.md") ? " as repo-fit would write it" : ""}. Nothing was written.\n\n${map.trimEnd()}`);
    const idx = [...p.keys()].filter((k) => k !== "MAP.md");
    if (idx.length) console.log(`\nIndex pages it would write: ${idx.join(", ")}`);
    break;
  }
  case "detect": {
    if (!pos[0]) fail("Usage: repo-fit detect <repo> [--json]");
    const { detect, format } = await import("../lib/detect.mjs");
    const d = detect(pos[0]);
    console.log(opt.json ? JSON.stringify(d, null, 2) : format(d));
    break;
  }
  case "guidance":
    if (pos[0] === "check") guidanceCheck();
    else fail("Usage: repo-fit guidance check");
    break;
  case "init": init(pos[0], opt); break;
  case "status": status(pos[0]); break;
  case "update": await update(pos[0], Boolean(opt.apply)); break;
  case "skip": skip(pos[0], pos[1], opt); break;
  case "hooks": hooks(pos[0], opt); break;
  case "help":
  case "--help":
  case undefined:
    console.log(HELP);
    break;
  default:
    fail(`Unknown command "${process.argv[2]}".\n\n${HELP}`, 2);
}
