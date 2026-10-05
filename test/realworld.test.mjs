// Patterns from a real folder upgraded from 0.5.0 (synthetic copies here, never real data): a folder that never
// chose a map, secret notes, worlds copied from a template, a book whose pictures are linked from the book folder,
// and an older .playbook/.gitignore that undo must put back.
import assert from "node:assert/strict";
import { test } from "node:test";
import { organizePlan } from "../lib/organize.mjs";
import { pages } from "../scripts/playbook/map.mjs";
import { linkReport } from "../scripts/playbook/move.mjs";
import { cli, git, has, read, repo, sandboxed, script, write } from "./helpers.mjs";

const ME = { REPO_FIT_TODAY: "2026-10-05", GIT_AUTHOR_NAME: "Test Person", GIT_AUTHOR_EMAIL: "test@example.com", GIT_COMMITTER_NAME: "Test Person", GIT_COMMITTER_EMAIL: "test@example.com" };

test("a folder that never chose a map gets none at session start", sandboxed((sb) => {
  const d = repo(sb, "nomap", { commit: true, files: { "worlds/a/notes.md": "# World A\n\nA world.\n", "worlds/b/notes.md": "# World B\n\nAnother.\n" } });
  // The scripts arrive (as through an update) without the map step.
  assert.equal(cli(sb, ["apply", d, "--steps", "A-01,A-10", "--tool", "claude", "--hooks", "none", "--autosave", "off", "--apply"], { env: ME }).status, 0);
  assert.ok(!has(d, "MAP.md"));
  script(sb, d, "brief.mjs", ["--text", "--file"]);
  assert.ok(!has(d, "MAP.md") && !has(d, "worlds/INDEX.md"), "nothing written without a yes to the map");
  assert.doesNotMatch(cli(sb, ["status", d], { env: ME }).out, /map is out of date/i);
}));

test("a secret note is listed by name only: its words never reach an index page, the map or open work", sandboxed((sb) => {
  const d = repo(sb, "sec", { files: {
    "worlds/w/story.md": "# Story\n\nThe hero sets out.\n",
    "worlds/w/SECRETS-parent-only.md": "# Secrets\n\nThe twist: the teacher is the dragon.\n\n- [ ] Hide the twist until book 3\n",
  } });
  const p = pages(d);
  const all = [...p.values()].join("\n");
  assert.match(p.get("worlds/INDEX.md"), /SECRETS-parent-only\.md/);
  assert.doesNotMatch(all, /twist|dragon|Hide the/);
}));

test("worlds copied from a template are a pattern, not junk: same-named copies stay; a file named 'copy' still goes", sandboxed((sb) => {
  const icon = "A small round pebble, flat icon style.\n";
  const d = repo(sb, "tpl", { commit: true, files: {
    "worlds/_template/ornaments/prompts/icon-pebble.txt": icon,
    "worlds/one/ornaments/prompts/icon-pebble.txt": icon,
    "worlds/two/ornaments/prompts/icon-pebble.txt": icon,
    "ideas.md": "# Ideas\n\nMany.\n",
    "ideas copy.md": "# Ideas\n\nMany.\n",
  } });
  const moves = organizePlan(d, { today: "2026-10-05" }).batches.flatMap((b) => b.moves);
  assert.ok(!moves.some((m) => m.from.includes("ornaments/")), JSON.stringify(moves.map((m) => m.from)));
  assert.ok(moves.some((m) => m.from === "ideas copy.md" && /same as ideas\.md/.test(m.why)));
}));

test("a picture linked from the book folder works; a placeholder in a template is not a broken link", sandboxed((sb) => {
  const d = repo(sb, "book", { files: {
    "books/b1/art/p1-eagle.jpg": "jpg",
    "books/b1/chapters/ch1.md": "# Chapter 1\n\n![An eagle](art/p1-eagle.jpg)\n",
    "worlds/_template/chapter.md": "# Chapter\n\n![description](art/p1-name.jpg)\n",
    "notes/real.md": "# Real\n\nSee [gone](missing.md).\n",
  } });
  const broken = linkReport(d).broken.map((b) => `${b.file} → ${b.dest}`);
  assert.deepEqual(broken, ["notes/real.md → missing.md"]);
}));

test("undo puts back an older .playbook/.gitignore that the update rewrote", sandboxed((sb) => {
  const d = repo(sb, "old", { files: { "notes/a.md": "# A\n\nNote.\n" } });
  assert.equal(cli(sb, ["apply", d, "--steps", "A-01,A-10", "--tool", "claude", "--hooks", "none", "--autosave", "off", "--apply"], { env: ME }).status, 0);
  write(d, ".playbook/.gitignore", "backups/\nundone/\n"); // as 0.5.0 left it, and saved in Git
  const pj = JSON.parse(read(d, "playbook.json"));
  write(d, "playbook.json", `${JSON.stringify({ ...pj, playbook: "0.5.0" }, null, 2)}\n`);
  git(sb, d, ["add", "-A", "-f"], ME);
  git(sb, d, ["commit", "-q", "-m", "0.5.0 setup"], ME);
  assert.equal(cli(sb, ["update", d, "--apply"], { env: ME }).status, 0);
  assert.equal(read(d, ".playbook/.gitignore"), "*\n");
  assert.equal(cli(sb, ["undo", d, "--apply"], { env: ME }).status, 0);
  assert.equal(read(d, ".playbook/.gitignore"), "backups/\nundone/\n");
}));

test("without a map, the briefing does not point at one; a template's tasks are not open work", sandboxed((sb) => {
  const d = repo(sb, "tasks", { commit: true, files: { "notes/plan.md": "# Plan\n\n- [ ] Real task\n", "worlds/_template/todo.md": "# Todo\n\n- [ ] Placeholder task\n" } });
  assert.equal(cli(sb, ["apply", d, "--steps", "A-01,A-10", "--tool", "claude", "--hooks", "none", "--autosave", "off", "--apply"], { env: ME }).status, 0);
  assert.doesNotMatch(script(sb, d, "brief.mjs", ["--text"]).out, /see MAP\.md/);
  const map = pages(d).get("MAP.md");
  assert.match(map, /Real task/);
  assert.doesNotMatch(map, /Placeholder task/);
}));

test("the safety snapshot never saves repo-fit's own records (.playbook/)", sandboxed((sb) => {
  const d = repo(sb, "snap", { commit: true, files: { "notes/a.md": "# A\n\nNote.\n" } });
  write(d, ".playbook/news.json", "{}\n");
  write(d, "loose.md", "# Loose\n\nNew, at the top.\n");
  const code = cli(sb, ["organize", d], { env: ME }).stdout.match(/--apply --plan (\w+)/)?.[1];
  assert.ok(code);
  assert.equal(cli(sb, ["organize", d, "--apply", "--plan", code], { env: ME }).status, 0);
  const saved = git(sb, d, ["show", "--name-only", "--format=", "HEAD"]).stdout;
  assert.match(saved, /loose\.md/);
  assert.doesNotMatch(saved, /\.playbook/);
}));
