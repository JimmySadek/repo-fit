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
- [ ] Karpathy LLM wiki pattern and its implementations
- [ ] `claude-obsidian`
- [ ] `claude-memory-compiler`
- [ ] `OpenSpec` (delta-first)
- [ ] `Backlog.md`
- [ ] `dox`
- [ ] `claude-reflect`, `backpass`, `agent-playbook`
- [ ] `fable5-methodology`
- [ ] Organizing methods: PARA, Johnny.Decimal, Zettelkasten
- [ ] Findings saved, borrow list written

## Step 4. Design
- [ ] One design document: outcomes → capabilities → code changes → out of scope
- [ ] Maintainer says yes

## Step 5. Measurement before features
- [ ] Fixture repos (synthetic only), including a spaghetti everything-folder
- [ ] Outcome scorer for the section 5 outcomes
- [ ] 0.6.0 baseline scores recorded

## Step 6. Slices (each: failing test first, `node --test` green, scores improve, live run checked)
- [ ] (filled in after the design is approved)

## Ceremony limits (from the 4 Oct audit)
- At most 3 questions to start
- One plain yes per tidy batch
- Every change undoable
- Nothing moved or deleted without a yes
