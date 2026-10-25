// What a folder keeps out of Git stays out of everything repo-fit writes or reports: the map, the index pages, open
// work and the fit check. And a rulebook never sends sessions to a MAP.md that a fresh copy will not have.
import assert from "node:assert/strict";
import { test } from "node:test";
import { pages } from "../scripts/playbook/map.mjs";
import { cli, git, has, read, repo, sandboxed, script, write } from "./helpers.mjs";

const ME = { REPO_FIT_TODAY: "2026-10-25", GIT_AUTHOR_NAME: "Test Person", GIT_AUTHOR_EMAIL: "test@example.com", GIT_COMMITTER_NAME: "Test Person", GIT_COMMITTER_EMAIL: "test@example.com" };
const SETUP = ["--tool", "claude", "--hooks", "none", "--autosave", "off", "--apply"];

test("files Git ignores never reach the map, the index pages, open work or the fit check", sandboxed((sb) => {
  const d = repo(sb, "ig", { commit: true, files: {
    ".gitignore": "private-calls/\nsecret-plan.md\n",
    "notes/a.md": "# A\n\n- [ ] Visible task\n",
    "notes/b.md": "# B\n\nSee [a](a.md).\n",
    "private-calls/one.md": "# One\n\n- [ ] Hidden task\n\nSee [gone](gone.md).\n",
    "private-calls/two.md": "# Two\n",
    "notes/secret-plan.md": "# Secret\n\nTODO: hidden too\n",
  } });
  const p = pages(d);
  const map = p.get("MAP.md");
  assert.doesNotMatch(map, /private-calls|secret-plan/);
  assert.match(map, /\*\*Open work:\*\* 1 item in 1 note\./);
  assert.ok(![...p.keys()].some((k) => k.startsWith("private-calls/")), "no index page inside an ignored folder");
  assert.doesNotMatch(p.get("notes/INDEX.md") ?? "", /secret-plan/);

  assert.equal(cli(sb, ["apply", d, "--steps", "A-01,A-10,A-13", ...SETUP], { env: ME }).status, 0);
  assert.ok(!has(d, "private-calls/INDEX.md"));
  const open = script(sb, d, "map.mjs", ["--open"]).out;
  assert.doesNotMatch(open, /Hidden task|hidden too/);
  const check = script(sb, d, "check.mjs").out;
  assert.doesNotMatch(check, /private-calls|secret-plan|gone\.md/, check);
  const status = cli(sb, ["status", d], { env: ME }).out;
  assert.doesNotMatch(status, /private-calls|secret-plan/, status);
}));

test("when Git ignores MAP.md, the pointer starts at README.md, audit offers the fix and status warns", sandboxed((sb) => {
  const d = repo(sb, "pt", { commit: true, files: { ".gitignore": "MAP.md\n", "notes/a.md": "# A\n\nNote.\n" } });
  // A pointer from an older run still sends sessions to MAP.md.
  assert.equal(cli(sb, ["apply", d, "--steps", "A-01,A-10,A-11,A-13", ...SETUP], { env: ME }).status, 0);
  const agents = read(d, "AGENTS.md");
  git(sb, d, ["add", "-A"]);
  git(sb, d, ["commit", "-q", "-m", "setup"]);
  const old = `${agents.trimEnd()}\n\n<!-- repo-fit:pointer begin -->\n**Start at [MAP.md](MAP.md).** It lists every area.\n<!-- repo-fit:pointer end -->\n`;
  write(d, "AGENTS.md", old); // as an older version left it

  const status = cli(sb, ["status", d], { env: ME }).out;
  assert.match(status, /AGENTS\.md sends every session to MAP\.md, but Git keeps MAP\.md out/, status);
  assert.match(status, /--steps D-11/);
  assert.match(status, /Not checked: files inside code folders/);

  const plan = JSON.parse(cli(sb, ["audit", d, "--json"], { env: ME }).stdout).plan;
  assert.ok(plan.decide.some((s) => s.id === "D-11" && /README\.md/.test(s.step)), JSON.stringify(plan.decide));
  assert.equal(cli(sb, ["apply", d, "--steps", "D-11", "--apply"], { env: ME }).status, 0);
  const now = read(d, "AGENTS.md");
  assert.match(now, /\*\*Start at \[README\.md\]\(README\.md\)\.\*\*/);
  assert.doesNotMatch(now, /Start at \[MAP\.md\]/);
  assert.equal(now.match(/repo-fit:pointer begin/g).length, 1, "one pointer, replaced in place");
  assert.doesNotMatch(cli(sb, ["status", d], { env: ME }).out, /sends every session to MAP\.md/);
}));

test("a new rulebook in a folder that ignores MAP.md points at README.md from the start", sandboxed((sb) => {
  const d = repo(sb, "pn", { commit: true, files: { ".gitignore": "MAP.md\n", "notes/a.md": "# A\n\nNote.\n" } });
  assert.equal(cli(sb, ["apply", d, "--steps", "A-01,A-10,A-11,A-13,D-11", ...SETUP], { env: ME }).status, 0);
  assert.match(read(d, "AGENTS.md"), /\*\*Start at \[README\.md\]\(README\.md\)\.\*\*/);
}));
