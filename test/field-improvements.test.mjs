// Field improvements grounded in daily use of repo-fit on real notes and book folders (synthetic fixtures only).
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { find, orient, snapshot } from "../dev/score.mjs";
import { logHasDate } from "../scripts/playbook/lib.mjs";
import { POINTER, pages, scan, summary, title, withPointer } from "../scripts/playbook/map.mjs";
import { ROOT, cli, git, has, read, repo, sandboxed, script, write } from "./helpers.mjs";

const ME = { REPO_FIT_TODAY: "2026-11-21", GIT_AUTHOR_NAME: "Test Person", GIT_AUTHOR_EMAIL: "test@example.com", GIT_COMMITTER_NAME: "Test Person", GIT_COMMITTER_EMAIL: "test@example.com" };
const SETUP = ["--tool", "claude", "--hooks", "none", "--autosave", "off", "--apply"];
const words = (n) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");

test("large area index pages group notes by immediate subfolder, while small areas stay flat", sandboxed((sb) => {
  const files = { "evidence/overview.md": "# Overview\n\nTop note in evidence.\n" };
  for (let i = 1; i <= 7; i++) files[`evidence/research/r${i}.md`] = `# Research ${i}\n\nFinding ${i}.\n`;
  for (let i = 1; i <= 7; i++) files[`evidence/calls/c${i}.md`] = `# Call ${i}\n\nNotes from call ${i}.\n`;
  files["small/a/one.md"] = "# One\n\nFirst.\n";
  files["small/b/two.md"] = "# Two\n\nSecond.\n";
  const d = repo(sb, "grouped", { files });
  const p = pages(d);
  const ev = p.get("evidence/INDEX.md");
  assert.match(ev, /\[Overview\]\(overview\.md\)/);
  assert.match(ev, /^## calls\/$/m, ev);
  assert.match(ev, /^## research\/$/m, ev);
  assert.ok(ev.indexOf("[Overview]") < ev.indexOf("## calls/"), "root notes come before subfolder headings");
  assert.doesNotMatch(p.get("small/INDEX.md"), /^## /m, "small areas stay compact and flat");
  for (const [k, v] of p) write(d, k, v);
  const f = find(snapshot(d));
  assert.equal(f.found, f.total, `every note stays within 2 links: ${f.unreachable}`);
}));

test("template placeholder headings stay readable and never produce empty link labels", sandboxed((sb) => {
  assert.equal(title("# <Name>\n", "_template/character.md"), "<Name>");
  assert.equal(title("# <Book title>: outline\n", "_template/outline.md"), "<Book title>: outline");
  assert.equal(title("# <b>Bold</b> heading\n", "a.md"), "Bold heading");
  assert.equal(title("# <span></span>\n", "fallback-name.md"), "fallback-name");
  const d = repo(sb, "tplhead", { files: {
    "worlds/_template/character.md": "# <Name>\n\nRole and look.\n",
    "worlds/_template/world.md": "# <World name>: story bible\n\nMain rules.\n",
  } });
  const idx = pages(d).get("worlds/INDEX.md");
  assert.match(idx, /\[\\<Name>\]\(_template\/character\.md\)/, "a placeholder is escaped, so GitHub shows it as text");
  assert.match(idx, /\[\\<World name>: story bible\]\(_template\/world\.md\)/);
  assert.doesNotMatch(idx, /\[\]\(/, "no empty link text");
}));

test("configured root role files (like TASKS.md) are listed as key files, not loose clutter", sandboxed((sb) => {
  const d = repo(sb, "rootrole", { files: {
    "playbook.json": `${JSON.stringify({ paths: { board: "TASKS.md" }, required: ["TASKS.md"] })}\n`,
    "TASKS.md": "# Tasks\n\n- [ ] Ship v1\n",
    "STYLE.md": "# Style\n\nKeep sentences short.\n",
    "notes/a.md": "# A\n\nFirst note.\n",
  } });
  const s = scan(d);
  assert.deepEqual(s.keyFiles.map((x) => x.path), ["TASKS.md"]);
  assert.deepEqual(s.loose.map((x) => x.path), ["STYLE.md"]);
  const p = pages(d);
  const map = p.get("MAP.md");
  assert.match(map, /\*\*Key files at the top:\*\*\n- \[Tasks\]\(TASKS\.md\)/);
  assert.match(map, /\*\*At the top of the folder:\*\* 1 note\.\n- \[Style\]\(STYLE\.md\)/);
  assert.doesNotMatch(map, /Loose at the top/);
  for (const [k, v] of p) write(d, k, v);
  const o = orient(d, snapshot(d));
  const f = find(snapshot(d));
  assert.equal(o.covered, o.entries);
  assert.equal(f.found, f.total);
}));

test("the map pointer is the same in every folder, so organize never leaves the rulebook out of step", sandboxed((sb) => {
  const d = repo(sb, "noinbox", { commit: true, files: { "AGENTS.md": "# Rules\n\nBe clear.\n", "notes/a.md": "# A\n\nNote.\n", "loose-idea.md": "# Idea\n\nA loose note at the top.\n" } });
  assert.equal(cli(sb, ["apply", d, "--steps", "A-01,A-10,A-13,D-11", ...SETUP], { env: ME }).status, 0);
  const agents = read(d, "AGENTS.md");
  assert.ok(agents.includes(POINTER), "the pointer is the one POINTER text");
  assert.match(POINTER, /ask the person once per kind.*file\.mjs <item> --to <folder>/s, "a session without the briefing hook still learns how to file");
  assert.match(POINTER, /check\.mjs --review/, "the review keeps its line");
  const n = POINTER.replace(/<!--[^>]*-->/g, "").split(/\s+/).filter(Boolean).length;
  assert.ok(n <= 85, `the pointer stays short: ${n} words`);
  git(sb, d, ["add", "-A"], ME);
  git(sb, d, ["commit", "-q", "-m", "setup"], ME);
  // organize makes inbox/ (its rules file): the pointer must not change with it.
  const code = cli(sb, ["organize", d], { env: ME }).stdout.match(/--apply --plan (\w+)/)?.[1];
  assert.ok(code, "organize offers a plan for the loose note");
  assert.equal(cli(sb, ["organize", d, "--apply", "--plan", code], { env: ME }).status, 0);
  assert.ok(has(d, "inbox"), "organize made inbox/");
  const st = cli(sb, ["status", d], { env: ME }).out;
  assert.doesNotMatch(st, /Out of step|Behind/, st);
}));

test("update refreshes an older pointer to the short one and keeps the page it starts at", sandboxed((sb) => {
  const d = repo(sb, "oldpointer", { commit: true, files: { "AGENTS.md": "# Rules\n\nBe clear.\n", "README.md": "# Readme\n\nAbout.\n", "notes/a.md": "# A\n\nNote.\n" } });
  assert.equal(cli(sb, ["apply", d, "--steps", "A-01,A-10,A-13,D-11", ...SETUP], { env: ME }).status, 0);
  const older = "<!-- repo-fit:pointer begin -->\n**Start at [README.md](README.md).** Older words. New things go in `inbox/`. Never delete, merge or commit inbox items yourself.\n<!-- repo-fit:pointer end -->";
  write(d, "AGENTS.md", read(d, "AGENTS.md").replace(/<!-- repo-fit:pointer begin -->[\s\S]*?<!-- repo-fit:pointer end -->/, older));
  git(sb, d, ["add", "-A"], ME);
  git(sb, d, ["commit", "-q", "-m", "older pointer"], ME);
  assert.equal(cli(sb, ["update", d, "--apply"], { env: ME }).status, 0);
  const now = read(d, "AGENTS.md");
  assert.ok(now.includes(withPointer("", "README.md").trim()), now);
  assert.doesNotMatch(now, /Older words/);
}));

test("index lines drop HTML comments and real tags, and never leave an open tag or comment", () => {
  assert.equal(summary("Short intro line here. <!-- private: ask Sam about the budget --> More words follow after it.\n"), "Short intro line here. More words follow after it.");
  assert.equal(summary("<details><summary>Click</summary> The hidden part is long enough.</details>\n"), "Click The hidden part is long enough.");
  assert.equal(summary(`Intro text that is long enough. <!-- ${words(40)}\n`), "Intro text that is long enough.");
  assert.equal(title('# <center>Centered</center> <img src="x.png" alt="x">\n', "a.md"), "Centered");
  const d = mkdtempSync(join(tmpdir(), "rf-esc-"));
  try {
    writeFileSync(join(d, "a.md"), "# A\n\nUse <Name> for the hero, and keep it short.\n");
    mkdirSync(join(d, "notes"));
    writeFileSync(join(d, "notes", "b.md"), "# <Book title>\n\nAn outline with <Chapter> markers.\n");
    const idx = pages(d).get("notes/INDEX.md");
    assert.match(idx, /\[\\<Book title>\]\(b\.md\): An outline with \\<Chapter> markers\./, idx);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test("briefing counts current.md body words only (ignoring YAML frontmatter), matching check and audit", sandboxed((sb) => {
  const d = repo(sb, "frontmatter-cap", { commit: true, files: {
    "AGENTS.md": "# Rules\n",
    "00-home/current.md": `---\nid: home\nsource_refs: [${words(200)}]\n---\n# Current\n\n${words(1100)}\n`,
    "scripts/check_notes.py": "CURRENT_MAX_WORDS = 1200  # 00-home/current.md body\n",
  } });
  assert.equal(cli(sb, ["apply", d, "--steps", "A-01,A-10", ...SETUP], { env: ME }).status, 0);
  const b = script(sb, d, "brief.mjs", ["--text"]);
  assert.equal(b.status, 0, b.out);
  assert.doesNotMatch(b.out, /cap 1200/, "body is under 1200 even though frontmatter + body is over 1200");
  // When the body itself exceeds the cap, the briefing still warns.
  write(d, "00-home/current.md", `---\nid: home\n---\n# Current\n\n${words(1250)}\n`);
  assert.match(script(sb, d, "brief.mjs", ["--text"]).out, /00-home\/current\.md is 125\d words \(cap 1200\)/);
}));

test("log date detection accepts human-readable dates and headings, and ignores frontmatter metadata dates", sandboxed((sb) => {
  assert.equal(logHasDate("---\nlast_verified: 2026-11-13\n---\n# Log\n\n## Older, 10 November 2026\n", "2026-11-13"), false);
  assert.equal(logHasDate("# Log\n\n## Upkeep, 13 November 2026\n", "2026-11-13"), true);
  assert.equal(logHasDate("# Log\n\n## Upkeep, Nov 13, 2026\n", "2026-11-13"), true);
  assert.equal(logHasDate("# Log\n\n| 2026-11-13 | Did work |\n", "2026-11-13"), true);
  assert.equal(logHasDate("# Log\n\n- 2026-11-13 · Claude Code · Did work\n", "2026-11-13"), true);

  const d = repo(sb, "humanlog", { files: {
    "00-home/log.md": "---\nid: log\n---\n# Log\n\n## Setup note, 21 November 2026\n\nRecorded the work.\n",
    "00-home/current.md": "# Current\n",
  } });
  git(sb, d, ["add", "-A"], ME);
  git(sb, d, ["commit", "-q", "-m", "work"], { ...ME, GIT_AUTHOR_DATE: "2026-11-21T10:00:00Z", GIT_COMMITTER_DATE: "2026-11-21T10:00:00Z" });
  assert.equal(cli(sb, ["apply", d, "--steps", "A-01,A-10", ...SETUP], { env: ME }).status, 0);
  const b = script(sb, d, "brief.mjs", ["--text"]);
  assert.doesNotMatch(b.out, /has no line in 00-home\/log\.md/, b.out);
}));

test("adapt never misreads repo-fit's own pointer block as the repo's commit rules", sandboxed((sb) => {
  const d = repo(sb, "ownpointer", { commit: true, files: {
    "AGENTS.md": "# Rules\n\nWrite clearly.\n\n<!-- repo-fit:pointer begin -->\n**Start at [MAP.md](MAP.md).** Never delete, merge or commit inbox items yourself.\n<!-- repo-fit:pointer end -->\n",
    "notes/a.md": "# A\n\nNote.\n",
  } });
  const a = JSON.parse(cli(sb, ["audit", d, "--json"]).stdout);
  assert.equal(a.own.topics.commits, undefined, `pointer must not trigger commit rules: ${JSON.stringify(a.own.topics.commits)}`);
}));

test("audit and check agree on parent-folder links, templates, inline code, wiki links, gitignored files and code areas", sandboxed((sb) => {
  const d = repo(sb, "consistent", { commit: true, files: {
    ".gitignore": "drafts/\n",
    "books/b1/art/p1-scene.jpg": "jpg",
    "books/b1/chapters/01.md": "# Chapter 1\n\n![Scene](art/p1-scene.jpg)\n\nInline example: `[not a link](missing.md)`.\n",
    "books/_template/chapter.md": "# <Title>\n\n![Placeholder](art/p1-placeholder.jpg)\n",
    "notes/a.md": "# A\n\nSee [[b]] and [real](missing-real.md).\n",
    "notes/b.md": "# B\n\nReached by wiki link.\n",
    "drafts/hidden.md": "# Hidden\n\nSee [gone](nope.md).\n",
    "reels/render.py": "print('render')\n",
    "reels/helper.py": "print('helper')\n",
    "reels/frame.md": "# Frame spec\n\nInside a code area.\n",
  } });
  const a = JSON.parse(cli(sb, ["audit", d, "--json"]).stdout);
  assert.deepEqual(a.details.brokenLinks.map((x) => `${x.file}:${x.target}`), ["notes/a.md:missing-real.md"]);
  assert.ok(!a.details.orphans.includes("notes/b.md"), "wiki link counts as inbound");
  assert.ok(!a.details.orphans.includes("reels/frame.md"), "code area notes are not orphans");
  assert.ok(!a.details.orphans.some((f) => f.startsWith("drafts/")), "gitignored files stay out of audit");

  assert.equal(cli(sb, ["apply", d, "--steps", "A-01,A-10", ...SETUP], { env: ME }).status, 0);
  const c = script(sb, d, "check.mjs");
  assert.doesNotMatch(c.out, /reels\/frame\.md/, "check skips code areas like fit and audit");
}));

test("A-12 README links only pages that exist or are created in the same run, leaving zero broken links", sandboxed((sb) => {
  const d = repo(sb, "readme-only", { files: {
    "00-home/current.md": "# Current\n",
    "AGENTS.md": "# Rules\n",
  } });
  rmSync(join(d, "README.md"));
  git(sb, d, ["add", "-A"], ME);
  git(sb, d, ["commit", "-q", "-m", "no readme"], ME);
  assert.equal(cli(sb, ["apply", d, "--steps", "A-01,A-10,A-12", ...SETUP], { env: ME }).status, 0);
  const readme = read(d, "README.md");
  assert.match(readme, /\[the current view\]\(00-home\/current\.md\)/);
  assert.doesNotMatch(readme, /board\.md|open-questions\.md|decisions\.md|log\.md/, "missing pages are not linked");
  const c = script(sb, d, "check.mjs");
  assert.equal(c.status, 0, c.out);
}));

test("apply refreshes AGENTS.md core block and repo-fit's MAP.md when adding new role pages, leaving status clean", sandboxed((sb) => {
  const d = repo(sb, "syncapply", { commit: true, files: {
    "AGENTS.md": "# Rules\n",
    "docs/00-home/current.md": "# Current\n",
  } });
  assert.equal(cli(sb, ["apply", d, "--steps", "A-01,A-10,A-13,D-01,D-11", ...SETUP], { env: ME }).status, 0);
  // Adding log and decisions later refreshes the core block and MAP/INDEX in the same run.
  const res = cli(sb, ["apply", d, "--steps", "A-04,A-05", ...SETUP], { env: ME });
  assert.equal(res.status, 0, res.out);
  assert.match(read(d, "AGENTS.md"), /docs\/decisions\.md/);
  assert.match(read(d, "AGENTS.md"), /docs\/00-home\/log\.md/);
  assert.match(read(d, "docs/INDEX.md"), /decisions\.md/);
  const st = cli(sb, ["status", d], { env: ME });
  assert.equal(st.status, 0, st.out);
  assert.match(st.out, /✅ Your folder is fit/);
  // Undo takes back the new pages AND restores AGENTS.md and docs/INDEX.md cleanly.
  assert.equal(cli(sb, ["undo", d, "--apply"], { env: ME }).status, 0);
  assert.ok(!has(d, "docs/decisions.md"));
  assert.doesNotMatch(read(d, "AGENTS.md"), /docs\/decisions\.md/);
}));

test("status distinguishes same-version out-of-step from behind and prints only relevant fix hints", sandboxed((sb) => {
  const version = readFileSync(join(ROOT, "VERSION"), "utf8").trim();
  const d = repo(sb, "statusmsg", { commit: true, files: {
    "AGENTS.md": "# Rules\n",
    "notes/a.md": "# A\n\nNote.\n",
  } });
  assert.equal(cli(sb, ["apply", d, "--steps", "A-01,A-10,A-13,D-01,D-11", ...SETUP], { env: ME }).status, 0);
  // Drift a managed script at the same version: status must not say "Behind: X, and X is ready".
  write(d, "scripts/playbook/brief.mjs", `${read(d, "scripts/playbook/brief.mjs")}\n// local drift\n`);
  const sameVer = cli(sb, ["status", d], { env: ME }).out;
  assert.match(sameVer, new RegExp(`Out of step with repo-fit ${version.replace(/\./g, "\\.")}: scripts/playbook/brief\\.mjs`));
  assert.doesNotMatch(sameVer, /Behind:/);
  assert.match(sameVer, /What can fix it: an update shows what it changes \(`update`\)\./);
  assert.doesNotMatch(sameVer, /organize plan|items waiting in inbox|Broken links are yours/, "only relevant fix hints are shown");
}));
