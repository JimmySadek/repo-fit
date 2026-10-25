# repo-fit 0.9.0 deep mode: design note

Date: 25 Oct 2026 · Status: **Approved by Jimmy on 25 Oct 2026 ("Approve, worktree"), with the changes in
"Decisions" below. Sweep 1 is built (slice A).** · Plan: one-repo
`claudedocs/2026-10-25-repo-fit-field-report-plan.md`, sections "Final shape: two sweeps, two questions" and "Deep mode
internals, researched". All numbers below are from a made-up example app, not from a real repo.

## 🎯 In one paragraph

One new command, `repo-fit deep`, with two sweeps. **Sweep 1** handles everything that is not code: documents, specs,
plans, decisions and rulebooks. **Sweep 2** handles code and design.

Each sweep runs the same way:
1. repo-fit looks, read-only.
2. The assistant reads inside the folders and writes **a plan file**. The assistant never edits the repo directly.
3. repo-fit checks the plan and shows **one screen**: what it found, before and after, and why.
4. The person answers **once**: yes, or feedback.
5. After the yes, repo-fit applies the plan without asking again. Everything goes on **its own branch**, in **a
   separate working copy** (a Git worktree), one commit per step. The person's folder and branch never change. Each
   step is proven before the next one starts. A step that fails its proof is taken back and reported.
6. The result is a branch the person merges. Any single step can be undone with `git revert`.

## How it works

```
repo-fit deep . --sweep docs            read-only: what is inside (JSON for the assistant with --json)
        │
        ▼
assistant reads the documents ──► .playbook/deep/docs.json      (the plan: moves, status lines, rulebook split)
        │                                                        .playbook/ is ignored by Git, so this is no change
        ▼
repo-fit deep . --sweep docs             with the plan file there: checks it, prints the ONE screen + a code
        │
   person: yes ──► repo-fit deep . --sweep docs --apply --plan <code>
        │
        ▼
separate working copy on new branch repo-fit/deep-<date> ─► step 1: apply, prove, commit ─► step 2 … ─► copy removed
                                          └ fails its proof: reset inside the copy to before the step, listed at the end
```

Sweep 2 works the same way, with two additions before the plan:
- **Project type:** read from the manifests and the config files.
- **Best practices researched live:** the assistant does the web research, because the scripts never go online. It
  writes a dated, sourced note, `docs/research/<date>-<type>-structure.md`, which is committed on the branch.

repo-fit refuses a code plan until that note exists, is at most 30 days old and cites at least 2 sources. Someone using
the command line without an assistant still gets the analysis, and the screen says "best practices: not researched".

## Commands

| Command | Writes? | What it does |
|---|---|---|
| `deep <repo> --sweep docs` | No | Counts and lists everything that is not code: documents by place, specs and plans with or without a status line, decisions, exact copies (sha256), notes in build folders (`public/`, `static/`), rulebook sizes. `--json` gives the full list for the assistant. |
| `deep <repo> --sweep docs` (plan file present) | No | Checks `.playbook/deep/docs.json`, then prints the one screen and the plan code. It refuses: code files, files with unsaved changes, ignored files, files the code loads, rulebook moves, unknown status words, and a plan that empties a place `playbook.json` counts on without a `paths` change. |
| `deep <repo> --sweep code` | No | Project type, available proof commands, and the analysis (below). `--json` for the assistant. |
| `deep <repo> --sweep code --plan <file>` | No | Checks the plan and the research note, then prints the one screen and the code. |
| `deep <repo> --sweep <s> --apply --plan <code>` | On a new branch only | Creates the branch in a separate working copy, then applies, proves and commits step by step. At the end it removes the copy and prints the result screen. The same yes twice makes no second branch. |
| `deep <repo> --sweep <s> --list` | No | Every change with its reason (the details on request). |

## Files

