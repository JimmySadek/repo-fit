// Organize: one plan for the whole folder (before → after → why), one yes, one undo. Loose files go into folders by
// kind (the folder's own names first), files that share a name start get a folder, old-looking folders and exact copies
// go to the archive, uncertain items to inbox/, and code with everything it needs stays where it is.
import assert from "node:assert/strict";
import { test } from "node:test";
import { makeFixture } from "../dev/fixtures.mjs";
import { find, locator, loose, oneHome, orient, safety, sameTree, snapshot } from "../dev/score.mjs";
import { organizePlan } from "../lib/organize.mjs";
import { applyMoves, planMoves } from "../lib/move.mjs";
import { cli, git, has, read, repo, sandboxed, script, write } from "./helpers.mjs";

const DAY = { REPO_FIT_TODAY: "2026-10-05", GIT_AUTHOR_NAME: "Test Person", GIT_AUTHOR_EMAIL: "test@example.com", GIT_COMMITTER_NAME: "Test Person", GIT_COMMITTER_EMAIL: "test@example.com" };
const dest = (p, from) => p.batches.flatMap((b) => b.moves).find((m) => m.from === from)?.to;

test("the plan for an everything-folder: kinds into folders, name groups, old folders and copies archived, uncertain to inbox, code stays", sandboxed((sb) => {
  const { dir } = makeFixture("spaghetti", sb.dir);
  const p = organizePlan(dir, { today: "2026-10-05" });
  assert.equal(dest(p, "recipe-lasagna.md"), "notes/recipe-lasagna.md");
  assert.equal(dest(p, "japan-trip-plan.md"), "notes/japan-trip/japan-trip-plan.md");
  assert.equal(dest(p, "client-acme-proposal.md"), "notes/client-acme/client-acme-proposal.md");
  assert.equal(dest(p, "IMG_2041.jpg"), "media/IMG_2041.jpg");
  assert.equal(dest(p, "Screenshot 2026-09-01 at 10.15.31.png"), "media/screenshot/Screenshot 2026-09-01 at 10.15.31.png");
  assert.equal(dest(p, "Invoice-2026-03.pdf"), "documents/invoice/Invoice-2026-03.pdf");
  assert.equal(dest(p, "old/draft-v1.md"), "archive/2026-10-05-old/draft-v1.md");
  assert.equal(dest(p, "New Folder/scan001.pdf"), "archive/2026-10-05-new-folder/scan001.pdf");
  assert.equal(dest(p, "ideas copy.md"), "archive/2026-10-05-copies/ideas copy.md");
  assert.match(p.batches.flatMap((b) => b.moves).find((m) => m.from === "ideas copy.md").why, /same as ideas\.md/);
  assert.equal(dest(p, "ideas.md"), "notes/ideas.md");
  assert.equal(dest(p, "untitled.md"), "inbox/untitled.md");
  for (const f of ["logo.png", "prices-2026.csv"]) assert.match(p.stays.find((s) => s.path === f)?.why ?? "", /website\/app\.js/);
  assert.ok(p.stays.some((s) => s.path === "website/" && /program/.test(s.why)));
  assert.ok(!p.batches.flatMap((b) => b.moves).some((m) => m.from.startsWith("website/") || m.from.startsWith("stuff/") || m.from.startsWith("photos-2025/")));
}));

test("the screen shows before, after and why in plain words, and the full list gives a why for every move", sandboxed((sb) => {
  const { dir } = makeFixture("spaghetti", sb.dir);
  const r = cli(sb, ["organize", dir], { env: DAY });
  assert.equal(r.status, 0, r.out);
  assert.match(r.stdout, /Your folder today/);
  assert.match(r.stdout, /After/);
  assert.match(r.stdout, /Why this is better for you/);
  assert.match(r.stdout, /32 things loose at the top/);
  assert.match(r.stdout, /archive\/: "old\/", "New Folder\/", 1 copy, dated 2026-10-05\. Nothing deleted/);
  assert.match(r.stdout, /notes\/: your 12 notes/);
  assert.match(r.stdout, /1 data file\b/);
  assert.match(r.stdout, /Nothing is deleted/);
  assert.match(r.stdout, /website\/.*stays/);
  assert.match(r.stdout, /Nothing was changed/);
  const l = cli(sb, ["organize", dir, "--list"], { env: DAY });
  assert.match(l.stdout, /`recipe-lasagna\.md` → `notes\/recipe-lasagna\.md`: /);
  assert.match(l.stdout, /`logo\.png` stays: website\/app\.js mentions it by name/);
  assert.ok(!has(dir, "notes"), "looking changes nothing");
}));

