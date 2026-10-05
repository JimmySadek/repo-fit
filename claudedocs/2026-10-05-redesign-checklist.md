# repo-fit redesign checklist (started 5 Oct 2026)

> Goal: make any repo truly fit, including a one-folder-for-everything repo. Source: `claudedocs/2026-10-05-intent-vs-reality.md`. Branch `dev`. Local commits only; ask before any push.

## Step 1. Goal
- [x] Restate the goal in 5 lines
- [x] Maintainer confirms the goal (5 Oct, with self-improvement added as line 6)

The confirmed goal:

1. A fit repo is one where a fresh session, or a person, can get oriented, find anything and pick up open work, without help.
2. repo-fit makes any repo fit, including a messy "one folder for everything" repo (work, notes, code, media). It maps what is there, proposes a structure and tidies in small batches.
3. Nothing moves, merges or gets deleted without a plain yes for that batch, and every change can be undone.
4. After tidying, it keeps the repo fit: new input lands in the right place, every note can be reached from an index page, and stale or orphaned notes show up for review.
5. It improves itself: corrections the person repeats become proposed rule edits they review (opt-in).
6. Success is measured, not assumed: fixture repos (including a spaghetti one) are scored before and after, against 0.6.0, within the ceremony limits.

## Step 2. Decisions (report section 9), one question each
- [x] D1 Scope guard (5 Oct): **organizer in plain files, with progressive disclosure.** Moves, merges, archives in small batches, one yes each, undoable; never deletes (archives). Always-loaded lines point to `MAP.md`; one index page per area; any note at most two steps from the map. Scripts build and check the map and indexes. No search engine, database or service; search is the fallback. Research: `2026-10-05-progressive-disclosure-research.md`
- [x] Cross-cutting rule from the maintainer (5 Oct): **every user-facing word is written for non-technical, non-native English readers** (skill, CLI output, briefing, generated pages, README). Say what it does, the intention and the why, briefly. Internal terms (like "progressive disclosure") never reach users without plain words
- [x] D2 Default structure (5 Oct): **the repo's own words first, plus a light skeleton.** Reuse existing folder names and gather loose things into them. Code never moves, nor files the code may load by name. Every repo gets `inbox/` and `archive/`. PARA's "active vs reference" idea is used only when a repo has no structure, in plain words
- [x] D3 Autonomy (5 Oct): **design once, one click, then standing rules.**
  - First run: repo-fit maps the repo, designs the best-fitting structure, and shows **before → after and why it is better for this person** (one screen; the full list one step away). One yes sorts it all: [Sort it all] [Check batch by batch] [Not now].
  - The one-click plan only moves and archives non-code files. Merging note text is never in it (listed afterwards to look at). Code and files the code loads never move. Undo: whole plan in one command, or batch by batch.
  - After that: repo-fit's own pages (map, index pages, briefing) update alone. A new inbox item that matches an approved **standing rule** ("screenshots → docs/screenshots/") is filed alone, with one line in the next briefing and undo. A new kind of item asks once, with "Yes, and always do this". Any rule stops in plain words.
  - ⚠️ Changes the brief's ceremony limit from "one yes per tidy batch" to "one yes for the whole plan, after seeing before, after and why"
- [x] Core principle from the maintainer (5 Oct): **not one-size-fits-all. The same logic for everyone, tailored to each person's existing work**, so everyone benefits
- [x] D4 Who it is for first (5 Oct): **answered by the principle above.** No single target user: defaults come from what each folder already has (code, notes, everything-folder, with or without git). Wording always for non-technical, non-native English readers. Design note: several real working folders have no git, so tailoring must cover them
- [x] D5 Positioning (5 Oct): **"From chaos to progress."** New README opening: "From chaos to progress. repo-fit organizes your project folder, so you and your AI assistant can find anything, then keeps it organized. You see the before and after first. Nothing moves without your yes, and everything can be undone." Use "organize", not "tidy" (clearer for non-native readers). ⏳ The README changes only when the organizing feature ships
- [x] Record the answers here and in `AGENTS.md` (scope guard approved in D1)

## Step 3. Research (primary sources, dated) → `claudedocs/`
- [x] Karpathy LLM wiki pattern and its implementations
- [x] `claude-obsidian`
- [x] `claude-memory-compiler`
- [x] `OpenSpec` (delta-first)
- [x] `Backlog.md`
- [x] `dox`
- [x] `claude-reflect`, `backpass`, `agent-playbook`
- [x] `fable5-methodology`
- [x] Organizing methods: PARA, Johnny.Decimal, Zettelkasten
- [x] Safe moves: link rewriting when files move, git rename behaviour, code references (added 5 Oct: the one-click plan depends on it)
- [x] Findings saved, borrow list written: `2026-10-05-borrow-research.md`
- ⏳ Cleanup for the maintainer: research copies (~900 MB) sit in the session scratch folder; deletes were blocked for the agents, so the maintainer runs `sh <scratchpad>/cleanup-research.sh`

Code facts gathered for the design (5 Oct):
- `lib/apply.mjs` `writeAll`/`undo`: backups and receipts work without Git, but only `create` and `edit` entries exist. A `move` entry is needed.
- `lib/audit.mjs`: Markdown links only, orphans, stale (Git only, 180 days), protected paths, big files, secrets. `scripts/playbook/lib.mjs` `coverage()` also follows `[[wiki links]]`.
- `dev/transcript-check.mjs`: `OFF_TOPIC` lists archive, stale, unlinked, old notes. These become on-topic for organizing; the checker must change with the flow.