| File | New / changed | What |
|---|---|---|
| `lib/deep.mjs` | New | The inventory, plan checks, screens, and the apply loop (branch, steps, proof, commit, take-back) |
| `lib/analyze.mjs` | New | Built-in Node analysis: JS/TS import graph, files and exports nothing uses, import loops, copied blocks, hand-written colours and spacing. Also reads the output of the repo's own **knip**, **jscpd** and **dependency-cruiser** when they are installed (`node_modules/.bin` or PATH). It never runs `npx` to download them. |
| `lib/proof.mjs` | New | Runs the repo's own test, typecheck, lint and build commands (from `detect`) before the first step, then after each step. A command that passed before must still pass. Also: the deliberate-break check, the built CSS before and after, and Playwright screenshots, **but only if the repo already has Playwright**. |
| `lib/rulebook.mjs` | New | The rulebook split check: every rule line from the old rulebook is in exactly one new file, word for word. Size limits: `CLAUDE.md` under 200 lines, `AGENTS.md` under 32 KiB, both read from `guidance/`. |
| `scripts/playbook/move.mjs` | Changed | In deep mode, moves also rewrite relative JS/TS imports (`./x`, `../x`). Imports through aliases go to the assistant as plan edits. |
| `bin/repo-fit.mjs` | Changed | The `deep` command and its help text |
| `SKILL.md`, `INSTALL.md`, `README.md`, `AGENTS.md`, `CHANGELOG.md` | Changed | The deep pass in the skill: what the assistant reads, the plan file, the research note, the two questions. The rule changes are listed below. |
| `guidance/` | Changed | Dated, sourced notes for the vendor facts used here: Claude Code memory size, Codex `AGENTS.md` cap, nested `AGENTS.md` |
| `dev/fixtures.mjs`, `dev/measure.mjs` | Changed | Two synthetic fixtures (below) and new outcome rows |

**The plan file** (written by the assistant, then checked by repo-fit). Every change is data, so every change is
checked, shown, proven and committed by repo-fit:

```json
{ "sweep": "docs", "base": "<HEAD commit>", "steps": [
  { "title": "Copies to the archive", "moves": [{ "from": "public/old-notes.md", "to": "archive/old-notes.md", "why": "same as docs/notes.md" }] },
  { "title": "Documents by kind", "moves": [{ "from": "claudedocs/login-spec.md", "to": "docs/specs/login-spec.md", "why": "a spec" }] },
  { "title": "Status lines", "status": [{ "path": "docs/specs/login-spec.md", "line": "Replaced by [login v2](login-v2-spec.md)" }] },
  { "title": "Rulebook", "split": [{ "from": "AGENTS.md", "section": "## Design rules", "to": "docs/design/rules.md" }],
    "sections": [{ "path": "AGENTS.md", "heading": "## Where documents go", "text": "- Specs: docs/specs/" }] }
] }
```

As built in slice A: every path in the plan is where the file is **today**; `to` is where it goes. A step may also
carry `"paths": { "<role>": "<new place>" }` (it updates `playbook.json` in a folder set up with repo-fit) and
`"map": true`. In a folder set up with repo-fit, the map is rebuilt after every step that moves files, and an index page
left alone in an emptied folder goes to `archive/` with it.

The code plan uses the same format, plus `edits: [{ path, find, replace }]` for the changes the assistant writes. The
script applies those edits and proves the result.

## Screen 1: sweep 1, everything that is not code (mock)

```
# Deep sweep 1 of 2: everything that is not code · example-app

🛟 Every change goes on a new branch, `repo-fit/deep-2026-10-26`, one commit per step. Your branch `main` stays as
   it is. Undo one step: `git revert <commit>`. Undo everything: delete the branch.
⚠️ 2 files have unsaved changes, so they stay out of this sweep: `notes/today.md`, `TODO.md`.

What I found inside your folders
  📄 41 documents in 7 places: docs/, claudedocs/, docs/superpowers/, notes/, design/, public/, the top level
  📋 9 specs and plans: 3 replaced by newer ones, 6 without a status line
  🧭 4 decisions in 3 places
  👯 5 exact copies, 2 of them in public/ (it ships to every visitor)
  📏 AGENTS.md has 212 lines; 70 of them are design rules

Your folder today                      After one yes
  docs/               8 documents        docs/specs/       7  (each with a status line)
  claudedocs/        14 documents        docs/plans/       5
  docs/superpowers/   6 documents        docs/decisions/   4
  notes/              9 documents        docs/research/    6
  design/             2 documents        docs/design/      4  (with the design rules)
  public/             2 notes, 1 mockup  archive/          8  (3 replaced specs, 5 copies)
  AGENTS.md         212 lines            AGENTS.md       142 lines, links to docs/design/rules.md

Why
  - One docs/ folder by kind: you and every assistant find a spec in one place, not seven.
  - A status line on every spec and plan, so nobody builds from a replaced spec.
  - Copies and replaced specs go to archive/. Nothing is deleted.
  - public/ ships to visitors, so notes and mockups there move out (only ones your code does not use).
  - A shorter rulebook: every rule is kept word for word, checked line by line.

5 steps, each one commit, each proven (no file lost, every link still works, every rule kept):
  1 copies to archive · 2 documents by kind · 3 status lines · 4 rulebook · 5 map and index pages

Every change with its reason: repo-fit deep . --sweep docs --list
Yes: repo-fit deep . --sweep docs --apply --plan 7f3a2c          Or tell me what to change.
```

## Screen 2: sweep 2, code and design (mock)

