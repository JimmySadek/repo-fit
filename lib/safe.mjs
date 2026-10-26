// Safe start: before repo-fit changes anything, the folder is saved in Git as it is now, so the person can always go
// back, with or without repo-fit. Part of the one yes: the screens say it before the question. Never pushes.
// The snapshot is a commit kept apart from every branch, under a private ref (refs/repo-fit/snapshots/<time>-<random>):
// it is built in a temporary index, so the person's branch, staged files and files stay exactly as they are, the
// repo's own commit rules are never touched, and a normal `git push` does not send it (the maintainer, 25 Oct 2026).
// Git is never started inside that yes: a folder without Git needs its own separate choice (the maintainer, 21 Oct 2026).
//   snapshotPlan(root)            → { state, line } what will happen, in plain words, for the screen (changes nothing)
//   snapshot(root, { gitInit })   → { ok, text, ref } saves; starts Git only with gitInit; ok: false means nothing may change
//   savedSnapshot()               → the snapshot ref this run saved or reused, for the receipts (null when none)
// States: no-git (Git not installed: say how to add it, then continue with repo-fit's own undo), no-repo (stop until
// the person chooses --git-init or --no-snapshot), no-name (Git needs the person's name and email: stop), dirty (save a
// snapshot), saved (every unsaved file is already in a snapshot on this commit), clean (already saved).
import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, lstatSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, realpathSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SAFE_SECRET, SECRET } from "./audit.mjs";

