// Patterns from the first real sessions with 0.7.x (synthetic copies, never real data): a website's own folders,
// archived copies of other projects in outputs/, a person who wants the briefing without the end-of-reply reminder,
// tool clutter left unsaved, and the checker on a folder that is already organized.
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkTranscript } from "../dev/transcript-check.mjs";
import { pages } from "../scripts/playbook/map.mjs";
import { cli, git, has, read, repo, sandboxed, script, write } from "./helpers.mjs";

const ME = { REPO_FIT_TODAY: "2026-10-06", GIT_AUTHOR_NAME: "Test Person", GIT_AUTHOR_EMAIL: "test@example.com", GIT_COMMITTER_NAME: "Test Person", GIT_COMMITTER_EMAIL: "test@example.com" };

test("in a folder that is a website, the site's own folders get no index page; the map links the folder itself", sandboxed((sb) => {
  const d = repo(sb, "site", { files: {
    "package.json": JSON.stringify({ name: "site", scripts: { build: "astro build" } }),
    "astro.config.mjs": "export default {};\n",
    "content/en/blog/a.md": "---\ntitle: A\n---\nPost A.\n",
    "content/en/blog/b.md": "---\ntitle: B\n---\nPost B.\n",
    "docs/guide.md": "# Guide\n\nHow it works.\n",
  } });
  const p = pages(d);
  assert.ok(!p.has("content/INDEX.md"), "the site owns content/");
  assert.ok(p.has("docs/INDEX.md"), "a normal notes folder still gets its index");
  assert.match(p.get("MAP.md"), /\[content\/\]\(content\/\): .*the website uses these files/);
}));

test("archived copies in outputs/ are neither broken links nor open work", sandboxed((sb) => {
  const d = repo(sb, "out", { commit: true, files: {
    "notes/plan.md": "# Plan\n\n- [ ] Real task\n",
    "outputs/partner-copy/README.md": "# Partner\n\nSee [governance](./GOVERNANCE.md).\n\n- [ ] Their task\n",
  } });
  assert.equal(cli(sb, ["apply", d, "--steps", "A-01,A-10", "--tool", "claude", "--hooks", "none", "--autosave", "off", "--apply"], { env: ME }).status, 0);
  const c = script(sb, d, "check.mjs");
  assert.doesNotMatch(c.out, /broken link \.\/GOVERNANCE\.md/, c.out);
  const map = pages(d).get("MAP.md");
  assert.match(map, /Real task/);
  assert.doesNotMatch(map, /Their task/);
}));

test("--hooks briefing turns on the briefing without the end-of-reply reminder, and a later run keeps it that way", sandboxed((sb) => {
  const d = repo(sb, "hk", { commit: true, files: { "notes/a.md": "# A\n\nNote.\n" } });
  assert.equal(cli(sb, ["apply", d, "--steps", "A-01,A-10", "--tool", "claude", "--hooks", "none", "--autosave", "off", "--apply"], { env: ME }).status, 0);
  assert.equal(cli(sb, ["hooks", d, "--hooks", "briefing", "--apply"], { env: ME }).status, 0);
  const s1 = read(d, ".claude/settings.json");
  assert.match(s1, /brief\.mjs/);
  assert.doesNotMatch(s1, /autosave\.mjs/);
  assert.equal(JSON.parse(read(d, "playbook.json")).hooks, "briefing");
  cli(sb, ["hooks", d, "--apply"], { env: ME });
  assert.doesNotMatch(read(d, ".claude/settings.json"), /autosave\.mjs/, "a re-run keeps the person's choice");
}));

test("the safety snapshot leaves tool clutter out (.serena/, caches)", sandboxed((sb) => {
  const d = repo(sb, "clut", { commit: true, files: { "notes/a.md": "# A\n\nNote.\n" } });
  write(d, ".serena/cache/x.pkl", "cache");
  write(d, "tools/__pycache__/m.pyc", "pyc");
  write(d, "loose.md", "# Loose\n\nAt the top.\n");
  const code = cli(sb, ["organize", d], { env: ME }).stdout.match(/--apply --plan (\w+)/)[1];
  assert.equal(cli(sb, ["organize", d, "--apply", "--plan", code], { env: ME }).status, 0);
  const saved = git(sb, d, ["show", "--name-only", "--format=", "HEAD"]).stdout;
  assert.match(saved, /loose\.md/);
  assert.doesNotMatch(saved, /\.serena|__pycache__/);
}));

test("checker: a folder already organized has no before/after to show, so asking about the setup is fine", () => {
  const line = (o) => JSON.stringify(o);
  const start = line({ type: "user", message: { content: "<command-name>/repo-fit</command-name>" } });
  const run = line({ type: "assistant", message: { content: [{ type: "tool_use", id: "o1", name: "Bash", input: { command: "node /x/bin/repo-fit.mjs organize /r" } }] } });
  const out = line({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "o1", content: "# r is already organized\n\n✅ Nothing to move." }] } });
  const ask = line({ type: "assistant", message: { content: [{ type: "tool_use", id: "q1", name: "AskUserQuestion", input: { questions: [{ question: "Set up the briefing?" }] } }] } });
  assert.ok(checkTranscript([start, run, out, ask].join("\n")).ok);
});
