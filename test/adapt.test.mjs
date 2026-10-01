// Adapt first: on a mature repo with its own rules, checks and hooks, repo-fit assesses what is there,
// says what to leave as is, and adapts its own pieces instead of competing with them.
import assert from "node:assert/strict";
import { test } from "node:test";
import { cli, git, has, json, read, repo, sandboxed, script, tree, write } from "./helpers.mjs";

const words = (n) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");
const flags = ["--tool", "claude", "--hooks", "brief", "--autosave", "off"];
const apply = (sb, d, steps, extra = []) => cli(sb, ["apply", d, "--steps", steps, ...flags, ...extra]);
const audit = (sb, d) => JSON.parse(cli(sb, ["audit", d, "--json"]).stdout);
const block = (t) => t.match(/<!-- playbook:core v\S+ begin[\s\S]*?<!-- playbook:core end -->/)?.[0] ?? "";

const AGENTS = `# Rules for this notes repo

- source-archive/ is append-only. Never edit, rename or delete an archived file.
- \`ledger/\` is append-only too.
- decisions/ records decisions and their lifecycle. A proposal is not an accepted decision.

## Capture

1. **Save the source.** Keep the exact wording in \`source-archive/inputs/\` with a manifest.
2. Update the topic note in \`notes/\`.

**Definition of done:** \`python3 scripts/check_notes.py\`, then \`python3 scripts/validate_notes.py --strict\`, then a local commit.
`;

// A repo shaped like a mature notes repo: its own rules, checks, hooks, caps and registers. Generic names only.
function mature(sb, { policy = true, big = false, playbook = null } = {}) {
  const files = {
    "AGENTS.md": AGENTS,
    "CLAUDE.md": "@AGENTS.md\n",
    "README.md": `# Notes\n\nA notes repo for a small team. Start at 00-home/current.md. ${words(40)}\n${policy ? "\n## Big files\n\nVideos and decks live on the shared drive; two signed PDFs are kept in Git on purpose.\n" : ""}`,
    "00-home/current.md": `---\nid: home\nsource_refs: [${words(200)}]\n---\n# Current\n\n${words(1150)}\n`,
    "00-home/log.md": "# Log\n",
    "00-home/open-questions.md": "# Open questions\n",
    "00-home/hubs/README.md": "# Hubs\n",
    "decisions/accepted/first.md": "# First\n",
    "decisions/proposed/second.md": "# Second\n",
    "source-archive/inputs/20260101-kickoff/manifest.json": "{}\n",
    "source-archive/inputs/20260101-kickoff/notes.md": "See [gone](missing-a.md).\n",
    "ledger/2026.md": "# Ledger\n\nSee [gone](missing-b.md).\n",
    "outputs/README.md": "# Outputs\n\n- 20260101-report\n",
    "outputs/20260101-report/README.md": "# Report\n",
    "outputs/20260101-report/results/case.md": "See [gone](../missing-c.md).\n",
    "notes/topic.md": "# Topic\n\nSee [gone](missing-d.md).\n",
    "data/people/registry.json": "{}\n",
    "system/templates/note.md": "# Note\n",
    "scripts/check_notes.py": 'RECORDERS = {"Codex", "Claude Code"}\nCURRENT_MAX_WORDS = 1200  # 00-home/current.md body\n',
    "scripts/validate_notes.py": "# validator\n",
    ".claude/settings.json": `${JSON.stringify({ hooks: { SessionStart: [{ hooks: [{ type: "command", command: ".claude/hooks/identity.sh" }] }], Stop: [{ hooks: [{ type: "command", command: "python3 scripts/check_notes.py --hook" }] }] } }, null, 2)}\n`,
    ".claude/commands/close.md": "# Close the session\n",
    ".github/PULL_REQUEST_TEMPLATE.md": "# PR\n",
    "tools/video/AGENTS.md": "# Rules for the video sub-project\n",
    ".gitignore": "*.mov\n",
  };
  if (playbook) files["playbook.json"] = `${JSON.stringify(playbook, null, 2)}\n`;
  const d = repo(sb, "mature", { files });
  if (big) {
    write(d, "media/signed.pdf", "x".repeat(6 * 1024 * 1024));
    write(d, "media/raw.mov", "x".repeat(6 * 1024 * 1024));
  }
  git(sb, d, ["add", "-A"]);
  git(sb, d, ["commit", "-q", "-m", "initial"]);
  return d;
}