```
# Deep sweep 2 of 2: code and design · example-app

Project type: web app, React with Vite, TypeScript (from package.json and vite.config.ts)
Best practices, read today: docs/research/2026-10-26-react-vite-structure.md (4 sources)
  - group code by feature, not by kind
  - no files that only re-export other files
  - one place for colours and spacing (design tokens)
Tools: knip (yours) · repo-fit's built-in import graph and copy finder (jscpd and dependency-cruiser are not installed)
How each step is proven: npm test ✔ now · npm run typecheck ✔ now · npm run build ✔ now · screenshots: not checked (no Playwright)

What I found
  🪦 6 files and 14 exports that nothing uses
  👯 3 blocks of copied code, 40+ lines each
  🔁 1 import loop: cart → checkout → cart
  🏷️ 2 misleading names: utils/helpers2.ts, components/NewHeader.tsx (the only header)
  🎨 23 colours typed by hand in 11 files; 9 are near copies of 6 brand colours

6 steps, each one commit, each proven before the next:
  1 Remove the 6 unused files and 14 unused exports        tests · typecheck · build
  2 Move files into features/cart, checkout, account       same, and the import graph is unchanged
    (moves only, so Git keeps each file's history)
  3 Fix the imports after the moves                        same
  4 Rename the 2 misleading files                          same
  5 Break the import loop                                  same, and no loops
  6 One tokens file for colours and spacing                same, and the built CSS is unchanged

First, a deliberate break is made and undone, to see that your tests notice it. If they do not, the screen says so.
A step that fails its proof is taken back and listed at the end. Later steps that do not depend on it still run.

Every change with its reason: repo-fit deep . --sweep code --list
Yes: repo-fit deep . --sweep code --apply --plan 91be04          Or tell me what to change.
```

## The result screen (after either sweep, mock)

```
✅ Deep sweep 2 is done on branch `repo-fit/deep-2026-10-26`. Your branch `main` is as it was.
  ✅ 1 unused code removed          a1b2c3d  tests 212 ✔ · typecheck ✔ · build ✔
  ✅ 2 files into features          d4e5f6a  tests 212 ✔ · typecheck ✔ · build ✔ · graph unchanged
  ✅ 3 imports fixed                0718293  tests 212 ✔ · typecheck ✔ · build ✔
  ✅ 4 renames                      a4b5c6d  tests 212 ✔ · typecheck ✔ · build ✔
  ↩️ 5 import loop: taken back. `npm test` failed in checkout.test.ts. Nothing from this step is on the branch.
  ✅ 6 design tokens                e7f8091  tests 212 ✔ · typecheck ✔ · build ✔ · built CSS unchanged
See it:        git log --stat main..repo-fit/deep-2026-10-26
Keep it:       git merge repo-fit/deep-2026-10-26
Undo one step: git revert <commit>      Drop it all: git branch -D repo-fit/deep-2026-10-26
```

## Safety rules for deep mode

- **Its own branch, in a separate working copy.** repo-fit creates `repo-fit/deep-<date>` from HEAD in a Git worktree
  in the system's temporary folder, commits there, and removes the worktree at the end; the branch stays for the person
  to merge. The person's folder, branch and files never change (a dev server or another session may be using them).
  Nothing is pushed. For sweep 2, the checkout's `node_modules` (and the like) is linked into the worktree so the proof
  runs without a download; if that is not possible, the screen says the proof is limited. Never a download.
- **Explicit paths only.** Each commit stages only that step's own paths, never `git add .`. This respects repos whose
  rules say "explicit paths".
- **Their hooks stay on.** The repo's own commit hooks run as usual (no `--no-verify`). If a hook blocks a commit, that
  step is taken back and reported.
- **Unsaved changes are protected.** The worktree starts from the last commit, so files with unsaved changes, or not
  in the last commit, are not in it: they are left out of the plan and the screen names them. A step is taken back
  with a reset inside the worktree, which holds nothing of the person's.
- **The plan is tied to one commit.** The plan stores the HEAD commit it was made on. If HEAD or the files changed
  after the yes, nothing is applied and the screen is shown again (same as `organize` today).
- **No snapshot needed.** The 0.8.0 snapshot protects unsaved files in the person's folder; deep mode never touches
  that folder, so it takes none.

## Proof for each step

