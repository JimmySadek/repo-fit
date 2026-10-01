// Applies steps from an audit plan to a repo, safely. Dry run by default.
//   - creates files, and edits a few named files, only for the steps you list
//   - backs up every file before editing it, and writes a receipt of everything it did
//   - undo puts things back, and never overwrites something you changed since
// It never commits, pushes, installs, deletes or logs in to anything.
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, rmdirSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { audit, placeNew } from "./audit.mjs";
import { CORE_ROLES, coreBlock, coreVars, hasScripts } from "./core.mjs";
import { deferVars } from "./adapt.mjs";
import { ruleOverlap } from "./detect.mjs";
import { PATH_DEFAULTS } from "../scripts/playbook/lib.mjs";
import { readPrefs } from "./prefs.mjs";

const here = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const version = readFileSync(join(here, "VERSION"), "utf8").trim();
const today = () => new Date().toLocaleDateString("sv-SE");
const stamp = () => new Date().toISOString().replace(/[:.]/g, "-");
const sha = (s) => createHash("sha256").update(s).digest("hex");
const fill = (t, v) => t.replaceAll("{{version}}", version).replaceAll("{{name}}", v.name ?? "").replaceAll("{{owner}}", v.owner ?? "").replaceAll("{{current}}", v.current ?? PATH_DEFAULTS.current).replaceAll("{{date}}", today());
const kit = (rel, v) => fill(readFileSync(join(here, "kits/starter", rel), "utf8"), v);
const BLOCK_RE = /<!-- playbook:core v\S+ begin[^>]*-->[\s\S]*?<!-- playbook:core end -->/;
const VENDORED = ["lib.mjs", "brief.mjs", "check.mjs", "autosave.mjs"];
const AUTO = new Set(["A-01", "A-02", "A-03", "A-04", "A-05", "A-06", "A-07", "A-08", "A-09", "A-10", "A-11", "A-12", "D-01", "D-02", "D-08", "D-10"]);
const SHOW_LINES = 12; // lines of a new file a dry run prints, unless --show
const ROLE_STEPS = { "A-02": "board", "A-03": "current", "A-04": "log", "A-05": "decisions", "A-06": "questions", "A-07": "people", "A-08": "lessons" };

function guidanceReviewed() {
  const dir = join(here, "guidance");
  return readdirSync(dir).filter((f) => f.endsWith(".md") && f !== "README.md").map((f) => readFileSync(join(dir, f), "utf8").match(/^retrieved:\s*(\S+)/m)?.[1] ?? "").sort().pop() ?? "";
}

function diffText(rel, oldT, newT) {
  const dir = mkdtempSync(join(tmpdir(), "playbook-"));
  writeFileSync(join(dir, "a"), oldT);
  writeFileSync(join(dir, "b"), newT);
  const r = spawnSync("diff", ["-u", "-L", `${rel} (now)`, "-L", `${rel} (after)`, join(dir, "a"), join(dir, "b")], { encoding: "utf8" });
  rmSync(dir, { recursive: true });
  return r.stdout.split("\n").slice(0, 40).join("\n");
}

// Add our hooks to a hook file without touching the hooks that are already there.
function mergeHooks(oldText, wanted) {
  const cur = JSON.parse(oldText);
  cur.hooks ??= {};
  for (const [event, groups] of Object.entries(wanted.hooks)) {
    const list = (cur.hooks[event] ??= []);
    if (!JSON.stringify(list).includes("scripts/playbook/")) list.push(...groups);
  }
  return `${JSON.stringify(cur, null, 2)}\n`;
}
function hookFile(kitRel, mode) {
  const j = JSON.parse(readFileSync(join(here, "kits/tools", kitRel), "utf8"));
  if (mode === "brief") j.hooks = { SessionStart: j.hooks.SessionStart };
  return j;
}

// Who is named as owner in a new repo. Order: --owner, your saved `owner` preference, the repo's git user.name, then "Owner".
export function defaultOwner(explicit, target) {
  if (typeof explicit === "string" && explicit.trim()) return explicit.trim();
  const pref = readPrefs().owner;
  if (typeof pref === "string" && pref.trim()) return pref.trim();
  const r = spawnSync("git", ["-C", target, "config", "user.name"], { encoding: "utf8" });
  const g = r.status === 0 ? r.stdout.trim() : "";
  return g || "Owner";
}
// Names allowed in a log line's second field: the tools, and the owner.
export const recordersFor = (owner) => [...new Set(["Codex", "Claude Code", "Claude Cowork", "Claude app", owner])];

