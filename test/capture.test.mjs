// Capture: new things land in inbox/. Standing rules come from the organize plan (shown on its screen, approved by
// the same yes) and file matching items at the start of a session, with a receipt, a briefing line and undo. A note
// with no family waits for the person; a new kind asks once (Yes / Yes, and always / Not now). Copies are named.
import assert from "node:assert/strict";
import { test } from "node:test";
import { makeFixture, makeBytes } from "../dev/fixtures.mjs";
import { cli, has, read, sandboxed, script, write } from "./helpers.mjs";

const ME = { REPO_FIT_TODAY: "2026-10-05", GIT_AUTHOR_NAME: "Test Person", GIT_AUTHOR_EMAIL: "test@example.com", GIT_COMMITTER_NAME: "Test Person", GIT_COMMITTER_EMAIL: "test@example.com" };

// The skill's flow on the everything-folder: organize (with its rules), then the setup that brings the scripts.
function organized(sb, name = "spaghetti") {
  const { dir } = makeFixture(name, sb.dir);
  const rec = JSON.parse(cli(sb, ["audit", dir, "--json"], { env: ME }).stdout).plan.recommended;
  const code = cli(sb, ["organize", dir], { env: ME }).stdout.match(/--apply --plan (\w+)/)[1];
  assert.equal(cli(sb, ["organize", dir, "--apply", "--plan", code], { env: ME }).status, 0);
  assert.equal(cli(sb, ["apply", dir, "--steps", rec.steps.join(","), ...rec.flags.split(" "), "--apply"], { env: ME }).status, 0);
  return dir;
}
const session = (sb, dir) => script(sb, dir, "brief.mjs", ["--text", "--file"]);

