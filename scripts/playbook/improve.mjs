// Managed by repo-fit: change it there and run `repo-fit update`, not here.
// Improve (opt-in: `repo-fit prefs set improve on`). repo-fit learns from what repeats, never from reading chats:
//  - a correction the assistant notices is remembered (here, in .playbook/, not in Git) and proposed once it comes
//    back; a yes adds one line to "Your preferences" in the rulebook, never anywhere else;
//  - filing the same kind of item to the same folder by hand twice proposes a standing rule (from repo-fit's records);
//  - a correction that repeats an approved preference means the written rule is not working: make it a check instead.
// Nothing is written without a yes, and a no is remembered.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, posix } from "node:path";
import { root, today } from "./lib.mjs";
import { kindOf } from "./map.mjs";
import { RULES_ABOUT, readRules } from "./file.mjs";

const STORE = ".playbook/improve.json";
const MARK = /<!-- repo-fit:preferences begin -->[\s\S]*?<!-- repo-fit:preferences end -->/;
const SECRET = /(sk-|ghp_|xox[bp]-|AKIA)[\w-]{8,}|\b[A-Za-z0-9+/_-]{32,}\b|(password|passwd|api[_ -]?key|token|secret)\s*[:=]/i;
const NOUN = { note: "notes", image: "images", media: "media files", document: "documents", data: "data files" };
const norm = (s) => s.toLowerCase().replace(/\s+/g, " ").replace(/^[\s.,;:!-]+|[\s.,;:!-]+$/g, "");

export function improveOn() {
  if (process.env.REPO_FIT_IMPROVE) return process.env.REPO_FIT_IMPROVE === "on";
  const dir = process.env.REPO_FIT_CONFIG ?? join(process.env.HOME ?? process.env.USERPROFILE ?? "", ".config/repo-fit");
  try {
    return JSON.parse(readFileSync(join(dir, "preferences.json"), "utf8")).improve === "on";
  } catch {
    return false;
  }
}

const load = () => {
  try {
    return JSON.parse(readFileSync(join(root, STORE), "utf8"));
  } catch {
    return { candidates: [] };
  }
};
const save = (s) => {
  mkdirSync(join(root, ".playbook"), { recursive: true });
  writeFileSync(join(root, STORE), `${JSON.stringify(s, null, 2)}\n`);
};
const rulebook = () => ["AGENTS.md", "CLAUDE.md"].find((f) => existsSync(join(root, f))) ?? "AGENTS.md";
const preferences = () => {
  const t = existsSync(join(root, rulebook())) ? readFileSync(join(root, rulebook()), "utf8") : "";
  return (t.match(MARK)?.[0] ?? "").split("\n").filter((l) => l.startsWith("- ")).map((l) => l.slice(2));
};

// Files the person filed to the same folder by hand (their answer, not a rule), by kind, from repo-fit's records.
function handFiled() {
  const dir = join(root, ".playbook/receipts");
  const count = new Map();
  for (const n of existsSync(dir) ? readdirSync(dir).filter((x) => x.endsWith(".json") && !existsSync(join(dir, `${x}.undone`))) : []) {
    try {
      for (const e of JSON.parse(readFileSync(join(dir, n), "utf8")).entries ?? []) {
        if (e.type !== "move" || e.why !== "your answer") continue;
        const key = `${kindOf(posix.basename(e.to))}\t${posix.dirname(e.to)}`;
        count.set(key, (count.get(key) ?? 0) + 1);
      }
    } catch {
      /* not a record repo-fit can read */
    }
  }
  return count;
}

// Open proposals: corrections seen 2 or more times, and hand-filing seen 2 or more times with no rule yet.
export function proposals() {
  if (!improveOn()) return [];
  const s = load();
  const out = s.candidates.filter((c) => c.status === "open" && c.count >= 2).map((c) => ({ id: c.id, text: `"${c.text}" (it came up ${c.count} times)`, line: c.text }));
  const rules = readRules(root)?.rules ?? [];
  for (const [key, n] of handFiled()) {
    const [kind, to] = key.split("\t");
    const id = `rule-${kind}-${to.replace(/[^\w-]+/g, "_")}`;
    if (n < 2 || rules.some((r) => r.kind === kind && !r.starts) || s.candidates.some((c) => c.id === id)) continue;
    out.push({ id, text: `new ${NOUN[kind] ?? kind} in inbox/ go to ${to}/ (you did this by hand ${n} times)`, rule: { kind, to } });
  }
  return out;
}

