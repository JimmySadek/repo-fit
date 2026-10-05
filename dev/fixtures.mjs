// Synthetic test folders for measuring repo-fit's outcomes. Deterministic: the same files, bytes and Git dates every run.
// Never real data. Each folder comes with its "truth": what was planted (duplicates, broken links, open tasks, code that
// must not move, items to drop in later), so dev/score.mjs can check what repo-fit found and fixed. Not shipped to npm.
//   import { makeFixture, FIXTURES } from "./fixtures.mjs"
import { spawnSync } from "node:child_process";
import { mkdirSync, utimesSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const FIXTURES = ["spaghetti", "spaghetti-nogit", "code-sprawl", "flat-notes", "tidy"];

const OLD = "2025-01-10T10:00:00Z"; // older than the 180-day review rule
const NEW = "2026-09-20T10:00:00Z";

// Small files whose first bytes match their kind, each one unique unless a duplicate is planted on purpose.
const PNG = (id) => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from(`fixture image ${id}\n`)]);
const JPG = (id) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(`fixture photo ${id}\n`)]);
const PDF = (id) => Buffer.from(`%PDF-1.4\n% fixture document ${id}\n`);
export const makeBytes = { png: PNG, jpg: JPG, pdf: PDF };

function put(dir, rel, content) {
  const p = join(dir, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
}

function gitInit(dir, oldFiles) {
  const run = (args, date) => spawnSync("git", args, { cwd: dir, encoding: "utf8", env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date, GIT_AUTHOR_NAME: "Fixture", GIT_AUTHOR_EMAIL: "fixture@example.com", GIT_COMMITTER_NAME: "Fixture", GIT_COMMITTER_EMAIL: "fixture@example.com" } });
  run(["init", "-q", "-b", "main"], NEW);
  run(["config", "user.name", "Fixture"], NEW);
  run(["config", "user.email", "fixture@example.com"], NEW);
  if (oldFiles.length) {
    run(["add", "--", ...oldFiles], OLD);
    run(["commit", "-q", "-m", "old notes"], OLD);
  }
  run(["add", "-A"], NEW);
  run(["commit", "-q", "-m", "everything else"], NEW);
}

// Without Git, old files get an old modification date instead.
function ageFiles(dir, oldFiles) {
  const t = new Date(OLD);
  for (const f of oldFiles) utimesSync(join(dir, f), t, t);
}

const checkboxes = (items) => items.map((t) => `- [ ] ${t}`).join("\n");

