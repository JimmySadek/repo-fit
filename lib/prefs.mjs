// Your standing choices for the playbook, kept outside any repo: ~/.config/repo-fit/preferences.json
// (set REPO_FIT_CONFIG to use another folder). Nothing is written unless you run `repo-fit prefs set`.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = () => process.env.REPO_FIT_CONFIG ?? join(process.env.HOME ?? "", ".config/repo-fit");
const file = () => join(dir(), "preferences.json");

export function readPrefs() {
  try {
    return existsSync(file()) ? JSON.parse(readFileSync(file(), "utf8")) : {};
  } catch {
    return {};
  }
}
export function setPref(key, value) {
  const p = readPrefs();
  const parts = key.split(".");
  let cur = p;
  for (const k of parts.slice(0, -1)) cur = cur[k] = typeof cur[k] === "object" && cur[k] ? cur[k] : {};
  if (value === null) delete cur[parts.at(-1)];
  else cur[parts.at(-1)] = value;
  mkdirSync(dir(), { recursive: true });
  writeFileSync(file(), `${JSON.stringify(p, null, 2)}\n`);
  return { path: file(), prefs: p };
}
export const prefsPath = file;
