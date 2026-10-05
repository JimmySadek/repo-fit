// The map: MAP.md lists every area in one line, each area has an index page listing its notes, and the rulebook
// points at the map. Built from the folder by a script, rebuilt as a cache, never touching the person's own text.
import assert from "node:assert/strict";
import { test } from "node:test";
import { makeFixture } from "../dev/fixtures.mjs";
import { find, linkEdges, orient, snapshot } from "../dev/score.mjs";
import { pages, summary } from "../scripts/playbook/map.mjs";
import { ROOT, cli, has, read, repo, sandboxed, script, write } from "./helpers.mjs";

const mixed = {
  "notes/a.md": "# Alpha\n\nThe first note, about the alpha plan.\n",
  "notes/sub/b.md": "# Beta\n\nA second note in a sub folder.\n",
  "website/package.json": "{}\n",
  "website/app.js": "export const a = 1;\n",
  "website/README.md": "# Website\n\nThe shop front.\n",
  "photos/x.jpg": "jpg",
  "loose.md": "# Loose\n\nA note left at the top.\n",
  "pic.png": "png",
};

const writeAll = (d, map) => {
  for (const [p, c] of map) write(d, p, c);
};
// Every link in the generated pages must point at something that exists.
const brokenIn = (d, list) => linkEdges(snapshot(d), new Set(list)).filter((e) => !e.to);

test("the map has one line per area and lists the loose notes at the top; code and media folders get no index page", sandboxed((sb) => {
  const d = repo(sb, "m", { files: mixed });
  const p = pages(d);
  assert.deepEqual([...p.keys()].sort(), ["MAP.md", "notes/INDEX.md"]);
  const map = p.get("MAP.md");
  assert.match(map, /\[notes\/\]\(notes\/INDEX\.md\): 2 notes/);
  assert.match(map, /\[website\/\]\(website\/README\.md\): a program .*stays where it is/i);
  assert.match(map, /\[photos\/\]\(photos\/\): 1 image/);
  assert.match(map, /\[Loose\]\(loose\.md\): A note left at the top\./);
  assert.match(map, /1 image/);
  assert.match(p.get("notes/INDEX.md"), /\[Alpha\]\(a\.md\): The first note/);
  assert.match(p.get("notes/INDEX.md"), /\[Beta\]\(sub\/b\.md\)/);
  writeAll(d, p);
  assert.deepEqual(brokenIn(d, ["MAP.md", "notes/INDEX.md"]), []);
  const f = find(snapshot(d));
  assert.equal(f.found, f.total, `unreachable: ${f.unreachable}`);
}));

test("a note's line uses its description, else its first real paragraph, without link syntax, kept short", () => {
  assert.equal(summary("---\ndescription: \"Plan for Q4\"\n---\n# T\n\nBody.\n"), "Plan for Q4");
  assert.equal(summary("# T\n\n- a list\n\n> quote\n\nSee [the plan](plan.md) and [[budget|the budget]] for **details** here.\n"), "See the plan and the budget for details here.");
  const long = summary(`# T\n\n${"word ".repeat(60)}\n`);
  assert.ok(long.length <= 101 && long.endsWith("…"), long);
  assert.equal(summary("# Only a title\n"), "");
});

test("a README that already lists its folder's notes is the index; one that misses notes gets an INDEX.md beside it", sandboxed((sb) => {
  const d = repo(sb, "r", { files: { "kept/README.md": "# Kept\n\n- [One](one.md)\n- [Two](two.md)\n", "kept/one.md": "# One\n", "kept/two.md": "# Two\n", "partial/README.md": "# Partial\n\n- [One](one.md)\n", "partial/one.md": "# One\n", "partial/two.md": "# Two\n" } });
  const p = pages(d);
  assert.ok(!p.has("kept/INDEX.md"));
  assert.match(p.get("MAP.md"), /\[kept\/\]\(kept\/README\.md\)/);
  assert.ok(p.has("partial/INDEX.md"));
  assert.match(p.get("partial/INDEX.md"), /\[Two\]\(two\.md\)/);
}));

test("rebuilding keeps the person's text above and below the list; their own MAP.md or INDEX.md is never touched", sandboxed((sb) => {
  const d = repo(sb, "k", { files: mixed });
  writeAll(d, pages(d));
  write(d, "MAP.md", read(d, "MAP.md").replace("# Map", "# Map\n\nMy own words on top.").concat("\nMy own words below.\n"));
  write(d, "notes/c.md", "# Gamma\n\nA third note.\n");
  const again = pages(d);
  assert.match(again.get("MAP.md"), /My own words on top\.[\s\S]*3 notes[\s\S]*My own words below\./);
  const own = repo(sb, "own", { files: { "MAP.md": "# My map\n\nHand made.\n", "notes/INDEX.md": "# Mine\n", "notes/a.md": "# A\n" } });
  assert.deepEqual([...pages(own).keys()], []);
}));

test("names with spaces and brackets are linked so the links work", sandboxed((sb) => {
  const d = repo(sb, "s", { files: { "Meeting notes.md": "# Meeting\n\nTalk.\n", "my stuff/a (1).md": "# A one\n\nText here.\n" } });
  writeAll(d, pages(d));
  assert.deepEqual(brokenIn(d, ["MAP.md", "my stuff/INDEX.md"]), []);
  assert.match(read(d, "MAP.md"), /\]\(<Meeting notes\.md>\)/);
}));