// An everything-folder: photos, PDFs, notes on several topics, a small program, "old" and "New Folder".
function spaghetti(dir, { git }) {
  const f = {};
  for (let i = 1; i <= 6; i++) f[`IMG_204${i}.jpg`] = JPG(`IMG_204${i}`);
  for (let i = 1; i <= 4; i++) f[`Screenshot 2026-09-0${i} at 10.15.3${i}.png`] = PNG(`shot-${i}`);
  f["logo.png"] = PNG("logo"); // the website loads it by name: it must stay
  f["team-photo.jpg"] = JPG("team");
  for (const m of ["03", "04", "05"]) f[`Invoice-2026-${m}.pdf`] = PDF(`invoice-${m}`);
  f["contract-signed.pdf"] = PDF("contract");
  f["Lease agreement.pdf"] = PDF("lease");
  f["prices-2026.csv"] = "item,price\ncoffee,3\n"; // the website reads it by name: it must stay
  const meeting = "# Meeting notes\n\nTalked about the summer plan and the new website.\n\n- Budget is tight\n- Launch in October\n";
  f["Meeting notes.md"] = meeting;
  f["meeting-notes (1).md"] = `${meeting}- Ask Sam about hosting\n`; // a near copy: only judgement can merge it
  f["ideas.md"] = "# Ideas\n\n- A podcast about slow travel\n- A recipe book for busy weeks\n";
  f["ideas copy.md"] = f["ideas.md"]; // an exact copy
  f["japan-trip-plan.md"] = "# Japan trip plan\n\nTwo weeks in April. Budget in [the budget](japan-trip-budget.md), packing in [[japan-trip-packing]].\n\n![Route map](IMG_2041.jpg)\n";
  f["japan-trip-budget.md"] = "# Japan trip budget\n\nFlights 900, rail pass 400, rooms 1200.\n";
  f["japan-trip-packing.md"] = `# Japan trip packing\n\n${checkboxes(["Buy a rail pass", "Pack the travel adapter", "Renew the passport"])}\n`;
  f["todo.md"] = `# Todo\n\n${checkboxes(["Call the bank about the card", "Book the dentist", "Send the lease to Sam", "Fix the website footer"])}\n- [x] Pay the April invoice\n\nSee [the old list](missing-file.md).\n`;
  f["untitled.md"] = "";
  f["recipe-lasagna.md"] = "# Lasagna\n\nLayers of pasta, sauce and cheese. Bake 45 minutes.\n";
  f["book-notes-atomic-habits.md"] = "# Atomic Habits: notes\n\nSmall habits compound. Make it obvious, attractive, easy, satisfying.\n";
  f["client-acme-proposal.md"] = "# Acme proposal\n\nScope: a new booking page. Price: 4,000.\n";
  f["client-acme-meeting.md"] = "# Acme meeting\n\nThey liked the proposal. Next: a call with their designer.\n";
  f["client-acme-followup.md"] = `# Acme follow-up\n\n${checkboxes(["Send the revised quote to Acme", "Schedule the designer call"])}\n`;
  f["old/draft-v1.md"] = "# First draft\n\nAn early version of the website text.\n";
  f["old/notes-2023.txt"] = "Old notes from 2023.\n";
  f["New Folder/scan001.pdf"] = PDF("scan001");
  f["stuff/links.md"] = "# Useful links\n\n- [Meeting notes](../Meeting%20notes.md)\n- [Japan plan](../japan-trip-plan.md)\n- [Lasagna](<../recipe-lasagna.md>)\n";
  f["stuff/random.md"] = "# Random\n\nThings I wanted to remember. See [[ideas]].\n";
  f["stuff/gift-ideas.md"] = "# Gift ideas\n\n- A good umbrella\n- A cooking class\n";
  f["stuff/podcast-list.md"] = "# Podcasts\n\n- Slow travel stories\n- Money basics\n";
  f["stuff/car-service.md"] = "# Car service\n\nLast service in May.\n\nTODO: book the winter tyres change\n";
  f["stuff/home-wifi-setup.md"] = "# Home wifi\n\nRouter in the hall. Restart it monthly.\n";
  f["photos-2025/beach.jpg"] = JPG("beach");
  f["photos-2025/mountain.jpg"] = JPG("mountain");
  f["website/package.json"] = JSON.stringify({ name: "website", scripts: { start: "node app.js" } }, null, 2) + "\n";
  f["website/app.js"] = 'const logo = "../logo.png";\nconst prices = "../prices-2026.csv";\nexport function page() {\n  return `<img src="${logo}">`;\n}\n';
  f["website/style.css"] = "body { font-family: sans-serif; }\n";
  for (const [k, v] of Object.entries(f)) put(dir, k, v);
  const old = ["stuff/podcast-list.md", "book-notes-atomic-habits.md", "old/draft-v1.md"];
  git ? gitInit(dir, old) : ageFiles(dir, old);
  return {
    code: ["website/package.json", "website/app.js", "website/style.css"],
    referenced: ["logo.png", "prices-2026.csv"],
    dupGroups: [{ kind: "exact", files: ["ideas.md", "ideas copy.md"] }, { kind: "near", files: ["Meeting notes.md", "meeting-notes (1).md"] }],
    problems: [
      { kind: "broken-link", file: "todo.md", target: "missing-file.md" },
      { kind: "stale", file: "stuff/podcast-list.md" },
      { kind: "stale", file: "book-notes-atomic-habits.md" },
      { kind: "empty", file: "untitled.md" },
      { kind: "orphan", file: "client-acme-proposal.md" },
      { kind: "orphan", file: "stuff/gift-ideas.md" },
      { kind: "orphan", file: "stuff/home-wifi-setup.md" },
      { kind: "duplicate", file: "ideas copy.md" },
    ],
    openItems: ["Buy a rail pass", "Pack the travel adapter", "Renew the passport", "Call the bank about the card", "Book the dentist", "Send the lease to Sam", "Fix the website footer", "Send the revised quote to Acme", "Schedule the designer call", "book the winter tyres change"],
    drops: [
      { name: "IMG_3001.jpg", make: "jpg", anchor: "IMG_2042.jpg" },
      { name: "IMG_3002.jpg", make: "jpg", anchor: "IMG_2043.jpg" },
      { name: "Invoice-2026-06.pdf", make: "pdf", anchor: "Invoice-2026-05.pdf" },
      { name: "client-acme-call-notes.md", make: "md", text: "# Acme call\n\nThe designer wants a darker theme.\n", anchor: "client-acme-meeting.md" },
      { name: "random-thought.md", make: "md", text: "# A thought\n\nMaybe learn the piano.\n", anchor: null },
    ],
  };
}

