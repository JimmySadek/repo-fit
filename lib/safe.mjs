// Safe start: before repo-fit changes anything, the folder is saved in Git as it is now, so the person can always go
// back, with or without repo-fit. Part of the one yes: the screens say it before the question. Never pushes.
//   snapshotPlan(root)   → { state, line } what will happen, in plain words, for the screen (changes nothing)
//   snapshot(root)       → { ok, text } starts Git if needed and commits; ok: false means nothing may change
// States: no-git (Git not installed: say how to add it, then continue with repo-fit's own undo), no-repo (start Git
// here), no-name (Git needs the person's name and email: stop), dirty (save a snapshot), clean (already saved).
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { SAFE_SECRET, SECRET } from "./audit.mjs";

const MESSAGE = "repo-fit: snapshot before changes";
const HUGE = 50 * 1024 * 1024; // left out of the snapshot: hosts refuse files near 100 MB, and Git slows down with them
const run = (root, args, { input, env } = {}) => {
  const r = spawnSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, input, env: env ? { ...process.env, ...env } : undefined });
  return { ok: !r.error && r.status === 0, out: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim(), missing: r.error?.code === "ENOENT", stdout: r.stdout ?? "" };
};

const INSTALL = {
  darwin: "On a Mac, open Terminal and run `xcode-select --install`.",
  win32: "On Windows, run `winget install --id Git.Git -e` in a terminal, or get it from git-scm.com.",
};
const installHelp = () => INSTALL[process.platform] ?? "On Linux, install the `git` package with your system's package manager (for example `sudo apt install git`).";

// Its own rules say "commit only when asked": the yes to the screen is that ask, and the screen says so.
function onlyWhenAsked(root) {
  return ["AGENTS.md", "CLAUDE.md"].some((f) => existsSync(join(root, f)) && /commit (only )?when (asked|told)|only commit when asked|never commit unless/i.test(readFileSync(join(root, f), "utf8")));
}

// Paths repo-fit itself changed after the last commit (its receipts not undone), so a run snapshots only once.
function ownChanges(root) {
  const since = run(root, ["log", "-1", "--format=%cI"]).stdout.trim();
  const dir = join(root, ".playbook/receipts");
  const out = new Set();
  if (!since || !existsSync(dir)) return out;
  for (const n of readdirSync(dir).filter((x) => x.endsWith(".json") && !existsSync(join(dir, `${x}.undone`)))) {
    try {
      const rc = JSON.parse(readFileSync(join(dir, n), "utf8"));
      if (!(new Date(rc.date) >= new Date(since))) continue;
      for (const e of rc.entries ?? []) for (const p of [e.path, e.from, e.to]) if (p) out.add(p);
    } catch {
      /* not a receipt repo-fit can read: ignore it */
    }
  }
  return out;
}

// What would go in the snapshot: every unsaved change of the person's, except secret-like files and huge files
// (named instead), and except what repo-fit itself changed since the last commit.
function pending(root) {
  const st = run(root, ["status", "--porcelain", "-z", "--untracked-files=all"]);
  const own = ownChanges(root);
  const entries = st.stdout.split("\0").filter(Boolean).filter((e) => /^.. /.test(e)).map((e) => ({ code: e.slice(0, 2), path: e.slice(3) })).filter((e) => !own.has(e.path));
  const left = entries.filter((e) => e.code === "??" && ((SECRET.test(e.path) && !SAFE_SECRET.test(e.path)) || (existsSync(join(root, e.path)) && statSync(join(root, e.path)).size > HUGE))).map((e) => e.path);
  return { changes: entries.filter((e) => !left.includes(e.path)).map((e) => e.path), left };
}