test("A2: the audit lists where the core block would contradict the repo's rules", sandboxed((sb) => {
  const a = audit(sb, mature(sb));
  const topics = a.details.conflicts.map((c) => c.topic).sort();
  assert.deepEqual(topics, ["checks", "commits", "decisions", "inputs"]);
  const d01 = a.plan.decide.find((s) => s.id === "D-01");
  assert.match(d01.step, /⚠️ conflicts with existing rules \(4\)/);
  const md = cli(sb, ["audit", mature(sb)]).out;
  assert.match(md, /## Conflicts with the core block/);
  assert.match(md, /\| inputs \| .* \| AGENTS\.md:9 \|/);
}));

test("A2: D-01 writes the slim block, which defers to the repo on every topic it covers", sandboxed((sb) => {
  const d = mature(sb);
  const r = apply(sb, d, "D-01", ["--apply"]);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /the slim block defers to this repo's own rules on checks, commits, decisions, inputs/);
  const b = block(read(d, "AGENTS.md"));
  assert.match(b, /Run this repo's own checks \(`python3 scripts\/check_notes\.py`, `python3 scripts\/validate_notes\.py --strict` and the others its rules name\)/);
  assert.match(b, /goes to `source-archive\/inputs\/`, saved the way this repo's own rules above say/);
  assert.match(b, /binding only as this repo's own decision rules above define it \(`decisions\/`\)/);
  assert.match(b, /When to commit follows this repo's own rules above/);
  assert.doesNotMatch(b, /scripts\/playbook\/|Autosave|wip\/|YYYY-MM-DD-topic|docs\//, "nothing the repo does not have, nothing that competes");
}));

test("A2: a repo without such rules still gets the full block", sandboxed((sb) => {
  const d = repo(sb, "plain", { files: { "AGENTS.md": "# Rules\n\nBe kind.\n\n- Never commit on main.\n- Never commit secrets or .env files.\n" } });
  assert.equal(cli(sb, ["init", d, "--tool", "claude"]).status, 0);
  assert.equal(block(read(d, "AGENTS.md")), "", "init never edits an AGENTS.md that exists");
  assert.equal(apply(sb, d, "D-01", ["--apply"]).status, 0);
  const full = block(read(d, "AGENTS.md"));
  assert.match(full, /Run `node scripts\/playbook\/check\.mjs`\. Commit\./);
  assert.match(full, /Autosave \(see `playbook\.json`\)/);
}));

test("B1: protected paths are listed only, never offered for fixing", sandboxed((sb) => {
  const a = audit(sb, mature(sb));
  assert.deepEqual(a.details.brokenLinks.map((b) => b.file), ["notes/topic.md"]);
  const prot = a.details.protectedFindings.brokenLinks.map((b) => b.file).sort();
  assert.deepEqual(prot, ["ledger/2026.md", "outputs/20260101-report/results/case.md", "source-archive/inputs/20260101-kickoff/notes.md"]);
  assert.match(a.plan.decide.find((s) => s.id === "D-03").step, /Fix 1 broken link/);
  const paths = a.details.protected.map((p) => p.path).sort();
  assert.deepEqual(paths, ["ledger/", "outputs/", "source-archive/"]);
  assert.ok(!a.details.orphans.some((f) => f.startsWith("ledger/")));
}));

test("B1: protectedPaths reach playbook.json and keep the review queue out of them", sandboxed((sb) => {
  const d = mature(sb);
  assert.equal(apply(sb, d, "A-01,A-10", ["--apply"]).status, 0);
  assert.deepEqual(json(d, "playbook.json").protectedPaths.sort(), ["ledger/", "source-archive/"]);
  const c = script(sb, d, "check.mjs");
  assert.doesNotMatch(c.out, /ledger\//, c.out);
}));

test("B2: a dry run shows what new files will hold", sandboxed((sb) => {
  const d = mature(sb);
  const r = apply(sb, d, "A-01,A-08,A-10");
  assert.match(r.out, /"currentWordCap": 1200/, "playbook.json is shown in full");
  assert.match(r.out, /"recorders": \[/);
  assert.match(r.out, /Same file as repo-fit's own `scripts\/playbook\/check\.mjs`/);
  assert.match(r.out, /# Learnings|# Lessons/i, "a new note shows its first lines");
  const all = apply(sb, d, "A-10", ["--show"]);
  assert.match(all.out, /process\.exit\(1\)/, "--show prints the scripts in full");
}));

test("C1: the audit reads an existing playbook.json, and two caps that disagree are flagged", sandboxed((sb) => {
  const d = mature(sb, { playbook: { playbook: "0.4.0", currentWordCap: 900, paths: { people: "data/people/registry.json" } } });
  const a = audit(sb, d);
  assert.equal(a.mapping.people, "data/people/registry.json");
  const f5 = a.checks.find((c) => c.id === "F5");
  assert.equal(f5.status, "part");
  assert.match(f5.suggest, /Two caps disagree: set currentWordCap to 1200/);
  assert.ok(a.details.conflicts.some((c) => c.topic === "word cap"));
}));

test("C3: a written big-files policy counts, and ignored files are told apart from tracked ones", sandboxed((sb) => {
  const withPolicy = audit(sb, mature(sb, { big: true }));
  const f16 = withPolicy.checks.find((c) => c.id === "F16");
  assert.equal(f16.status, "ok");
  assert.match(f16.found, /2 files over 5 MB: 1 tracked in Git, 1 ignored \(local only\); written policy: "Big files" \(README\.md:\d+\)/);
  assert.ok(!withPolicy.plan.decide.some((s) => s.id === "D-05"));
}));

test("C3: tracked big files with no written policy are still a gap", sandboxed((sb) => {
  const a = audit(sb, mature(sb, { big: true, policy: false }));
  assert.equal(a.checks.find((c) => c.id === "F16").status, "missing");
  assert.ok(a.plan.decide.some((s) => s.id === "D-05"));
}));

test("C4: status is not 'Behind' for parts that were never adopted", sandboxed((sb) => {
  const d = mature(sb);
  assert.equal(apply(sb, d, "A-01", ["--apply"]).status, 0);
  assert.deepEqual(json(d, "playbook.json").adopted, ["A-01"]);
  const s = cli(sb, ["status", d]);
  assert.equal(s.status, 0, s.out);
  assert.doesNotMatch(s.out, /Behind/);
  assert.match(s.out, /Not adopted: the core block in AGENTS\.md \(D-01\)/);
  assert.match(s.out, /Not adopted: the scripts and hooks \(A-10\)/);
  const u = cli(sb, ["update", d, "--apply"]);
  assert.doesNotMatch(read(d, "AGENTS.md"), /playbook:core/, `update never adds a part: ${u.out}`);
  assert.ok(!has(d, "scripts/playbook"));
}));

test("C4: a skip is recorded with its reason, and audit, status and apply respect it", sandboxed((sb) => {
  const d = mature(sb);
  assert.equal(apply(sb, d, "A-01", ["--apply"]).status, 0);
  const dry = cli(sb, ["skip", d, "D-01", "--reason", "conflicts with our rules"]);
  assert.match(dry.out, /Dry run/);
  assert.equal(json(d, "playbook.json").skipped, undefined, "a dry run writes nothing");
  assert.equal(cli(sb, ["skip", d, "D-01", "--reason", "conflicts with our rules", "--apply"]).status, 0);
  assert.deepEqual(json(d, "playbook.json").skipped, { "D-01": "conflicts with our rules" });
  assert.match(cli(sb, ["status", d]).out, /Skipped on purpose: the core block in AGENTS\.md \(D-01\): conflicts with our rules/);
  const a = audit(sb, d);
  assert.ok(!a.plan.decide.some((s) => s.id === "D-01"));
  assert.ok(a.leave.some((l) => l.what === "D-01 skipped on purpose"));
  const r = apply(sb, d, "D-01", ["--apply"]);
  assert.match(r.out, /D-01: skipped on purpose \(conflicts with our rules\)/);
  assert.doesNotMatch(read(d, "AGENTS.md"), /playbook:core/);
  assert.equal(cli(sb, ["skip", d, "D-01", "--remove", "--apply"]).status, 0);
  assert.ok(audit(sb, d).plan.decide.some((s) => s.id === "D-01"), "removing the skip offers the step again");
}));

test("C4: scripts adopted without hooks do not warn about missing hooks", sandboxed((sb) => {
  const d = repo(sb, "nohooks", { files: { "AGENTS.md": "# Rules\n" } });
  assert.equal(cli(sb, ["apply", d, "--steps", "A-01,A-10", "--tool", "claude", "--hooks", "none", "--autosave", "off", "--apply"]).status, 0);
  assert.equal(json(d, "playbook.json").hooks, "none");
  const s = cli(sb, ["status", d]);
  assert.doesNotMatch(s.out, /hooks are not set up/, s.out);
}));

test("C5: A-01 copies the cap from the repo's own check script, and check counts the body only", sandboxed((sb) => {
  const d = mature(sb);
  const a = audit(sb, d);
  const f5 = a.checks.find((c) => c.id === "F5");
  assert.equal(f5.status, "ok");
  assert.match(f5.found, /body 1152 words; word cap 1200 \(stated in scripts\/check_notes\.py:2\)/);
  assert.equal(apply(sb, d, "A-01,A-10", ["--apply"]).status, 0);
  assert.equal(json(d, "playbook.json").currentWordCap, 1200);
  const c = script(sb, d, "check.mjs");
  assert.doesNotMatch(c.out, /over the cap/, "the whole file is over 1200 words, the body is not");
}));

test("C6: A-10 is a decision when the repo has its own hooks and checks, and they are kept", sandboxed((sb) => {
  const d = mature(sb);
  const a = audit(sb, d);
  assert.ok(!a.plan.safe.some((s) => s.id === "A-10"));
  const a10 = a.plan.decide.find((s) => s.id === "A-10");
  assert.match(a10.why, /Repo already has: Claude Code SessionStart hook `\.claude\/hooks\/identity\.sh`; Claude Code Stop hook `python3 scripts\/check_notes\.py --hook`; check script `scripts\/check_notes\.py`/);
  const r = apply(sb, d, "A-10");
  assert.match(r.out, /A-10: repo already has .*identity\.sh/);
  assert.equal(apply(sb, d, "A-10", ["--apply"]).status, 0);
  const hooks = JSON.stringify(json(d, ".claude/settings.json"));
  assert.match(hooks, /identity\.sh/);
  assert.match(hooks, /check_notes\.py --hook/);
}));

test("C7: with work tracked elsewhere, a board is an optional decision, not a safe step", sandboxed((sb) => {
  const a = audit(sb, mature(sb));
  assert.ok(!a.plan.safe.some((s) => s.id === "A-02"));
  assert.match(a.plan.decide.find((s) => s.id === "A-02").options, /^leave as is/);
}));

test("C7: work kept in the current view and open questions counts as an equivalent, not a gap", sandboxed((sb) => {
  const d = mature(sb);
  const a = audit(sb, d);
  assert.equal(a.checks.find((c) => c.id === "F8").status, "equivalent");
  assert.ok(a.leave.some((l) => /Tracked work/.test(l.what)));
  const md = cli(sb, ["audit", d]).out;
  assert.match(md, /\| F8 \| Tracked work .* \| 🔁 \|/);
  assert.match(md, /\(1 through an equivalent the repo already has, 🔁\)/);
  assert.match(md, /## Leave as is \(the repo already covers it\)/);
}));

test("D1: recorders come from the repo's own list, and the owner only when named", sandboxed((sb) => {
  const d = mature(sb);
  assert.equal(apply(sb, d, "A-01", ["--apply"]).status, 0);
  assert.deepEqual(json(d, "playbook.json").recorders, ["Codex", "Claude Code"]);
  const p = repo(sb, "plainrec", { files: { "AGENTS.md": "# Rules\n" } });
  assert.equal(apply(sb, p, "A-01", ["--apply"]).status, 0);
  assert.ok(!json(p, "playbook.json").recorders.includes("Test Person"), "git user.name is not added unasked");
  const q = repo(sb, "ownerrec", { files: { "AGENTS.md": "# Rules\n" } });
  assert.equal(apply(sb, q, "A-01", ["--owner", "Sam Example", "--apply"]).status, 0);
  assert.ok(json(q, "playbook.json").recorders.includes("Sam Example"));
}));

test("D2: tool and config folders are not counted as unlinked notes", sandboxed((sb) => {
  const a = audit(sb, mature(sb));
  assert.ok(!a.details.orphans.some((f) => f.startsWith(".")), a.details.orphans.join(", "));
  assert.ok(!a.details.orphans.includes("tools/video/AGENTS.md"), "a nested project's rule file is not a note");
  assert.ok(!a.details.orphans.includes("system/templates/note.md"), "templates are left out, as in the review queue");
}));

test("D3: undo --force moves a changed file aside instead of leaving it, and never deletes it", sandboxed((sb) => {
  const d = repo(sb, "u", { files: { "AGENTS.md": "# Rules\n" } });
  assert.equal(apply(sb, d, "A-08", ["--apply"]).status, 0);
  write(d, "LEARNINGS.md", "# Lessons\n\nmy own edit\n");
  const plain = cli(sb, ["undo", d, "--apply"]);
  assert.match(plain.out, /changed since it was created\. Left in place\. To remove it anyway, run undo again with --force/);
  assert.ok(has(d, "LEARNINGS.md"));
  const forced = cli(sb, ["undo", d, "--force", "--apply"]);
  assert.equal(forced.status, 0, forced.out);
  assert.ok(!has(d, "LEARNINGS.md"));
  assert.ok(tree(d, ".playbook/undone").some((f) => f.endsWith("/LEARNINGS.md")), "the changed file was moved aside, with the user's edit");
}));

test("the Codex session brief puts its context where Codex reads it", sandboxed((sb) => {
  const d = repo(sb, "cx");
  assert.equal(cli(sb, ["init", d, "--tool", "codex"]).status, 0);
  const r = script(sb, d, "brief.mjs", ["--hook", "--format", "codex"]);
  const j = JSON.parse(r.stdout);
  assert.equal(j.hookSpecificOutput.hookEventName, "SessionStart");
  assert.ok(j.hookSpecificOutput.additionalContext.includes("cx"));
  assert.equal(j.additionalContext, undefined);
  assert.equal(j.systemMessage, undefined, "Codex shows systemMessage as a warning");
}));