test("map.mjs prints what would change and writes only with --write", sandboxed((sb) => {
  const d = repo(sb, "c", { files: mixed });
  write(d, "scripts/playbook/map.mjs", read(ROOT, "scripts/playbook/map.mjs"));
  const dry = script(sb, d, "map.mjs");
  assert.equal(dry.status, 0, dry.out);
  assert.match(dry.out, /MAP\.md/);
  assert.ok(!has(d, "MAP.md"));
  assert.equal(script(sb, d, "map.mjs", ["--write"]).status, 0);
  assert.ok(has(d, "MAP.md") && has(d, "notes/INDEX.md"));
}));

test("the recommended set adds the map, the index pages and a pointer in the rulebook; undo takes them away", sandboxed((sb) => {
  const d = repo(sb, "notes", { commit: true, files: { "notes/one.md": "# One\n\nFirst.\n", "notes/two.md": "# Two\n\nSecond.\n" } });
  const rec = JSON.parse(cli(sb, ["audit", d, "--json"]).stdout).plan.recommended;
  for (const id of ["A-13", "D-11"]) assert.ok(rec.steps.includes(id), `${id} in ${rec.steps}`);
  assert.ok(rec.gains.some((g) => /MAP\.md/.test(g)));
  const r = cli(sb, ["apply", d, "--steps", rec.steps.join(","), ...rec.flags.split(" "), "--apply"]);
  assert.equal(r.status, 0, r.out);
  assert.ok(has(d, "MAP.md") && has(d, "notes/INDEX.md"));
  assert.match(read(d, "AGENTS.md"), /<!-- repo-fit:pointer begin -->[\s\S]*\[MAP\.md\]\(MAP\.md\)[\s\S]*<!-- repo-fit:pointer end -->/);
  assert.ok(has(d, "scripts/playbook/map.mjs"));
  const o = orient(d, snapshot(d));
  assert.ok(o.map && o.pointer && o.covered === o.entries, JSON.stringify(o));
  assert.equal(cli(sb, ["undo", d, "--apply"]).status, 0);
  assert.ok(!has(d, "MAP.md") && !has(d, "notes/INDEX.md"));
}));

test("the map's own links do not hide notes nothing else links to, in the check and in the audit", sandboxed((sb) => {
  const d = repo(sb, "lonely", { commit: true, files: { "README.md": "# Notes\n\nStart with [one](notes/one.md).\n", "notes/one.md": "# One\n\nFirst.\n", "notes/lonely.md": "# Lonely\n\nNobody links here.\n" } });
  const rec = JSON.parse(cli(sb, ["audit", d, "--json"]).stdout).plan.recommended;
  assert.equal(cli(sb, ["apply", d, "--steps", rec.steps.join(","), ...rec.flags.split(" "), "--apply"]).status, 0);
  assert.ok(has(d, "MAP.md") && has(d, "notes/INDEX.md"));
  const check = script(sb, d, "check.mjs");
  assert.match(check.out, /nothing links to:.*lonely\.md/, check.out);
  assert.doesNotMatch(check.out, /nothing links to:.*(INDEX|one)\.md/, check.out);
  const orphans = JSON.parse(cli(sb, ["audit", d, "--json"]).stdout).details.orphans;
  assert.deepEqual(orphans, ["notes/lonely.md"]);
}));

test("a code repo with its own rulebook gets the pointer added to its AGENTS.md, after its own rules", sandboxed((sb) => {
  const d = repo(sb, "app", { commit: true, files: { "package.json": JSON.stringify({ name: "app", scripts: { test: "node --test" } }), "src/a.js": "1\n", "src/b.js": "2\n", "docs/setup.md": "# Setup\n\nRun it.\n", "AGENTS.md": "# Rules\n\nKeep functions small.\n" } });
  const rec = JSON.parse(cli(sb, ["audit", d, "--json"]).stdout).plan.recommended;
  assert.equal(cli(sb, ["apply", d, "--steps", rec.steps.join(","), ...rec.flags.split(" "), "--apply"]).status, 0);
  const agents = read(d, "AGENTS.md");
  assert.ok(agents.startsWith("# Rules\n\nKeep functions small."), agents);
  assert.match(agents, /repo-fit:pointer begin/);
  assert.match(read(d, "MAP.md"), /\[src\/\]\(src\/\): a program/);
  assert.equal(JSON.parse(cli(sb, ["audit", d, "--json"]).stdout).plan.recommended.steps.length, 0, "nothing is recommended twice");
}));

test("score: on the everything-folder, every note is within two links of MAP.md after the recommended set", sandboxed((sb) => {
  const { dir } = makeFixture("spaghetti", sb.dir);
  const rec = JSON.parse(cli(sb, ["audit", dir, "--json"]).stdout).plan.recommended;
  assert.equal(cli(sb, ["apply", dir, "--steps", rec.steps.join(","), ...rec.flags.split(" "), "--apply"]).status, 0);
  const after = snapshot(dir);
  const f = find(after);
  assert.equal(f.found, f.total, `unreachable: ${f.unreachable}`);
  const o = orient(dir, after);
  assert.ok(o.map && o.pointer && o.covered === o.entries, JSON.stringify(o));
}));