export function snapshotPlan(root) {
  const v = run(root, ["--version"]);
  if (v.missing || !v.ok) return { state: "no-git", line: `⚠️ Git is not installed, so repo-fit cannot save a snapshot of your folder first. It is highly recommended: Git keeps a saved copy you can always go back to. ${installHelp()} repo-fit's own undo still takes back everything it changes.` };
  const asked = onlyWhenAsked(root) ? " Your rules say to commit only when asked: your yes is that ask." : "";
  const name = run(root, ["config", "user.name"]).ok || process.env.GIT_AUTHOR_NAME;
  const email = run(root, ["config", "user.email"]).ok || process.env.GIT_AUTHOR_EMAIL;
  if (!name || !email) return { state: "no-name", line: "⚠️ Git does not know your name and email yet, so it cannot save a snapshot of your folder first, and repo-fit will not change anything without one. Run these two lines once (with your own name and email), then ask again:\n\n```bash\ngit config --global user.name \"Your Name\"\n```\n\n```bash\ngit config --global user.email \"you@example.com\"\n```" };
  const inside = run(root, ["rev-parse", "--show-toplevel"]);
  if (!inside.ok) return { state: "no-repo", line: `🛟 Safety first: this folder is not saved in Git yet. repo-fit starts Git here and saves a snapshot of everything as it is now, so you can always go back. Nothing is uploaded.${asked}` };
  const p = pending(root);
  const left = p.left.length ? ` Left out of the snapshot (secrets or very big files): ${p.left.slice(0, 5).join(", ")}${p.left.length > 5 ? ", …" : ""}.` : "";
  if (!p.changes.length) {
    const last = run(root, ["log", "-1", "--format=%s (%cs)"]);
    return { state: "clean", line: `🛟 Safety first: everything is already saved in Git${last.ok && last.out ? ` (last save: ${last.out})` : ""}, so you can always go back to it.${left}` };
  }
  return { state: "dirty", line: `🛟 Safety first: repo-fit saves a snapshot of your ${p.changes.length} unsaved file${p.changes.length === 1 ? "" : "s"} in Git before it changes anything, so you can always go back. Nothing is uploaded.${asked}${left}` };
}

export function snapshot(root) {
  const plan = snapshotPlan(root);
  if (plan.state === "no-git") return { ok: true, text: "⚠️ Git is not installed, so no snapshot was saved. repo-fit's own undo takes back what it changes." };
  if (plan.state === "no-name") return { ok: false, text: `❌ Nothing was changed. ${plan.line.replace(/^⚠️ /, "")}` };
  if (plan.state === "clean") return { ok: true, text: "🛟 Everything was already saved in Git, so no new snapshot was needed." };
  if (plan.state === "no-repo") {
    const init = run(root, ["init", "-q", "-b", "main"]);
    if (!init.ok) return { ok: false, text: `❌ Nothing was changed. Git could not start in this folder: ${init.out}` };
  }
  const p = pending(root);
  // The list goes through stdin, so any number of files fits; names are taken literally, never as patterns.
  const add = run(root, ["add", "-A", "--pathspec-from-file=-", "--pathspec-file-nul"], { input: p.changes.join("\0"), env: { GIT_LITERAL_PATHSPECS: "1" } });
  if (!add.ok) return { ok: false, text: `❌ Nothing was changed. Git did not save the snapshot: ${add.out}` };
  const commit = run(root, ["commit", "-q", "-m", MESSAGE]);
  if (!commit.ok) {
    run(root, ["reset", "-q"]); // unstage again: the person's files and their state stay exactly as they were
    return { ok: false, text: `❌ Nothing was changed. Git did not save the snapshot, and repo-fit does not change a folder it could not save first. Git said: ${commit.out.split("\n").slice(0, 3).join(" ")}\nIf you want to go ahead without a snapshot anyway, run the same command again with --no-snapshot.` };
  }
  return { ok: true, text: `🛟 Saved a snapshot of your folder in Git (${plan.state === "no-repo" ? "Git was started here first, " : ""}"${MESSAGE}"). To go back to it at any time: \`git log\` shows it. Nothing was uploaded.${p.left.length ? ` Left out of the snapshot (secrets or very big files): ${p.left.join(", ")}.` : ""}` };
}
