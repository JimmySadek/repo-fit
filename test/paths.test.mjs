// The repo's own paths: the core block names the files the repo really has, the word cap counts the body only,
// and a people register kept as data counts as the people record.
import assert from "node:assert/strict";
import { test } from "node:test";
import { bodyWords } from "../scripts/playbook/lib.mjs";
import { cli, json, read, repo, sandboxed, script, write } from "./helpers.mjs";

const apply = (sb, d, steps, extra = []) => cli(sb, ["apply", d, "--steps", steps, "--tool", "claude", "--hooks", "brief", "--autosave", "off", ...extra]);
const block = (t) => t.match(/<!-- playbook:core v\S+ begin[\s\S]*?<!-- playbook:core end -->/)?.[0] ?? "";
const words = (n) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");

// A notes repo laid out its own way: home files in 00-home/, a decisions folder, raw input in source-archive/inputs/,
// a note template under system/, a people register as JSON, and no board.
const ownLayout = (sb) =>
  repo(sb, "own", {
    files: {
      "AGENTS.md": "# Rules\n\nOur own rules.\n",
      "00-home/current.md": "# Current\n",
      "00-home/log.md": "# Log\n",
      "00-home/open-questions.md": "# Questions\n",
      "decisions/index.md": "# Decisions\n",
      "source-archive/inputs/2026-01-01-kickoff/notes.md": "words\n",
      "system/templates/note.md": "# Note\n",
      "data-bank/entity-register/registry.json": "{}\n",
      "system/founders.json": "[]\n",
    },
  });