function build(target, o) {
  const a = audit(target);
  const r = a.detect.repo;
  if (!r.exists) return { error: `${target} is not a folder` };
  const v = { name: o.name ?? a.name, owner: defaultOwner(o.owner, target) };
  const tools = o.tool === "claude" ? ["claude-code"] : o.tool === "codex" ? ["codex"] : ["claude-code", "codex"];
  const inPlan = new Map([...a.plan.safe, ...a.plan.decide].map((s) => [s.id, s]));
  const want = o.steps ?? a.plan.safe.map((s) => s.id);
  // The board's first row points at the current view. Point it there only if that file exists or is being created now.
  v.current = a.mapping.current ? a.mapping.current : want.includes("A-03") && inPlan.has("A-03") ? placeNew(a.mapping, "current") : existsSync(join(a.root, "README.md")) ? "README.md" : "";
  const ops = [];
  const manual = [];
  const notes = [];
  const willHave = new Set(Object.entries(a.mapping).filter(([, p]) => p).map(([k]) => k));
  const placed = {}; // role -> where a NEW file was put, when that is not the default path
  const create = (step, path, content) => ops.push({ step, type: "create", path, content });
  const edit = (step, path, fn, extra = {}) => ops.push({ step, type: "edit", path, edit: fn, ...extra });

  const skippedNow = new Map((a.plan.skipped ?? []).map((s) => [s.id, s]));
  for (const id of want) {
    if (skippedNow.has(id)) {
      notes.push(`${id}: skipped on purpose (${skippedNow.get(id).reason}). To do it after all, first run: repo-fit skip <repo> ${id} --remove --apply`);
      continue;
    }
    if (!AUTO.has(id)) {
      manual.push({ id, step: inPlan.get(id)?.step ?? "(not in this repo's plan)" });
      continue;
    }
    if (!inPlan.has(id)) {
      notes.push(id === "A-01" && r.playbook ? "A-01: playbook.json already exists, nothing to do. Change a value in it by hand (the audit's F5 says which cap to use)." : `${id}: not part of this repo's plan, nothing to do`);
      continue;
    }
    if (ROLE_STEPS[id]) {
      const role = ROLE_STEPS[id];
      const dest = placeNew(a.mapping, role);
      create(id, dest, kit(PATH_DEFAULTS[role], v));
      willHave.add(role);
      if (dest !== PATH_DEFAULTS[role]) placed[role] = dest;
      // playbook.json already exists and is not being written in this run: keep it in step with the new file.
      if (r.playbook && !(want.includes("A-01") && inPlan.has("A-01"))) {
        edit(id, "playbook.json", (old) => {
          const j = JSON.parse(old);
          let changed = false;
          if (dest !== PATH_DEFAULTS[role] && j.paths?.[role] !== dest) { j.paths = { ...(j.paths ?? {}), [role]: dest }; changed = true; }
          if (Array.isArray(j.autosaveAllow) && !dest.startsWith("docs/") && !j.autosaveAllow.includes(dest)) { j.autosaveAllow = [...j.autosaveAllow, dest]; changed = true; }
          if (Array.isArray(j.required) && !j.required.includes(dest)) { j.required = [...j.required, dest]; changed = true; }
          return changed ? `${JSON.stringify(j, null, 2)}\n` : old;
        });
      }
    }
  }
  const has = (id) => want.includes(id) && inPlan.has(id);
  // The core block names this repo's files: the mapped ones and the ones made in this run. A role with neither is left out.
  // Where the repo's own rules cover a topic (checks, commits, decisions, raw input), the block defers to them.
  const corePaths = Object.fromEntries(CORE_ROLES.map((k) => [k, willHave.has(k) ? placed[k] ?? a.mapping[k] ?? PATH_DEFAULTS[k] : null]));
  corePaths.scripts = hasScripts(a.root) || has("A-10") ? "scripts/playbook/" : null;
  const core = () => coreBlock(coreVars(a.root, corePaths, deferVars(a.own, corePaths)));
  if (has("D-01") && a.details.conflicts.length) notes.push(`D-01: the slim block defers to this repo's own rules on ${[...new Set(a.details.conflicts.map((c) => c.topic))].join(", ")}:\n${a.details.conflicts.map((c) => `  - ${c.topic}: the full block says "${c.block}"; the repo says "${c.repo}" (${c.where})`).join("\n")}`);
  if (has("A-10") && tools.includes("codex") && o.hooks !== "none") notes.push("A-10: the Codex hooks match the official file format but are untested in a real session. Codex runs no hook until you review and trust it with /hooks, so confirm one hook fires before relying on it.");
  if (has("A-10") && a.details.ownHooksAndChecks.length) notes.push(`A-10: repo already has ${a.details.ownHooksAndChecks.join("; ")}. Yours stay as they are; repo-fit's are added next to them${o.hooks === "none" ? " (scripts only, no hooks)" : ""}. To keep only yours, skip A-10: repo-fit skip <repo> A-10 --reason "own hooks and checks" --apply`);

  if (has("A-09")) for (const f of a.details.outputsWithoutReadme) create("A-09", `${f}/README.md`, `# ${basename(f)}\n\nWhat this is, why it exists and where its source lives. Two or three lines.\n`);
  if (has("A-12")) create("A-12", "README.md", kit("README.md", v));
  if (has("A-11")) create("A-11", "AGENTS.md", kit("AGENTS.md", v).replace("<!-- playbook:core -->", core()));
  if (has("A-10")) {
    for (const f of VENDORED) create("A-10", `scripts/playbook/${f}`, readFileSync(join(here, "scripts/playbook", f), "utf8"));
    if (o.hooks !== "none") {
      if (tools.includes("claude-code")) {
        const wanted = hookFile("claude-code/.claude/settings.json", o.hooks);
        edit("A-10", ".claude/settings.json", (old) => mergeHooks(old, wanted), { createIfMissing: `${JSON.stringify(wanted, null, 2)}\n` });
      }
      if (tools.includes("codex")) {
        const wanted = hookFile("codex/.codex/hooks.json", o.hooks);
        edit("A-10", ".codex/hooks.json", (old) => mergeHooks(old, wanted), { createIfMissing: `${JSON.stringify(wanted, null, 2)}\n` });
      }
    }
    const agentsWillExist = a.detect.repo.rules.includes("AGENTS.md") || has("A-11");
    if (tools.includes("claude-code") && agentsWillExist && !r.rules.includes("CLAUDE.md")) create("A-10", "CLAUDE.md", readFileSync(join(here, "kits/tools/claude-code/CLAUDE.md"), "utf8"));
  }
  if (has("D-01")) edit("D-01", "AGENTS.md", (old) => (BLOCK_RE.test(old) ? old.replace(BLOCK_RE, () => core()) : `${old.trimEnd()}\n\n${core()}\n`));
  if (has("D-02")) {
    const ov = ruleOverlap(a.root);
    // Plain wording. The kit's CLAUDE.md talks about playbook hooks, which a repo linking its rule files may not have.
    const thin = "# CLAUDE.md\n\n@AGENTS.md\n\nClaude Code reads this file and imports the shared rulebook above. Put shared rules in AGENTS.md so Codex and Claude Code stay in step. Rules for Claude Code only go below this line.\n";
    const hasImport = (t) => /(^|\s)@AGENTS\.md\b/.test(t);
    if (ov?.identical) edit("D-02", "CLAUDE.md", (old) => (hasImport(old) ? old : thin), { warn: "CLAUDE.md is an identical copy of AGENTS.md. It is replaced by a thin import. The backup keeps the old file." });
    else if (o.claudeLink === "merge") edit("D-02", "CLAUDE.md", (old) => (hasImport(old) ? old : `@AGENTS.md\n\n## Claude Code only\n\nLines that were in CLAUDE.md and are not in AGENTS.md. Review them: a line that is only a reworded copy of an AGENTS.md rule belongs in AGENTS.md instead.\n\n${(ov?.onlyInClaude ?? []).join("\n").trim()}\n`), { warn: `Merge keeps ${ov?.onlyInClaude.length ?? 0} CLAUDE-only line(s) under the import and drops ${Math.round((ov?.share ?? 0) * 100)}% that AGENTS.md already has. Check that no reworded copy of a rule ends up in both places.` });
    else edit("D-02", "CLAUDE.md", (old) => (hasImport(old) ? old : `@AGENTS.md\n\n${old}`), { warn: `AGENTS.md and CLAUDE.md overlap by ${Math.round((ov?.share ?? 0) * 100)}%. A plain import loads the shared lines twice${(ov?.share ?? 0) >= 0.8 ? '. Consider --claude-link merge' : ", and any differing rules both apply. Review for conflicts"}.` });
  }
  if (has("D-10")) {
    const label = { dev: "Dev server", start: "Start", build: "Build", test: "Test", lint: "Lint", typecheck: "Type-check", format: "Format", check: "Check" };
    const body = a.detect.repo.commands.map((c) => `- **${label[c.name] ?? c.name}:** \`${c.run}\` (from ${c.from})`).join("\n");
    const block = `<!-- playbook:commands begin (drafted from the scripts found in this repo; edit freely, delete these two marker lines to stop updates) -->\n## Dev, test and lint\n\n${body}\n<!-- playbook:commands end -->`;
    const re = /<!-- playbook:commands begin[^>]*-->[\s\S]*?<!-- playbook:commands end -->/;
    edit("D-10", "AGENTS.md", (old) => (re.test(old) ? old.replace(re, () => block) : `${old.trimEnd()}\n\n${block}\n`));
  }
  if (has("D-08")) edit("D-08", ".gitignore", (old) => (/\*\.(mp4|mov|zip|psd|webm)/.test(old) ? old : `${old.replace(/\n*$/, "\n")}\n# playbook: heavy media stays out of Git\n*.mp4\n*.mov\n*.webm\n*.zip\n*.psd\n`), { createIfMissing: "# playbook: heavy media stays out of Git\n*.mp4\n*.mov\n*.webm\n*.zip\n*.psd\n" });

  // The word cap for the current view: --word-cap, else the repo's own cap, else the one in playbook.json, else 900. Only the body counts.
  const cur = a.details.current;
  const cap = o.wordCap ?? cur?.cap ?? cur?.playbookCap ?? 900;
  if (o.wordCap && !has("A-01")) notes.push(`--word-cap is used only when A-01 writes playbook.json. Here, set currentWordCap in playbook.json by hand.`);
  if (has("A-01") && cur && cur.words > cap) notes.push(`⚠️ \`${a.mapping.current}\` has a body of ${cur.words} words, over the word cap of ${cap}, so check will fail. Pick a cap with --word-cap <N>, or trim it.`);
  // Who may appear in recorded_by: the repo's own list when it has one; the owner only when named with --owner.
  const recorders = a.own.recorders?.names ?? (o.owner ? recordersFor(v.owner) : recordersFor(null).filter(Boolean));
  if (has("A-01") && a.own.recorders) notes.push(`A-01: recorders copied from ${a.own.recorders.where}: ${recorders.join(", ")}`);
  // Steps this run adopts are recorded in playbook.json, so status and update manage only what was adopted.
  const adoptedNow = new Set([...(Array.isArray(a.own.playbook.adopted) ? a.own.playbook.adopted : []), ...(r.playbook ? ["A-01"] : []), ...want.filter((id) => AUTO.has(id) && inPlan.has(id))]);
  if (r.playbook && !has("A-01") && want.some((id) => AUTO.has(id) && inPlan.has(id))) {
    edit("adopted", "playbook.json", (old) => {
      const j = JSON.parse(old);
      const next = [...new Set([...(Array.isArray(j.adopted) ? j.adopted : []), ...adoptedNow])].sort();
      const hooks = has("A-10") ? { hooks: o.hooks } : {};
      return JSON.stringify(j.adopted) === JSON.stringify(next) && (!has("A-10") || j.hooks === o.hooks) ? old : `${JSON.stringify({ ...j, adopted: next, ...hooks }, null, 2)}\n`;
    });
  }
  if (has("A-01")) {
    const roles = ["current", "board", "log", "questions", "people", "decisions", "lessons"];
    const mapped = { ...Object.fromEntries(Object.entries(a.mapping).filter(([, p]) => p)), ...placed };
    const rolePath = (k) => mapped[k] ?? PATH_DEFAULTS[k];
    const allow = ["docs/**", "outputs/**/README.md", "LEARNINGS.md"];
    for (const k of roles) {
      const p = mapped[k];
      if (p && !allow.includes(p) && !p.startsWith("docs/") && (placed[k] || statSync(join(a.root, p)).isFile())) allow.push(p);
    }
    const required = ["README.md", "playbook.json", ...(a.detect.repo.rules.includes("AGENTS.md") || has("A-11") ? ["AGENTS.md"] : []), ...roles.filter((k) => willHave.has(k)).map(rolePath)];
    const pj = {
      playbook: version, profile: "knowledge", tools, models: o.models ?? [], guidance: { reviewed: guidanceReviewed() },
      autosave: o.autosave, autosaveAllow: allow, autosaveMaxFileMB: 5, protectedBranches: ["main", "master"], currentWordCap: cap, staleDays: 30, staleIsError: true,
      recorders, paths: mapped, required: [...new Set(required)], ...(a.own.protected.length ? { protectedPaths: a.own.protected.map((x) => x.path) } : {}), adopted: [...adoptedNow].sort(), ...(has("A-10") ? { hooks: o.hooks } : {}),
    };
    create("A-01", "playbook.json", `${JSON.stringify(pj, null, 2)}\n`);
  }
  // A file made from a template must not link to siblings that will not exist (for example when only some steps are chosen).
  const madeHere = new Set(ops.filter((x) => x.type === "create").map((x) => x.path));
  for (const op of ops) {
    if (op.type !== "create" || !ROLE_STEPS[op.step] || !op.path.endsWith(".md")) continue;
    op.content = op.content.replace(/\[([^\]]+)\]\((?!https?:|#|mailto:)([^)\s#]+)(#[^)]*)?\)/g, (m, text, target) => {
      const rel = join(dirname(op.path), target).split("\\").join("/");
      return existsSync(join(a.root, rel)) || madeHere.has(rel) ? m : text;
    });
  }
  return { a, ops, manual, notes, tools };
}

