// Deep mode (0.9.0): the proof for code. Runs the repo's own commands (test, typecheck, lint, build, check, found by
// `detect`) in a throwaway copy of the last commit, never in the person's folder.
//   withCopy(root, base, fn)   → a separate working copy (a Git worktree) for the time of fn, then removed
//   addCopy(root, args)        → `git worktree add` without the repo's own hooks and without Git LFS downloads
//   linkPackages(root, wt)     → the folder's installed packages (node_modules, .venv) cloned into the copy (copy-on-write,
//                                so a build that writes there leaves them as they were), or linked where cloning is not
//                                possible; the commands run with no download; says when the proof is limited
//   proofCommands(wt)          → the repo's own test, typecheck, lint, build and check commands; one that installs
//                                packages is named but not run
//   runCommands(wt, cmds)      → each command's result: passed or not, how long, how many tests when it says
//   cleanUpKilled(root)        → removes copies left by a run that was killed, and their branches with no commit
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, unlinkSync } from "node:fs";
import { devNull, tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { commands } from "./detect.mjs";

// GIT_OPTIONAL_LOCKS=0: reading the status never rewrites the folder's index while an editor uses it.
const git = (cwd, args, env = {}) => {
  const r = spawnSync("git", args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", ...env } });
  return { ok: !r.error && r.status === 0, stdout: r.stdout ?? "", out: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim() };
};
export const COPY = /^repo-fit-(deep|proof)-(\d+)-/;
const COMMAND_TIMEOUT = 15 * 60 * 1000;
const PROOF = ["test", "typecheck", "lint", "build", "check"];

// The repo's commands and tools run offline: package managers, Corepack, npx and pip may use what is installed or
// cached, never download. A command that needs a download then fails, and is not used as proof.
export const offline = (env) => ({ ...env, CI: "1", NO_COLOR: "1", FORCE_COLOR: "0", npm_config_offline: "true", npm_config_yes: "false", npm_config_update_notifier: "false", npm_config_manage_package_manager_versions: "false", COREPACK_ENABLE_NETWORK: "0", COREPACK_ENABLE_DOWNLOAD_PROMPT: "0", YARN_ENABLE_NETWORK: "0", PIP_NO_INDEX: "1" });

// A separate working copy without the repo's own hooks (a post-checkout hook may install or download) and without
// Git LFS downloads (large files stay as their small pointer files).
export const addCopy = (root, args) => git(root, ["-c", `core.hooksPath=${devNull}`, "worktree", "add", ...args], { GIT_LFS_SKIP_SMUDGE: "1" });

// A run that was killed (Ctrl-C, a closed terminal) cannot remove its working copy. The next run removes each one whose
// process is gone, and its branch when that has no commit of its own. A run that is still going is left alone.
export function cleanUpKilled(root) {
  for (const b of git(root, ["worktree", "list", "--porcelain"]).stdout.split("\n\n")) {
    const path = b.match(/^worktree (.+)$/m)?.[1];
    const m = basename(path ?? "").match(COPY);
    const branch = b.match(/^branch refs\/heads\/(repo-fit\/deep-.+)$/m)?.[1];
    if (!path || !m || (m[1] === "deep" && !branch)) continue;
    try {
      process.kill(Number(m[2]), 0);
      continue; // still running
    } catch (e) {
      if (e.code === "EPERM") continue;
    }
    unlinkPackages(path);
    git(root, ["worktree", "remove", "--force", path]);
    rmSync(path, { recursive: true, force: true });
    if (branch && git(root, ["merge-base", "--is-ancestor", branch, "HEAD"]).ok) git(root, ["branch", "-D", branch]);
  }
  // Never `git worktree prune`: it would also forget the person's own worktrees whose folder is away (an unplugged
  // drive). `worktree remove --force` forgets repo-fit's own copy, even when its folder is gone.
}

// A separate working copy of `base` for the time of fn. No branch: it only reads and runs the proof.
export function withCopy(root, base, fn) {
  cleanUpKilled(root);
  const wt = mkdtempSync(join(tmpdir(), `repo-fit-proof-${process.pid}-`));
  const add = addCopy(root, ["-q", "--detach", wt, base]);
  if (!add.ok) {
    rmSync(wt, { recursive: true, force: true });
    return { error: `Git could not make the separate working copy: ${add.out.split("\n")[0]}` };
  }
  try {
    return fn(wt);
  } finally {
    unlinkPackages(wt);
    git(root, ["worktree", "remove", "--force", wt]);
    rmSync(wt, { recursive: true, force: true });
  }
}

const isLink = (p) => {
  try {
    return lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
};
// Where installed packages live: node_modules at the top and next to each package.json, and a Python .venv or venv.
const packagePlaces = (wt) => ["node_modules", ".venv", "venv", ...git(wt, ["ls-files", "-z", "*package.json"]).stdout.split("\0").filter((f) => f.endsWith("/package.json") && f.split("/").length <= 4).map((f) => `${dirname(f)}/node_modules`)];

// Removes the links to the folder's packages as links, so removing the copy never reaches into the folder.
export function unlinkPackages(wt) {
  for (const rel of packagePlaces(wt)) if (isLink(join(wt, rel))) unlinkSync(join(wt, rel));
}

// A copy-on-write clone (APFS on macOS, Btrfs or XFS on Linux): quick, takes no extra space, and a write in the clone
// never reaches the original. Only on the same disk; macOS `cp -c` would quietly make a full copy across disks, and
// Linux `--reflink=always` fails where it cannot clone. REPO_FIT_CLONE=off turns it off (for tests).
// A place that is itself a link (a shared store) is linked as it is: `cp -R` would copy only the link.
const canClone = (from, wt) => process.env.REPO_FIT_CLONE !== "off" && ["darwin", "linux"].includes(process.platform) && !isLink(from) && statSync(from).dev === statSync(wt).dev;
function clone(from, to) {
  const r = spawnSync("cp", process.platform === "darwin" ? ["-c", "-R", from, to] : ["-R", "--reflink=always", from, to], { stdio: "ignore", timeout: COMMAND_TIMEOUT });
  if (!r.error && r.status === 0) return true;
  rmSync(to, { recursive: true, force: true }); // a part-made clone, inside the copy
  return false;
}

// The folder's installed packages, cloned into the copy, or linked where cloning is not possible (the screen says so,
// since a command that writes there then writes into the folder's packages). Never a download: when package.json lists
// packages and none are installed, the proof is limited, and the screen says so.
export function linkPackages(root, wt) {
  const linked = []; // every place put into the copy, cloned or linked; never committed
  let notCloned = false;
  for (const rel of packagePlaces(wt)) {
    const from = join(root, rel);
    const to = join(wt, rel);
    if (!existsSync(from) || existsSync(to) || isLink(to) || !existsSync(dirname(to))) continue;
    if (!(canClone(from, wt) && clone(from, to))) {
      symlinkSync(from, to, process.platform === "win32" ? "junction" : "dir");
      notCloned = true;
    }
    linked.push(rel);
  }
  let pkg = null;
  try {
    pkg = JSON.parse(readFileSync(join(wt, "package.json"), "utf8"));
  } catch {}
  const wants = pkg && Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).length > 0;
  const limited = wants && !linked.includes("node_modules") ? "this folder's packages are not installed (no node_modules/), and repo-fit never downloads them" : null;
  return { linked, limited, notCloned };
}

// A command that installs or downloads packages. The folder's packages are linked into the copy, so an install would
// change them; it is named on the screen and not run.
const INSTALLS = /\b(npm|pnpm|yarn|bun)\s+(i|install|ci|add|update|upgrade|dlx)\b|\b(npx|bunx|pnpx)\b|\bpip3?\s+install\b|\bpoetry\s+(install|add|update)\b|\buv\s+(sync|add|pip\s+install)\b|\bcorepack\s+(enable|prepare|install|use)\b|\bbundle\s+install\b/;
// What a command runs: a package script with its pre and post scripts and the scripts it runs in turn, or a Makefile
// target with its prerequisites.
function chain(wt, c) {
  const seen = new Set();
  const out = [];
  if (c.from === "package.json") {
    let scripts = {};
    try {
      scripts = JSON.parse(readFileSync(join(wt, "package.json"), "utf8")).scripts ?? {};
    } catch {}
    const visit = (k) => {
      if (seen.has(k)) return;
      seen.add(k);
      for (const n of [`pre${k}`, k, `post${k}`]) {
        if (!scripts[n]) continue;
        out.push(scripts[n]);
        for (const m of String(scripts[n]).matchAll(/\b(?:npm|pnpm|bun)\s+(?:run(?:-script)?\s+)?([\w:.-]+)|\byarn\s+(?:run\s+)?([\w:.-]+)/g)) visit(m[1] ?? m[2]);
      }
    };
    visit(c.name);
  } else if (c.from === "Makefile") {
    let make = "";
    try {
      make = readFileSync(join(wt, "Makefile"), "utf8");
    } catch {}
    const visit = (t) => {
      if (seen.has(t)) return;
      seen.add(t);
      const m = make.match(new RegExp(`^${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:([^\n=]*)\n((?:\t.*\n?)*)`, "m"));
      if (!m) return;
      out.push(m[2]);
      for (const d of m[1].trim().split(/\s+/).filter(Boolean)) visit(d);
    };
    visit(c.name);
  }
  return out.join("\n");
}

// The repo's own commands that can prove a step, in this order: test, typecheck, lint, build, check.
export function proofCommands(wt) {
  const all = commands(wt);
  return PROOF.flatMap((n) => all.filter((c) => c.name === n)).map((c) => (INSTALLS.test(chain(wt, c)) ? { ...c, skip: "it installs packages, and repo-fit never downloads" } : c));
}

// How many tests a runner says passed: node --test (spec and TAP), Jest, Vitest, Mocha, pytest.
function testCount(out) {
  const m = out.match(/^[ℹ#] pass (\d+)/m) ?? out.match(/Tests:\s+(\d+) passed/) ?? out.match(/Tests\s+(\d+) passed/) ?? out.match(/(\d+) passing\b/) ?? out.match(/=+ (\d+) passed/);
  return m ? Number(m[1]) : null;
}

// Runs one command in its own process group and, when it is done or takes too long, stops everything it started (a
// test runner's workers, a server a test left running). Exit code 124 means it took too long.
const RUNNER = `const { spawn } = require("node:child_process");
const [cmd, ms] = process.argv.slice(1);
const c = spawn(cmd, { shell: true, detached: true, stdio: "inherit" });
const stop = () => { try { process.kill(-c.pid, "SIGKILL"); } catch {} };
let late = false;
const t = setTimeout(() => { late = true; stop(); }, Number(ms));
c.on("exit", (code) => { clearTimeout(t); stop(); process.exit(late ? 124 : code ?? 1); });
c.on("error", () => process.exit(1));`;

// The repo's commands run as they would in its own CI, offline: no colours, and nothing inherited from a test runner
// that started repo-fit (NODE_TEST_CONTEXT makes an inner node --test report to the outer one instead of printing).
export function runCommands(wt, cmds, { timeout = COMMAND_TIMEOUT } = {}) {
  const { NODE_TEST_CONTEXT, ...env } = process.env;
  return cmds.map((c) => {
    if (c.skip) return { name: c.name, run: c.run, ok: false, skipped: c.skip, ms: 0, tests: null, tail: "", timedOut: false };
    const t = Date.now();
    const opts = { cwd: wt, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, env: offline(env), killSignal: "SIGKILL" };
    const r = process.platform === "win32" ? spawnSync(c.run, { ...opts, shell: true, timeout }) : spawnSync(process.execPath, ["-e", RUNNER, c.run, String(timeout)], { ...opts, timeout: timeout + 30000 });
    const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
    const timedOut = r.error?.code === "ETIMEDOUT" || (process.platform !== "win32" && r.status === 124);
    return { name: c.name, run: c.run, ok: !r.error && r.status === 0, ms: Date.now() - t, tests: testCount(out), tail: out.trim().split("\n").slice(-15).join("\n"), timedOut };
  });
}

export const hasPlaywright = (wt) => existsSync(join(wt, "node_modules", ".bin", "playwright"));
