#!/usr/bin/env node
// Measures repo-fit on the synthetic test folders (dev/fixtures.mjs) and scores the outcomes (dev/score.mjs).
// Everything runs in a temporary folder with a fake HOME: nothing on this machine or in any real repo is touched.
//   node dev/measure.mjs                          the current checkout
//   node dev/measure.mjs --ref 3fed971            a past version, read from Git (3fed971 = 0.6.0, before the redesign)
//   node dev/measure.mjs --fixtures spaghetti,tidy --json --out <file.md>
// Not shipped to npm.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { FIXTURES, dropItems, makeBytes, makeFixture } from "./fixtures.mjs";
import { find, landed, locator, loose, oneHome, openWork, orient, safety, sameTree, snapshot, surfaced } from "./score.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);

// The repo-fit under test: this checkout, or a past commit extracted into a temporary folder.
function repoFitAt(ref, tmp) {
  if (!ref) return ROOT;
  const dir = join(tmp, `repo-fit-${ref}`);
  mkdirSync(dir, { recursive: true });
  const tar = execFileSync("git", ["-C", ROOT, "archive", ref], { maxBuffer: 256 * 1024 * 1024 });
  execFileSync("tar", ["-x", "-C", dir], { input: tar });
  return dir;
}

function env(tmp) {
  const home = join(tmp, "home");
  mkdirSync(home, { recursive: true });
  // The person's Git knows their name (Safe start needs it to save a snapshot).
  const e = { ...process.env, GIT_AUTHOR_NAME: "Fixture Person", GIT_AUTHOR_EMAIL: "person@example.com", GIT_COMMITTER_NAME: "Fixture Person", GIT_COMMITTER_EMAIL: "person@example.com", HOME: home, USERPROFILE: home, REPO_FIT_CONFIG: join(home, "cfg"), GIT_CONFIG_NOSYSTEM: "1", GIT_TERMINAL_PROMPT: "0", REPO_FIT_UPDATE_CHECK: "off" };
  delete e.REPO_FIT_TODAY;
  return e;
}

