// The measurement tools (dev/): the test folders are the same every run, and the scorer counts what it should.
// If these fail, the outcome scores cannot be trusted.
import assert from "node:assert/strict";
import { renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { FIXTURES, makeFixture } from "../dev/fixtures.mjs";
import { find, landed, locator, loose, oneHome, openWork, orient, parseLinks, resolveLink, safety, snapshot, surfaced } from "../dev/score.mjs";
import { has, sandboxed, write } from "./helpers.mjs";

test("every test folder is built the same way every time, and its truth names files that exist", sandboxed((sb) => {
  for (const name of FIXTURES) {
    const a = makeFixture(name, join(sb.dir, "one"));
    const b = makeFixture(name, join(sb.dir, "two"));
    const sa = snapshot(a.dir);
    const sb2 = snapshot(b.dir);
    assert.deepEqual([...sa.keys()], [...sb2.keys()], name);
    for (const [p, f] of sa) assert.equal(f.hash, sb2.get(p).hash, `${name}: ${p}`);
    const t = a.truth;
    for (const p of [...t.code, ...t.referenced, ...t.dupGroups.flatMap((g) => g.files), ...t.problems.map((x) => x.file), ...t.drops.map((d) => d.anchor).filter(Boolean)]) assert.ok(has(a.dir, p), `${name}: ${p} exists`);
    const all = Object.values(Object.fromEntries([...sa].filter(([, f]) => f.md).map(([p, f]) => [p, f.text]))).join("\n");
    for (const i of t.openItems) assert.ok(all.includes(i), `${name}: open item "${i}" is planted`);
  }
}));

test("links: code is skipped; angle brackets, %20, reference links, wiki links with aliases and folders resolve", sandboxed((sb) => {
  const text = "[a](my%20note.md) [b](<my note.md>) ![i](img/p.png) [[other|Alias]] [[sub/deep]]\n`[no](x.md)`\n```\n[no](y.md)\n```\n[ref]: docs/\n[x](https://example.com)\n";
  const links = parseLinks(text);
  assert.deepEqual(links.map((l) => l.target), ["my%20note.md", "my note.md", "img/p.png", "other", "sub/deep", "docs/", "https://example.com"]);
  const files = new Map(["my note.md", "img/p.png", "x/other.md", "sub/deep.md", "docs/INDEX.md"].map((p) => [p, {}]));
  assert.deepEqual(links.map((l) => resolveLink(files, "n.md", l)), ["my note.md", "my note.md", "img/p.png", "x/other.md", "sub/deep.md", "docs/INDEX.md", undefined]);
}));

test("find counts notes within two links of MAP.md, and leaves out front doors and the map's own pages", sandboxed((sb) => {
  const d = join(sb.dir, "f");
  write(d, "MAP.md", "# Map\n\n- [Notes](notes/INDEX.md)\n");
  write(d, "notes/INDEX.md", "- [One](one.md)\n");
  write(d, "notes/one.md", "# One\n");
  write(d, "notes/two.md", "# Two\n");
  write(d, "README.md", "# Front door\n");
  write(d, "loose.md", "# Loose\n");
  write(d, "photo.jpg", "x");
  const r = find(snapshot(d));
  assert.equal(r.total, 3);
  assert.equal(r.found, 1);
  assert.deepEqual(r.unreachable, ["loose.md", "notes/two.md"]);
  const o = orient(d, snapshot(d));
  assert.equal(o.map, true);
  assert.equal(o.covered, 1); // notes/ yes; loose.md no; README.md and photo.jpg need no line
  assert.equal(o.entries, 2);
}));

test("a note moved with its links rewritten is found, not lost; a deleted file is lost", sandboxed((sb) => {
  const d = join(sb.dir, "s");
  write(d, "a.md", "# A\n\n[b](b.md)\n");
  write(d, "b.md", "# B\n");
  write(d, "c.md", "# C\n");
  write(d, "app.js", "x\n");
  const before = snapshot(d);
  renameSync(join(d, "a.md"), join(d, "sub-a.md"));
  write(d, "notes/a.md", "# A\n\n[b](../b.md)\n");
  rmSync(join(d, "sub-a.md"));
  let after = snapshot(d);
  let locate = locator(before, after);
  assert.equal(locate("a.md"), "notes/a.md");
  let s = safety(before, after, { code: ["app.js"] }, locate);
  assert.deepEqual(s.lost, []);
  assert.deepEqual(s.codeMoved, []);
  assert.equal(s.linksAfter, s.linksBefore);
  rmSync(join(d, "b.md"));
  write(d, "c.md", "# C\n\nA new line, written in place.\n");
  after = snapshot(d);
  locate = locator(before, after);
  s = safety(before, after, { code: ["app.js"] }, locate);
  assert.deepEqual(s.lost, ["b.md"], "an edited file is not lost; a deleted one is");
}));

test("a problem counts as surfaced only when the output says what kind of problem it is", () => {
  const truth = { problems: [{ kind: "duplicate", file: "a copy.md" }, { kind: "orphan", file: "b.md" }, { kind: "stale", file: "c.md" }, { kind: "broken-link", file: "d.md", target: "gone.md" }] };
  const same = (p) => p;
  const listedAsOrphans = "2 note(s) nothing links to: a copy.md, b.md\nc.md\n";
  assert.deepEqual(surfaced(listedAsOrphans, truth, same).missed, ["duplicate: a copy.md", "stale: c.md", "broken-link: d.md"]);
  const full = "a copy.md is an exact copy of a.md\n1 note untouched for 180+ days: c.md\nd.md:3 broken link gone.md\nnothing links to: b.md\n";
  assert.equal(surfaced(full, truth, same).found, 4);
});

test("loose files leave out front doors, manifests and files the code uses; duplicates and open work are counted", sandboxed((sb) => {
  const d = join(sb.dir, "l");
  for (const [p, c] of Object.entries({ "README.md": "#", "package.json": "{}", "logo.png": "x", "photo.jpg": "y", "notes.md": "- [ ] Call Sam\n", "a.md": "same\n", "archive/a.md": "same\n", "b.md": "- [ ] Call Sam\n- [ ] Pay rent\n" })) write(d, p, c);
  const files = snapshot(d);
  assert.deepEqual(loose(files, { referenced: ["logo.png"] }), ["a.md", "b.md", "notes.md", "photo.jpg"]);
  const locate = locator(files, files);
  assert.deepEqual(oneHome(files, { dupGroups: [{ kind: "exact", files: ["a.md", "archive/a.md"] }] }, locate).exact, { resolved: 1, total: 1 });
  assert.deepEqual(openWork(files, { openItems: ["Call Sam", "Pay rent"] }), { where: "b.md", found: 2, total: 2 });
}));

test("new input counts as landed right only beside its family in a folder, or in inbox/", sandboxed((sb) => {
  const d = join(sb.dir, "n");
  write(d, "media/IMG_1.jpg", "one");
  write(d, "media/IMG_2.jpg", "two");
  write(d, "IMG_3.jpg", "three");
  write(d, "inbox/thought.md", "idea");
  const before = snapshot(d);
  const hash = (p) => before.get(p).hash;
  const truth = { drops: [{ name: "IMG_2.jpg", anchor: "media/IMG_1.jpg" }, { name: "IMG_3.jpg", anchor: "media/IMG_1.jpg" }, { name: "thought.md", anchor: null }] };
  const r = landed(before, truth, { "IMG_2.jpg": hash("media/IMG_2.jpg"), "IMG_3.jpg": hash("IMG_3.jpg"), "thought.md": hash("inbox/thought.md") }, locator(before, before));
  assert.equal(r.found, 2);
  assert.deepEqual(r.wrong, ["IMG_3.jpg → IMG_3.jpg"]);
}));
