// Shared helpers for the tests. No dependencies: only node:test and the standard library.
// Every test runs in its own sandbox: a fake HOME (no global git config, no saved preferences, no Claude session logs),
// so the results do not depend on the machine that runs them.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const CLI = join(ROOT, "bin", "repo-fit.mjs");

export function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), "repo-fit-test-"));
  const home = join(dir, "home");
  mkdirSync(home);
  const env = { ...process.env, HOME: home, USERPROFILE: home, REPO_FIT_CONFIG: join(home, "cfg"), GIT_CONFIG_NOSYSTEM: "1", GIT_TERMINAL_PROMPT: "0", REPO_FIT_UPDATE_CHECK: "off" };
  delete env.REPO_FIT_TODAY;
  return { dir, home, env, cleanup: () => rmSync(dir, { recursive: true, force: true, maxRetries: 5 }) };
}

// Wraps a test body so it gets a fresh sandbox and always cleans up.
export const sandboxed = (fn) => async (t) => {
  const sb = sandbox();
  try {
    await fn(sb, t);
  } finally {
    sb.cleanup();
  }
};

export const git = (sb, cwd, args, env = {}) => spawnSync("git", args, { cwd, env: { ...sb.env, ...env }, encoding: "utf8" });

// A small Git repo with its own identity. `files` maps a relative path to its content.
export function repo(sb, name, { branch = "main", files = {}, commit = false } = {}) {
  const d = join(sb.dir, name);
  mkdirSync(d, { recursive: true });
  git(sb, d, ["init", "-q", "-b", branch]);
  git(sb, d, ["config", "user.name", "Test Person"]);
  git(sb, d, ["config", "user.email", "test@example.com"]);
  write(d, "README.md", `# ${name}\n`);
  for (const [p, c] of Object.entries(files)) write(d, p, c);
  if (commit) {
    git(sb, d, ["add", "-A"]);
    git(sb, d, ["commit", "-q", "-m", "initial"]);
  }
  return d;
}

export function write(root, rel, content) {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
}
export const read = (root, rel) => readFileSync(join(root, rel), "utf8");
export const has = (root, rel) => existsSync(join(root, rel));
export const json = (root, rel) => JSON.parse(read(root, rel));

// Runs the command line tool. Returns { status, stdout, stderr, out } where out is stdout + stderr.
export function cli(sb, args, { cwd = ROOT, env = {}, input } = {}) {
  const r = spawnSync(process.execPath, [CLI, ...args], { cwd, env: { ...sb.env, ...env }, encoding: "utf8", input });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, out: `${r.stdout}${r.stderr}` };
}

// Runs a vendored script (brief, check, autosave) inside a repo.
export function script(sb, repoDir, name, args = [], { input } = {}) {
  const r = spawnSync(process.execPath, [join(repoDir, "scripts", "playbook", name), ...args], { cwd: repoDir, env: sb.env, encoding: "utf8", input });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, out: `${r.stdout}${r.stderr}` };
}

// Every file under a folder, as relative paths with forward slashes (ignores .git).
export function tree(root, rel = "") {
  const out = [];
  for (const e of readdirSync(join(root, rel), { withFileTypes: true })) {
    if (e.name === ".git") continue;
    const p = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...tree(root, p));
    else out.push(p);
  }
  return out.sort();
}
