// The safe move engine: plan every move first, refuse what must stay, rewrite links both ways in each link's own style,
// tie the yes to the exact plan, journal before the first move, verify after, roll back on failure, undo with a receipt.
import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { makeFixture } from "../dev/fixtures.mjs";
import { locator, safety, sameTree, snapshot } from "../dev/score.mjs";
import { applyMoves, planMoves, recover, scanLinks } from "../scripts/playbook/move.mjs";
import { cli, has, read, sandboxed, tree, write } from "./helpers.mjs";

const folder = (sb, name, files) => {
  const d = join(sb.dir, name);
  mkdirSync(d, { recursive: true });
  for (const [p, c] of Object.entries(files)) write(d, p, c);
  return d;
};
const dests = (text) => scanLinks(text).map((l) => `${l.kind}:${l.dest}`);

test("the link scanner finds every link form and skips code", () => {
  const text = [
    "---",
    'related: "[[notes/a]]"',
    "---",
    "[inline](a.md#part \"Title\") and ![img](pics/x.png) and [angle](<my note.md>) and [pct](my%20note.md)",
    "[ref]: refs/r.md \"Ref title\"",
    '<img src="pics/y.png"> <a href="b.md">b</a>',
    "[[wiki]] [[folder/deep|Alias]] [[c#Heading]] ![[pic.png|100]]",
    "`[not](code.md)`",
    "```",
    "[not](fenced.md) [[fenced]]",
    "```",
    "https://example.com and [web](https://example.com/x.md) and [top](#local)",
  ].join("\n");
  assert.deepEqual(dests(text), [
    "wiki:notes/a",
    "inline:a.md#part",
    "inline:pics/x.png",
    "inline:my note.md",
    "inline:my%20note.md",
    "ref:refs/r.md",
    "html:pics/y.png",
    "html:b.md",
    "wiki:wiki",
    "wiki:folder/deep",
    "wiki:c#Heading",
    "wiki:pic.png",
  ]);
});

const notes = {
  "notes/a.md": "# A\n\nSee [b](../b.md), ![pic](../pics/x.png) and [[b]].\n",
  "b.md": [
    "# B",
    "",
    "[A](notes/a.md#part \"Title\") [dot](./notes/a.md) [no ext](notes/a) [angle](<notes/a.md>)",
    "[[notes/a|Alias]] ![[notes/a]] [[a]]",
    "[ref][r]",
    "",
    "[r]: notes/a.md",
    "",
    "```",
    "[code](notes/a.md)",
    "```",
    "",
  ].join("\n"),
  "space note.md": "# Space\n\nLinked from [pct](my%20folder/z.md).\n",
  "my folder/z.md": "# Z\n",
  "pics/x.png": "png",
};