## Step 4. Design
- [x] One design document: outcomes → capabilities → code changes → out of scope (`2026-10-05-redesign-design.md`)
- [x] Maintainer says yes (5 Oct), including the 6 choices listed with the design: standing-rule filing at session start, uncertain items to `inbox/`, same-role folders only suggested, exact copies archived in the plan, no transcript reading, open tasks stay in their notes

## Step 5. Measurement before features
- [x] Fixture repos (synthetic only), including a spaghetti everything-folder: `dev/fixtures.mjs` (5 folders)
- [x] Outcome scorer for the section 5 outcomes: `dev/score.mjs`, runner `dev/measure.mjs`, tests `test/measure.test.mjs`
- [x] 0.6.0 baseline scores recorded: `2026-10-05-baseline-0.6.0.md` (pinned to commit `3fed971`; no `v0.6.0` tag exists)

## Step 6. Slices (each: failing test first, `node --test` green, scores improve, live run checked)
- [x] 1. Map + generated `MAP.md` and index pages + pointer (add-only). Moves: Orient, Find. Done 5 Oct: 153 tests pass; Orient ✅ and Find 100% on all five folders; safety unchanged ✅. The first build hid orphan notes (links from the map counted), dropping "Nothing rots" below 0.6.0; fixed with a test, back to 3/1/3/4. Live run: only `repo-fit map` run by hand on a copy of the everything-folder (plain words, nothing written). ⏳ **Not yet** a skill session checked with `node dev/transcript-check.mjs <session.jsonl>`, which the original brief asks for every slice: do it with slice 4's first live skill run, when the flow offers the map. The measure adapter needed no change (A-13 and D-11 are in the recommended set)
- [x] 2. Safe move engine: move receipts, plan fingerprint, journal, link rewrite, code-reference check, verify, undo. Moves: Safety. Done 5 Oct: `lib/move.mjs`, `undo` extended; 13 new tests, 166 pass. On the test folders the engine moved 36, 20 and 10 files, refused every file the code or rules need, kept links working, and undo restored the exact tree. Scores unchanged (no command uses it yet), safety ✅. ⏳ No live run: there is nothing a person can run until slice 3
  - [x] Link scanner: inline, images, reference definitions, angle brackets, `%20`, HTML src/href, wikilinks (headings, aliases, embeds), frontmatter; skips code blocks and inline code
  - [x] Plan: refuse code, files named by code/config/rule files, protected paths, dot folders, taken or duplicate destinations; list plain-text mentions
  - [x] Rewrite both directions, keeping each link's style (fragment, title, `./`, `.md` or not, `<>` or `%20`, alias, `!`)
  - [x] Fingerprint: refuse when a file in the plan changed after the preview
  - [x] Journal before the first move; verify after (files, content, working links); roll back on failure; recover after a crash
  - [x] Receipt `move` entries; `undo` moves back, refuses where a file changed, restores emptied folders
  - [x] Whole-folder test on the test folders with the independent scorer: nothing lost, code untouched, links not fewer, undo restores the exact tree
  - Engine only, no user command: the organize screen (slice 3) is its front door, so the scores move in slice 3
- [x] 3. Organize plan and the before/after/why screen; one-click apply. Moves: Loose, Find, One home. Done 5 Oct: `lib/organize.mjs`, `repo-fit organize` (screen, `--list`, `--apply`), one receipt for moves + links + map. 179 tests pass. Scores: loose at the top 30/30/7/18 → 0/0/0/0; exact copies 1/1 everywhere; Orient and Find full; safety ✅; nothing else lower. Found and fixed with tests: folder links did not follow an archived folder (the move check rolled back, as designed); moved notes lost their old date; empty `inbox/` missing from the map; rule files naming a folder locked files in; repo-fit's own scripts blocked `INDEX.md`; notes went into the setup's `docs/`. ⏳ Live run: the screen read on a copy of the everything-folder (wording fixed: plural, matching counts, one archive line); no skill session yet (slice 4)
  - ⏳ Not built (left for later slices, as designed): renaming folders before the yes (the skill, slice 4), batch-by-batch apply, "Not now, just the map" (slice 4 flow), near copies (judgement pass)
- [ ] 4. `SKILL.md` flow and transcript checker; first live run on a test folder. Moves: Ceremony
- [ ] 5. Capture: inbox, standing rules, duplicates, "Not now"; briefing lines. Moves: New input
- [ ] 6. Fit check: facts, rebuild, judgement pass prompt; dates without Git. Moves: Nothing rots
- [ ] 7. Open work collector and map section. Moves: Open work
- [ ] 8. Improve: receipts-based rules, candidates, preferences block (opt-in)
- [ ] 9. Release prep: README "From chaos to progress", CHANGELOG, guidance (Codex URL), `docs/reference.md` scope line, pilots on copies of two real folders with the maintainer's approval
- For each slice, add the measure adapter step in `dev/measure.mjs` so the scores reflect the new flow

## Ceremony limits (from the 4 Oct audit)
- At most 3 questions to start
- One plain yes per tidy batch
- Every change undoable
- Nothing moved or deleted without a yes
