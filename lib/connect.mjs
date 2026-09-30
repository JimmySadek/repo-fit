// Connects a local Git repo to a Git host. Dry run by default.
// With --apply it creates an EMPTY, PRIVATE remote repository with the host CLI you are already logged in to,
// and adds `origin`. It never pushes, never commits, never creates anything public, never installs or logs in.
import { spawnSync } from "node:child_process";
import { basename, resolve } from "node:path";
import { detect } from "./detect.mjs";
import { writeAll } from "./apply.mjs";

const run = (cmd, args, env) => {
  const r = spawnSync(cmd, args, { encoding: "utf8", timeout: 60000, env: { ...process.env, ...env } });
  return { ok: r.status === 0, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
};
const show = (cmd, args, env) => `${env ? `${Object.entries(env).map(([k, v]) => `${k}=${v}`).join(" ")} ` : ""}${cmd} ${args.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(" ")}`;

function options(d, o, name, root) {
  const T = d.machine.tools;
  const list = [];
  const gh = T.gh.installed ? (T.gh.loggedIn ?? []).find((l) => l.host === "github.com") : null;
  const ghOwner = o.owner ?? gh?.account;
  list.push({
    id: "github", label: "GitHub (github.com)", available: Boolean(gh),
    reason: !T.gh.installed ? "gh is not installed" : gh ? `gh is logged in as ${gh.account}` : `gh is not logged in to github.com${T.gh.loggedIn?.length ? ` (only ${T.gh.loggedIn.map((l) => l.host).join(", ")})` : ""}`,
    path: `${ghOwner}/${name}`,
    check: ["gh", ["repo", "view", `${ghOwner}/${name}`]],
    steps: [["gh", ["repo", "create", `${ghOwner}/${name}`, "--private", "--source", root, "--remote", "origin"]]],
    url: `https://github.com/${ghOwner}/${name}.git`,
    undoRemote: `gh repo delete ${ghOwner}/${name}`,
  });
  const gl = T.glab.installed ? (T.glab.loggedIn ?? [])[0] : null;
  const glOwner = o.owner ?? gl?.account;
  const env = gl ? { GITLAB_HOST: gl.host } : undefined;
  const glUrl = `https://${gl?.host}/${glOwner}/${name}.git`;
  list.push({
    id: "gitlab", label: `GitLab (${gl?.host ?? "gitlab.com"})`, available: Boolean(gl),
    reason: !T.glab.installed ? "glab is not installed" : gl ? `glab is logged in as ${gl.account}${(T.glab.loggedIn ?? []).length > 1 ? " (first of several logins)" : ""}` : "glab is not logged in",
    path: `${glOwner}/${name}`,
    check: ["glab", ["repo", "view", `${glOwner}/${name}`], env],
    // glab defaults to "internal" visibility, so --private is always passed. --skipGitInit keeps glab away from the local repo; the remote is added below.
    steps: [
      ["glab", ["repo", "create", o.owner ? `${o.owner}/${name}` : name, "--private", "--skipGitInit"], env],
      ["git", ["-C", root, "remote", "add", "origin", glUrl]],
    ],
    url: glUrl,
    undoRemote: `glab repo delete ${glOwner}/${name}`,
  });
  return list;
}

export function connect(target, o = {}) {
  const root = resolve(target);
  const d = detect(root);
  const r = d.repo;
  if (!r.exists) return { ok: false, text: `❌ ${root} is not a folder.` };
  if (!r.git) return { ok: false, text: "❌ Not a Git repository. Run `git init` yourself first. This command never creates one." };
  if (r.remotes.length) return { ok: true, text: `✅ Already connected: ${r.remotes.map((x) => `${x.name} → ${x.kind} (${x.host})`).join(", ")}. Nothing to do.` };

  const name = (o.name ?? basename(root)).replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  const opts = options(d, o, name, root);
  const out = [`# Connect: ${basename(root)} (${o.apply ? "apply" : "dry run"})`, ""];
  out.push(`Local repo: branch ${r.branch}, ${r.commits} commit${r.commits === 1 ? "" : "s"}, ${r.uncommitted} uncommitted. **No remote**, so nothing here is backed up off this machine.`, "");
  out.push("| Host | Available | Why | Would create |", "|---|---|---|---|");
  for (const x of opts) out.push(`| ${x.label} | ${x.available ? "✅" : "❌"} | ${x.reason} | ${x.available ? `\`${x.path}\` (private, empty)` : "-"} |`);
  out.push("");
  const usable = opts.filter((x) => x.available);
  if (!usable.length) return { ok: true, text: `${out.join("\n")}\nNo host CLI is installed and logged in for this. Nothing to offer. Log in yourself (for example \`gh auth login\` or \`glab auth login\`), or add a remote by hand.` };

  const chosen = o.host ? opts.find((x) => x.id === o.host) : null;
  if (!chosen) {
    out.push(`Choose a host with \`--host ${usable.map((x) => x.id).join("|")}\`. Add \`--owner <group-or-org>\` to create it under an organization instead of your own account, and \`--name\` to change the repo name (now \`${name}\`).`);
    return { ok: true, text: out.join("\n") };
  }
  if (!chosen.available) return { ok: false, text: `${out.join("\n")}\n❌ ${chosen.label} is not available: ${chosen.reason}.` };

  // Read-only: is the name free on the host?
  const [cmd, args, env] = chosen.check;
  const probe = run(cmd, args, env);
  if (probe.ok) return { ok: false, text: `${out.join("\n")}\n❌ \`${chosen.path}\` already exists on ${chosen.label}. Nothing was created. Choose another name with --name.` };

  out.push(`## Plan for ${chosen.label}`, "", `1. Name check (read-only, done): \`${chosen.path}\` is free, or the host did not find it.`);
  chosen.steps.forEach((s, i) => out.push(`${i + 2}. \`${show(...s)}\``));
  out.push("", "**It does not:** push, commit, make anything public, install anything or log in. Visibility is always private.", "");
  if (!o.apply) return { ok: true, text: `${out.join("\n")}Dry run. Nothing was created. Run again with \`--apply\` to do exactly this.` };

  for (const [c, a, e] of chosen.steps) {
    const res = run(c, a, e);
    if (!res.ok) return { ok: false, text: `${out.join("\n")}\n❌ \`${show(c, a, e)}\` failed: ${res.err || res.out}\nStopped. Check the host before retrying: a repo may have been created.` };
  }
  const remote = run("git", ["-C", root, "remote", "get-url", "origin"]);
  const receipt = writeAll(root, [], {
    type: "connect", host: chosen.id, created: chosen.path, visibility: "private", remote: { name: "origin", url: remote.ok ? remote.out.replace(/\/\/[^@/\s]+@/, "//") : chosen.url },
    manual: { deleteRemoteRepo: chosen.undoRemote, removeLocalRemote: "git remote remove origin" },
  });
  return {
    ok: true,
    text: `${out.join("\n")}✅ Created \`${chosen.path}\` (private, empty) and linked it as \`origin\`${remote.ok ? "" : " (could not confirm the link: check `git remote -v`)"}. Receipt: \`${receipt.receipt}\`.\n\nNothing was pushed or committed. Pushing sends your files off this machine, so it stays a separate decision.\nTo undo by hand: \`git remote remove origin\`, and \`${chosen.undoRemote}\` (the tool never deletes a remote repo for you).`,
  };
}