| Sweep | Proof |
|---|---|
| 1 documents | No file lost (the file count is not lower). Each move keeps its working links (the move engine's own proof), and no link anywhere points at nothing that did not before. Every rule line is kept, word for word. `scripts/playbook/check.mjs` still passes, when it passed before the first step. The repo's own commit hooks run on every commit. |
| 2 code | First, the repo's own commands run once (baseline). After each step, every command that passed before must pass again, run from clean. The import graph has no new loops. When the step changes design values, the built CSS is compared before and after. Screenshots are taken only if Playwright is already installed. The deliberate break runs once per sweep. |

**Known gaps (from the research):**
- A Vite build is not byte-identical after moves, so the check compares the CSS and the screenshots, not all the JS.
- The built-in analysis covers JS/TS imports, CSS values and exact copies. For other languages it does file-level
  analysis only, unless the repo's own tools are installed. The screen says which.

## Rules this changes (deep mode only)

| Rule today | In deep mode |
|---|---|
| Code, and files the code loads, never move | They may move, on the deep branch only, after that sweep's yes |
| Never commit (INSTALL.md) | Commits go on the deep branch only, never on the person's branches |
| Nothing is ever deleted: archive instead | Documents are still archived. Unused code is deleted on the deep branch (decision 2) |

## Synthetic fixtures (no real repo)

- **`field-docs`:**
  - documents scattered in 7 places, including `claudedocs/` and `docs/superpowers/`
  - specs where one replaces another, decisions in 3 places, exact copies in `public/`
  - a 212-line rulebook with a design section and the line "explicit paths, never `git add .`"
  - a worktree holding an old `CLAUDE.md`, and an untracked `meeting-notes/`
- **`field-app`:**
  - a small JS app with its own `node --test` tests, so the proof runs with no packages to install
  - an unused file, an unused export, an import loop, a copied block and a misleadingly named file
  - colours typed by hand
  - one deliberately fragile step, to prove that a failing step is taken back

## Build order (local commits, each tested, reviewed and reported)

1. **Slice A:** sweep 1 end to end (inventory, plan check, screen, branch apply with proof, rulebook split check).
2. **Slice B:** sweep 2 read-only (project type, built-in analysis plus the repo's own tools, proof baseline, the
   research note check, the screen).
3. **Slice C:** sweep 2 apply (import rewrites on moves, plan edits, the proof per step, the deliberate break, the
   take-back).

## Decisions (Jimmy, 25 Oct 2026)

1. **Where it applies: a separate worktree.** The checkout's branch must never move, because a dev server and other
   sessions use it. The checkout's `node_modules` (or the equivalent) is linked into the worktree for the proof; if
   linking is not possible, the screen says the proof is limited. Never a download. At the end the worktree is removed
   and the branch `repo-fit/deep-<date>` stays for the person to merge.
2. **Code that nothing uses: deleted on the deep branch.** Git keeps it, and `git revert` brings it back.
3. **Slices:** A, B and C in one go, with a report to the hub after each. Screens as mocked.

## Found in the slice A live run (synthetic fixture, set up with repo-fit first)

- `playbook.json` names `docs/**` (autosave) and `decisions` (required). The move engine read that as "code names this
  folder" and refused every move out of `docs/`. Deep mode now reads `playbook.json` as repo-fit's own settings: it
  locks nothing, and a plan that empties a place it counts on must change it with `"paths"`.
- repo-fit's own index pages were counted as documents. They are not, and one left alone in an emptied folder now goes
  to `archive/` with it.
- The rebuilt map drops its own lines to files that left an area. The link proof now counts links that point at
  nothing, not working links in total.
- A last step with nothing left to change made a failed empty commit; now it says so and makes none. The same yes twice
  made a second branch; now each commit names its plan code and a second run says where it already is.

## Found in the slice A review (fresh reviewer, fixed with tests that failed first)

- Files that tools find by their name and place (`README`, `LICENSE`, `CHANGELOG`, `SECURITY` and the like, and
  `robots.txt`, `llms.txt`, `ads.txt`) could move. They stay now. `requirements.txt`, `CMakeLists.txt` and the web files
  are not counted as documents.
- A page (or an `.rst` or `.adoc` document) that points at other files by a relative path could move away from them.
  The plan check now refuses that move unless what it points at moves the same way.
- A status line rewrote blank lines in the whole document, could land above YAML front matter, and could rewrite a
  front-matter `status:` key. Now only the added line changes, it goes below front matter, and a front-matter key is
  left to the person.
- A commit hook that changed files without adding them left them for the next step. That step is now taken back.
- A run that was killed left its working copy and an empty branch. The next run removes them when that process is gone.
- A plan written wrongly crashed with a stack trace. It now gets a message per mistake, also in `--list`.
- A split ignored code blocks in its check but not when applied. Both ignore them now.
- A run with steps taken back said "done". It now says "partly done" and how many.
- Left as is: the rule proof compares lines as a set. A split moves lines word for word, so no reachable case loses a
  line; a counted proof would need a test that cannot fail. A partly applied plan says where it is; trying the steps
  taken back again needs a changed plan.
