// Managed by repo-fit: change it there and run `repo-fit update`, not here.
// Files new things in inbox/ by the standing rules the person approved (inbox/rules.json). A lookup, never a guess:
// an item that matches no rule waits, and the briefing asks once (Yes / Yes, and always / Not now). An exact copy of
// something already in the folder is named, not filed. Moves go through the safe move engine: receipt, undo, links.
//   node scripts/playbook/file.mjs            what would be filed (nothing moves)
//   node scripts/playbook/file.mjs --apply    file it now (the briefing does this at session start)
import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, join, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { applyMoves, files, planMoves } from "./move.mjs";
import { kindOf, nameWords, pages } from "./map.mjs";

const RULES = "inbox/rules.json";
const sha = (abs) => createHash("sha256").update(readFileSync(abs)).digest("hex");

export function readRules(root) {
  try {
    const j = JSON.parse(readFileSync(join(root, RULES), "utf8"));
    return { ...j, rules: Array.isArray(j.rules) ? j.rules : [], notNow: j.notNow ?? {} };
  } catch {
    return null;
  }
}

// The rule for one file: one whose name start matches first, then one for its whole kind.
export function ruleFor(rules, path) {
  const kind = kindOf(posix.basename(path));
  const w = nameWords(posix.basename(path));
  const starts = rules.filter((r) => r.kind === kind && r.starts && w.slice(0, r.starts.split("-").length).join("-") === r.starts);
  return starts.sort((a, b) => b.starts.length - a.starts.length)[0] ?? rules.find((r) => r.kind === kind && !r.starts) ?? null;
}

// What is in the inbox: each item with its kind, its rule (if any) and the file it copies exactly (if any).
export function inboxState(root) {
  const cfg = readRules(root) ?? { rules: [], notNow: {} };
  const all = files(root);
  const items = all.filter((p) => p.startsWith("inbox/") && p !== RULES && !posix.basename(p).startsWith("."));
  const others = all.filter((p) => !p.startsWith("inbox/") && !p.startsWith("archive/"));
  const bySize = new Map();
  for (const p of others) {
    try {
      const n = statSync(join(root, p)).size;
      if (n) bySize.set(n, [...(bySize.get(n) ?? []), p]);
    } catch {
      /* gone meanwhile */
    }
  }
  const out = items.map((path) => {
    const size = statSync(join(root, path)).size;
    const h = size ? sha(join(root, path)) : null;
    const dupOf = h ? (bySize.get(size) ?? []).find((p) => sha(join(root, p)) === h) ?? null : null;
    return { path, kind: kindOf(posix.basename(path)), rule: dupOf ? null : ruleFor(cfg.rules, path), dupOf };
  });
  return { cfg, items: out };
}

export function capture(root, { apply = false, protect } = {}) {
  if (!existsSync(join(root, "inbox"))) return { lines: [], filed: [] };
  if (!protect) {
    try {
      protect = JSON.parse(readFileSync(join(root, "playbook.json"), "utf8")).protectedPaths ?? [];
    } catch {
      protect = [];
    }
  }
  const { cfg, items } = inboxState(root);
  const lines = [];
  let filed = [];
  const matched = items.filter((i) => i.rule);
  if (apply && matched.length) {
    const plan = planMoves(root, matched.map((i) => ({ from: i.path, to: `${i.rule.to}/${posix.basename(i.path)}`, why: "your standing rule" })), { protect });
    const r = plan.moves.length ? applyMoves(root, plan, { step: "file", writes: (x) => pages(x, { protect }) }) : { ok: true };
    if (r.ok) filed = plan.moves;
    if (filed.length) {
      const where = [...new Set(filed.map((m) => `${posix.dirname(m.to)}/`))];
      lines.push(`📥 Filed by your rules: ${filed.length} → ${where.slice(0, 3).join(", ")}${where.length > 3 ? ", …" : ""}. Undo: repo-fit undo <folder> --apply`);
    }
    if (!r.ok) lines.push(`⚠️ Filing the inbox did not go as planned, so nothing moved: ${r.text.split("\n").pop()}`);
  }
  const done = new Set(filed.map((m) => m.from));
  const left = items.filter((i) => !done.has(i.path));
  for (const d of left.filter((i) => i.dupOf).slice(0, 3)) lines.push(`📥 ${d.path} is the same as ${d.dupOf}: keep one, or archive the copy.`);
  // Waiting: no rule (or not filed yet). "Not now" stays quiet until more of that kind arrive than when it was said.
  const waiting = left.filter((i) => !i.dupOf);
  const count = {};
  for (const i of waiting) count[i.kind] = (count[i.kind] ?? 0) + 1;
  const shown = waiting.filter((i) => i.rule || count[i.kind] > (cfg.notNow[i.kind] ?? 0));
  if (shown.length) {
    const rule = shown.filter((i) => i.rule).length;
    const names = shown.slice(0, 3).map((i) => posix.basename(i.path)).join(", ");
    lines.push(`📥 Inbox: ${shown.length} waiting: ${names}${shown.length > 3 ? ", …" : ""}${rule ? `; ${rule} ${rule === 1 ? "matches" : "match"} your rules (filed when a session starts)` : ""}. Ask the assistant to file the rest.`);
  }
  return { lines, filed, waiting: shown };
}

// Run directly (not imported). The real path, because a folder can have two names (macOS: /var and /private/var).
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const { lines } = capture(root, { apply: process.argv.includes("--apply") });
  console.log(lines.length ? lines.join("\n") : "📥 The inbox is empty, or nothing in it matches a rule.");
}
