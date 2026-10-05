// The setup flow: one recommended set per kind of repo, a preview of the briefing, one dry run.
import assert from "node:assert/strict";
import { test } from "node:test";
import { cli, git, has, read, repo, sandboxed, script, tree, write } from "./helpers.mjs";

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
  assert.match(rec.flags, /--hooks none --autosave off/);
  assert.match(rec.hooksCommand, /hooks .* --hooks brief --apply$/);
  assert.ok(rec.gains.some((g) => /briefing/.test(g)));
}));

test("a notes repo without rules gets the rulebook, a current view and a board, with autosave", sandboxed((sb) => {
  const rec = audit(sb, notesRepo(sb)).plan.recommended;
  assert.equal(rec.kind, "notes");
  for (const id of ["A-01", "A-10", "A-11", "A-03", "A-02"]) assert.ok(rec.steps.includes(id), `${id} in ${rec.steps}`);
  assert.match(rec.flags, /--hooks none --autosave on/);
  assert.match(rec.hooksCommand, /--hooks all --apply$/);
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

test("a code repo is not scored on notes files, and unsaved work on main is never a gap", sandboxed((sb) => {
  const d = codeRepo(sb);
  write(d, "src/d.js", "export const d = 4;\n");
  const a = audit(sb, d);
  for (const id of ["F5", "F6", "F7", "F8", "F9", "F10", "F11"]) assert.equal(a.checks.find((c) => c.id === id).status, "na", id);
  const f19 = a.checks.find((c) => c.id === "F19");
  assert.equal(f19.status, "part", "uncommitted work on main is noted");
  assert.equal(f19.weight, 0);
  const out = cli(sb, ["audit", codeRepo(sb)]).stdout;
  assert.doesNotMatch(out.match(/## Verdict[\s\S]*?## What/)[0], /Current-state page|Unsaved work/);
}));

test("unsaved work on main is fine where the repo's own rules commit on main", sandboxed((sb) => {
  const d = codeRepo(sb, { "AGENTS.md": "# Rules\n\nBranch `main`. Commit finished steps with clear messages.\n" });
  write(d, "src/d.js", "export const d = 4;\n");
  const f19 = audit(sb, d).checks.find((c) => c.id === "F19");
  assert.equal(f19.status, "ok");
}));

test("the recommended set writes no hook files; the person turns the briefing on with `hooks`", sandboxed((sb) => {
  const d = codeRepo(sb, { ".claude/settings.json": JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: "command", command: "their-own.sh" }] }] } }) });
  const rec = audit(sb, d).plan.recommended;
  assert.equal(cli(sb, ["apply", d, "--steps", rec.steps.join(","), ...rec.flags.split(" "), "--apply"]).status, 0);
  assert.doesNotMatch(read(d, ".claude/settings.json"), /scripts\/playbook/, "the assistant's apply adds no hook");
  assert.ok(!has(d, ".codex/hooks.json"));
  const dry = cli(sb, ["hooks", d]);
  assert.equal(dry.status, 0, dry.out);
  assert.match(dry.out, /Dry run/);
  assert.doesNotMatch(read(d, ".claude/settings.json"), /scripts\/playbook/, "the dry run writes nothing");
  const on = cli(sb, ["hooks", d, "--apply"]);
  assert.equal(on.status, 0, on.out);
  assert.match(on.out, /The briefing is on/);
  const s = read(d, ".claude/settings.json");
  assert.match(s, /scripts\/playbook\/brief\.mjs/);
  assert.match(s, /their-own\.sh/, "the repo's own hook stays");
  assert.match(s, /autosave\.mjs\\" --event stop/, "the end-of-reply reminder comes with the briefing");
  assert.doesNotMatch(s, /precompact/, "no autosave before compaction when autosave is off");
  assert.equal(JSON.parse(read(d, "playbook.json")).hooks, "brief");
  assert.match(cli(sb, ["hooks", d, "--apply"]).out, /already on/);
  assert.equal(cli(sb, ["undo", d, "--apply"]).status, 0);
  assert.doesNotMatch(read(d, ".claude/settings.json"), /scripts\/playbook/, "undo turns it off");
}));

test("`hooks` refuses a repo without the briefing script", sandboxed((sb) => {
  const r = cli(sb, ["hooks", codeRepo(sb), "--apply"]);
  assert.equal(r.status, 2);
  assert.match(r.out, /briefing script is not there yet/);
}));