// A program with its documents spread around: screenshots at the top, two document folders, three results folders.
function codeSprawl(dir) {
  const f = {};
  f["package.json"] = JSON.stringify({ name: "detector", scripts: { test: "node --test", start: "node src/index.js" } }, null, 2) + "\n";
  f["src/index.js"] = 'import { detect } from "./detect.js";\nconsole.log(detect("frame.png"));\n';
  f["src/detect.js"] = 'const MODEL = "yolo-small.pt"; // loaded from the repo root\nexport function detect(frame) {\n  return { frame, model: MODEL };\n}\n';
  f["tests/detect.test.js"] = 'import { test } from "node:test";\nimport { detect } from "../src/detect.js";\ntest("detect", () => detect("x"));\n';
  f["yolo-small.pt"] = Buffer.from("fixture model weights\n");
  for (const n of ["home", "settings", "reports", "users", "billing"]) f[`dashboard-${n}.png`] = PNG(`dashboard-${n}`);
  f["tmp_sidebar.png"] = PNG("sidebar");
  f["README.md"] = "# Detector\n\nFinds objects in frames. Start with [the architecture](docs/architecture.md) and [the competitor analysis](Competitor_Analysis.md).\n";
  f["AGENTS.md"] = "# Rules\n\n- Run `npm test` before you commit.\n- Meeting notes go in notes/.\n";
  f["Competitor_Analysis.md"] = "# Competitor analysis\n\nThree tools do something similar. Ours is faster on small frames.\n";
  f["docs/architecture.md"] = "# Architecture\n\nFrames go in, boxes come out. See the [flow diagram](diagrams/flow.png).\n";
  f["docs/setup.md"] = "# Setup\n\nInstall Node, run `npm test`. The home screen looks like this:\n\n![Home](../dashboard-home.png)\n\nTODO: document the model download\n";
  f["notes/setup-copy.md"] = f["docs/setup.md"]; // an exact copy in the wrong folder
  f["notes/meeting-2026-09-02.md"] = `# Meeting 2 Sep\n\n${checkboxes(["Share the benchmark numbers", "Pick a license"])}\n`;
  f["notes/roadmap.md"] = `# Roadmap\n\n${checkboxes(["Support video files", "Add a settings page", "Write the user guide"])}\n`;
  for (let i = 1; i <= 3; i++) f[`output/run-${i}.json`] = `{"run":${i},"boxes":${i * 3}}\n`;
  f["test_output/last.json"] = '{"passed":true}\n';
  f["runs/2026-09-30.json"] = '{"ok":true}\n';
  f["old debug files/debug-1.log"] = "debug line one\n";
  f["old debug files/debug-2.log"] = "debug line two\n";
  for (const [k, v] of Object.entries(f)) put(dir, k, v);
  gitInit(dir, ["notes/roadmap.md"]);
  return {
    code: ["package.json", "src/index.js", "src/detect.js", "tests/detect.test.js"],
    referenced: ["yolo-small.pt"],
    dupGroups: [{ kind: "exact", files: ["docs/setup.md", "notes/setup-copy.md"] }],
    problems: [
      { kind: "broken-link", file: "docs/architecture.md", target: "diagrams/flow.png" },
      { kind: "stale", file: "notes/roadmap.md" },
      { kind: "orphan", file: "notes/meeting-2026-09-02.md" },
      { kind: "duplicate", file: "notes/setup-copy.md" },
    ],
    openItems: ["document the model download", "Share the benchmark numbers", "Pick a license", "Support video files", "Add a settings page", "Write the user guide"],
    drops: [
      { name: "dashboard-export.png", make: "png", anchor: "dashboard-settings.png" },
      { name: "notes-from-call.md", make: "md", text: "# Call notes\n\nThey want CSV export.\n", anchor: null },
    ],
  };
}