test("a move rewrites links to the moved file and inside it, each in its own style; code blocks stay", sandboxed((sb) => {
  const d = folder(sb, "n", notes);
  const plan = planMoves(d, [{ from: "notes/a.md", to: "topics/deep/a.md", why: "test" }]);
  assert.deepEqual(plan.refused, []);
  const r = applyMoves(d, plan);
  assert.equal(r.ok, true, r.text);
  assert.ok(!has(d, "notes/a.md") && has(d, "topics/deep/a.md"));
  assert.equal(read(d, "topics/deep/a.md"), "# A\n\nSee [b](../../b.md), ![pic](../../pics/x.png) and [[b]].\n");
  const b = read(d, "b.md");
  assert.match(b, /\[A\]\(topics\/deep\/a\.md#part "Title"\)/);
  assert.match(b, /\[dot\]\(\.\/topics\/deep\/a\.md\)/);
  assert.match(b, /\[no ext\]\(topics\/deep\/a\)/);
  assert.match(b, /\[angle\]\(<topics\/deep\/a\.md>\)/);
  assert.match(b, /\[\[topics\/deep\/a\|Alias\]\] !\[\[topics\/deep\/a\]\] \[\[a\]\]/);
  assert.match(b, /\[r\]: topics\/deep\/a\.md/);
  assert.match(b, /```\n\[code\]\(notes\/a\.md\)\n```/, "a link inside a code block is not a link");
  assert.ok(!existsSync(join(d, "notes")), "a folder the moves emptied is removed");
}));

test("a name with spaces keeps its link style: %20 stays %20", sandboxed((sb) => {
  const d = folder(sb, "s", notes);
  const r = applyMoves(d, planMoves(d, [{ from: "my folder/z.md", to: "other place/z.md" }]));
  assert.equal(r.ok, true, r.text);
  assert.match(read(d, "space note.md"), /\[pct\]\(other%20place\/z\.md\)/);
}));

test("a link to a folder follows the folder when all its files move to the same new place", sandboxed((sb) => {
  const d = folder(sb, "fl", { "MAP.md": "- [old/](old/)\n- [keep/](<keep/>)\n", "old/a.md": "# A\n", "old/sub/b.md": "# B\n", "keep/c.md": "# C\n", "keep/d.md": "# D\n" });
  const r = applyMoves(d, planMoves(d, [{ from: "old/a.md", to: "archive/2026-old/a.md" }, { from: "old/sub/b.md", to: "archive/2026-old/sub/b.md" }, { from: "keep/c.md", to: "notes/c.md" }]));
  assert.equal(r.ok, true, r.text);
  assert.equal(read(d, "MAP.md"), "- [old/](archive/2026-old/)\n- [keep/](<keep/>)\n");
  assert.ok(!has(d, "old"));
}));

test("a move that renames a file updates bare [[name]] links; a move that keeps the name leaves them alone", sandboxed((sb) => {
  const d = folder(sb, "w", { "review.md": "See ![[chart.png|200]] and [[plan#Goals|the plan]].\n", "att/chart.png": "png", "plan.md": "# Plan\n" });
  assert.equal(applyMoves(d, planMoves(d, [{ from: "att/chart.png", to: "images/review-chart.png" }, { from: "plan.md", to: "notes/plan.md" }])).ok, true);
  assert.equal(read(d, "review.md"), "See ![[review-chart.png|200]] and [[plan#Goals|the plan]].\n");
}));

test("the plan refuses code, files that code or rules name, protected paths, dot folders and taken destinations", sandboxed((sb) => {
  const d = folder(sb, "r", {
    "app.js": 'const prices = readFileSync("data/prices.md", "utf8");\n',
    "data/prices.md": "# Prices\n",
    "AGENTS.md": "# Rules\n\nKeep the plan in plan.md at the top.\n",
    "plan.md": "# Plan\n",
    "private/secret.md": "# Secret\n",
    ".hidden/h.md": "# H\n",
    "free.md": "# Free\n",
    "taken.md": "# Taken\n",
    "other.md": "# Other\n",
  });
  const plan = planMoves(d, [
    { from: "app.js", to: "code/app.js" },
    { from: "data/prices.md", to: "notes/prices.md" },
    { from: "plan.md", to: "notes/plan.md" },
    { from: "private/secret.md", to: "notes/secret.md" },
    { from: ".hidden/h.md", to: "notes/h.md" },
    { from: "free.md", to: "taken.md" },
    { from: "other.md", to: "notes/x.md" },
    { from: "free.md", to: "notes/x.md" },
    { from: "missing.md", to: "notes/missing.md" },
  ], { protect: ["private/"] });
  const why = Object.fromEntries(plan.refused.map((x) => [`${x.from}>${x.to}`, x.why]));
  assert.match(why["app.js>code/app.js"], /code/i);
  assert.match(why["data/prices.md>notes/prices.md"], /app\.js/);
  assert.match(why["plan.md>notes/plan.md"], /AGENTS\.md/);
  assert.match(why["private/secret.md>notes/secret.md"], /protected/i);
  assert.match(why[".hidden/h.md>notes/h.md"], /hidden|dot/i);
  assert.match(why["free.md>taken.md"], /already/i);
  assert.match(why["free.md>notes/x.md"], /twice|same/i);
  assert.match(why["missing.md>notes/missing.md"], /not there|missing/i);
  assert.deepEqual(plan.moves.map((m) => m.from), ["other.md"]);
}));

test("a plain-text mention in a note is listed, not changed", sandboxed((sb) => {
  const d = folder(sb, "m", { "a.md": "# A\n", "log.md": "# Log\n\nMoved things around a.md today.\n" });
  const plan = planMoves(d, [{ from: "a.md", to: "notes/a.md" }]);
  assert.deepEqual(plan.mentions.map((m) => m.file), ["log.md"]);
  assert.equal(applyMoves(d, plan).ok, true);
  assert.match(read(d, "log.md"), /around a\.md today/);
}));

test("the yes is tied to the exact plan: a file changed after the preview means nothing moves", sandboxed((sb) => {
  const d = folder(sb, "f", notes);
  const plan = planMoves(d, [{ from: "notes/a.md", to: "topics/a.md" }]);
  write(d, "b.md", `${read(d, "b.md")}\nOne more line.\n`);
  const r = applyMoves(d, plan);
  assert.equal(r.ok, false);
  assert.match(r.text, /changed since/i);
  assert.ok(has(d, "notes/a.md") && !has(d, "topics/a.md"));
}));

test("a failure halfway rolls everything back and says so", sandboxed((sb) => {
  const d = folder(sb, "x", { "a.md": "# A\n\n[b](b.md)\n", "b.md": "# B\n\n[a](a.md)\n", "locked/keep.md": "# Keep\n" });
  const before = snapshot(d);
  const plan = planMoves(d, [{ from: "a.md", to: "notes/a.md" }, { from: "b.md", to: "locked/b.md" }]);
  chmodSync(join(d, "locked"), 0o555);
  try {
    const r = applyMoves(d, plan);
    assert.equal(r.ok, false);
    assert.match(r.text, /put back|rolled back/i);
  } finally {
    chmodSync(join(d, "locked"), 0o755);
  }
  assert.deepEqual(sameTree(before, snapshot(d)).same, true, JSON.stringify(sameTree(before, snapshot(d))));
  assert.ok(!has(d, ".playbook/journal.json"));
}));

test("after a crash the journal puts the folder back before anything else runs", sandboxed((sb) => {
  const d = folder(sb, "c", notes);
  const before = snapshot(d);
  const r = applyMoves(d, planMoves(d, [{ from: "notes/a.md", to: "topics/a.md" }, { from: "pics/x.png", to: "images/x.png" }]), { crashAfter: 2 });
  assert.equal(r.crashed, true);
  assert.ok(has(d, ".playbook/journal.json"));
  const rec = recover(d);
  assert.match(rec.text, /put back/i);
  assert.ok(!has(d, ".playbook/journal.json"));
  assert.equal(sameTree(before, snapshot(d)).same, true, JSON.stringify(sameTree(before, snapshot(d))));
}));

test("undo moves files back, restores edited links and emptied folders, and refuses a file changed since", sandboxed((sb) => {
  const d = folder(sb, "u", notes);
  const original = snapshot(d);
  assert.equal(applyMoves(d, planMoves(d, [{ from: "notes/a.md", to: "topics/a.md" }, { from: "pics/x.png", to: "images/x.png" }])).ok, true);
  const dry = cli(sb, ["undo", d]);
  assert.match(dry.out, /move `topics\/a\.md` back to `notes\/a\.md`/);
  assert.ok(has(d, "topics/a.md"), "a dry run changes nothing");
  const u = cli(sb, ["undo", d, "--apply"]);
  assert.equal(u.status, 0, u.out);
  assert.equal(sameTree(original, snapshot(d)).same, true, JSON.stringify(sameTree(original, snapshot(d))));

  const d2 = folder(sb, "u2", notes);
  assert.equal(applyMoves(d2, planMoves(d2, [{ from: "notes/a.md", to: "topics/a.md" }])).ok, true);
  write(d2, "topics/a.md", "# A, edited by the person\n");
  const u2 = cli(sb, ["undo", d2, "--apply"]);
  assert.match(u2.out, /changed since/);
  assert.equal(read(d2, "topics/a.md"), "# A, edited by the person\n");
  assert.ok(!has(d2, "notes/a.md"));
}));

for (const name of ["spaghetti", "flat-notes", "code-sprawl"]) {
  test(`whole folder (${name}): every non-code file moved into folders, nothing lost, code untouched, links kept, undo exact`, sandboxed((sb) => {
    const { dir, truth } = makeFixture(name, sb.dir);
    const before = snapshot(dir);
    const top = [...before.keys()].filter((p) => !p.includes("/") && !/^(README|AGENTS|CLAUDE)\.md$|^package\.json$/.test(p));
    const sub = [...before.keys()].filter((p) => p.includes("/") && !truth.code.includes(p) && !p.startsWith("."));
    const moves = [...top.map((p) => ({ from: p, to: `sorted/${p}` })), ...sub.slice(0, 6).map((p) => ({ from: p, to: `sorted/${p.replaceAll("/", "-")}` }))];
    const plan = planMoves(dir, moves);
    for (const p of [...truth.code, ...truth.referenced]) assert.ok(!plan.moves.some((m) => m.from === p), `${p} must not move`);
    const r = applyMoves(dir, plan);
    assert.equal(r.ok, true, r.text);
    const after = snapshot(dir);
    const s = safety(before, after, truth, locator(before, after));
    assert.deepEqual(s.lost, []);
    assert.deepEqual(s.codeMoved, []);
    assert.ok(s.linksAfter >= s.linksBefore, `working links ${s.linksBefore} → ${s.linksAfter}`);
    assert.equal(cli(sb, ["undo", dir, "--apply"]).status, 0);
    const back = sameTree(before, snapshot(dir));
    assert.equal(back.same, true, JSON.stringify(back));
    assert.deepEqual(readdirSync(join(dir, ".playbook/receipts")).filter((f) => f.endsWith(".undone")).length, 1);
    assert.deepEqual(tree(dir).filter((p) => !p.startsWith(".playbook/")), [...before.keys()].sort());
  }));
}

test("a file named by config in another case (TODO.md for todo.md) stays", sandboxed((sb) => {
  const d = folder(sb, "case", { "playbook.json": '{ "paths": { "board": "TODO.md" } }\n', "todo.md": "# Todo\n" });
  const plan = planMoves(d, [{ from: "todo.md", to: "notes/todo.md" }]);
  assert.deepEqual(plan.moves, []);
  assert.match(plan.refused[0].why, /playbook\.json/);
}));