for (const [name, maxLoose] of [["spaghetti", 3], ["spaghetti-nogit", 3], ["code-sprawl", 1], ["flat-notes", 0]]) {
  test(`organize --apply (${name}): few loose files left, copies resolved, every note findable, nothing lost; one undo restores it`, sandboxed((sb) => {
    const { dir, truth } = makeFixture(name, sb.dir);
    const before = snapshot(dir);
    const r = cli(sb, ["organize", dir, "--apply"], { env: DAY });
    assert.equal(r.status, 0, r.out);
    const after = snapshot(dir);
    const at = locator(before, after);
    assert.ok(loose(after, truth).length <= maxLoose, `loose: ${loose(after, truth)}`);
    const s = safety(before, after, truth, at);
    assert.deepEqual([s.lost, s.codeMoved], [[], []]);
    assert.ok(s.linksAfter >= s.linksBefore, `links ${s.linksBefore} → ${s.linksAfter}`);
    const h = oneHome(after, truth, at);
    assert.equal(h.exact.resolved, h.exact.total, "every exact copy is resolved");
    const f = find(after, { before, locate: at });
    assert.equal(f.found, f.total, `not findable from MAP.md: ${f.unreachable}`);
    assert.ok(has(dir, "inbox"), "new things get one landing place");
    const u = cli(sb, ["undo", dir, "--apply"]);
    assert.equal(u.status, 0, u.out);
    const back = sameTree(before, snapshot(dir));
    assert.equal(back.same, true, JSON.stringify(back));
  }));
}

test("an organized folder gets nothing to move, and the screen says that is good", sandboxed((sb) => {
  const { dir } = makeFixture("tidy", sb.dir);
  const p = organizePlan(dir, { today: "2026-10-05" });
  assert.equal(p.batches.flatMap((b) => b.moves).length, 0);
  const r = cli(sb, ["organize", dir, "--apply"], { env: DAY });
  assert.equal(r.status, 0, r.out);
  assert.match(r.stdout, /already organized|Nothing to move/i);
  assert.ok(!has(dir, "inbox") && !has(dir, ".playbook/receipts"));
}));