// Two steps that edit the same file must build on each other, not overwrite each other.
function chain(ops) {
  const out = [];
  for (const op of ops) {
    const prev = op.type === "edit" ? out.find((x) => x.type === "edit" && x.path === op.path) : null;
    if (!prev) out.push(op);
    else {
      const fns = [prev.edit, op.edit];
      prev.edit = (t) => fns.reduce((x, f) => f(x), t);
      prev.step = `${prev.step}+${op.step}`;
      prev.warn = [prev.warn, op.warn].filter(Boolean).join(" ");
    }
  }
  return out;
}

function prepare(root, ops) {
  for (const op of ops) {
    const abs = join(root, op.path);
    const exists = existsSync(abs);
    if (op.type === "create") {
      op.status = exists ? "kept" : "new";
    } else if (!exists) {
      if (op.createIfMissing) Object.assign(op, { type: "create", content: op.createIfMissing, status: "new" });
      else op.status = "missing";
    } else {
      try {
        const old = readFileSync(abs, "utf8");
        const next = op.edit(old);
        Object.assign(op, next === old ? { status: "in-place" } : { status: "edit", old, content: next });
      } catch (e) {
        op.status = "error";
        op.error = e.message;
      }
    }
  }
}

export function apply(target, o) {
  const b = build(resolve(target), o);
  if (b.error) return { ok: false, text: `❌ ${b.error}` };
  const root = b.a.root;
  b.ops = chain(b.ops);
  prepare(root, b.ops);
  const out = [`# ${o.dry ? "Dry run" : "Apply"}: ${b.a.name}`, "", o.dry ? "Nothing is written yet. Review, then run again with --apply." : "Writing now. Nothing is committed.", ""];
  const icon = { new: "➕ create", edit: "✏️ edit", kept: "⏭️ kept yours (already exists)", "in-place": "✅ already in place", missing: "⚠️ file to edit is missing", error: "❌ cannot edit" };
  for (const op of b.ops) {
    out.push(`- **${op.step}** ${icon[op.status]} \`${op.path}\`${op.status === "new" ? ` (${op.content.split("\n").length - 1} lines)` : ""}${op.error ? `: ${op.error}` : ""}`);
    // A dry run shows what a new file will hold: config files in full, other files their first lines (--show for all).
    if (op.status === "new" && o.dry && !o.show && op.path.startsWith("scripts/playbook/")) out.push(`  Same file as repo-fit's own \`${op.path}\` (version ${version}). Add --show to see it.`);
    else if (op.status === "new" && o.dry) {
      const lines = op.content.replace(/\n$/, "").split("\n");
      const full = o.show || /\.(json|ya?ml|toml)$|(^|\/)\.gitignore$/.test(op.path) || lines.length <= SHOW_LINES;
      out.push("  ```", ...(full ? lines : lines.slice(0, SHOW_LINES)).map((l) => `  ${l}`), "  ```");
      if (!full) out.push(`  … ${lines.length - SHOW_LINES} more line(s). Add --show to see every line.`);
    }
    if (op.status === "edit") {
      if (op.warn) out.push(`  ⚠️ ${op.warn}`);
      out.push("  ```diff", ...diffText(op.path, op.old, op.content).split("\n").map((l) => `  ${l}`), "  ```");
    }
  }
  for (const m of b.manual) out.push(`- **${m.id}** 🖐️ not automated, do by hand or decide: ${m.step}`);
  for (const n of b.notes) out.push(`- ${n}`);
  const todo = b.ops.filter((op) => op.status === "new" || op.status === "edit");
  if (!todo.length) return { ok: true, text: `${out.join("\n")}\n\nNothing to write.` };
  if (o.dry) return { ok: true, text: `${out.join("\n")}\n\n${todo.length} file(s) would be written. Every edit is backed up first, and a receipt is written for undo.` };

  const w = writeAll(root, todo.map((op) => ({ step: op.step, type: op.status === "edit" ? "edit" : "create", path: op.path, old: op.old, content: op.content })));
  return { ok: true, text: `${out.join("\n")}\n\n✅ Wrote ${w.entries.length} file(s). Receipt: \`${w.receipt}\`. Backups: \`.playbook/backups/${w.ts}/\`. Undo with: node bin/repo-fit.mjs undo ${target} --apply` };
}

