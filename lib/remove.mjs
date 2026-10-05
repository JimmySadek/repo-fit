// A clean way out: take repo-fit's own parts out of a folder and keep everything of the person's as it is now
// (organized folders included). repo-fit's files are set aside in .playbook/removed/, never deleted; its blocks are
// taken out of the rule files; its session-start lines are taken out of the tool settings. One receipt, so one
// `undo` brings everything back.
//   removePlan(root) → { aside, edits }   read-only
//   removeApply(root, plan) → { ok, text }
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmdirSync, writeFileSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { files } from "../scripts/playbook/move.mjs";

const BLOCKS = [
  /\n*<!-- playbook:core v\S+ begin[^>]*-->[\s\S]*?<!-- playbook:core end -->\n*/,
  /\n*<!-- playbook:commands begin[^>]*-->[\s\S]*?<!-- playbook:commands end -->\n*/,
  /\n*<!-- repo-fit:pointer begin -->[\s\S]*?<!-- repo-fit:pointer end -->\n*/,
];
const PAGE = /<!-- repo-fit:(map|index) begin[^>]*-->[\s\S]*?<!-- repo-fit:\1 end -->/;
const sha = (abs) => createHash("sha256").update(readFileSync(abs)).digest("hex");
const shaText = (s) => createHash("sha256").update(s).digest("hex");

export function removePlan(root) {
  const list = files(root);
  const aside = [];
  const edits = [];
  for (const p of list) {
    if (p.startsWith("scripts/playbook/") || p === "playbook.json" || p === "inbox/rules.json") aside.push(p);
    else if (p === "MAP.md" || /(^|\/)INDEX\.md$/.test(p)) {
      // repo-fit's own pages: set aside whole when nothing of the person's is around the list, else only the list goes.
      const t = readFileSync(join(root, p), "utf8");
      if (!PAGE.test(t)) continue;
      const rest = t.replace(PAGE, "").replace(/^# .*$/m, "").trim();
      if (!rest) aside.push(p);
      else edits.push({ path: p, old: t, content: `${t.replace(PAGE, "").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`, what: "repo-fit's list taken out; your own text stays" });
    }
  }
  for (const p of ["AGENTS.md", "CLAUDE.md"].filter((f) => list.includes(f))) {
    const t = readFileSync(join(root, p), "utf8");
    let next = t;
    for (const re of BLOCKS) next = next.replace(re, "\n\n");
    next = `${next.replace(/\n{3,}/g, "\n\n").trim()}\n`;
    if (next !== t) edits.push({ path: p, old: t, content: next, what: "repo-fit's parts taken out; your own text stays" });
  }
  for (const p of [".claude/settings.json", ".codex/hooks.json"].filter((f) => existsSync(join(root, f)))) {
    const t = readFileSync(join(root, p), "utf8");
    let j;
    try {
      j = JSON.parse(t);
    } catch {
      continue;
    }
    const hooks = j.hooks ?? {};
    for (const ev of Object.keys(hooks)) {
      hooks[ev] = (hooks[ev] ?? []).map((g) => ({ ...g, hooks: (g.hooks ?? []).filter((h) => !String(h.command ?? "").includes("scripts/playbook/")) })).filter((g) => g.hooks.length);
      if (!hooks[ev].length) delete hooks[ev];
    }
    if (!Object.keys(hooks).length) delete j.hooks;
    const next = `${JSON.stringify(j, null, 2)}\n`;
    if (next !== t) edits.push({ path: p, old: t, content: next, what: "the session-start briefing taken out" });
  }
  return { aside, edits };
}

const group = (paths) => {
  const scripts = paths.filter((p) => p.startsWith("scripts/playbook/"));
  const pages = paths.filter((p) => p === "MAP.md" || /(^|\/)INDEX\.md$/.test(p));
  const out = [];
  if (scripts.length) out.push(`- scripts/playbook/ (${scripts.length} files, repo-fit's scripts) → set aside in .playbook/removed/`);
  if (paths.includes("playbook.json")) out.push("- playbook.json (repo-fit's settings) → set aside");
  if (pages.length) out.push(`- ${pages.slice(0, 3).join(", ")}${pages.length > 3 ? `, and ${pages.length - 3} more` : ""} (repo-fit's map and index pages) → set aside`);
  if (paths.includes("inbox/rules.json")) out.push("- inbox/rules.json (the filing rules) → set aside; inbox/ and what is in it stay");
  return out;
};

export function removeScreen(plan, name, target, safety) {
  if (!plan.aside.length && !plan.edits.length) return `# repo-fit is not in ${name}\n\nNothing to remove.`;
  return [
    `# Remove repo-fit from ${name}`,
    "",
    safety,
    "",
    "**Before → after** (repo-fit's own parts only):",
    ...group(plan.aside),
    ...plan.edits.map((e) => `- ${e.path} → ${e.what}`),
    "",
    "**Your files stay** exactly where they are now, organized folders included. Your preferences in AGENTS.md stay too.",
    "",
    "**Why this is safe:** nothing of yours is touched. What is set aside is kept, not deleted, and one command brings it all back.",
    "",
    `Nothing was changed. Do it: \`repo-fit remove ${target} --apply\`. Undo it later: \`repo-fit undo ${target} --apply\`.`,
  ].join("\n");
}

export function removeApply(root, plan) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const entries = [];
  for (const p of plan.aside) {
    const to = posix.join(".playbook/removed", ts, p);
    const hash = sha(join(root, p));
    mkdirSync(dirname(join(root, to)), { recursive: true });
    renameSync(join(root, p), join(root, to));
    entries.push({ step: "remove", type: "move", from: p, to, hash, why: "repo-fit removed" });
  }
  for (const e of plan.edits) {
    const backup = posix.join(".playbook/backups", ts, e.path);
    mkdirSync(dirname(join(root, backup)), { recursive: true });
    copyFileSync(join(root, e.path), join(root, backup));
    writeFileSync(join(root, e.path), e.content);
    entries.push({ step: "remove", type: "edit", path: e.path, before: shaText(e.old), after: shaText(e.content), backup });
  }
  // Folders the removal emptied (scripts/playbook, scripts): undo makes them again when it moves the files back.
  for (const d of ["scripts/playbook", "scripts"]) {
    try {
      if (existsSync(join(root, d)) && !readdirSync(join(root, d)).length) rmdirSync(join(root, d));
    } catch {
      /* not empty: it stays */
    }
  }
  mkdirSync(join(root, ".playbook/receipts"), { recursive: true });
  const receipt = posix.join(".playbook/receipts", `${ts}.json`);
  writeFileSync(join(root, receipt), `${JSON.stringify({ playbook: "remove", date: new Date().toISOString(), steps: ["remove"], entries, dirs: [] }, null, 2)}\n`);
  return { ok: true, text: `✅ repo-fit's own parts are set aside (${plan.aside.length} files) and taken out of ${plan.edits.length} file(s). Your files stay as they are. To bring it all back: repo-fit undo <folder> --apply. When you are sure, you can delete the hidden .playbook/ folder yourself.` };
}