const ask = (id) => `Ask the person once, yes or no. Yes: \`node scripts/playbook/check.mjs --accept ${id}\`. No: \`node scripts/playbook/check.mjs --reject ${id}\`.`;

// The assistant noticed a correction about how to work in this folder: remember it, propose it once it comes back.
export function remember(text) {
  if (!improveOn()) return "Improve is off, so nothing was remembered. The person can turn it on with: repo-fit prefs set improve on";
  const line = text.trim();
  if (line.includes("\n") || line.length > 160) return "⚠️ Not remembered: too long for a rule. A rule is one short line (160 characters at most).";
  if (line.length < 8) return "⚠️ Not remembered: too short to be a rule.";
  if (SECRET.test(line)) return "⚠️ Not remembered: it looks like a secret (a key, token or password). Never put those in a rule.";
  if (preferences().some((p) => norm(p) === norm(line))) return `⚠️ This is already in your preferences ("${line}"), and it came up again, so the written rule is not working. Propose a check or a script that enforces it instead.`;
  const s = load();
  let c = s.candidates.find((x) => norm(x.text) === norm(line));
  if (c?.status === "rejected") return "The person said no to this before, so it is not proposed again.";
  if (!c) s.candidates.push((c = { id: `pref-${s.candidates.length + 1}`, text: line, count: 0, status: "open", first: today() }));
  c.count++;
  c.last = today();
  save(s);
  return c.count >= 2 ? `🆕 Propose this rule, seen ${c.count} times: "${line}". It goes in "Your preferences" in ${rulebook()}. ${ask(c.id)}` : `Remembered (seen 1 time). It is proposed once it comes back.`;
}

export function decide(id, yes) {
  const p = proposals().find((x) => x.id === id);
  const s = load();
  const c = s.candidates.find((x) => x.id === id);
  if (!p && !c) return { ok: false, text: `❌ No proposal ${id}.` };
  if (!yes) {
    if (c) c.status = "rejected";
    else s.candidates.push({ id, text: p.text, count: 0, status: "rejected", rule: p.rule });
    save(s);
    return { ok: true, text: "✅ Noted: no. It will not be proposed again." };
  }
  if (p?.rule) {
    // A standing rule for that kind, in inbox/rules.json (the file the inbox filing reads).
    const cur = readRules(root) ?? { about: RULES_ABOUT, rules: [], notNow: {} };
    writeFileSync(join(root, "inbox/rules.json"), `${JSON.stringify({ about: cur.about ?? RULES_ABOUT, rules: [...cur.rules, p.rule], notNow: cur.notNow ?? {} }, null, 2)}\n`);
    s.candidates.push({ id, text: p.text, count: 0, status: "accepted", rule: p.rule });
    save(s);
    return { ok: true, text: `✅ New rule: new ${NOUN[p.rule.kind] ?? p.rule.kind} in inbox/ go to ${p.rule.to}/ when a session starts. To stop it, delete its lines in inbox/rules.json.` };
  }
  // One line in "Your preferences", the rulebook's own block; the old file is kept first.
  const file = rulebook();
  const abs = join(root, file);
  const old = existsSync(abs) ? readFileSync(abs, "utf8") : "";
  if (old) {
    mkdirSync(join(root, ".playbook/backups", today()), { recursive: true });
    copyFileSync(abs, join(root, ".playbook/backups", today(), file));
  }
  const lines = [...preferences(), c.text];
  const block = `<!-- repo-fit:preferences begin -->\n## Your preferences\n\nAdded by repo-fit when you said yes. Delete a line to drop it.\n\n${lines.map((l) => `- ${l}`).join("\n")}\n<!-- repo-fit:preferences end -->`;
  writeFileSync(abs, MARK.test(old) ? old.replace(MARK, () => block) : `${old.trimEnd()}\n\n${block}\n`);
  c.status = "accepted";
  save(s);
  return { ok: true, text: `✅ Added to "Your preferences" in ${file}: "${c.text}". To undo, delete that line (the old file is kept in .playbook/backups/).` };
}

// For the session start: one line per proposal, and what the assistant should do with it.
export function improveLines() {
  const ps = proposals();
  return { lines: ps.map((p) => `🆕 A rule to consider: ${p.text}. Say yes or no to the assistant.`), context: ps.length ? ` For each "🆕 A rule to consider": ${ps.map((p) => `${p.id}: ${ask(p.id)}`).join(" ")}` : "", on: improveOn() };
}