// Writes files the safe way: a backup before every edit, then one receipt. Used by apply and update.
export function writeAll(root, items, extra = {}) {
  const ts = stamp();
  const entries = [];
  const dirs = new Set(); // folders this run creates, so undo can remove exactly those once empty
  const ensureDir = (abs) => {
    for (let d = abs; !existsSync(d) && d.startsWith(root); d = dirname(d)) dirs.add(relative(root, d));
    mkdirSync(abs, { recursive: true });
  };
  for (const it of items) {
    const abs = join(root, it.path);
    ensureDir(dirname(abs));
    if (it.type === "edit") {
      const backup = join(".playbook/backups", ts, it.path);
      mkdirSync(dirname(join(root, backup)), { recursive: true });
      copyFileSync(abs, join(root, backup));
      writeFileSync(abs, it.content);
      entries.push({ step: it.step, type: "edit", path: it.path, before: sha(it.old), after: sha(it.content), backup });
    } else {
      writeFileSync(abs, it.content);
      entries.push({ step: it.step, type: "create", path: it.path, after: sha(it.content) });
    }
  }
  mkdirSync(join(root, ".playbook/receipts"), { recursive: true });
  if (!existsSync(join(root, ".playbook/.gitignore"))) writeFileSync(join(root, ".playbook/.gitignore"), "backups/\nundone/\n");
  const receipt = join(".playbook/receipts", `${ts}.json`);
  writeFileSync(join(root, receipt), `${JSON.stringify({ playbook: version, date: new Date().toISOString(), steps: [...new Set(items.map((x) => x.step))], entries, dirs: [...dirs].sort((a, b) => b.length - a.length), ...extra }, null, 2)}\n`);
  return { ts, receipt, entries };
}

