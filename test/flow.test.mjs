// The setup flow: one recommended set per kind of repo, a preview of the briefing, one dry run.
import assert from "node:assert/strict";
import { test } from "node:test";
import { cli, git, repo, sandboxed, script, tree } from "./helpers.mjs";

const audit = (sb, d) => JSON.parse(cli(sb, ["audit", d, "--json"]).stdout);
const pkg = JSON.stringify({ name: "app", scripts: { test: "node --test" } });
const codeRepo = (sb, files = {}) =>
  repo(sb, "app", { commit: true, files: { "package.json": pkg, "src/a.js": "export const a = 1;\n", "src/b.js": "export const b = 2;\n", "src/c.js": "export const c = 3;\n", "AGENTS.md": "# Rules\n\nKeep functions small.\n", ...files } });
const notesRepo = (sb, files = {}) => repo(sb, "notes", { commit: true, files: { "notes/one.md": "# One\n", "notes/two.md": "# Two\n", ...files } });

test("a code repo is recommended the briefing, one rulebook and its commands, not notes files", sandboxed((sb) => {
  const rec = audit(sb, codeRepo(sb)).plan.recommended;
  assert.equal(rec.kind, "technical");
  for (const id of ["A-01", "A-10", "D-10"]) assert.ok(rec.steps.includes(id), `${id} in ${rec.steps}`);
  for (const id of ["A-02", "A-03", "A-11", "D-01"]) assert.ok(!rec.steps.includes(id), `${id} not in ${rec.steps}`);
  assert.match(rec.flags, /--hooks brief --autosave off/);
  assert.ok(rec.gains.some((g) => /briefing/.test(g)));
}));

test("a notes repo without rules gets the rulebook, a current view and a board, with autosave", sandboxed((sb) => {
  const rec = audit(sb, notesRepo(sb)).plan.recommended;
  assert.equal(rec.kind, "notes");
  for (const id of ["A-01", "A-10", "A-11", "A-03", "A-02"]) assert.ok(rec.steps.includes(id), `${id} in ${rec.steps}`);
  assert.match(rec.flags, /--hooks all --autosave on/);
}));

test("a repo with its own commit rule gets autosave off, and still the short block, which adds no commit rule", sandboxed((sb) => {
  const rec = audit(sb, notesRepo(sb, { "AGENTS.md": "# Rules\n\nCommit only when asked.\n" })).plan.recommended;
  assert.match(rec.flags, /--autosave off/);
  assert.ok(rec.steps.includes("D-01"), `D-01 in ${rec.steps}`);
}));

test("a rule given as an example of other repos is not read as this repo's commit rule", sandboxed((sb) => {
  const d = notesRepo(sb, { "AGENTS.md": '# Rules\n\n- Respect a repo\'s own rules. Example: a repo that says "commit only when asked" runs with autosave off.\n' });
  assert.equal(audit(sb, d).own.topics.commits, undefined);
}));

test("notes in kit and starter folders are templates, not unlinked notes", sandboxed((sb) => {
  const a = audit(sb, notesRepo(sb, { "kits/starter/LEARNINGS.md": "# Learnings\n", "starter/notes.md": "# Starter\n" }));
  assert.ok(!a.details.orphans.some((f) => /^(kits|starter)\//.test(f)), JSON.stringify(a.details.orphans));
}));

test("the media rule is offered for video or zip files, not for one image", sandboxed((sb) => {
  const img = audit(sb, notesRepo(sb, { "assets/banner.png": "png" }));
  assert.ok(!img.plan.decide.some((s) => s.id === "D-08"));
  const vid = audit(sb, notesRepo(sb, { "media/clip.mp4": "mp4" }));
  assert.ok(vid.plan.decide.some((s) => s.id === "D-08"));
}));

test("linking a CLAUDE.md that differs a lot from AGENTS.md stays out of the recommended set", sandboxed((sb) => {
  const d = codeRepo(sb, { "CLAUDE.md": "# Claude\n\nUse tabs.\nWrite tests first.\nNever touch src/c.js.\n" });
  const a = audit(sb, d);
  assert.ok(a.plan.decide.some((s) => s.id === "D-02"), "D-02 is still offered");
  assert.ok(!a.plan.recommended.steps.includes("D-02"));
}));

test("the audit report opens with the recommended set, before the score", sandboxed((sb) => {
  const out = cli(sb, ["audit", codeRepo(sb)]).stdout;
  assert.ok(out.indexOf("## Recommended set") < out.indexOf("## Verdict"));
  assert.match(out, /--steps A-01,A-10,D-10/);
}));

test("preview shows the briefing and writes nothing", sandboxed((sb) => {
  const d = codeRepo(sb);
  const before = tree(d);
  const r = cli(sb, ["preview", d]);
  assert.equal(r.status, 0, r.out);
  assert.match(r.stdout, /Nothing was written/);
  assert.match(r.stdout, /📍 app/);
  assert.match(r.stdout, /🕘 Recent: .*initial/);
  assert.doesNotMatch(r.stdout, /board .* is missing/);
  assert.deepEqual(tree(d), before);
  assert.equal(git(sb, d, ["status", "--porcelain"]).stdout, "");
}));

test("preview of a notes repo shows the board it would get, empty", sandboxed((sb) => {
  const r = cli(sb, ["preview", notesRepo(sb)]);
  assert.equal(r.status, 0, r.out);
  assert.match(r.stdout, /The board starts empty/);
}));

test("after the recommended set, a repo without a board gets recent commits in the brief, not an error", sandboxed((sb) => {
  const d = codeRepo(sb);
  const rec = audit(sb, d).plan.recommended;
  const r = cli(sb, ["apply", d, "--steps", rec.steps.join(","), ...rec.flags.split(" "), "--apply"]);
  assert.equal(r.status, 0, r.out);
  const b = script(sb, d, "brief.mjs", ["--text"]);
  assert.equal(b.status, 0, b.out);
  assert.doesNotMatch(b.stdout, /is missing/);
  assert.match(b.stdout, /🕘 Recent/);
  assert.equal(script(sb, d, "check.mjs").status, 0, "check passes with only the adopted parts");
}));

test("detect does not offer host files it cannot add", sandboxed((sb) => {
  const d = codeRepo(sb);
  git(sb, d, ["remote", "add", "origin", "https://github.com/someone/app.git"]);
  const j = JSON.parse(cli(sb, ["detect", d, "--json"]).stdout);
  assert.ok(!j.offers.some((o) => o.id === "host"));
}));

test("a repo that already turned autosave off in playbook.json keeps it off", sandboxed((sb) => {
  const rec = audit(sb, notesRepo(sb, { "playbook.json": JSON.stringify({ autosave: false }) })).plan.recommended;
  assert.match(rec.flags, /--autosave off/);
}));

test("preview says 'would start' while the repo has playbook.json but not the brief script", sandboxed((sb) => {
  const r = cli(sb, ["preview", notesRepo(sb, { "playbook.json": JSON.stringify({ playbook: "0.5.0", autosave: false }) })]);
  assert.equal(r.status, 0, r.out);
  assert.match(r.stdout, /would start with after the recommended set/);
}));

test("the brief sets no branch rule: on main with autosave off it says nothing about branches", sandboxed((sb) => {
  const d = codeRepo(sb);
  const rec = audit(sb, d).plan.recommended;
  assert.equal(cli(sb, ["apply", d, "--steps", rec.steps.join(","), ...rec.flags.split(" "), "--apply"]).status, 0);
  const b = script(sb, d, "brief.mjs", ["--text"]).stdout;
  assert.doesNotMatch(b, /never to commit|Work on a branch|wip\//, b);
}));