test("an older setup is told what is new, and a skipped step that changed gets a second look", sandboxed((sb) => {
  const pj = { playbook: "0.5.0", tools: ["claude-code"], skipped: { "D-01": "the block wants a table board" } };
  const d = notesRepo(sb, { "playbook.json": JSON.stringify(pj), "AGENTS.md": "# Rules\n" });
  const out = cli(sb, ["status", d]).out;
  assert.match(out, /🆕 New since 0\.5\.0:/);
  assert.match(out, /774 to 293 words/);
  assert.match(out, /👀 Worth a second look: .*D-01.*"the block wants a table board".*no longer needs a table board/);
  assert.match(out, /skip <repo> D-01 --remove --apply, then apply <repo> --steps D-01/);
  const current = notesRepo(sb, { "playbook.json": JSON.stringify({ ...pj, playbook: "0.6.0" }), "AGENTS.md": "# Rules\n" });
  assert.doesNotMatch(cli(sb, ["status", current]).out, /New since|second look/);
}));

test("what repo-fit writes claims nothing that is off: CLAUDE.md, and .playbook/ stays out of git status", sandboxed((sb) => {
  const d = codeRepo(sb);
  const rec = audit(sb, d).plan.recommended;
  assert.equal(cli(sb, ["apply", d, "--steps", rec.steps.join(","), ...rec.flags.split(" "), "--apply"]).status, 0);
  assert.doesNotMatch(read(d, "CLAUDE.md"), /autosave|hooks? .*print/i, "CLAUDE.md does not say the briefing or autosave is on");
  assert.doesNotMatch(git(sb, d, ["status", "--porcelain"]).stdout, /\.playbook/, "receipts and backups stay local");
}));

test("an older .playbook/.gitignore is widened so receipts stop showing as untracked", sandboxed((sb) => {
  const d = codeRepo(sb, { ".playbook/.gitignore": "backups/\nundone/\n" });
  const rec = audit(sb, d).plan.recommended;
  assert.equal(cli(sb, ["apply", d, "--steps", rec.steps.join(","), ...rec.flags.split(" "), "--apply"]).status, 0);
  assert.equal(read(d, ".playbook/.gitignore"), "*\n");
}));

test("a mixed repo is not offered a blank current-view page in the one-click set", sandboxed((sb) => {
  const d = repo(sb, "mixed", { commit: true, files: { "package.json": pkg, "src/a.js": "1\n", "docs/one.md": "# One\n", "docs/two.md": "# Two\n", "docs/three.md": "# Three\n" } });
  const rec = audit(sb, d).plan.recommended;
  assert.equal(rec.kind, "mixed");
  assert.ok(!rec.steps.includes("A-03"), rec.steps.join());
}));

// The end-of-reply reminder with autosave off: a code repo with the briefing and reminder turned on.
function reminderRepo(sb) {
  const d = codeRepo(sb);
  const rec = audit(sb, d).plan.recommended;
  assert.equal(cli(sb, ["apply", d, "--steps", rec.steps.join(","), ...rec.flags.split(" "), "--apply"]).status, 0);
  assert.equal(cli(sb, ["hooks", d, "--apply"]).status, 0);
  git(sb, d, ["add", "-A"]);
  git(sb, d, ["commit", "-q", "-m", "repo-fit"]);
  return d;
}
const stop = (sb, d, session) => script(sb, d, "autosave.mjs", ["--event", "stop", "--host", "Claude Code"], { input: JSON.stringify({ session_id: session }) });

test("with autosave off, the reminder asks once whether anything is worth keeping, and never asks to commit", sandboxed((sb) => {
  const d = reminderRepo(sb);
  const head = git(sb, d, ["rev-parse", "HEAD"]).stdout;
  write(d, "src/a.js", "export const a = 2;\n");
  const r = stop(sb, d, "s1");
  assert.equal(r.status, 0, r.out);
  const out = JSON.parse(r.stdout);
  assert.equal(out.decision, "block");
  assert.match(out.reason, /Before you finish: files changed \(src\/a\.js\) but no note, current view or log did/);
  assert.match(out.reason, /If there is nothing worth keeping, say so in one line and stop\. Do not commit unless/);
  assert.doesNotMatch(out.reason, /Capture by default|then commit\./);
  assert.equal(git(sb, d, ["rev-parse", "HEAD"]).stdout, head, "nothing is committed");
  assert.equal(stop(sb, d, "s1").stdout.trim(), "", "once per session");
}));

test("the reminder stays quiet when something was written down, or nothing changed", sandboxed((sb) => {
  const d = reminderRepo(sb);
  assert.equal(stop(sb, d, "s1").stdout.trim(), "", "nothing changed");
  write(d, "src/a.js", "export const a = 2;\n");
  write(d, "docs/notes.md", "# Notes\n\nWhy a is 2.\n");
  assert.equal(stop(sb, d, "s2").stdout.trim(), "", "a note was updated");
}));

test("status tells a repo with the old briefing-only setup about the reminder", sandboxed((sb) => {
  const d = reminderRepo(sb);
  write(d, ".claude/settings.json", JSON.stringify({ hooks: { SessionStart: [{ hooks: [{ type: "command", command: "node scripts/playbook/brief.mjs --hook" }] }] } }));
  assert.match(cli(sb, ["status", d]).out, /end-of-reply reminder .* is not on\. The person turns it on with: repo-fit hooks/);
}));