export function undo(target, { receipt, dry = true, force = false } = {}) {
  const root = resolve(target);
  const dir = join(root, ".playbook/receipts");
  if (!existsSync(dir)) return { ok: false, text: "❌ No receipts here. Nothing to undo." };
  const all = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  const changedFiles = (f) => (JSON.parse(readFileSync(join(dir, f), "utf8")).entries ?? []).length > 0;
  const pick = receipt ? basename(receipt) : all.filter((f) => !existsSync(join(dir, `${f}.undone`)) && changedFiles(f)).pop();
  if (!pick || !existsSync(join(dir, pick))) return { ok: false, text: "❌ No receipt left to undo." };
  const rc = JSON.parse(readFileSync(join(dir, pick), "utf8"));
  if (rc.type === "connect") return { ok: true, text: `# Connect receipt ${pick}\n\nThis receipt records a remote repo (\`${rc.created}\`, ${rc.visibility}). The tool never deletes a remote repo. To undo by hand:\n\n- \`${rc.manual.removeLocalRemote}\`\n- \`${rc.manual.deleteRemoteRepo}\`` };
  const ts = stamp();
  const out = [`# ${dry ? "Undo dry run" : "Undo"}: ${basename(root)}`, "", `Receipt ${pick}, from ${rc.date}. ${dry ? "Nothing is changed yet. Run again with --apply." : ""}`, ""];
  let acted = 0;
  let kept = 0;
  // With --force, a file changed since repo-fit wrote it is moved aside first, so nothing is lost.
  const keepAside = (rel) => {
    if (dry) return;
    mkdirSync(dirname(join(root, ".playbook/undone", ts, "changed", rel)), { recursive: true });
    copyFileSync(join(root, rel), join(root, ".playbook/undone", ts, "changed", rel));
  };
  for (const e of [...rc.entries].reverse()) {
    const abs = join(root, e.path);
    const now = existsSync(abs) ? sha(readFileSync(abs, "utf8")) : null;
    if (e.type === "create") {
      if (now === null) out.push(`- ➖ \`${e.path}\` is already gone`);
      else if (now !== e.after && !force) {
        out.push(`- ⚠️ \`${e.path}\` changed since it was created. Left in place. To remove it anyway, run undo again with --force (it is moved to .playbook/undone/, not deleted), or move it out by hand.`);
        kept++;
      } else {
        if (now !== e.after) out.push(`- ⚠️ \`${e.path}\` changed since it was created: --force moves it aside with your changes`);
        out.push(`- ↩️ move \`${e.path}\` aside to \`.playbook/undone/${ts}/\``);
        if (!dry) {
          mkdirSync(dirname(join(root, ".playbook/undone", ts, e.path)), { recursive: true });
          renameSync(abs, join(root, ".playbook/undone", ts, e.path));
        }
        acted++;
      }
    } else if (now !== e.after && !force) {
      out.push(`- ⚠️ \`${e.path}\` changed since the edit. Left as it is. Backup: \`${e.backup}\`. To restore it anyway, run undo again with --force (your current version is kept in .playbook/undone/ first), or copy the backup by hand.`);
      kept++;
    } else {
      if (now !== e.after) {
        out.push(`- ⚠️ \`${e.path}\` changed since the edit: --force keeps your current version in \`.playbook/undone/${ts}/changed/\` first`);
        if (now !== null) keepAside(e.path);
      }
      out.push(`- ↩️ restore \`${e.path}\` from \`${e.backup}\``);
      if (!dry) copyFileSync(join(root, e.backup), abs);
      acted++;
    }
  }
  if (!dry) {
    for (const d of rc.dirs ?? []) {
      try {
        rmdirSync(join(root, d)); // only succeeds when the folder is empty
      } catch {
        /* not empty, or already gone: leave it */
      }
    }
    // A receipt is done only when nothing was left behind; otherwise `undo --force` can still finish it.
    if (!kept) writeFileSync(join(dir, `${pick}.undone`), `${new Date().toISOString()}\n`);
  }
  out.push("", dry ? `${acted} change(s) would be undone.${kept ? ` ${kept} left in place because they changed since (see above).` : ""}` : `✅ Undid ${acted} change(s). Created files were moved aside to .playbook/undone/, edited files were restored from their backups. Nothing was deleted.${kept ? ` ${kept} left in place because they changed since.` : ""}`);
  return { ok: true, text: out.join("\n") };
}
