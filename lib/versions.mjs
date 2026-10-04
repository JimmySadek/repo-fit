// Version helpers shared by detect and tools. Read-only.
import { closeSync, existsSync, openSync, readFileSync, readSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const parse = (s) => {
  const m = (s ?? "").match(/(\d+)\.(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};
// true, false, or null when a version cannot be read
export function atLeast(have, need) {
  const a = parse(have);
  const b = parse(need);
  if (!a || !b) return null;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return true;
}

export function gates(tool) {
  try {
    return JSON.parse(readFileSync(join(here, "guidance/gates.json"), "utf8")).gates.filter((g) => g.tool === tool);
  } catch {
    return [];
  }
}

// The Claude Code version that actually ran in this repo, read from the end of the newest session logs
// (the desktop app can bundle a different version than the `claude` command in a terminal).
export function claudeSessionVersion(root) {
  const home = process.env.HOME ?? "";
  for (const key of new Set([root.replace(/[^A-Za-z0-9]/g, "-"), root.replace(/[^A-Za-z0-9_]/g, "-")])) {
    const dir = join(home, ".claude/projects", key);
    if (!existsSync(dir)) continue;
    const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl")).map((f) => ({ f, t: statSync(join(dir, f)).mtimeMs })).sort((a, b) => b.t - a.t).slice(0, 3);
    for (const { f } of files) {
      const fd = openSync(join(dir, f), "r");
      try {
        const size = statSync(join(dir, f)).size;
        const len = Math.min(size, 262144);
        const buf = Buffer.alloc(len);
        readSync(fd, buf, 0, len, size - len);
        const all = [...buf.toString("utf8").matchAll(/"version":"(\d+\.\d+\.\d+)"/g)];
        if (all.length) return all[all.length - 1][1];
      } finally {
        closeSync(fd);
      }
    }
  }
  return null;
}

// What changed for a repo that already uses repo-fit, in plain words, by release. `status` and `update` show the news
// since the version a repo has, and a skipped step that changed since then as "worth a second look".
export const RELEASES = [
  {
    version: "0.6.0",
    news: [
      "The shared rules in AGENTS.md shrink from 774 to 293 words. They go after your own rules and say yours win where they overlap. No more rules about branches, when to commit, or board columns.",
      "The briefing no longer says \"never commit on main\". Without a board, it shows your last three commits instead of an error.",
      "A long list of unlinked notes in the briefing becomes a count, with one command that lists them.",
    ],
    steps: {
      "D-01": "The shared rules block is now 293 words, goes after your rules, and your rules win where they overlap. It no longer needs a table board or sets branch and commit rules.",
    },
  },
];
export function since(have) {
  const news = [];
  const steps = {};
  for (const r of RELEASES) {
    if (atLeast(have, r.version) !== false) continue; // the repo already has this release
    news.push(...r.news.map((n) => ({ version: r.version, text: n })));
    for (const [id, what] of Object.entries(r.steps ?? {})) steps[id] = what;
  }
  return { news, steps };
}
