// The managed core block for AGENTS.md, written with the repo's own paths.
// `{{#role}}text{{/role}}` keeps the text only when the role has a path, `{{^role}}text{{/role}}` only when it has none,
// and `{{role}}` is the path. So the block never points at a file the repo does not have.
// Used by init, apply (A-11, D-01), status and update. Not vendored into repos.
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { rolePaths } from "./audit.mjs";
import { PATH_DEFAULTS } from "../scripts/playbook/lib.mjs";

const here = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const version = readFileSync(join(here, "VERSION"), "utf8").trim();

export const CORE_ROLES = ["current", "board", "log", "questions", "people", "decisions", "inputs", "template"];
// The Starter kit's paths: what a new repo from `init` has.
const STARTER = { ...PATH_DEFAULTS, template: "docs/templates/note.md" };

// Paths as the block shows them: folders end in "/", a role with no path is null.
export function coreVars(root, paths) {
  const v = {};
  for (const role of CORE_ROLES) {
    const p = typeof paths[role] === "string" && paths[role] ? paths[role].replace(/\/+$/, "") : null;
    const abs = p && root ? join(root, p) : null;
    const folder = role === "inputs" || (abs && existsSync(abs) && statSync(abs).isDirectory());
    v[role] = p ? `${p}${folder ? "/" : ""}` : null;
  }
  return v;
}

// The block for a repo as it is on disk: playbook.json `paths` first, then the files the audit finds.
export const repoCoreVars = (root) => coreVars(root, rolePaths(root));

export function coreBlock(vars = coreVars(null, STARTER)) {
  let t = readFileSync(join(here, "core/AGENTS.core.md"), "utf8").replaceAll("{{version}}", version);
  const section = /\{\{([#^])(\w+)\}\}([\s\S]*?)\{\{\/\2\}\}/g;
  for (let prev = ""; prev !== t; ) {
    prev = t;
    t = t.replace(section, (m, kind, role, body) => (Boolean(vars[role]) === (kind === "#") ? body : ""));
  }
  t = t.replace(/\{\{(\w+)\}\}/g, (m, role) => (vars[role] ? vars[role] : m));
  // A list item left empty is dropped, and the list is numbered again.
  const out = [];
  let n = 0;
  for (const raw of t.split("\n")) {
    const line = raw.trimEnd();
    if (/^\d+\.$/.test(line)) continue;
    const item = line.match(/^\d+\. (.*)$/);
    n = item ? n + 1 : 0;
    out.push(item ? `${n}. ${item[1]}` : line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();
}