// A second brain kept flat: notes on three topics in one folder, linked by [[wiki links]], with attachments.
function flatNotes(dir) {
  const f = {};
  const topics = { health: ["sleep", "running", "food", "stress", "habits"], work: ["goals", "meetings", "hiring", "budget", "projects"], reading: ["fiction", "history", "science", "biographies", "queue"] };
  for (const [t, subs] of Object.entries(topics)) {
    subs.forEach((s, i) => {
      const next = subs[(i + 1) % subs.length];
      f[`${t}-${s}.md`] = `# ${t} ${s}\n\nNotes on ${s}. Related: [[${t}-${next}]].\n`;
    });
  }
  f["health-habits.md"] = "# health habits\n\nSmall steps. Related: [[health-sleep]].\n";
  f["Health habits (old).md"] = "# health habits\n\nSmall steps. Related: [[health-sleep]].\n\nOld version.\n"; // a near copy
  f["work-projects.md"] = `# work projects\n\n${checkboxes(["Draft the Q4 plan", "Review the hiring brief"])}\nRelated: [[work-goals]].\n`;
  f["reading-queue.md"] = `# reading queue\n\n${checkboxes(["Finish the history book", "Pick the next novel"])}\nRelated: [[reading-fiction]].\n`;
  f["inbox-note.md"] = "# Inbox\n\nQuick capture: call the plumber.\n";
  f["weekly-review.md"] = "# Weekly review\n\nWhat went well, what did not. See ![[review-chart.png]].\n";
  f["attachments/review-chart.png"] = PNG("review-chart");
  f["attachments/receipt.jpg"] = JPG("receipt");
  f[".obsidian/app.json"] = "{}\n";
  for (const [k, v] of Object.entries(f)) put(dir, k, v);
  const old = ["reading-history.md", "health-food.md"];
  gitInit(dir, old);
  return {
    code: [],
    referenced: [],
    dupGroups: [{ kind: "near", files: ["health-habits.md", "Health habits (old).md"] }],
    problems: [
      { kind: "stale", file: "reading-history.md" },
      { kind: "stale", file: "health-food.md" },
      { kind: "orphan", file: "inbox-note.md" },
      { kind: "orphan", file: "weekly-review.md" },
    ],
    openItems: ["Draft the Q4 plan", "Review the hiring brief", "Finish the history book", "Pick the next novel"],
    drops: [
      { name: "health-walking.md", make: "md", text: "# health walking\n\n10,000 steps.\n", anchor: "health-running.md" },
      { name: "random.md", make: "md", text: "# Random\n\nA thought.\n", anchor: null },
    ],
  };
}

// The control: a folder that is already organized. repo-fit should propose almost nothing here.
function tidy(dir) {
  const f = {};
  f["README.md"] = "# Studio\n\nStart at [the notes](notes/README.md) or [the clients](clients/README.md).\n";
  f["notes/README.md"] = "# Notes\n\n- [Ideas](ideas.md)\n- [Reading](reading.md)\n";
  f["notes/ideas.md"] = "# Ideas\n\n- A newsletter\n";
  f["notes/reading.md"] = `# Reading\n\n${checkboxes(["Finish the design book"])}\n`;
  f["clients/README.md"] = "# Clients\n\n- [Acme](acme.md)\n";
  f["clients/acme.md"] = "# Acme\n\nActive. Next call on Monday.\n";
  f["media/logo.png"] = PNG("studio-logo");
  for (const [k, v] of Object.entries(f)) put(dir, k, v);
  gitInit(dir, []);
  return { code: [], referenced: [], dupGroups: [], problems: [], openItems: ["Finish the design book"], drops: [{ name: "acme-brief.md", make: "md", text: "# Acme brief\n\nA booking page.\n", anchor: "clients/acme.md" }] };
}

const BUILD = { spaghetti: (d) => spaghetti(d, { git: true }), "spaghetti-nogit": (d) => spaghetti(d, { git: false }), "code-sprawl": codeSprawl, "flat-notes": flatNotes, tidy };

// Makes one test folder under `parent` and returns its path and truth. The truth is also saved beside it as <name>.truth.json.
export function makeFixture(name, parent) {
  if (!BUILD[name]) throw new Error(`Unknown fixture ${name}. Known: ${FIXTURES.join(", ")}`);
  const dir = join(parent, name);
  mkdirSync(dir, { recursive: true });
  const truth = { name, git: name !== "spaghetti-nogit", ...BUILD[name](dir) };
  writeFileSync(`${dir}.truth.json`, `${JSON.stringify(truth, null, 2)}\n`);
  return { dir, truth };
}

// Drops the truth's "new input" items into the folder: into inbox/ when there is one, else at the top (what a person would do).
export function dropItems(dir, truth, existsInbox) {
  const where = existsInbox ? "inbox" : "";
  for (const d of truth.drops) put(dir, where ? `${where}/${d.name}` : d.name, d.make === "md" ? d.text : makeBytes[d.make](`drop-${d.name}`));
  return where;
}