test("D-01 writes the core block with the repo's own paths, not the Starter kit's", sandboxed((sb) => {
  const d = ownLayout(sb);
  const r = apply(sb, d, "D-01", ["--apply"]);
  assert.equal(r.status, 0, r.out);
  const b = block(read(d, "AGENTS.md"));
  assert.ok(b, "the block is added");
  for (const p of ["`00-home/current.md`", "`decisions/`", "`data-bank/entity-register/registry.json`", "`source-archive/inputs/YYYY-MM-DD-topic.md`", "`system/templates/note.md`", "`00-home/open-questions.md`", "`00-home/log.md`"]) assert.ok(b.includes(p), `block names ${p}`);
  assert.doesNotMatch(b, /docs\//, "no Starter kit path is left");
  assert.match(read(d, "AGENTS.md"), /Our own rules\./, "the repo's own rules stay");
}));

test("a role the repo does not have is left out of the core block, and its lists stay numbered", sandboxed((sb) => {
  const d = repo(sb, "bare", { files: { "AGENTS.md": "# Rules\n" } });
  assert.equal(apply(sb, d, "D-01", ["--apply"]).status, 0);
  const b = block(read(d, "AGENTS.md"));
  assert.doesNotMatch(b, /### Board/, "no board, no board section");
  assert.doesNotMatch(b, /board\.md|people\.md|decisions\.md|current\.md|templates\/note\.md|founder-input/);
  assert.match(b, /binding only when recorded in the repository/);
  assert.match(b, /name its folder as `inputs` under `paths`/);
  assert.doesNotMatch(b, /\{\{|\}\}/, "no marker is left");
  assert.doesNotMatch(b, /^\d+\.\s*$/m, "no empty list item");
  for (const list of b.split(/\n### /)) {
    const nums = [...list.matchAll(/^(\d+)\. /gm)].map((m) => Number(m[1]));
    assert.deepEqual(nums, nums.map((_, i) => i + 1), `numbered 1 to n: ${list.slice(0, 40)}`);
  }
}));

test("a board made in the same run is named in the core block", sandboxed((sb) => {
  const d = ownLayout(sb);
  assert.equal(apply(sb, d, "A-02,D-01", ["--apply"]).status, 0);
  const b = block(read(d, "AGENTS.md"));
  assert.match(b, /### Board\n`00-home\/board\.md` is the only place status lives/);
}));

test("update and status keep the repo's paths in the core block", sandboxed((sb) => {
  const d = ownLayout(sb);
  assert.equal(apply(sb, d, "A-01,A-10,D-01", ["--apply"]).status, 0);
  const before = read(d, "AGENTS.md");
  const s = cli(sb, ["status", d]);
  assert.doesNotMatch(s.out, /AGENTS\.md/, `status does not see the block as behind: ${s.out}`);
  assert.equal(cli(sb, ["update", d, "--apply"]).status, 0);
  assert.equal(read(d, "AGENTS.md"), before, "update does not put the Starter kit paths back");
}));

test("a path mapped in playbook.json wins, so a user can point a role at any file", sandboxed((sb) => {
  const d = ownLayout(sb);
  write(d, "crm/humans.csv", "name\n");
  write(d, "playbook.json", `${JSON.stringify({ paths: { people: "crm/humans.csv" } })}\n`);
  const a = JSON.parse(cli(sb, ["audit", d, "--json"]).stdout);
  assert.equal(a.mapping.people, "crm/humans.csv");
  assert.equal(apply(sb, d, "D-01", ["--apply"]).status, 0);
  assert.match(block(read(d, "AGENTS.md")), /Search `crm\/humans\.csv` and the whole repository/);
}));

test("the word cap counts the body of current.md, not its frontmatter", sandboxed((sb) => {
  const d = repo(sb, "cap");
  assert.equal(cli(sb, ["init", d, "--tool", "claude"]).status, 0);
  const front = `---\nsource_refs: [${words(1200)}]\n---\n`;
  write(d, "docs/00-home/current.md", `${front}# Current\n\nShort body.\n`);
  const ok = script(sb, d, "check.mjs");
  assert.doesNotMatch(ok.out, /over the cap/, ok.out);
  write(d, "docs/00-home/current.md", `${front}# Current\n\n${words(950)}\n`);
  const over = script(sb, d, "check.mjs");
  assert.equal(over.status, 1);
  assert.match(over.out, /body is 952 words, over the cap of 900/);
}));

test("bodyWords skips frontmatter, also with Windows line endings", () => {
  assert.equal(bodyWords("---\r\na: b c d\r\n---\r\none two\r\n"), 2);
  assert.equal(bodyWords("---\n---\nonly body\n"), 2);
  assert.equal(bodyWords("no frontmatter here\n"), 3);
});

test("audit finds a word cap the repo already states and apply keeps it", sandboxed((sb) => {
  const d = ownLayout(sb);
  write(d, "AGENTS.md", "# Rules\n\nKeep `00-home/current.md` under 1500 words.\n");
  write(d, "00-home/current.md", `# Current\n\n${words(1200)}\n`);
  const a = JSON.parse(cli(sb, ["audit", d, "--json"]).stdout);
  assert.deepEqual(a.details.current, { words: 1202, cap: 1500, capSource: "AGENTS.md:3" });
  assert.equal(a.checks.find((c) => c.id === "F5").status, "ok");
  assert.equal(apply(sb, d, "A-01", ["--apply"]).status, 0);
  assert.equal(json(d, "playbook.json").currentWordCap, 1500);
}));

test("with no stated cap, a long current view is flagged and --word-cap sets the cap", sandboxed((sb) => {
  const d = ownLayout(sb);
  write(d, "00-home/current.md", `---\nid: x\n---\n# Current\n\n${words(1000)}\n`);
  const audit = cli(sb, ["audit", d]);
  assert.match(audit.out, /\| F5 \| Current-state page \| ⚠️ \| 00-home\/current\.md, body 1002 words; no word cap stated, default 900 \| .*--word-cap/);
  assert.match(apply(sb, d, "A-01").out, /body of 1002 words, over the word cap of 900/);
  assert.equal(apply(sb, d, "A-01", ["--word-cap", "1200", "--apply"]).status, 0);
  assert.equal(json(d, "playbook.json").currentWordCap, 1200);
  assert.equal(cli(sb, ["apply", d, "--word-cap", "lots"]).status, 1, "a cap must be a number");
}));

test("a people register kept as JSON counts, so no second people page is planned", sandboxed((sb) => {
  const d = ownLayout(sb);
  const a = JSON.parse(cli(sb, ["audit", d, "--json"]).stdout);
  const f10 = a.checks.find((c) => c.id === "F10");
  assert.equal(f10.status, "ok");
  assert.equal(a.mapping.people, "data-bank/entity-register/registry.json", "the full register ranks before founders.json");
  assert.match(f10.found, /also system\/founders\.json/);
  assert.ok(!a.plan.safe.some((s) => s.id === "A-07"), "no people page is added");
}));

test("registers in archives and tests are not taken for the people record", sandboxed((sb) => {
  const d = repo(sb, "arch", { files: { "source-archive/people.json": "[]\n", "tests/fixtures/contacts.json": "[]\n" } });
  const a = JSON.parse(cli(sb, ["audit", d, "--json"]).stdout);
  assert.equal(a.mapping.people, null);
  assert.ok(a.plan.safe.some((s) => s.id === "A-07"));
}));
