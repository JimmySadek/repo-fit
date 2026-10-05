// Open work in one list: unchecked boxes and TODO: lines are collected where they already are, and MAP.md shows the
// count and the first items, each linked to its note. Nothing moves out of the notes. Done items, code blocks, the
// archive and repo-fit's own pages are left out.
import assert from "node:assert/strict";
import { test } from "node:test";
import { makeFixture } from "../dev/fixtures.mjs";
import { pages } from "../scripts/playbook/map.mjs";
import { cli, read, repo, sandboxed, script, write } from "./helpers.mjs";

const ME = { REPO_FIT_TODAY: "2026-10-05", GIT_AUTHOR_NAME: "Test Person", GIT_AUTHOR_EMAIL: "test@example.com", GIT_COMMITTER_NAME: "Test Person", GIT_COMMITTER_EMAIL: "test@example.com" };

test("MAP.md lists the open items with links to their notes; done items, code blocks and the archive are left out", sandboxed((sb) => {
  const d = repo(sb, "o", { files: {
    "notes/trip.md": "# Trip\n\n- [ ] Buy a rail pass\n- [x] Book the flight\n* [ ] Pack the adapter\n",
    "notes/car.md": "# Car\n\nTODO: book the winter tyres\n\n```\n- [ ] not a task, just an example\n```\n",
    "archive/old.md": "# Old\n\n- [ ] an old task nobody needs\n",
  } });
  const map = pages(d).get("MAP.md");
  assert.match(map, /\*\*Open work\*\* \(3 items in 2 notes\)/);
  assert.match(map, /- Buy a rail pass \(\[Trip\]\(notes\/trip\.md\)\)/);
  assert.match(map, /- Pack the adapter/);
  assert.match(map, /- book the winter tyres \(\[Car\]\(notes\/car\.md\)\)/);
  assert.doesNotMatch(map, /Book the flight|not a task|old task/);
  assert.doesNotMatch(map, /- \[ \]/, "no checkboxes in the map: the tasks stay in their notes");
}));

test("a long list shows the first 10 and a count; the folder's own map script prints all of them", sandboxed((sb) => {
  const items = Array.from({ length: 13 }, (_, i) => `- [ ] Task number ${i + 1}`).join("\n");
  const d = repo(sb, "long", { files: { "notes/big.md": `# Big\n\n${items}\n` } });
  write(d, "scripts/playbook/map.mjs", read(process.cwd(), "scripts/playbook/map.mjs"));
  const map = pages(d).get("MAP.md");
  assert.match(map, /Task number 10\b/);
  assert.doesNotMatch(map, /Task number 11\b/);
  assert.match(map, /and 3 more: `node scripts\/playbook\/map\.mjs --open` lists them all/);
  const all = script(sb, d, "map.mjs", ["--open"]).out;
  assert.match(all, /Task number 13/);
}));

test("the briefing says how much open work there is, in one line, with where to look", sandboxed((sb) => {
  const { dir } = makeFixture("spaghetti", sb.dir);
  const rec = JSON.parse(cli(sb, ["audit", dir, "--json"], { env: ME }).stdout).plan.recommended;
  const code = cli(sb, ["organize", dir], { env: ME }).stdout.match(/--apply --plan (\w+)/)[1];
  assert.equal(cli(sb, ["organize", dir, "--apply", "--plan", code], { env: ME }).status, 0);
  assert.equal(cli(sb, ["apply", dir, "--steps", rec.steps.join(","), ...rec.flags.split(" "), "--apply"], { env: ME }).status, 0);
  const out = script(sb, dir, "brief.mjs", ["--text", "--file"]).out;
  assert.match(out, /✅ Open work: 10 items in 4 notes \(see MAP\.md\)/);
  assert.match(read(dir, "MAP.md"), /Fix the website footer/);
}));
