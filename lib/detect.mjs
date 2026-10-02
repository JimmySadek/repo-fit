// Read-only detection of the machine and of a repository. It never writes, installs, logs in or sends anything.
// Used by `repo-fit detect`. Not vendored into repos.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { atLeast, claudeSessionVersion, gates } from "./versions.mjs";

const sh = (cmd, args, cwd) => {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", timeout: 8000 });
  return { ok: r.status === 0, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
};
const has = (root, rel) => existsSync(join(root, rel));
const read = (root, rel) => {
  try {
    return readFileSync(join(root, rel), "utf8");
  } catch {
    return "";
  }
};

const CLIS = ["git", "gh", "glab", "node", "python3", "jq", "claude", "codex", "gemini", "backlog", "specify", "openspec", "uv"];

// Machine: which tools exist, and whether gh or glab are logged in. Logins report host and account name only, never tokens.
function machine() {
  const tools = {};
  for (const name of CLIS) {
    const where = sh("sh", ["-c", `command -v ${name}`]);
    if (!where.ok) {
      tools[name] = { installed: false };
      continue;
    }
    const v = sh(name, ["--version"]);
    tools[name] = { installed: true, version: (v.out || v.err).split("\n")[0].slice(0, 60) };
  }
  const logins = (name, re) => {
    if (!tools[name].installed) return undefined;
    const r = sh(name, ["auth", "status"]);
    return [...`${r.out}\n${r.err}`.matchAll(re)].map((m) => ({ host: m[1].toLowerCase(), account: m[2] }));
  };
  tools.gh.loggedIn = logins("gh", /Logged in to (\S+) account (\S+)/g);
  tools.glab.loggedIn = logins("glab", /Logged in to (\S+) as (\S+)/g);
  return { platform: process.platform, tools };
}

// Strip any user:token@ part from a URL before it is shown anywhere.
const cleanUrl = (u) => u.replace(/\/\/[^@/\s]+@/, "//");
function hostOf(url) {
  const m = url.match(/^(?:[a-z+]+:\/\/)?(?:[^@/]+@)?([^/:]+)[:/]/i);
  return m ? m[1].toLowerCase() : "";
}
const hostKind = (h) => (/github/.test(h) ? "github" : /gitlab/.test(h) ? "gitlab" : /bitbucket/.test(h) ? "bitbucket" : h ? "other" : "none");

const CODE = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".py", ".rs", ".go", ".java", ".kt", ".rb", ".php", ".swift", ".c", ".cc", ".cpp", ".h", ".cs", ".sh", ".sql", ".vue", ".svelte", ".astro"]);
const DOCS = new Set([".md", ".mdx", ".txt", ".rst"]);
const MEDIA = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".mp4", ".mov", ".webm", ".mp3", ".wav", ".pdf", ".pptx", ".psd", ".ai", ".zip"]);
const SKIP = new Set([".git", "node_modules", ".venv", "venv", "dist", "build", ".next", ".astro", "__pycache__", ".cache", "coverage", "worktrees"]);
const BIG = 5 * 1024 * 1024;
const LIMIT = 20000;

function survey(root) {
  const s = { files: 0, docs: 0, code: 0, media: 0, other: 0, truncated: false, big: [] };
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (s.files >= LIMIT) return void (s.truncated = true);
      if (SKIP.has(e.name)) continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) {
        s.files++;
        const ext = e.name.includes(".") ? e.name.slice(e.name.lastIndexOf(".")).toLowerCase() : "";
        if (CODE.has(ext)) s.code++;
        else if (DOCS.has(ext)) s.docs++;
        else if (MEDIA.has(ext)) s.media++;
        else s.other++;
        try {
          const size = statSync(p).size;
          if (size > BIG) s.big.push({ path: p.slice(root.length + 1).split("\\").join("/"), mb: Math.round(size / 1048576) });
        } catch {
          /* unreadable file: ignore */
        }
      }
    }
  };
  try {
    walk(root);
  } catch {
    /* unreadable folder: report what was counted */
  }
  s.big.sort((a, b) => b.mb - a.mb);
  return s;
}

