// Deep mode, sweep 1: everything that is not code. repo-fit looks inside every folder (read-only), the assistant writes
// a plan file, repo-fit checks it and shows one screen, and after one yes applies it in a separate working copy (a Git
// worktree) on its own branch, one commit per step, each step proven. A step that fails is taken back and reported. The
// person's folder, branch and files never change. Synthetic fixtures only.
import assert from "node:assert/strict";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { makeFixture } from "../dev/fixtures.mjs";
import { cli, git, read, repo, sandboxed, write } from "./helpers.mjs";

const ME = { REPO_FIT_TODAY: "2026-10-25", GIT_AUTHOR_NAME: "Test Person", GIT_AUTHOR_EMAIL: "test@example.com", GIT_COMMITTER_NAME: "Test Person", GIT_COMMITTER_EMAIL: "test@example.com" };
const BRANCH = "repo-fit/deep-2026-10-25";
const deep = (sb, dir, extra = []) => cli(sb, ["deep", dir, "--sweep", "docs", ...extra], { env: ME });
const head = (sb, dir) => git(sb, dir, ["rev-parse", "HEAD"]).stdout.trim();
const status = (sb, dir) => git(sb, dir, ["status", "--porcelain"]).stdout;
const lines = (text) => text.split("\n").length - 1;

// What an assistant would write after reading the documents of the field-docs fixture.
function planFor(sb, dir, change = (p) => p) {
  const plan = {
    sweep: "docs",
    base: head(sb, dir),
    steps: [
      { title: "Copies to the archive", why: "Exact copies go to archive/, so each document has one home. Nothing is deleted.", moves: [
        { from: "notes/overview-old.md", to: "archive/overview-old.md", why: "same as docs/overview.md" },
        { from: "public/overview-copy.md", to: "archive/overview-copy.md", why: "same as docs/overview.md; public/ ships to visitors" },
      ] },
      { title: "Documents by kind", why: "One docs/ folder by kind: a spec is in one place, not seven.", moves: [
        { from: "claudedocs/2026-09-01-search-plan.md", to: "docs/plans/2026-09-01-search-plan.md", why: "a plan" },
        { from: "claudedocs/2026-09-10-caching-research.md", to: "docs/research/2026-09-10-caching-research.md", why: "research" },
        { from: "claudedocs/2026-09-12-login-review.md", to: "docs/reviews/2026-09-12-login-review.md", why: "a review" },
        { from: "docs/superpowers/specs/2026-09-03-onboarding-design.md", to: "docs/specs/2026-09-03-onboarding-design.md", why: "a spec" },
        { from: "docs/superpowers/plans/2026-09-05-onboarding-plan.md", to: "docs/plans/2026-09-05-onboarding-plan.md", why: "a plan" },
        { from: "docs/login-spec.md", to: "archive/login-spec.md", why: "replaced by login v2" },
        { from: "docs/login-v2-spec.md", to: "docs/specs/login-v2-spec.md", why: "a spec" },
        { from: "notes/decision-use-sqlite.md", to: "docs/decisions/0002-use-sqlite.md", why: "a decision" },
        { from: "decisions/0001-record-decisions.md", to: "docs/decisions/0001-record-decisions.md", why: "a decision" },
        { from: "public/notes-launch.md", to: "docs/plans/launch-notes.md", why: "a note in a folder that ships to visitors" },
        { from: "public/mockup-checkout.html", to: "docs/design/mockup-checkout.html", why: "a mockup nothing loads, in a folder that ships to visitors" },
        { from: "design/brand.md", to: "docs/design/brand.md", why: "design" },
      ] },
      { title: "Status lines", why: "A status line on every spec and plan, so nobody builds from a replaced spec.", status: [
        { path: "docs/login-spec.md", line: "Replaced by [login v2](../docs/specs/login-v2-spec.md)" },
        { path: "docs/login-v2-spec.md", line: "Current" },
        { path: "claudedocs/2026-09-01-search-plan.md", line: "Draft" },
        { path: "docs/superpowers/plans/2026-09-05-onboarding-plan.md", line: "Done" },
        { path: "docs/superpowers/specs/2026-09-03-onboarding-design.md", line: "Current" },
      ] },
      { title: "Rulebook", why: "A shorter rulebook: the design rules become a document read when needed. Every rule is kept word for word.", split: [
        { from: "AGENTS.md", section: "## Design rules", to: "docs/design/rules.md" },
      ], sections: [
        { path: "AGENTS.md", heading: "## Where documents go", text: "- Specs: docs/specs/\n- Plans: docs/plans/\n- Decisions: docs/decisions/\n- Replaced or copied documents: archive/" },
      ] },
    ],
  };
  mkdirSync(join(dir, ".playbook/deep"), { recursive: true });
  writeFileSync(join(dir, ".playbook/deep/docs.json"), `${JSON.stringify(change(plan), null, 2)}\n`);
  return plan;
}
const codeOf = (out) => out.match(/--apply --plan (\w+)/)?.[1];