// Tools' own caches and state: not the person's work, never saved in the snapshot.
const TOOL_CLUTTER = /(^|\/)(\.serena|\.cache|__pycache__|\.pytest_cache|\.mypy_cache|\.ruff_cache|\.DS_Store|node_modules|\.venv|venv)(\/|$)/;
const MESSAGE = "repo-fit: snapshot before changes";
const REFS = "refs/repo-fit/snapshots/";
const HUGE = 50 * 1024 * 1024; // left out of the snapshot: hosts refuse files near 100 MB, and Git slows down with them
const SHOWN = 10; // names on the 🛟 line; the rest is a count
// GIT_OPTIONAL_LOCKS=0: `git status` does not refresh the person's index on the side.
const run = (root, args, { input, env } = {}) => {
  const r = spawnSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, input, env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", ...env } });
  return { ok: !r.error && r.status === 0, out: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim(), missing: r.error?.code === "ENOENT", stdout: r.stdout ?? "" };
};
const q = (s) => (/[\s"']/.test(s) ? `"${s}"` : s);

const INSTALL = {
  darwin: "On a Mac, open Terminal and run `xcode-select --install`.",
  win32: "On Windows, run `winget install --id Git.Git -e` in a terminal, or get it from git-scm.com.",
};
const installHelp = () => INSTALL[process.platform] ?? "On Linux, install the `git` package with your system's package manager (for example `sudo apt install git`).";

const ruleText = (root) => ["AGENTS.md", "CLAUDE.md"].map((f) => (existsSync(join(root, f)) ? readFileSync(join(root, f), "utf8") : "")).join("\n");
// Its own rules about commits ("commit only when asked", "stage by explicit path, never `git add .`"): the snapshot
// keeps them, because it is no commit on a branch and stages nothing. The screen says so.
const COMMIT_RULES = /commit (only )?when (asked|told)|only commit when asked|never commit unless|explicit paths?|never `?git add (\.|-A)`?/i;

// Paths repo-fit itself changed that are still exactly as it left them (its receipts not undone), so a run
// snapshots only once and never saves repo-fit's own changes as "the folder before changes".
function ownChanges(root) {
  const dir = join(root, ".playbook/receipts");
  const out = new Set();
  if (!existsSync(dir)) return out;
  const sum = (p, text) => {
    try {
      const b = readFileSync(join(root, p));
      return createHash("sha256").update(text ? b.toString("utf8") : b).digest("hex");
    } catch {
      return null;
    }
  };
  for (const n of readdirSync(dir).filter((x) => x.endsWith(".json") && !existsSync(join(dir, `${x}.undone`)))) {
    try {
      const rc = JSON.parse(readFileSync(join(dir, n), "utf8"));
      const edited = new Map((rc.entries ?? []).filter((e) => e.type === "edit").map((e) => [e.path, e.after]));
      for (const e of rc.entries ?? []) {
        // Still exactly as repo-fit left it? Then it is repo-fit's change; once the person edits it, it is theirs.
        const at = e.type === "move" ? e.to : e.path;
        const same = e.type === "move" ? sum(at) === e.hash || sum(at, true) === edited.get(at) : sum(at, true) === e.after || e.type === "create" && sum(at, true) === null;
        if (same) for (const p of [e.path, e.from, e.to]) if (p) out.add(p);
      }
    } catch {
      /* not a receipt repo-fit can read */
    }
  }
  return out;
}

// What would go in the snapshot: every unsaved change of the person's, except secret-like files and huge files
// (named instead), and except what repo-fit itself changed since the last commit. A rename brings its old path too,
// so the snapshot does not keep a file at both places.
// A folder inside a bigger repo saves only its own changes, with paths relative to the folder.
function pending(root) {
  const st = run(root, ["status", "--porcelain", "-z", "--untracked-files=all", "--", "."]);
  if (!st.ok) return { error: st.out, changes: [], left: [] };
  const prefix = run(root, ["rev-parse", "--show-prefix"]).stdout.trim();
  const own = ownChanges(root);
  const raw = st.stdout.split("\0");
  const all = [];
  const add = (code, p) => p.startsWith(prefix) && all.push({ code, path: p.slice(prefix.length) });
  for (let i = 0; i < raw.length; i++) {
    if (!/^.. /.test(raw[i])) continue;
    const code = raw[i].slice(0, 2);
    add(code, raw[i].slice(3));
    if (/[RC]/.test(code) && raw[i + 1]) add(code, raw[++i]);
  }
  const entries = all.filter((e) => !own.has(e.path) && !e.path.startsWith(".playbook/") && !TOOL_CLUTTER.test(e.path)); // repo-fit's records are not the person's work
  const stat = (p) => {
    try {
      return lstatSync(join(root, p));
    } catch {
      return null;
    }
  };
  // A Git repo inside the folder (a submodule, or a clone) keeps its own history: it is named, never saved here.
  const nested = entries.filter((e) => e.path.endsWith("/") || stat(e.path)?.isDirectory()).map((e) => e.path);
  const left = entries.filter((e) => e.code === "??" && ((SECRET.test(e.path) && !SAFE_SECRET.test(e.path)) || (stat(e.path)?.size ?? 0) > HUGE)).map((e) => e.path);
  const out = new Set([...nested, ...left]);
  return { changes: [...new Set(entries.filter((e) => !out.has(e.path)).map((e) => e.path))], left: [...left, ...nested.map((p) => `${p.replace(/\/?$/, "/")} (its own Git repo)`)] };
}

// The names for the screen: a folder with several unsaved files is one name with its count.
function names(paths) {
  const by = new Map();
  for (const p of paths) {
    const top = p.includes("/") ? `${p.split("/")[0]}/` : p;
    by.set(top, [...(by.get(top) ?? []), p]);
  }
  const list = [...by].map(([top, l]) => (l.length > 1 ? `\`${top}\` (${l.length} files)` : `\`${l[0]}\``));
  return `${list.slice(0, SHOWN).join(", ")}${list.length > SHOWN ? `, and ${list.length - SHOWN} more` : ""}`;
}

// Untracked folders that look private, or that the repo's own rules say never to commit: named, with the offer to
// keep them out of Git. The snapshot keeps them on this computer only; an ordinary `git add .` would not.
const PRIVATE = /(^|[-_ .])(meetings?|meeting[-_ ]notes|transcripts?|customers?|clients?|private|personal|interviews?|minutes|confidential|1[-_]?on[-_]?1s?|one[-_]on[-_]ones?)([-_ .]|$)/i;
const NEVER = /never (commit|add|push)|do not (commit|add|push)|don't (commit|add|push)|not be committed|must not be committed|keep (it |them )?out of git|private|confidential|\.gitignore/i;
function privateLooking(root, changes) {
  const st = run(root, ["status", "--porcelain", "-z", "--untracked-files=normal"]);
  const rules = ruleText(root).split("\n").filter((l) => NEVER.test(l));
  const out = [];
  for (const e of st.stdout.split("\0")) {
    if (!e.startsWith("?? ") || !e.endsWith("/")) continue;
    const dir = e.slice(3);
    const name = dir.replace(/\/$/, "");
    const ruled = rules.some((l) => l.includes(`${name}/`) || l.includes(`\`${name}\``));
    if (!ruled && !name.split("/").some((s) => PRIVATE.test(s))) continue;
    out.push({ dir, files: changes.filter((p) => p.startsWith(dir)).length, ruled });
  }
  return out;
}

// The newest snapshots taken on this commit (refs are shared by every worktree of the repo, so the parent tells).
function snapshotsOn(root) {
  const head = run(root, ["rev-parse", "-q", "--verify", "HEAD^{commit}"]);
  const parent = head.ok ? head.out : "";
  const r = run(root, ["for-each-ref", "--sort=-refname", "--count=20", "--format=%(objectname) %(parent) %(refname)", REFS]);
  return r.stdout.split("\n").filter(Boolean).map((l) => l.split(" ")).filter(([, p]) => p === parent).map(([sha, , ref]) => ({ sha, ref }));
}

// Is every unsaved file of the person's already in a snapshot on this commit, exactly as it is now? Then that snapshot
// is the way back, and no second one is needed (repo-fit's own changes since are left out, as above). Writes nothing.
function savedIn(root, changes) {
  if (!changes.length) return null;
  const kind = (p) => {
    try {
      const st = lstatSync(join(root, p));
      return st.isSymbolicLink() ? "link" : st.isFile() ? "file" : "other";
    } catch {
      return "gone";
    }
  };
  const here = changes.filter((p) => kind(p) === "file");
  if (here.some((p) => p.includes("\n"))) return null;
  const h = here.length ? run(root, ["hash-object", "--stdin-paths"], { input: `${here.join("\n")}\n` }) : { ok: true, stdout: "" };
  if (!h.ok) return null;
  const now = new Map(here.map((p, i) => [p, h.stdout.split("\n")[i]]));
  // Git keeps a link as the text it points to, so that text is what is compared, not the file it leads to.
  for (const p of changes.filter((x) => kind(x) === "link")) now.set(p, run(root, ["hash-object", "--stdin"], { input: readlinkSync(join(root, p)) }).stdout.trim());
  for (const s of snapshotsOn(root)) {
    const t = run(root, ["ls-tree", "-r", "-z", s.sha]);
    if (!t.ok) continue;
    const had = new Map(t.stdout.split("\0").filter(Boolean).map((l) => [l.slice(l.indexOf("\t") + 1), l.split(" ")[2]?.split("\t")[0]]));
    if (changes.every((p) => (now.has(p) ? had.get(p) === now.get(p) : !had.has(p) && kind(p) === "gone"))) return s.ref;
  }
  return null;
}

// Paths the run is about to keep out of Git (`apply --ignore`) are never saved in the snapshot first.
const without = (list, leaveOut) => {
  const out = leaveOut.map((x) => x.replace(/^\.?\/+/, "")).filter(Boolean);
  return list.filter((p) => !out.some((x) => p === x.replace(/\/$/, "") || p.startsWith(x.endsWith("/") ? x : `${x}/`)));
};

export function snapshotPlan(root, { leaveOut = [] } = {}) {
  const v = run(root, ["--version"]);
  if (v.missing || !v.ok) return { state: "no-git", line: `⚠️ Git is not installed, so repo-fit cannot save a snapshot of your folder first. It is highly recommended: Git keeps a saved copy you can always go back to. ${installHelp()} repo-fit's own undo still takes back everything it changes.` };
  const name = run(root, ["config", "user.name"]).ok || process.env.GIT_AUTHOR_NAME;
  const email = run(root, ["config", "user.email"]).ok || process.env.GIT_AUTHOR_EMAIL;
  if (!name || !email) return { state: "no-name", line: "⚠️ Git does not know your name and email yet, so it cannot save a snapshot of your folder first, and repo-fit will not change anything without one. Run these two lines once (with your own name and email), then ask again:\n\n```bash\ngit config --global user.name \"Your Name\"\n```\n\n```bash\ngit config --global user.email \"you@example.com\"\n```" };
  const inside = run(root, ["rev-parse", "--show-toplevel"]);
  if (!inside.ok) return { state: "no-repo", line: `🚨 No git tree: this folder is not saved in Git, and repo-fit does not start Git without its own separate yes. Choose before anything changes: start Git here and save a snapshot of everything first, so you can always go back (recommended; nothing is uploaded; add \`--git-init\`), or go on without Git, with repo-fit's own backup and undo covering its changes (add \`--no-snapshot\`).` };
  const all = pending(root);
  if (all.error) return { state: "git-error", line: `⚠️ Git could not list this folder's unsaved files, so repo-fit cannot save a snapshot first, and it changes nothing without one. Git said: ${all.error.split("\n").slice(0, 3).join(" ")}` };
  const p = { ...all, changes: without(all.changes, leaveOut) };
  const kept = all.changes.length - p.changes.length ? ` Not saved in it: what you are keeping out of Git now (${names(all.changes.filter((x) => !p.changes.includes(x)))}).` : "";
  const left = p.left.length ? ` Left out of the snapshot (secrets, very big files, or Git repos of their own): ${p.left.slice(0, 5).join(", ")}${p.left.length > 5 ? ", …" : ""}.` : "";
  if (!p.changes.length) {
    const last = run(root, ["log", "-1", "--format=%s (%cs)"]);
    return { state: "clean", line: `🛟 Safety first: everything is already saved in Git${last.ok && last.out ? ` (last save: ${last.out})` : ""}, so you can always go back to it.${kept}${left}` };
  }
  const priv = privateLooking(root, p.changes).filter((x) => without([x.dir], leaveOut).length);
  const flag = priv.length ? `\n\n⚠️ Not in \`.gitignore\`, and ${priv.some((x) => x.ruled) ? "private by your rules or by name" : "private by name"}: ${priv.map((x) => `\`${x.dir}\` (${x.files} ${x.files === 1 ? "file" : "files"}${x.ruled ? "; your rules say to keep it out of Git" : ""})`).join(", ")}. The snapshot keeps ${priv.length === 1 ? "it" : "them"} on this computer only, but an ordinary \`git add .\` would put ${priv.length === 1 ? "it" : "them"} in a commit. To keep ${priv.length === 1 ? "it" : "them"} out of Git (a dry run first, then with --apply): \`repo-fit apply ${q(root)} --ignore ${q(priv.map((x) => x.dir).join(","))}\`` : "";
  const rules = COMMIT_RULES.test(ruleText(root)) ? " Your rules about commits stay kept: this is no commit on a branch, and nothing is staged." : "";
  const ref = savedIn(root, p.changes);
  if (ref) return { state: "saved", ref, line: `🛟 Safety first: your ${p.changes.length} unsaved file${p.changes.length === 1 ? " is" : "s are"} already in a snapshot in Git (\`${ref}\`), so you can always go back.${kept}${left}${flag}` };
  return { state: "dirty", line: `🛟 Safety first: before it changes anything, repo-fit saves a snapshot of your ${p.changes.length} unsaved file${p.changes.length === 1 ? "" : "s"} in Git: ${names(p.changes)}. It is kept apart from your branches, on this computer only: your branch, what you staged and your files stay exactly as they are, and a normal \`git push\` does not send it. Nothing is uploaded.${rules}${kept}${left}${flag}` };
}