const run = (cmd, argv, cwd, e) => {
  const r = spawnSync(cmd, argv, { cwd, env: e, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { status: r.status, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
};

// How a version is driven, the way the skill would drive it after the person says yes to everything it offers.
// The redesign adds its own steps here as each slice lands; until then every version goes through the 0.6.0 flow.
const adapter = {
  setup(rf, dir, e) {
    const cli = (...a) => run(process.execPath, [join(rf, "bin/repo-fit.mjs"), ...a], dir, e);
    const log = [];
    const a = JSON.parse(cli("audit", dir, "--json").out);
    const rec = a.plan?.recommended;
    // Slice 3 on: the person says yes to the organize plan, which runs first (as the skill does), with the plan shown.
    if (existsSync(join(rf, "lib/organize.mjs"))) {
      const code = cli("organize", dir).out.match(/--apply --plan (\w+)/)?.[1];
      const r = cli("organize", dir, "--apply", ...(code ? ["--plan", code] : []));
      log.push(`organize --apply → exit ${r.status}`);
    }
    if (rec?.steps?.length) {
      const r = cli("apply", dir, "--steps", rec.steps.join(","), ...rec.flags.split(/\s+/).filter(Boolean), "--apply");
      log.push(`apply ${rec.steps.join(",")} ${rec.flags} → exit ${r.status}`);
    }
    if (rec?.hooksCommand) {
      const r = cli("hooks", dir, "--hooks", rec.hooksMode, "--apply");
      log.push(`hooks --hooks ${rec.hooksMode} → exit ${r.status}`);
    }
    return log;
  },
  // What the person sees about problems: the repo's check and its briefing.
  seen(dir, e) {
    const s = (name, ...a) => (existsSync(join(dir, "scripts/playbook", name)) ? run(process.execPath, [join(dir, "scripts/playbook", name), ...a], dir, e).out : "");
    return `${s("check.mjs")}\n${s("brief.mjs", "--text")}`;
  },
  // A new session starts: whatever the version does at session start.
  session(dir, e) {
    if (existsSync(join(dir, "scripts/playbook/brief.mjs"))) run(process.execPath, [join(dir, "scripts/playbook/brief.mjs"), "--hook"], dir, e);
  },
  undoAll(rf, dir, e) {
    for (let i = 0; i < 20; i++) {
      const r = run(process.execPath, [join(rf, "bin/repo-fit.mjs"), "undo", dir, "--apply"], dir, e);
      if (r.status !== 0 || /No receipt/.test(r.out)) break;
    }
  },
};

const sha = (b) => createHash("sha256").update(b).digest("hex");

export function measureOne(rf, name, tmp) {
  const e = env(tmp);
  const { dir, truth } = makeFixture(name, join(tmp, "a"));
  const before = snapshot(dir);
  const looseBefore = loose(before, truth).length;
  const log = adapter.setup(rf, dir, e);
  const after = snapshot(dir);
  const locate = locator(before, after);
  const res = {
    fixture: name,
    log,
    orient: orient(dir, after),
    find: find(after, { before, locate }),
    loose: { before: looseBefore, after: loose(after, truth).length },
    oneHome: oneHome(after, truth, locate),
    openWork: openWork(after, truth),
    rot: surfaced(adapter.seen(dir, e), truth, locate),
    safety: safety(before, after, truth, locate),
  };
  // New input: drop the planted items, start a session, see where they ended up.
  // Slice 6: the checkup a re-run starts with, right after the setup (before new things arrive).
  const check = run(process.execPath, [join(rf, "bin/repo-fit.mjs"), "status", dir], dir, e).out;
  res.checkup = /✅ Your folder is fit/.test(check) ? "fit" : (check.match(/needs a look: (\d+)/)?.[1] ?? null);
  const into = dropItems(dir, truth, existsSync(join(dir, "inbox")));
  const dropHashes = Object.fromEntries(truth.drops.map((d) => [d.name, sha(d.make === "md" ? Buffer.from(d.text) : makeBytes[d.make](`drop-${d.name}`))]));
  adapter.session(dir, e);
  const afterSession = snapshot(dir);
  res.newInput = { droppedInto: into || "(top of the folder)", ...landed(afterSession, truth, dropHashes, locator(before, afterSession)) };
  // Slice 6: after new things arrived and a session started, is every note still within two links of the map?
  res.mapAfterNew = find(afterSession);
  // Undo, on a fresh copy of the same folder: set up, undo everything, compare with the original.
  const b = makeFixture(name, join(tmp, "b"));
  const beforeB = snapshot(b.dir);
  adapter.setup(rf, b.dir, e);
  adapter.undoAll(rf, b.dir, e);
  res.undo = sameTree(beforeB, snapshot(b.dir));
  return res;
}

const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : "n/a");
const yes = (b) => (b ? "✅" : "❌");

export function table(results, label) {
  const col = (f) => results.map(f).join(" | ");
  const rows = [
    ["Orient: MAP.md", (r) => (r.orient.map ? `✅ covers ${r.orient.covered}/${r.orient.entries}` : "❌")],
    ["Orient: pointer in rulebook", (r) => yes(r.orient.pointer)],
    ["Orient: briefing", (r) => yes(r.orient.briefing)],
    ["Find: notes within 2 links of MAP.md", (r) => `${pct(r.find.found, r.find.total)} (${r.find.found}/${r.find.total})`],
    ["Loose at the top: before → after", (r) => `${r.loose.before} → ${r.loose.after}`],
    ["One home: exact copies resolved", (r) => `${r.oneHome.exact.resolved}/${r.oneHome.exact.total}`],
    ["One home: near copies resolved", (r) => `${r.oneHome.near.resolved}/${r.oneHome.near.total}`],
    ["New input landed right", (r) => `${r.newInput.found}/${r.newInput.total}`],
    ["Map current after new things arrive", (r) => `${pct(r.mapAfterNew.found, r.mapAfterNew.total)} (${r.mapAfterNew.found}/${r.mapAfterNew.total})`],
    ["Checkup right after setup", (r) => (r.checkup === "fit" ? "✅ fit" : r.checkup ? `⚠️ ${r.checkup} to look at` : "n/a")],
    ["Nothing rots: problems surfaced", (r) => `${r.rot.found}/${r.rot.total}`],
    ["Open work in one list", (r) => `${r.openWork.found}/${r.openWork.total}`],
    ["Safety: no file lost", (r) => (r.safety.lost.length ? `❌ ${r.safety.lost.length} lost` : "✅")],
    ["Safety: code untouched", (r) => (r.safety.codeMoved.length ? `❌ ${r.safety.codeMoved.join(", ")}` : "✅")],
    ["Safety: working links before → after", (r) => `${r.safety.linksBefore} → ${r.safety.linksAfter}${r.safety.linksAfter < r.safety.linksBefore ? " ❌" : ""}`],
    ["Safety: undo restores the original", (r) => (r.undo.same ? "✅" : `❌ +${r.undo.added.length} −${r.undo.removed.length} ~${r.undo.changed.length}`)],
  ];
  return [`| Outcome (${label}) | ${col((r) => r.fixture)} |`, `|---|${results.map(() => "---").join("|")}|`, ...rows.map(([k, f]) => `| ${k} | ${col(f)} |`)].join("\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const ref = opt("--ref");
  const names = opt("--fixtures") ? opt("--fixtures").split(",") : FIXTURES;
  const tmp = mkdtempSync(join(tmpdir(), "repo-fit-measure-"));
  try {
    const rf = repoFitAt(ref, tmp);
    const version = readFileSync(join(rf, "VERSION"), "utf8").trim();
    const label = `repo-fit ${version}${ref ? ` at ${ref}` : " (this checkout)"}`;
    const results = names.map((n) => measureOne(rf, n, join(tmp, n)));
    const text = `${table(results, label)}\n\nLow ceremony is measured on live runs with dev/transcript-check.mjs, not here.\n`;
    if (opt("--out")) writeFileSync(opt("--out"), args.includes("--json") ? `${JSON.stringify({ label, results }, null, 2)}\n` : text);
    console.log(args.includes("--json") ? JSON.stringify({ label, results }, null, 2) : text);
  } finally {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
  }
}
