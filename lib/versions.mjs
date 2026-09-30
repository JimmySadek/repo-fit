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