const lstatExists = (abs) => {
  try {
    return Boolean(lstatSync(abs));
  } catch {
    return false;
  }
};

let saved = null;
export const savedSnapshot = () => saved;

const howBack = (ref) => `See what it holds: \`git show --stat ${ref}\`. Get a file back from it: \`git restore --source=${ref} -- <file>\`.`;

export function snapshot(root, { gitInit = false, leaveOut = [] } = {}) {
  saved = null;
  const plan = snapshotPlan(root, { leaveOut });
  if (plan.state === "no-git") return { ok: true, text: "⚠️ Git is not installed, so no snapshot was saved. repo-fit's own undo takes back what it changes." };
  if (plan.state === "git-error") return { ok: false, text: `❌ Nothing was changed. ${plan.line.replace(/^⚠️ /, "")}` };
  if (plan.state === "no-name") return { ok: false, text: `❌ Nothing was changed. ${plan.line.replace(/^⚠️ /, "")}` };
  if (plan.state === "clean") return { ok: true, text: "🛟 Everything was already saved in Git, so no new snapshot was needed." };
  if (plan.state === "saved") {
    saved = plan.ref;
    return { ok: true, ref: plan.ref, text: `🛟 Your unsaved files were already saved in a snapshot (\`${plan.ref}\`), so no new one was needed. ${howBack(plan.ref)}` };
  }
  if (plan.state === "no-repo" && !gitInit) return { ok: false, text: "❌ Nothing was changed. 🚨 No git tree: this folder is not saved in Git, and repo-fit does not start Git without its own separate yes. Run the same command again with one of these added:\n- `--git-init`: start Git here and save a snapshot of everything first, so you can always go back (recommended; nothing is uploaded).\n- `--no-snapshot`: go on without Git; repo-fit's own backup and undo cover its changes." };
  if (plan.state === "no-repo") {
    const init = run(root, ["init", "-q", "-b", "main"]);
    if (!init.ok) return { ok: false, text: `❌ Nothing was changed. Git could not start in this folder: ${init.out}` };
  }
  const started = plan.state === "no-repo" ? "Git was started here first. " : "";
  const p = pending(root);
  p.changes = without(p.changes, leaveOut);
  if (!p.changes.length) return { ok: true, text: `🛟 ${started}Nothing to save yet: the folder has no files Git would keep.` };
  const fail = (what, r) => ({ ok: false, text: `❌ ${started ? "Git was started here, but nothing else was changed" : "Nothing was changed"}. Git did not save the snapshot, and repo-fit does not change a folder it could not save first. Git said (${what}): ${r.out.split("\n").slice(0, 3).join(" ")}\nIf you want to go ahead without a snapshot anyway, run the same command again with --no-snapshot.` });
  // A temporary index: the person's own index (what they staged) is never read or written.
  const tmp = mkdtempSync(join(tmpdir(), "repo-fit-snapshot-"));
  try {
    const env = { GIT_INDEX_FILE: join(tmp, "index") };
    const head = run(root, ["rev-parse", "-q", "--verify", "HEAD^{commit}"]);
    if (head.ok) {
      const r = run(root, ["read-tree", head.out], { env });
      if (!r.ok) return fail("read-tree", r);
    }
    // A path that is neither on disk nor in the last commit (staged, then deleted) has nothing to save.
    const known = new Set(run(root, ["ls-files", "-z"], { env }).stdout.split("\0"));
    const list = p.changes.filter((x) => known.has(x) || lstatExists(join(root, x)));
    // The list goes through stdin, so any number of files fits; names are taken literally, never as patterns. -f: a
    // file the person added to Git although it is ignored is saved too (every name here comes from `git status`).
    const add = list.length ? run(root, ["add", "-A", "-f", "--pathspec-from-file=-", "--pathspec-file-nul"], { input: list.join("\0"), env: { ...env, GIT_LITERAL_PATHSPECS: "1" } }) : { ok: true };
    if (!add.ok) return fail("add", add);
    const tree = run(root, ["write-tree"], { env });
    if (!tree.ok) return fail("write-tree", tree);
    // Not signed: a private, local snapshot must not wait for a signing prompt.
    const commit = run(root, ["commit-tree", tree.out, ...(head.ok ? ["-p", head.out] : []), "--no-gpg-sign", "-m", MESSAGE]);
    if (!commit.ok) return fail("commit-tree", commit);
    // Unique across worktrees and runs; created only if the name is free, never overwritten.
    const ref = `${REFS}${new Date().toISOString().replace(/\.\d+Z$/, "Z").replace(/:/g, "-")}-${randomBytes(3).toString("hex")}`;
    const upd = run(root, ["update-ref", "-m", MESSAGE, ref, commit.out, ""]);
    if (!upd.ok) return fail("update-ref", upd);
    saved = ref;
    return { ok: true, ref, text: `🛟 Saved a snapshot of your folder in Git, apart from your branches: \`${ref}\`. ${started}Your branch, what you staged and your files are as they were. Nothing was uploaded. ${howBack(ref)}${p.left.length ? ` Left out of the snapshot (secrets, very big files, or Git repos of their own): ${p.left.join(", ")}.` : ""}` };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// A change to the rulebook (AGENTS.md, CLAUDE.md) lands in this copy of the folder only. Other working copies (Git
// worktrees) and branches not merged here keep their own rules until they take the change, and sessions already open
// keep the rules they started with. Read-only: it only lists them, so the person knows where the old rules still apply.
const RULE_FILES = ["AGENTS.md", "CLAUDE.md"];
export function rulebookCopies(root, paths) {
  const touched = RULE_FILES.filter((f) => paths.includes(f));
  if (!touched.length) return [];
  const restart = "💡 Sessions already open keep the old rules until they restart.";
  const top = run(root, ["rev-parse", "--show-toplevel"]);
  if (!top.ok) return [restart];
  const real = (p) => {
    try {
      return realpathSync(p);
    } catch {
      return null;
    }
  };
  const here = real(top.stdout.trim());
  const few = (list) => list.slice(0, 5).join(", ") + (list.length > 5 ? `, and ${list.length - 5} more` : "");
  const trees = [];
  for (const block of run(root, ["worktree", "list", "--porcelain"]).stdout.split("\n\n")) {
    const path = block.match(/^worktree (.+)$/m)?.[1];
    if (!path || /^(bare|prunable)/m.test(block) || !real(path) || real(path) === here) continue;
    const branch = block.match(/^branch refs\/heads\/(.+)$/m)?.[1];
    trees.push(`\`${path}\`${branch ? ` (branch \`${branch}\`)` : ""}`);
  }
  const branches = [];
  if (run(root, ["rev-parse", "--verify", "-q", "HEAD"]).ok) {
    // Full names (a tag may share a branch's name), the 50 most recently changed branches.
    const open = run(root, ["for-each-ref", "--no-merged=HEAD", "--sort=-committerdate", "--count=50", "--format=%(refname)", "refs/heads"]).stdout.split("\n").filter(Boolean);
    for (const b of open) if (run(root, ["diff", "--name-only", `HEAD...${b}`, "--", ...RULE_FILES]).stdout.trim()) branches.push(`\`${b.replace(/^refs\/heads\//, "")}\``);
  }
  const files = touched.join(" and ");
  const out = [];
  if (trees.length) out.push(`🔀 This changes ${files} in this copy of the folder only. Other working copies keep their old rules until they take this change: ${few(trees)}.`);
  if (branches.length) out.push(`🔀 ${branches.length === 1 ? "A branch" : "Branches"} not merged here also ${branches.length === 1 ? "changes" : "change"} ${RULE_FILES.join(" or ")}: ${few(branches)}. When ${branches.length === 1 ? "it is" : "they are"} merged, Git may ask which lines to keep.`);
  out.push(restart);
  return out;
}