const MANIFESTS = ["package.json", "pyproject.toml", "requirements.txt", "Cargo.toml", "go.mod", "pom.xml", "build.gradle", "Gemfile", "composer.json", "Package.swift", "Makefile", "Dockerfile", "docker-compose.yml"];

function commands(root) {
  const out = [];
  const want = ["dev", "start", "build", "test", "lint", "typecheck", "format", "check"];
  const runner = has(root, "pnpm-lock.yaml") ? "pnpm" : has(root, "yarn.lock") ? "yarn" : has(root, "bun.lock") || has(root, "bun.lockb") ? "bun" : "npm";
  const run = (k) => (runner === "yarn" ? `yarn ${k}` : `${runner} run ${k}`);
  try {
    const scripts = JSON.parse(read(root, "package.json") || "{}").scripts ?? {};
    for (const k of want) if (scripts[k]) out.push({ from: "package.json", name: k, run: run(k) });
  } catch {
    /* package.json is not valid JSON: skip */
  }
  const targets = new Set([...read(root, "Makefile").matchAll(/^([a-zA-Z][\w.-]*):/gm)].map((m) => m[1]));
  for (const k of want) if (targets.has(k)) out.push({ from: "Makefile", name: k, run: `make ${k}` });
  if (has(root, "pytest.ini") || /\[tool\.pytest/.test(read(root, "pyproject.toml"))) out.push({ from: "pyproject/pytest.ini", name: "test", run: "pytest" });
  return out;
}

// How much of CLAUDE.md repeats AGENTS.md, line by line. Used to choose between "import" and "replace".
export function ruleOverlap(root) {
  const a = read(root, "AGENTS.md");
  const c = read(root, "CLAUDE.md");
  if (!a || !c) return null;
  const every = new Set(a.split("\n").map((l) => l.trim()));
  const aset = new Set([...every].filter((l) => l.length >= 12)); // short lines (headings, "---") say little, so they do not count toward the overlap share
  const lines = c.split("\n").map((l) => l.trim()).filter((l) => l.length >= 12);
  const shared = lines.filter((l) => aset.has(l)).length;
  return {
    identical: a === c,
    claudeLines: lines.length,
    shared,
    share: lines.length ? shared / lines.length : 0,
    onlyInClaude: c.split("\n").filter((l) => l.trim() && !every.has(l.trim())),
  };
}

function repo(root) {
  const r = { path: root, exists: existsSync(root) && statSync(root).isDirectory() };
  if (!r.exists) return r;
  const g = (a) => sh("git", ["-C", root, ...a]);
  r.git = g(["rev-parse", "--is-inside-work-tree"]).out === "true";
  if (r.git) {
    r.branch = g(["branch", "--show-current"]).out || "(detached)";
    r.commits = Number(g(["rev-list", "--count", "HEAD"]).out) || 0;
    r.uncommitted = g(["status", "--porcelain"]).out.split("\n").filter(Boolean).length;
    r.lastCommit = g(["log", "-1", "--format=%cs"]).out || null;
    const remotes = new Map();
    for (const line of g(["remote", "-v"]).out.split("\n")) {
      const m = line.match(/^(\S+)\s+(\S+)\s+\(fetch\)/);
      if (m) remotes.set(m[1], cleanUrl(m[2]));
    }
    r.remotes = [...remotes].map(([name, url]) => ({ name, url, host: hostOf(url), kind: hostKind(hostOf(url)) }));
  }
  r.host = r.remotes?.length ? r.remotes[0].kind : "none";

  const files = survey(root);
  r.files = files;
  if (r.git && files.big.length) {
    const tracked = new Set(g(["ls-files", "-z"]).out.split("\0").filter(Boolean));
    for (const b of files.big) b.tracked = tracked.has(b.path);
  }
  r.manifests = MANIFESTS.filter((f) => has(root, f));
  r.obsidian = has(root, ".obsidian");
  const codeShare = files.code / Math.max(1, files.code + files.docs);
  // Media does not decide the kind: judge by documents against code.
  if (r.obsidian) r.kind = { value: "notes", why: "has an .obsidian folder" };
  else if (r.manifests.length && files.code > 0) r.kind = { value: codeShare >= 0.5 ? "technical" : "mixed", why: `${files.code} code files, ${files.docs} document files, manifests: ${r.manifests.join(", ")}` };
  else if (codeShare < 0.4) r.kind = { value: "notes", why: `${files.docs} document files against ${files.code} code files, no manifests (notes or knowledge base)` };
  else r.kind = { value: "mixed", why: `${files.docs} document files, ${files.code} code files, no manifests` };

  const rules = ["AGENTS.md", "CLAUDE.md", "CLAUDE.local.md", "GEMINI.md", ".cursorrules", ".cursor/rules", ".windsurfrules", ".github/copilot-instructions.md", ".claude", ".codex", ".mcp.json", ".sp-managed"];
  r.rules = rules.filter((f) => has(root, f));
  if (has(root, "AGENTS.md") && has(root, "CLAUDE.md")) {
    const a = read(root, "AGENTS.md");
    const c = read(root, "CLAUDE.md");
    r.claudeVsAgents = /(^|\s)@AGENTS\.md\b/.test(c) ? "imports AGENTS.md" : a === c ? "identical copy, no import" : "separate file, no import";
  }
  const tools = [];
  if (has(root, "backlog/tasks") || has(root, "backlog.config.yml") || has(root, "backlog/config.yml")) tools.push("Backlog.md");
  else if (has(root, "backlog")) tools.push("backlog/ folder (format unknown)");
  try {
    if (has(root, ".backlog") && readdirSync(join(root, ".backlog")).some((f) => !f.startsWith("."))) tools.push(".backlog/ (task files, often Git-ignored)");
  } catch {
    /* unreadable: skip */
  }
  if (has(root, ".specify")) tools.push("spec-kit");
  if (has(root, "openspec")) tools.push("OpenSpec");
  if (has(root, ".taskmaster")) tools.push("Task Master");
  for (const f of ["TODO.md", "TASKS.md", "JOBS.md"]) if (has(root, f)) tools.push(f);
  if (has(root, "docs/00-home/board.md")) tools.push("playbook board");
  r.taskTools = tools;
  r.otherTools = [".obsidian", ".serena", ".handoffs", ".prompts", "wiki"].filter((f) => has(root, f));
  r.ci = [has(root, ".github/workflows") ? "GitHub Actions" : null, has(root, ".gitlab-ci.yml") ? "GitLab CI" : null, has(root, ".circleci") ? "CircleCI" : null, has(root, "Jenkinsfile") ? "Jenkins" : null].filter(Boolean);
  r.commands = commands(root);
  r.claudeSessionVersion = claudeSessionVersion(root);
  try {
    const pj = JSON.parse(read(root, "playbook.json") || "null");
    r.playbook = pj?.playbook ?? null;
    r.playbookTools = pj?.tools ?? [];
  } catch {
    r.playbook = null;
    r.playbookTools = [];
  }
  return r;
}

// What a person should be asked. Nothing here is decided or applied.
function offers(m, r) {
  const list = [];
  const T = m.tools;
  const tools = [];
  if (T.claude.installed || r.rules.includes(".claude")) tools.push("Claude Code");
  if (T.codex.installed || r.rules.includes(".codex")) tools.push("Codex");
  // Version limits come from guidance/gates.json. The version that matters is the one this repo's sessions ran on.
  const cliVer = (T.claude.version ?? "").match(/\d+\.\d+\.\d+/)?.[0] ?? null;
  const eff = r.claudeSessionVersion ?? cliVer;
  const versionNotes = [];
  for (const g of gates("claude-code")) if (atLeast(eff, g.since) === false) versionNotes.push(`${g.feature} needs Claude Code ${g.since} or later (this repo runs ${eff}).`);
  if (r.claudeSessionVersion && cliVer && atLeast(cliVer, r.claudeSessionVersion) === false) versionNotes.push(`The claude command in a terminal is ${cliVer}, older than the ${r.claudeSessionVersion} your sessions use here.`);
  list.push({ id: "tools", ask: "Which AI tools will work in this repo?", found: tools.length ? tools : ["none detected"], note: ["AGENTS.md covers most tools. Hooks exist for Claude Code and Codex only.", ...versionNotes].join(" ") });

  if (r.claudeVsAgents && r.claudeVsAgents !== "imports AGENTS.md") list.push({ id: "link-rules", ask: "CLAUDE.md and AGENTS.md are not linked. Link them with an import?", found: [r.claudeVsAgents], note: "Claude Code reads only CLAUDE.md when one exists. Needs approval before editing." });
  else if (r.rules.includes("CLAUDE.md") && !r.rules.includes("AGENTS.md")) list.push({ id: "add-agents", ask: "Only CLAUDE.md exists. Add AGENTS.md as the shared rulebook so Codex can read it?", found: ["CLAUDE.md only"], note: "Never overwrite CLAUDE.md." });
  const siblings = r.rules.filter((f) => [".cursorrules", ".cursor/rules", ".windsurfrules", ".github/copilot-instructions.md", "GEMINI.md"].includes(f));
  if (siblings.length) list.push({ id: "sibling-rules", ask: "Other tools' rule files exist. Leave them alone, or link them?", found: siblings, note: "Default: leave alone." });

  const board = [{ label: "Markdown table (default, no install)", available: true }];
  if (r.taskTools.some((t) => /Backlog\.md/.test(t))) board.push({ label: "Backlog.md (already in this repo)", available: true });
  else if (T.backlog.installed) board.push({ label: "Backlog.md (installed on this machine)", available: true });
  // A host CLI only counts when it is logged in to the host this repo actually uses.
  const hostCli = (cli, label) => {
    const t = T[cli];
    const host = r.remotes[0].host;
    const ok = t.installed && (t.loggedIn ?? []).some((l) => l.host === host);
    const reason = !t.installed ? `${cli} is not installed` : !t.loggedIn?.length ? `${cli} is not logged in` : ok ? `${cli} is logged in to ${host}` : `${cli} is logged in to ${t.loggedIn.map((l) => l.host).join(", ")}, not to ${host}`;
    board.push({ label, available: ok, reason });
  };
  if (r.host === "github") hostCli("gh", "GitHub Issues");
  if (r.host === "gitlab") hostCli("glab", "GitLab issues");
  const existing = r.taskTools.filter((t) => !/playbook board|Backlog\.md/.test(t));
  list.push({ id: "board", ask: "Where should tasks and jobs be tracked?", options: board, found: existing.length ? existing : ["nothing yet"], note: existing.length ? "Something already tracks work here. Ask before adding a second board." : "Nothing is installed or logged in for you." });

  if (r.git) {
    const hostNote = { github: "GitHub remote: PR template and workflow can be offered.", gitlab: "GitLab remote: MR template and .gitlab-ci.yml can be offered, not .github/.", bitbucket: "Bitbucket remote: no host files offered.", other: "Unknown host: no host files offered.", none: "No remote: there is no off-machine backup." }[r.host];
    const mismatch = (r.host === "gitlab" && r.ci.includes("GitHub Actions")) || (r.host === "github" && r.ci.includes("GitLab CI"));
    list.push({ id: "host", ask: "Add files for your Git host?", found: [r.host], note: `${hostNote}${mismatch ? " ⚠️ The CI files here belong to a different host than the remote." : ""}` });
  }
  if (r.commands.length) list.push({ id: "commands", ask: "Draft a Dev, Test and Lint section for the rulebook from these scripts?", found: r.commands.map((c) => c.run) });
  list.push({ id: "autosave", ask: "Which files may autosave commit?", found: [r.kind.value], note: r.kind.value === "technical" ? "Suggest docs only. Never source code." : r.kind.value === "notes" ? "Suggest all Markdown notes." : "Suggest docs and notes, never source code." });
  return list;
}

export function detect(target) {
  const root = resolve(target);
  const m = machine();
  const r = repo(root);
  return { machine: m, repo: r, offers: r.exists ? offers(m, r) : [] };
}

export function format(d) {
  const { machine: m, repo: r } = d;
  const out = [];
  const yes = (t) => (t.installed ? `✅ ${t.version || "installed"}` : "➖ not installed");
  out.push("🖥️ Machine");
  out.push(`   git ${yes(m.tools.git)} · node ${yes(m.tools.node)} · python3 ${yes(m.tools.python3)} · jq ${yes(m.tools.jq)}`);
  out.push(`   claude ${yes(m.tools.claude)} · codex ${yes(m.tools.codex)} · gemini ${yes(m.tools.gemini)}`);
  const login = (t) => (!t.installed ? "not installed" : t.loggedIn?.length ? `logged in: ${t.loggedIn.map((l) => `${l.host} (${l.account})`).join(", ")}` : "installed, not logged in");
  out.push(`   gh ${login(m.tools.gh)} · glab ${login(m.tools.glab)}`);
  const extra = ["backlog", "specify", "openspec", "uv"].filter((n) => m.tools[n].installed);
  if (extra.length) out.push(`   also installed: ${extra.join(", ")}`);
  out.push("");
  if (!r.exists) {
    out.push(`❌ ${r.path} is not a folder.`);
    return out.join("\n");
  }
  out.push(`📁 Repo: ${r.path}`);
  out.push(r.git ? `   Git: branch ${r.branch}, ${r.commits} commits, ${r.uncommitted} uncommitted, last commit ${r.lastCommit ?? "none"}` : "   Git: not a Git repository");
  if (r.git) {
    const byHost = new Map();
    for (const x of r.remotes) byHost.set(`${x.kind} (${x.host})`, [...(byHost.get(`${x.kind} (${x.host})`) ?? []), x.name]);
    out.push(r.remotes.length ? `   Remote: ${[...byHost].map(([h, names]) => `${h} as ${names.join(", ")}`).join("; ")}` : "   Remote: none (no off-machine backup)");
  }
  out.push(`   Kind: ${r.kind.value}, because ${r.kind.why}`);
  out.push(`   Files: ${r.files.files}${r.files.truncated ? "+" : ""} (${r.files.docs} documents, ${r.files.code} code, ${r.files.media} media)${r.files.big.length ? `, ${r.files.big.length} over 5 MB${r.git ? ` (${r.files.big.filter((b) => b.tracked).length} tracked in Git)` : ""}, largest ${r.files.big[0].mb} MB: ${r.files.big[0].path}` : ""}`);
  out.push(`   Rule files: ${r.rules.join(", ") || "none"}${r.claudeVsAgents ? ` · CLAUDE.md vs AGENTS.md: ${r.claudeVsAgents}` : ""}`);
  out.push(`   Task tools: ${r.taskTools.join(", ") || "none"} · CI: ${r.ci.join(", ") || "none"}`);
  if (r.otherTools.length) out.push(`   Other: ${r.otherTools.join(", ")}`);
  if (r.commands.length) out.push(`   Commands: ${r.commands.map((c) => c.run).join(", ")}`);
  out.push(`   Playbook: ${r.playbook ? `installed (${r.playbook})` : "not installed"}`);
  out.push("");
  out.push("❓ Would ask you (nothing is decided or changed)");
  for (const o of d.offers) {
    out.push(`   • ${o.ask}`);
    out.push(`     found: ${o.found.join(" · ")}`);
    if (o.options) out.push(`     options: ${o.options.map((x) => `${x.label}${x.available ? "" : ` [not available: ${x.reason}]`}`).join(" | ")}`);
    if (o.note) out.push(`     ${o.note}`);
  }
  return out.join("\n");
}
