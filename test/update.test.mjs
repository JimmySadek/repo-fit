// How people learn about a newer repo-fit: one line in the briefing for an important release (checked at most once a
// day, never with the network in tests), and the Claude Code plugin files that let them switch on auto-update.
import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { ROOT, cli, repo, sandboxed, script, write } from "./helpers.mjs";

const npm = (version, releases) => JSON.stringify({ version, repoFit: { releases } });
const IMPORTANT = { version: "9.0.0", important: true, why: "Setup now fixes the thing your repo has." };

// A repo with the scripts, stamped with an older version.
function adopted(sb) {
  const d = repo(sb, "r", { commit: true, files: { "notes/a.md": "# A\n" } });
  assert.equal(cli(sb, ["apply", d, "--steps", "A-01,A-10", "--tool", "claude", "--hooks", "none", "--autosave", "off", "--apply"]).status, 0);
  write(d, "playbook.json", JSON.stringify({ ...JSON.parse(readFileSync(join(d, "playbook.json"), "utf8")), playbook: "0.6.0" }));
  return d;
}
const brief = (sb, d, env) => {
  Object.assign(sb.env, { REPO_FIT_UPDATE_CHECK: "on", ...env });
  return script(sb, d, "brief.mjs", ["--text"]);
};

test("an important newer release is one line in the briefing, with why it matters", sandboxed((sb) => {
  const b = brief(sb, adopted(sb), { REPO_FIT_UPDATE_JSON: npm("9.0.0", [IMPORTANT]) });
  assert.equal(b.status, 0, b.out);
  assert.match(b.stdout, /🆕 repo-fit 9\.0\.0 is out \(this repo has 0\.6\.0\): Setup now fixes the thing your repo has\. To get it, update repo-fit/);
  // Not every install is an npx skills one: a skillshare copy or a Git clone needs its own way to update.
  for (const way of [/npx skills update -g -y/, /skillshare update --all/, /git pull/]) assert.match(b.stdout, way);
}));

test("a release that is not important, or not newer, stays silent", sandboxed((sb) => {
  const d = adopted(sb);
  assert.doesNotMatch(brief(sb, d, { REPO_FIT_UPDATE_JSON: npm("9.0.0", [{ ...IMPORTANT, important: false }]) }).stdout, /🆕/);
  const same = adopted({ ...sb, dir: join(sb.dir, "x") });
  assert.doesNotMatch(brief(sb, same, { REPO_FIT_CONFIG: join(sb.home, "cfg2"), REPO_FIT_UPDATE_JSON: npm("0.6.0", [{ ...IMPORTANT, version: "0.6.0" }]) }).stdout, /🆕/);
}));

test("the check runs at most once a day: the cached answer is used until tomorrow", sandboxed((sb) => {
  const d = adopted(sb);
  assert.match(brief(sb, d, { REPO_FIT_UPDATE_JSON: npm("9.0.0", [IMPORTANT]) }).stdout, /9\.0\.0/);
  const again = brief(sb, d, { REPO_FIT_UPDATE_JSON: npm("9.9.9", [{ ...IMPORTANT, version: "9.9.9" }]) }).stdout;
  assert.match(again, /9\.0\.0/);
  assert.doesNotMatch(again, /9\.9\.9/);
}));

test("the check can be turned off, and a failed check is silent", sandboxed((sb) => {
  const d = adopted(sb);
  write(join(sb.home, "cfg"), "preferences.json", JSON.stringify({ updateCheck: "off" }));
  assert.doesNotMatch(brief(sb, d, { REPO_FIT_UPDATE_JSON: npm("9.0.0", [IMPORTANT]) }).stdout, /🆕/);
  const bad = brief(sb, d, { REPO_FIT_CONFIG: join(sb.home, "cfg3"), REPO_FIT_UPDATE_JSON: "not json" });
  assert.equal(bad.status, 0, bad.out);
  assert.doesNotMatch(bad.stdout, /🆕/);
}));

test("this release explains itself, and the plugin files match it", () => {
  const version = readFileSync(join(ROOT, "VERSION"), "utf8").trim();
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const rel = pkg.repoFit.releases.find((r) => r.version === version);
  assert.ok(rel, `package.json repoFit.releases has an entry for ${version}`);
  assert.ok(typeof rel.why === "string" && rel.why.length > 20 && typeof rel.important === "boolean");
  const plugin = JSON.parse(readFileSync(join(ROOT, ".claude-plugin/plugin.json"), "utf8"));
  assert.equal(plugin.name, "repo-fit");
  assert.equal(plugin.version, version, "bump .claude-plugin/plugin.json with VERSION, or plugin users never get it");
  const market = JSON.parse(readFileSync(join(ROOT, ".claude-plugin/marketplace.json"), "utf8"));
  assert.deepEqual(market.plugins.map((p) => [p.name, p.source]), [["repo-fit", "./"]]);
  assert.ok(!("version" in market.plugins[0]), "version lives in plugin.json only");
});

test("update adds the missing CLAUDE.md to a Codex-only setup made before 0.7.3, and only once", sandboxed((sb) => {
  const d = repo(sb, "codex-only", { commit: true, files: { "notes/a.md": "# A\n" } });
  assert.equal(cli(sb, ["apply", d, "--steps", "A-01,A-10,A-11", "--tool", "codex", "--hooks", "none", "--autosave", "off", "--apply"]).status, 0);
  // Before 0.7.3, a Codex-only setup had AGENTS.md and no CLAUDE.md.
  rmSync(join(d, "CLAUDE.md"));
  write(d, "playbook.json", JSON.stringify({ ...JSON.parse(readFileSync(join(d, "playbook.json"), "utf8")), playbook: "0.7.2" }));
  const dry = cli(sb, ["update", d]).out;
  assert.match(dry, /^--- CLAUDE\.md \(repo\)/m, dry);
  assert.ok(!existsSync(join(d, "CLAUDE.md")), "a dry run writes nothing");
  const done = cli(sb, ["update", d, "--apply"]);
  assert.equal(done.status, 0, done.out);
  assert.match(readFileSync(join(d, "CLAUDE.md"), "utf8"), /^@AGENTS\.md$/m);
  assert.doesNotMatch(cli(sb, ["update", d]).out, /^--- CLAUDE\.md/m, "nothing more to add the second time");
}));

test("update leaves a folder without AGENTS.md alone: no CLAUDE.md is added there", sandboxed((sb) => {
  const d = repo(sb, "no-rulebook", { commit: true, files: { "notes/a.md": "# A\n" } });
  assert.equal(cli(sb, ["apply", d, "--steps", "A-01,A-10", "--tool", "codex", "--hooks", "none", "--autosave", "off", "--apply"]).status, 0);
  assert.ok(!existsSync(join(d, "AGENTS.md")));
  cli(sb, ["update", d, "--apply"]);
  assert.ok(!existsSync(join(d, "CLAUDE.md")));
}));
