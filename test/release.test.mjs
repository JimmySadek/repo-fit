// Release: after an update, the briefing says once, in plain words, what is new and what to do. The redesign's
// release is marked important (so 0.6.0 users hear about it) and carries that sentence.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { ROOT, cli, json, read, repo, sandboxed, script, write } from "./helpers.mjs";

test("after an update, the briefing says once what is new; then it is quiet", sandboxed((sb) => {
  const d = repo(sb, "u", { commit: true, files: { "notes/a.md": "# A\n\nA note.\n" } });
  const rec = JSON.parse(cli(sb, ["audit", d, "--json"]).stdout).plan.recommended;
  assert.equal(cli(sb, ["apply", d, "--steps", rec.steps.join(","), ...rec.flags.split(" "), "--apply"]).status, 0);
  const pj = json(d, "playbook.json");
  write(d, "playbook.json", `${JSON.stringify({ ...pj, playbook: "0.5.0" }, null, 2)}\n`);
  assert.equal(cli(sb, ["update", d, "--apply"]).status, 0);
  assert.match(script(sb, d, "brief.mjs", ["--text"]).out, /🆕 New: repo-fit can organize your folder\. Ask your assistant to run \/repo-fit to see the plan\./, "a person's look does not use it up");
  assert.match(script(sb, d, "brief.mjs", ["--text", "--file"]).out, /🆕 New: repo-fit can organize/);
  assert.doesNotMatch(script(sb, d, "brief.mjs", ["--text", "--file"]).out, /🆕 New:/, "once");
}));

test("a fresh setup says nothing about updates", sandboxed((sb) => {
  const d = repo(sb, "f", { commit: true, files: { "notes/a.md": "# A\n\nA note.\n" } });
  const rec = JSON.parse(cli(sb, ["audit", d, "--json"]).stdout).plan.recommended;
  assert.equal(cli(sb, ["apply", d, "--steps", rec.steps.join(","), ...rec.flags.split(" "), "--apply"]).status, 0);
  assert.doesNotMatch(script(sb, d, "brief.mjs", ["--text"]).out, /updated/);
}));

test("the redesign's release is marked important and tells 0.6.0 users what to do, in plain words", () => {
  const rel = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).repoFit.releases.find((r) => r.version === "0.7.0");
  assert.ok(rel, "a release entry for the redesign");
  assert.equal(rel.important, true);
  assert.match(rel.briefing, /^New: repo-fit can organize your folder\. Ask your assistant to run \/repo-fit to see the plan\./);
  assert.doesNotMatch(`${rel.why} ${rel.briefing} ${rel.news.join(" ")}`, /fingerprint|receipt|hook|vendored|pathspec|journal/i);
});
