// Checks the tools a repo relies on against the version limits in guidance/gates.json, and can update the Claude Code
// command. Read-only unless you pass --update AND --apply. It only ever runs the tool's own official updater.
import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { detect } from "./detect.mjs";
import { atLeast, gates } from "./versions.mjs";
import { prefsPath, readPrefs } from "./prefs.mjs";

const sh = (cmd, args, timeout = 20000) => {
  const r = spawnSync(cmd, args, { encoding: "utf8", timeout });
  return { ok: r.status === 0, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
};
const ver = (s) => (s ?? "").match(/\d+\.\d+\.\d+/)?.[0] ?? null;

export function tools(target, o = {}) {
  const root = resolve(target);
  const d = detect(root);
  const r = d.repo;
  const T = d.machine.tools;
  if (!r.exists) return { ok: false, text: `❌ ${root} is not a folder.` };
  const cli = ver(T.claude.version);
  const session = r.claudeSessionVersion;
  const effective = session ?? cli; // the version that really runs for this repo
  const claudeChosen = r.rules.includes(".claude") || Boolean(session) || (r.playbookTools ?? []).includes("claude-code");
  const prefs = readPrefs();
  const autoAllowed = prefs.autoUpdate?.["claude-code"] === "when-required";

  const rows = [];
  for (const g of gates("claude-code")) {
    const required = g.id === "claude-native-agents-md" && r.rules.includes("AGENTS.md") && !r.rules.includes("CLAUDE.md") && claudeChosen;
    const ok = atLeast(effective, g.since);
    rows.push({ id: g.id, feature: g.feature, since: g.since, session: session ?? null, cli, ok, required, needsUpdate: required && ok === false, cliOk: atLeast(cli, g.since) });
  }
  const needed = rows.filter((x) => x.needsUpdate);

  // Where could an update come from? Only the terminal command can be updated here. The desktop app updates itself.
  let install = null;
  let latest = null;
  if (T.claude.installed) {
    const path = sh("sh", ["-c", "command -v claude"]).out;
    let real = path;
    try {
      real = realpathSync(path);
    } catch {
      /* keep the plain path */
    }
    install = { path, viaNpm: /node_modules\/@anthropic-ai\/claude-code/.test(real) };
    if (install.viaNpm && !o.offline) latest = ver(sh("npm", ["view", "@anthropic-ai/claude-code", "version"]).out);
  }

  const result = { repo: root, claude: { cli, session, effective, install, latest }, gates: rows, needed: needed.map((x) => x.id), autoUpdateAllowed: Boolean(autoAllowed && needed.length), prefsFile: prefsPath() };
  const out = [`# Tools: ${r.path.split("/").at(-1)}`, "", `Claude Code in a terminal (\`claude\` command): **${cli ?? "not installed"}**${install ? ` (${install.viaNpm ? "installed with npm" : "installed elsewhere"})` : ""}${latest ? `, latest on npm: ${latest}` : ""}.`, `Claude Code in this repo's recent sessions: **${session ?? "no session log found"}**${session && cli && session !== cli ? " (the desktop app bundles its own version)" : ""}.`, ""];
  out.push("| Feature | Needs | Sessions here | Terminal command | Needed for this repo? |", "|---|---|---|---|---|");
  for (const x of rows) out.push(`| ${x.feature} | ${x.since} | ${x.session ?? "?"} ${x.session ? (atLeast(x.session, x.since) ? "✅" : "❌") : ""} | ${x.cli ?? "?"} ${x.cli ? (x.cliOk ? "✅" : "❌") : ""} | ${x.required ? (x.ok === false ? "**yes, and not met**" : "yes, met") : "no"} |`);
  out.push("");

  if (!o.update) {
    if (needed.length) {
      out.push(`⚠️ **An update is needed:** ${needed.map((x) => x.feature).join("; ")}. ${autoAllowed ? "You have allowed automatic updates for this case, so the setup skill may run the update itself." : "Ask the user, or use the fallback below."}`, "", "**Options:** (1) update the terminal command: `repo-fit tools <repo> --update claude --apply` (runs Claude Code's own `claude update`); (2) **fallback that works on every version:** a thin `CLAUDE.md` that imports `AGENTS.md`, which the playbook adds by default.");
    } else {
      out.push("✅ **Nothing needs an update for this repo.**");
      if (cli && effective && cli !== effective && atLeast(cli, effective) === false) out.push("", `💡 Optional: the terminal command (${cli}) is older than the version your sessions use (${effective}). It only matters if you run Claude Code from a terminal here. To update it: \`repo-fit tools <repo> --update claude --apply\`.`);
    }
    return { ok: true, text: out.join("\n"), data: result };
  }

  if (o.update !== "claude") return { ok: false, text: `❌ Unknown tool "${o.update}". Only "claude" can be updated here.` };
  if (!T.claude.installed) return { ok: false, text: `${out.join("\n")}\n❌ The claude command is not installed. Install Claude Code yourself first. This tool does not install it.` };
  out.push("## Update plan", "", "1. Run Claude Code's own updater: `claude update` (official; checks for a newer version and installs it).", "2. Run `claude --version` and report before and after.", "", "**It changes** the `claude` command in a terminal only. The desktop app updates itself. **It does not** touch your repos, settings or logins.", "");
  if (!o.apply) return { ok: true, text: `${out.join("\n")}Dry run. Nothing was updated. Run again with \`--apply\` to do exactly this.`, data: result };
  const before = cli;
  const upd = spawnSync("claude", ["update"], { encoding: "utf8", timeout: 300000 });
  const after = ver(sh("claude", ["--version"]).out);
  const changed = after && before && after !== before;
  out.push(upd.status === 0 ? `✅ \`claude update\` finished. Version: ${before ?? "?"} → ${after ?? "?"}${changed ? "" : " (no change: already the latest, or the update could not install)"}.` : `❌ \`claude update\` failed: ${(upd.stderr || upd.stdout || "").trim().slice(0, 300)}\nNothing else was changed.`);
  return { ok: upd.status === 0, text: out.join("\n"), data: result };
}