test("the first look counts what is inside every folder and changes nothing", sandboxed((sb) => {
  const { dir } = makeFixture("field-docs", sb.dir);
  const before = [head(sb, dir), status(sb, dir)];
  const r = deep(sb, dir);
  assert.equal(r.status, 0, r.out);
  const s = r.stdout;
  assert.match(s, /Deep sweep 1 of 2: everything that is not code/);
  assert.match(s, /18 documents in 8 places/, s);
  assert.match(s, /5 specs and plans, 5 without a status line/);
  assert.match(s, /2 decisions in 2 places/);
  assert.match(s, /2 exact copies, 1 of them in public\//);
  assert.match(s, /named after a tool: `claudedocs\/`, `docs\/superpowers\/`/);
  assert.match(s, /public\/ ships to visitors and holds 2 notes and 1 page nothing loads/);
  assert.match(s, new RegExp(`AGENTS\\.md has ${lines(read(dir, "AGENTS.md"))} lines`));
  assert.match(s, /\.playbook\/deep\/docs\.json/, "says where the plan goes");
  assert.deepEqual([head(sb, dir), status(sb, dir)], before, "nothing changed");

  const j = JSON.parse(deep(sb, dir, ["--json"]).stdout);
  assert.equal(j.base, head(sb, dir));
  const v2 = j.documents.find((d) => d.path === "docs/login-v2-spec.md");
  assert.equal(v2.kind, "spec");
  assert.equal(v2.status, null);
  assert.ok(j.copies.some((g) => g.includes("public/overview-copy.md") && g.includes("docs/overview.md")));
  assert.ok(j.rulebooks.find((b) => b.path === "AGENTS.md").sections.some((x) => x.heading === "## Design rules" && x.lines >= 80));
}));

test("files with unsaved changes, or not in the last commit, stay out, and a plan that moves them is refused", sandboxed((sb) => {
  const { dir } = makeFixture("field-docs", sb.dir);
  write(dir, "notes/ideas.md", "# Ideas\n\n- Gift cards\n- A changed line\n");
  write(dir, "notes/new.md", "# New\n");
  assert.match(deep(sb, dir).stdout, /2 files have unsaved changes or are not in your last commit, so they stay out of this sweep: `notes\/ideas\.md`, `notes\/new\.md`/);
  planFor(sb, dir, (p) => ({ ...p, steps: [{ title: "Ideas", why: "test", moves: [{ from: "notes/ideas.md", to: "docs/ideas.md", why: "a note" }] }] }));
  const r = deep(sb, dir);
  assert.match(r.stdout, /The plan cannot be used yet/);
  assert.match(r.stdout, /notes\/ideas\.md: it has unsaved changes/);
  assert.equal(codeOf(r.stdout), undefined, "no yes is offered for a plan with problems");
}));

test("a plan that moves code, or sets a status word repo-fit does not know, is refused", sandboxed((sb) => {
  const { dir } = makeFixture("field-docs", sb.dir);
  planFor(sb, dir, (p) => ({ ...p, steps: [{ title: "Bad", why: "test", moves: [{ from: "src/app.js", to: "docs/app.js", why: "no" }], status: [{ path: "docs/overview.md", line: "Maybe" }] }] }));
  const s = deep(sb, dir).stdout;
  assert.match(s, /src\/app\.js: It is code or configuration/);
  assert.match(s, /docs\/overview\.md: "Maybe" is not a status repo-fit knows/);
  assert.equal(codeOf(s), undefined);
}));

test("the plan screen shows today and after, why, the steps and one yes, and changes nothing", sandboxed((sb) => {
  const { dir } = makeFixture("field-docs", sb.dir);
  planFor(sb, dir);
  const before = [head(sb, dir), status(sb, dir)];
  const s = deep(sb, dir).stdout;
  assert.match(s, /Every change goes on a new branch, `repo-fit\/deep-2026-10-25`, in a separate working copy/);
  assert.match(s, /Your folder today\s+After one yes/);
  assert.match(s, /claudedocs\/\s+3 documents/);
  assert.match(s, /docs\/plans\/\s+3 documents/);
  assert.match(s, /AGENTS\.md\s+\d+ lines\s+AGENTS\.md\s+\d+ lines/);
  assert.match(s, /One docs\/ folder by kind/);
  assert.match(s, /4 steps, each one commit, each proven/);
  assert.match(s, /1 Copies to the archive · 2 Documents by kind · 3 Status lines · 4 Rulebook/);
  assert.ok(codeOf(s), s);
  assert.deepEqual([head(sb, dir), status(sb, dir)], before, "nothing changed");
  const list = deep(sb, dir, ["--list"]).stdout;
  assert.match(list, /claudedocs\/2026-09-12-login-review\.md → docs\/reviews\/2026-09-12-login-review\.md: a review/);
  assert.match(list, /docs\/login-v2-spec\.md: Status: Current/);
}));

test("after the yes: one commit per step on its own branch, made in a separate copy; this folder and its branch stay as they are", sandboxed((sb) => {
  const { dir } = makeFixture("field-docs", sb.dir);
  planFor(sb, dir);
  const code = codeOf(deep(sb, dir).stdout);
  const before = [head(sb, dir), status(sb, dir), git(sb, dir, ["branch", "--show-current"]).stdout];
  const r = deep(sb, dir, ["--apply", "--plan", code]);
  assert.equal(r.status, 0, r.out);
  assert.deepEqual([head(sb, dir), status(sb, dir), git(sb, dir, ["branch", "--show-current"]).stdout], before, "this folder, its branch and its files are as they were");
  assert.match(r.stdout, /Deep sweep 1 is done on branch `repo-fit\/deep-2026-10-25`/);
  assert.match(r.stdout, /git merge repo-fit\/deep-2026-10-25/);
  assert.equal(git(sb, dir, ["log", "--format=%s", `main..${BRANCH}`]).stdout.trim().split("\n").reverse().join(" | "), "repo-fit deep: Copies to the archive | repo-fit deep: Documents by kind | repo-fit deep: Status lines | repo-fit deep: Rulebook");
  assert.equal(git(sb, dir, ["worktree", "list", "--porcelain"]).stdout.match(/^worktree /gm).length, 1, "the separate copy is removed at the end");

  const files = git(sb, dir, ["ls-tree", "-r", "--name-only", BRANCH]).stdout;
  for (const p of ["docs/specs/login-v2-spec.md", "archive/login-spec.md", "archive/overview-copy.md", "docs/design/rules.md", "docs/design/mockup-checkout.html", "src/app.js", "public/index.html"]) assert.match(files, new RegExp(`^${p.replace(/\./g, "\\.")}$`, "m"), p);
  assert.doesNotMatch(files, /^claudedocs\//m);
  const show = (p) => git(sb, dir, ["show", `${BRANCH}:${p}`]).stdout;
  assert.match(show("docs/specs/login-v2-spec.md"), /^# Login v2 spec\n\nStatus: Current\n/);
  assert.match(show("docs/specs/login-v2-spec.md"), /\(\.\.\/\.\.\/archive\/login-spec\.md\)/, "links follow the moves");
  assert.match(show("archive/login-spec.md"), /Status: Replaced by \[login v2\]\(\.\.\/docs\/specs\/login-v2-spec\.md\)/);
  const agents = show("AGENTS.md");
  assert.ok(lines(agents) < 200, `AGENTS.md has ${lines(agents)} lines`);
  assert.match(agents, /\(docs\/design\/rules\.md\)/);
  assert.match(agents, /## Where documents go\n\n- Specs: docs\/specs\//);
  assert.match(show("docs/design/rules.md"), /- Design rule 80: spacing token 80 is 320px\./);
  assert.match(git(sb, dir, ["show", "--stat", "-M", "--format=", `${BRANCH}~2`]).stdout, /=>/, "moves are kept as renames, so Git keeps each file's history");
  assert.ok(read(dir, "claudedocs/2026-09-01-search-plan.md"), "this folder still has its files");
  const twice = deep(sb, dir, ["--apply", "--plan", code]);
  assert.equal(twice.status, 0, twice.out);
  assert.match(twice.stdout, /This plan is already on branch `repo-fit\/deep-2026-10-25`/, "the same yes twice makes no second branch");
  assert.equal(git(sb, dir, ["branch", "--list", "repo-fit/*"]).stdout.trim().split("\n").length, 1);
}));

test("a step that fails its proof is taken back and reported; the other steps stay on the branch", sandboxed((sb) => {
  const { dir } = makeFixture("field-docs", sb.dir);
  planFor(sb, dir);
  // The repo's own hook refuses commits that touch AGENTS.md.
  write(dir, ".git/hooks/pre-commit", "#!/bin/sh\ngit diff --cached --name-only | grep -qx AGENTS.md && exit 1\nexit 0\n");
  chmodSync(join(dir, ".git/hooks/pre-commit"), 0o755);
  const r = deep(sb, dir, ["--apply", "--plan", codeOf(deep(sb, dir).stdout)]);
  assert.equal(r.status, 0, r.out);
  assert.match(r.stdout, /↩️ 4 Rulebook: taken back/);
  assert.match(r.stdout, /Nothing from this step is on the branch/);
  assert.match(r.stdout, /Deep sweep 1 is partly done on branch `repo-fit\/deep-2026-10-25`: 1 step was taken back/, "a partial run does not say done");
  assert.equal(git(sb, dir, ["rev-list", "--count", `main..${BRANCH}`]).stdout.trim(), "3");
  assert.doesNotMatch(git(sb, dir, ["ls-tree", "-r", "--name-only", BRANCH]).stdout, /^docs\/design\/rules\.md$/m);
}));

test("a step that would leave a link pointing at nothing is taken back; with no step left there is no branch", sandboxed((sb) => {
  const { dir } = makeFixture("field-docs", sb.dir);
  planFor(sb, dir, (p) => ({ ...p, steps: [{ title: "Status", why: "test", status: [{ path: "docs/login-spec.md", line: "Replaced by [login v3](login-v3-spec.md)" }] }] }));
  const r = deep(sb, dir, ["--apply", "--plan", codeOf(deep(sb, dir).stdout)]);
  assert.notEqual(r.status, 0);
  assert.match(r.stdout, /↩️ 1 Status: taken back, because 1 link would point at nothing \(docs\/login-spec\.md → login-v3-spec\.md\)/, r.stdout);
  assert.match(r.stdout, /No step could be applied, so there is no branch/);
  assert.equal(git(sb, dir, ["branch", "--list", "repo-fit/*"]).stdout.trim(), "");
}));

test("the yes is tied to the folder it was shown on: a new commit since means nothing is applied", sandboxed((sb) => {
  const { dir } = makeFixture("field-docs", sb.dir);
  planFor(sb, dir);
  const code = codeOf(deep(sb, dir).stdout);
  write(dir, "notes/later.md", "# Later\n");
  git(sb, dir, ["add", "notes/later.md"], ME);
  git(sb, dir, ["commit", "-q", "-m", "later"], ME);
  const r = deep(sb, dir, ["--apply", "--plan", code]);
  assert.notEqual(r.status, 0);
  assert.match(r.out, /changed since the plan was shown/);
  assert.equal(git(sb, dir, ["branch", "--list", "repo-fit/*"]).stdout.trim(), "");
}));

test("deep mode needs Git: a folder without it is told how to start, and nothing changes", sandboxed((sb) => {
  const d = repo(sb, "plain", { files: { "notes/a.md": "# A\n" } });
  const r = deep(sb, d);
  assert.notEqual(r.status, 0);
  assert.match(r.out, /Deep mode works with Git/);
}));


// A folder already set up with repo-fit: its own index pages are not documents, playbook.json does not lock docs/, a
// folder playbook.json requires is only emptied together with a "paths" change, and the folder's own check still passes.
test("in a folder set up with repo-fit: index pages follow, playbook.json moves with the plan, and its check still passes", sandboxed((sb) => {
  const { dir } = makeFixture("field-docs", sb.dir);
  const a = JSON.parse(cli(sb, ["audit", dir, "--json"]).stdout).plan.recommended;
  const set = cli(sb, ["apply", dir, "--steps", a.steps.join(","), ...a.flags.split(" ").filter(Boolean), "--apply"], { env: ME });
  assert.equal(set.status, 0, set.out);
  git(sb, dir, ["add", "-A"], ME);
  git(sb, dir, ["commit", "-q", "-m", "repo-fit setup"], ME);
  assert.ok(read(dir, "claudedocs/INDEX.md").includes("repo-fit:index begin"), "the setup made index pages");
  assert.match(deep(sb, dir).stdout, /18 documents in 8 places/, "index pages are not counted as documents");

  planFor(sb, dir);
  let s = deep(sb, dir).stdout;
  assert.match(s, /playbook\.json lists `decisions` as required, and the plan empties it/, s);
  assert.match(s, /"paths": \{ "decisions": "docs\/decisions" \}/);
  assert.equal(codeOf(s), undefined);

  planFor(sb, dir, (p) => ({ ...p, steps: p.steps.map((x, i) => (i === 1 ? { ...x, paths: { decisions: "docs/decisions" } } : x)) }));
  s = deep(sb, dir).stdout;
  const r = deep(sb, dir, ["--apply", "--plan", codeOf(s)]);
  assert.equal(r.status, 0, r.out);
  assert.doesNotMatch(r.stdout, /↩️/, r.stdout);
  assert.match(r.stdout, /check ✔/);
  assert.equal(git(sb, dir, ["rev-list", "--count", `main..${BRANCH}`]).stdout.trim(), "4");
  const tree = git(sb, dir, ["ls-tree", "-r", "--name-only", BRANCH]).stdout;
  assert.match(tree, /^archive\/claudedocs\/INDEX\.md$/m, "an index page left alone in an emptied folder goes to the archive");
  assert.doesNotMatch(tree, /^claudedocs\//m);
  assert.match(tree, /^archive\/login-spec\.md$/m, "playbook.json naming docs/ does not lock it");
  assert.match(git(sb, dir, ["show", `${BRANCH}:docs/INDEX.md`]).stdout, /\(plans\/2026-09-01-search-plan\.md\)/, "the map is rebuilt for the new places");
  assert.doesNotMatch(tree, /^\.playbook\//m, "repo-fit's own move records stay out of the commits");
  const cfg = JSON.parse(git(sb, dir, ["show", `${BRANCH}:playbook.json`]).stdout);
  assert.equal(cfg.paths.decisions, "docs/decisions");
  assert.ok(cfg.required.includes("docs/decisions") && !cfg.required.includes("decisions"));
  const agents = git(sb, dir, ["show", `${BRANCH}:AGENTS.md`]).stdout;

  // A smaller plan on the same folder: one file leaves a folder that keeps others, so the rebuilt map drops a link to it
  // (a list made by repo-fit, not a broken link). A last step with nothing left to change makes no commit.
  planFor(sb, dir, (p) => ({ ...p, steps: [
    p.steps[0],
    { title: "Decisions", why: "One place for decisions.", moves: [
      { from: "docs/login-v2-spec.md", to: "docs/specs/login-v2-spec.md", why: "a spec" },
      { from: "public/mockup-checkout.html", to: "docs/design/mockup-checkout.html", why: "a mockup nothing loads" },
      { from: "decisions/0001-record-decisions.md", to: "docs/decisions/0001-record-decisions.md", why: "a decision" },
      { from: "claudedocs/2026-09-01-search-plan.md", to: "docs/plans/2026-09-01-search-plan.md", why: "a plan" },
      { from: "docs/login-spec.md", to: "archive/login-spec.md", why: "replaced by login v2" },
    ], paths: { decisions: "docs/decisions" } },
    { title: "Map", why: "The map shows the new places.", map: true },
  ] }));
  const again = deep(sb, dir, ["--apply", "--plan", codeOf(deep(sb, dir).stdout)]);
  assert.equal(again.status, 0, again.out);
  assert.doesNotMatch(again.stdout, /↩️/, again.stdout);
  assert.match(again.stdout, /3 Map: nothing left to change/);
  assert.equal(git(sb, dir, ["rev-list", "--count", `main..${BRANCH}-2`]).stdout.trim(), "2");
  const block = Math.min(...["<!-- playbook:core", "<!-- repo-fit:pointer"].map((m) => agents.indexOf(m)).filter((i) => i >= 0));
  assert.ok(Number.isFinite(block), "the setup gave AGENTS.md a block repo-fit manages");
  assert.ok(agents.indexOf("## Where documents go") > 0 && agents.indexOf("## Where documents go") < block, "a new section goes above repo-fit's own blocks");
}));

// From the review of slice A (25 Oct 2026): files that tools find by their name and place stay put, a page that loads
// other files by a relative path does not move away from them, a status key in front matter is not rewritten, and a plan
// written wrongly gets a message instead of a crash.
const commitAll = (sb, dir, msg) => {
  git(sb, dir, ["add", "-A"], ME);
  git(sb, dir, ["commit", "-q", "-m", msg], ME);
};
test("named files stay, pages keep what they load, front-matter status keys and malformed plans get a message", sandboxed((sb) => {
  const { dir } = makeFixture("field-docs", sb.dir);
  write(dir, "public/robots.txt", "User-agent: *\n");
  write(dir, "requirements.txt", "requests==2.32.3\n");
  write(dir, "docs/README.md", "# Docs\n\nStart here.\n");
  write(dir, "public/mockup-styled.html", '<!doctype html>\n<link rel="stylesheet" href="mockup.css">\n<p>Styled mockup.</p>\n');
  write(dir, "public/mockup.css", "p { color: teal; }\n");
  write(dir, "docs/yaml-spec.md", "---\nstatus: draft\n---\n\n# YAML spec\n");
  commitAll(sb, dir, "more files");
  const j = JSON.parse(deep(sb, dir, ["--json"]).stdout);
  for (const p of ["public/robots.txt", "requirements.txt"]) assert.ok(!j.documents.some((d) => d.path === p), `${p} is not a document`);
  planFor(sb, dir, (p) => ({ ...p, steps: [{ title: "Tidy", why: "test", moves: [
    { from: "public/robots.txt", to: "archive/robots.txt", why: "no" },
    { from: "docs/README.md", to: "archive/README.md", why: "no" },
    { from: "public/mockup-styled.html", to: "docs/design/mockup-styled.html", why: "a mockup" },
  ], status: [{ path: "docs/yaml-spec.md", line: "Current" }] }] }));
  let s = deep(sb, dir).stdout;
  assert.match(s, /public\/robots\.txt: tools look for it by its name and place/, s);
  assert.match(s, /docs\/README\.md: tools look for it by its name and place/);
  assert.match(s, /public\/mockup-styled\.html: it points at `mockup\.css` by a relative path, which would point at nothing after the move/);
  assert.match(s, /docs\/yaml-spec\.md: its front matter has a status key/);
  assert.equal(codeOf(s), undefined);

  planFor(sb, dir, (p) => ({ ...p, steps: [null, { title: "Typo", why: "test", moves: [{ from: "docs/overview.md", dest: "archive/overview.md" }] }, { title: "Slash", why: "test", status: [{ path: "docs\\overview.md", line: "Current" }] }] }));
  const r = deep(sb, dir);
  assert.equal(r.status, 0, r.out);
  assert.doesNotMatch(r.out, /TypeError|at check/);
  assert.match(r.stdout, /Step 1 is not a step/);
  assert.match(r.stdout, /Step 2: each move needs "from" and "to" as text/);
  assert.match(r.stdout, /docs\\overview\.md: write paths with \//);
  const list = deep(sb, dir, ["--list"]);
  assert.doesNotMatch(list.out, /TypeError/);
  assert.match(list.out, /Step 1 is not a step/);
}));

test("a status line goes below front matter and leaves the rest of the document as it is; a heading in a code block does not stop a split", sandboxed((sb) => {
  const { dir } = makeFixture("field-docs", sb.dir);
  const fm = "---\ntitle: FM spec\n---\n\n```md\n# Not a title\n\n\n\nkept\n```\n";
  write(dir, "docs/fm-spec.md", fm);
  write(dir, "AGENTS.md", read(dir, "AGENTS.md").replace("## Design rules", "```md\n## Design rules\n```\n\n## Design rules"));
  commitAll(sb, dir, "front matter and a fenced heading");
  planFor(sb, dir, (p) => ({ ...p, steps: [
    { title: "Status", why: "test", status: [{ path: "docs/fm-spec.md", line: "Current" }] },
    p.steps[3],
  ] }));
  const r = deep(sb, dir, ["--apply", "--plan", codeOf(deep(sb, dir).stdout)]);
  assert.equal(r.status, 0, r.out);
  assert.doesNotMatch(r.stdout, /↩️/, r.stdout);
  assert.equal(git(sb, dir, ["show", `${BRANCH}:docs/fm-spec.md`]).stdout, "---\ntitle: FM spec\n---\n\nStatus: Current\n\n```md\n# Not a title\n\n\n\nkept\n```\n");
  assert.match(git(sb, dir, ["show", `${BRANCH}:AGENTS.md`]).stdout, /```md\n## Design rules\n```/, "the fenced copy stays");
}));

test("a commit hook that changes files outside the commit gets its step taken back", sandboxed((sb) => {
  const { dir } = makeFixture("field-docs", sb.dir);
  planFor(sb, dir, (p) => ({ ...p, steps: [p.steps[0]] }));
  write(dir, ".git/hooks/pre-commit", "#!/bin/sh\necho hooked > hook-was-here.txt\nexit 0\n");
  chmodSync(join(dir, ".git/hooks/pre-commit"), 0o755);
  const r = deep(sb, dir, ["--apply", "--plan", codeOf(deep(sb, dir).stdout)]);
  assert.notEqual(r.status, 0);
  assert.match(r.stdout, /↩️ 1 Copies to the archive: taken back, because a commit hook changed files that are not in the commit \(hook-was-here\.txt\)/, r.stdout);
  assert.equal(git(sb, dir, ["branch", "--list", "repo-fit/*"]).stdout.trim(), "");
}));

test("a working copy left by a run that was killed is cleaned up by the next run", sandboxed((sb) => {
  const { dir } = makeFixture("field-docs", sb.dir);
  planFor(sb, dir, (p) => ({ ...p, steps: [p.steps[0]] }));
  const stale = join(sb.dir, "repo-fit-deep-99999999-abc123");
  assert.equal(git(sb, dir, ["worktree", "add", "-q", "-b", BRANCH, stale, "HEAD"]).status, 0);
  const r = deep(sb, dir, ["--apply", "--plan", codeOf(deep(sb, dir).stdout)]);
  assert.equal(r.status, 0, r.out);
  assert.match(r.stdout, /done on branch `repo-fit\/deep-2026-10-25`/, "the empty branch of the killed run is reused");
  assert.equal(git(sb, dir, ["worktree", "list", "--porcelain"]).stdout.match(/^worktree /gm).length, 1);
  assert.equal(git(sb, dir, ["rev-list", "--count", `main..${BRANCH}`]).stdout.trim(), "1");
}));