test("a rule naming a folder says where things belong, it does not lock them in; code naming a folder does", sandboxed((sb) => {
  const d = repo(sb, "rules", { files: { "AGENTS.md": "# Rules\n\nMeeting notes go in notes/.\n", "notes/copy.md": "# Copy\n", "run.py": "for f in os.listdir('results/'): pass\n", "results/r1.md": "# R1\n" } });
  const plan = planMoves(d, [{ from: "notes/copy.md", to: "archive/copy.md" }, { from: "results/r1.md", to: "archive/r1.md" }]);
  assert.deepEqual(plan.moves.map((m) => m.from), ["notes/copy.md"]);
  assert.match(plan.refused[0].why, /run\.py names its folder results\//);
}));

test("old notes are still reported as old after organizing moves them", sandboxed((sb) => {
  const { dir } = makeFixture("spaghetti", sb.dir);
  const rec = JSON.parse(cli(sb, ["audit", dir, "--json"]).stdout).plan.recommended;
  assert.equal(cli(sb, ["apply", dir, "--steps", rec.steps.join(","), ...rec.flags.split(" "), "--apply"]).status, 0);
  assert.equal(cli(sb, ["organize", dir, "--apply"], { env: DAY }).status, 0);
  assert.ok(has(dir, "notes/book-notes-atomic-habits.md"));
  const out = script(sb, dir, "check.mjs").out;
  assert.match(out, /untouched for 180\+ days:.*notes\/book-notes-atomic-habits\.md/, out);
}));

test("a file changed after the screen was shown means nothing moves", sandboxed((sb) => {
  const { dir } = makeFixture("spaghetti", sb.dir);
  const p = organizePlan(dir, { today: "2026-10-05" });
  write(dir, "stuff/links.md", `${read(dir, "stuff/links.md")}\nOne more.\n`);
  const r = applyMoves(dir, p.plan);
  assert.equal(r.ok, false);
  assert.ok(has(dir, "recipe-lasagna.md"));
}));

test("after organizing, the map has a line for inbox/ even when nothing waits there yet", sandboxed((sb) => {
  const { dir } = makeFixture("flat-notes", sb.dir);
  assert.equal(cli(sb, ["organize", dir, "--apply"], { env: DAY }).status, 0);
  assert.match(read(dir, "MAP.md"), /\[inbox\/\]\(inbox\/\): new things waiting to be filed/);
}));

test("live-run order: the plan shown is applied first, then the setup; the folder ends as the screen said and the check passes", sandboxed((sb) => {
  const { dir } = makeFixture("spaghetti", sb.dir);
  const rec = JSON.parse(cli(sb, ["audit", dir, "--json"]).stdout).plan.recommended;
  const shown = cli(sb, ["organize", dir], { env: DAY }).stdout;
  const code = shown.match(/--apply --plan (\w+)/)?.[1];
  assert.ok(code, "the screen's command carries the plan it showed");
  const moves = organizePlan(dir, { today: "2026-10-05" }).batches.flatMap((b) => b.moves).length;
  const o = cli(sb, ["organize", dir, "--apply", "--plan", code], { env: DAY });
  assert.equal(o.status, 0, o.out);
  assert.match(o.out, new RegExp(`Moved ${moves} file`));
  assert.equal(cli(sb, ["apply", dir, "--steps", rec.steps.join(","), ...rec.flags.split(" "), "--apply"]).status, 0);
  assert.ok(has(dir, "documents/invoice/Invoice-2026-03.pdf"), "the PDFs went where the screen said");
  const o2 = orient(dir, snapshot(dir));
  assert.equal(o2.covered, o2.entries, "the map also lists the folders the setup added");
  const check = script(sb, dir, "check.mjs");
  assert.equal(check.status, 0, check.out);
  assert.doesNotMatch(script(sb, dir, "brief.mjs", ["--text"]).out, /missing/i);
}));

test("organize --apply refuses a plan other than the one shown, and moves nothing", sandboxed((sb) => {
  const { dir } = makeFixture("spaghetti", sb.dir);
  const r = cli(sb, ["organize", dir, "--apply", "--plan", "0000000000"], { env: DAY });
  assert.equal(r.status, 1);
  assert.match(r.out, /changed since you saw it/);
  assert.ok(has(dir, "recipe-lasagna.md"));
}));

test("after the setup made docs/ for its own pages, documents still go to documents/ in a notes folder", sandboxed((sb) => {
  const { dir } = makeFixture("spaghetti", sb.dir);
  write(dir, "docs/00-home/current.md", "# Current\n");
  assert.equal(dest(organizePlan(dir, { today: "2026-10-05" }), "Invoice-2026-03.pdf"), "documents/invoice/Invoice-2026-03.pdf");
}));

test("old notes stay reported as old after they are moved and the move is committed", sandboxed((sb) => {
  const { dir } = makeFixture("spaghetti", sb.dir);
  const rec = JSON.parse(cli(sb, ["audit", dir, "--json"]).stdout).plan.recommended;
  const shown = cli(sb, ["organize", dir], { env: DAY }).stdout.match(/--apply --plan (\w+)/)[1];
  assert.equal(cli(sb, ["organize", dir, "--apply", "--plan", shown], { env: DAY }).status, 0);
  assert.equal(cli(sb, ["apply", dir, "--steps", rec.steps.join(","), ...rec.flags.split(" "), "--apply"], { env: DAY }).status, 0);
  git(sb, dir, ["add", "-A"], DAY);
  git(sb, dir, ["commit", "-q", "-m", "organized"], DAY);
  const out = script(sb, dir, "check.mjs").out;
  assert.match(out, /untouched for 180\+ days:.*notes\/book-notes-atomic-habits\.md/, out);
}));