test("the organize screen lists the standing rules it will start, and the yes saves them in inbox/rules.json", sandboxed((sb) => {
  const { dir } = makeFixture("spaghetti", sb.dir);
  const screen = cli(sb, ["organize", dir], { env: ME }).stdout;
  assert.match(screen, /From now on/);
  assert.match(screen, /new images → media\//);
  assert.match(screen, /new files starting with "invoice" → documents\/invoice\//);
  assert.doesNotMatch(screen, /new notes → /, "a note without a family waits for you");
  const code = screen.match(/--apply --plan (\w+)/)[1];
  assert.equal(cli(sb, ["organize", dir, "--apply", "--plan", code], { env: ME }).status, 0);
  const rules = JSON.parse(read(dir, "inbox/rules.json")).rules;
  assert.ok(rules.some((r) => r.kind === "image" && !r.starts && r.to === "media"));
  assert.ok(rules.some((r) => r.starts === "client-acme" && r.to === "notes/client-acme"));
}));

test("at the start of a session, new inbox items that match a rule are filed, with a briefing line and undo", sandboxed((sb) => {
  const dir = organized(sb);
  write(dir, "inbox/IMG_3001.jpg", makeBytes.jpg("new photo"));
  write(dir, "inbox/Invoice-2026-06.pdf", makeBytes.pdf("june"));
  write(dir, "inbox/client-acme-call-notes.md", "# Acme call\n\nThe designer wants a darker theme.\n");
  write(dir, "inbox/random-thought.md", "# A thought\n\nMaybe learn the piano.\n");
  const out = session(sb, dir).out;
  assert.ok(has(dir, "media/IMG_3001.jpg") && has(dir, "documents/invoice/Invoice-2026-06.pdf") && has(dir, "notes/client-acme/client-acme-call-notes.md"));
  assert.ok(has(dir, "inbox/random-thought.md"), "no family: it waits for you");
  assert.match(out, /📥 Filed by your rules: 3/);
  assert.match(out, /📥 Inbox: 2 waiting: random-thought\.md, untitled\.md/, "untitled.md has waited since organizing");
  assert.match(read(dir, "MAP.md"), /notes\/INDEX\.md/);
  assert.match(read(dir, "notes/INDEX.md"), /client-acme-call-notes\.md/, "the index pages are rebuilt");
  const u = cli(sb, ["undo", dir, "--apply"]);
  assert.equal(u.status, 0, u.out);
  assert.ok(has(dir, "inbox/IMG_3001.jpg") && !has(dir, "media/IMG_3001.jpg"));
}));

test("the briefing for a person (--text alone) only looks: it never moves anything", sandboxed((sb) => {
  const dir = organized(sb);
  write(dir, "inbox/IMG_3001.jpg", makeBytes.jpg("new photo"));
  const out = script(sb, dir, "brief.mjs", ["--text"]).out;
  assert.ok(has(dir, "inbox/IMG_3001.jpg"));
  assert.match(out, /📥 Inbox: 2 waiting: IMG_3001\.jpg, untitled\.md; 1 matches your rules/);
}));

test("an exact copy of something already in the folder is named, not filed", sandboxed((sb) => {
  const dir = organized(sb);
  write(dir, "inbox/lasagna-again.md", read(dir, "notes/recipe-lasagna.md"));
  const out = session(sb, dir).out;
  assert.ok(has(dir, "inbox/lasagna-again.md"));
  assert.match(out, /lasagna-again\.md is the same as notes\/recipe-lasagna\.md/);
}));

test("a new kind: Yes files it, Yes-and-always adds a rule, Not now hides it until more of that kind arrive", sandboxed((sb) => {
  const dir = organized(sb);
  write(dir, "inbox/random-thought.md", "# A thought\n\nMaybe learn the piano.\n");
  const dry = cli(sb, ["file", dir, "inbox/random-thought.md", "--to", "notes"], { env: ME });
  assert.match(dry.out, /would move .*random-thought\.md.*notes\/random-thought\.md/);
  assert.ok(has(dir, "inbox/random-thought.md"));
  assert.equal(cli(sb, ["file", dir, "inbox/random-thought.md", "--to", "notes", "--apply"], { env: ME }).status, 0);
  assert.ok(has(dir, "notes/random-thought.md"));

  write(dir, "inbox/song.mp3", makeBytes.jpg("song"));
  assert.equal(cli(sb, ["file", dir, "inbox/song.mp3", "--to", "media/audio", "--always", "--apply"], { env: ME }).status, 0);
  assert.ok(JSON.parse(read(dir, "inbox/rules.json")).rules.some((r) => r.kind === "media" && r.to === "media/audio"));
  write(dir, "inbox/song2.mp3", makeBytes.jpg("song2"));
  session(sb, dir);
  assert.ok(has(dir, "media/audio/song2.mp3"), "the new rule files the next one by itself");

  write(dir, "inbox/idea.md", "# Idea\n\nSomething.\n");
  assert.equal(cli(sb, ["file", dir, "inbox/idea.md", "--not-now", "--apply"], { env: ME }).status, 0);
  assert.doesNotMatch(session(sb, dir).out, /Inbox: .*waiting/, "not now: quiet");
  write(dir, "inbox/idea-2.md", "# Idea 2\n\nMore.\n");
  assert.match(session(sb, dir).out, /📥 Inbox: 3 waiting/, "more of that kind: it asks again (with untitled.md and idea.md)");
}));

test("in a later session the folder's own script takes the answer (no repo-fit needed), and the rulebook says how", sandboxed((sb) => {
  const dir = organized(sb);
  assert.match(read(dir, "AGENTS.md"), /ask the person once per kind.*file\.mjs <item> --to <folder>/s);
  write(dir, "inbox/random-thought.md", "# A thought\n\nMaybe learn the piano.\n");
  const dry = script(sb, dir, "file.mjs", ["inbox/random-thought.md", "--to", "notes"]);
  assert.match(dry.out, /Dry run: would move/);
  const r = script(sb, dir, "file.mjs", ["inbox/random-thought.md", "--to", "notes", "--apply"]);
  assert.equal(r.status, 0, r.out);
  assert.ok(has(dir, "notes/random-thought.md"));
}));
