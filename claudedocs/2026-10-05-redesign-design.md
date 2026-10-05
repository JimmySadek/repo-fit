# repo-fit redesign: from chaos to progress (design, 5 Oct 2026)

> **Status: design for the maintainer's yes. Nothing here is built.** Inputs: the confirmed goal and decisions (`2026-10-05-redesign-checklist.md`), the diagnosis (`2026-10-05-intent-vs-reality.md`), the ceremony limits (`2026-10-04-usefulness-audit.md`), and the research (`2026-10-05-progressive-disclosure-research.md`, `2026-10-05-borrow-research.md`). Examples use synthetic folders only, per `AGENTS.md`.

## 1. In one page

repo-fit today adds a briefing and a rulebook beside the mess. After this redesign it **organizes the mess itself, keeps it organized, and learns from the person**, with the same safety it has now.

```
          ┌──── safety floor (kept): look first · one yes · receipt · undo · never delete ────┐
 MAP       a script reads the whole folder and groups it into areas, in the folder's own words
 ORGANIZE  one plan: before → after → why. One yes moves and archives. Code never moves
 CONNECT   MAP.md → one index page per area → the note. Any note two steps from the map
 CAPTURE   new things land in inbox/. Approved standing rules file them; new kinds ask once
 KEEP FIT  a fast script check every session; index pages rebuild themselves; problems surface
 IMPROVE   patterns the person repeats become proposed rules (opt-in, never automatic)
 OPEN WORK every open task in the notes shows up in one list on the map
```

**Same logic for every folder, tailored to what it already has.** A code repo, a second brain and an everything-folder all go through the same steps; what changes is what the scripts find.

**Built from proven pieces.** Every mechanic below comes from a source we read (section 9). What is new is putting them together with a receipt and undo, which none of the sources does.

## 2. Design rules (from the decisions)

| Rule | What it means in practice |
|---|---|
| **Plain words for every user** | Every screen, message and generated page reads clearly for a non-technical, non-native English reader. Say what happens, the intention and why, briefly. Internal terms never reach users |
| **Short first, details when asked** (progressive disclosure) | The always-loaded part is a few lines. The map is one line per area. People see one screen, with the full list one step away |
| **Scripts, not written rules** | Each capability is a command with a dry run. Written rules only point at the commands. OpenSpec dropped its AGENTS.md block for the same reason |
| **One yes for the plan** | After seeing before, after and why. Then standing rules for new items. A new kind of item asks once |
| **Never delete** | Archive instead. Undo moves things back, it never removes the person's files |
| **Code never moves** | Nor any file that code, config or rule files mention by name |
| **Own words first** | Reuse the folder's existing names. Add only `inbox/`, `archive/` and repo-fit's own pages |
| **Measure, then add** | Each slice must raise the outcome scores (section 7) on test folders, with 0.6.0 as the starting score |

## 3. What the person sees

### 3.1 First run (the setup, at most 3 questions)

```
1. LOOK     scripts read the folder silently: detect, map, plan, dry run
2. SHOW     one screen: your folder today → after → why it is better for you
3. ASK      [Organize it all]  [Show me the full list first]  [Not now, just the map]
4. APPLY    one apply with a receipt; links rechecked; result + one undo line
5. BRIEFING the person runs one line to turn on the session-start briefing (Claude Code requires that)
6. RECAP    what changed, what was checked, how to undo
```

**The SHOW screen**, for a synthetic everything-folder (the "spaghetti" test folder in section 7):

```
Your folder today                          After one click (undo any time)
62 things loose at the top                 MAP.md          start here: what lives where
  23 screenshots and photos                inbox/          new things land here
  14 notes about 4 topics                  notes/          your 14 loose notes, beside the 6 in stuff/
   6 PDFs                                  media/          the 23 images
"old/", "New Folder", "stuff/"             documents/      the 6 PDFs
website/ (a small program)                 archive/2026-10-05-old/   "old/" and "New Folder". Nothing deleted
                                           website/        the program, exactly where it is

Why this is better for you
 • You and your assistant can find any note in two steps from MAP.md. Today 14 notes have nothing pointing to them.
 • New things get one landing place, so the top of the folder stays clear.
 • Nothing is deleted. Old things are in archive/, still findable. The program and the files it uses stay put.
 • 38 links inside your notes are updated, so none of them break.
```

- **Each move has a short "why"** in the full list (Forte's caution: filing by hand reminds people what they have; the "why" keeps that moment).
- **Items the plan cannot place confidently go to `inbox/`**, not into a guess (Johnny.Decimal's approach). The briefing then offers to file them.
- **New folder names** reuse the folder's own words. When the folder has none, the plan uses plain English (`notes/`, `documents/`, `media/`), and the assistant may suggest names in the language the folder already uses. The person can rename before saying yes.
- **A folder that is already organized** gets only the map and index pages. "Nothing to move" is a good result, and the screen says so.

### 3.2 Every session afterwards

```
📍 my-folder · 2 uncommitted · last change 3 Oct
📥 Filed on my own (your rules): 3 screenshots → media/screenshots/        undo: repo-fit undo
📥 Inbox: 1 new kind of item: "contract-draft.pdf" → documents/?
      [Yes]  [Yes, and always do this]  [Not now]
🧹 Fit: 2 things to look at (1 broken link, 1 note missing from its index page)
✅ Open work: 7 items across 4 notes (see MAP.md)
```

- Lines appear only when there is something to say. A clean folder gives a two-line briefing.
- "Not now" is remembered; repo-fit asks again only when more items of that kind arrive (backpass).

### 3.3 Now and then: the judgement pass

When the person asks, or when the briefing suggests it (for example after 2 weeks), the assistant reviews what scripts cannot judge: notes that may cover the same topic, claims that contradict each other, outdated notes. It proposes changes; nothing changes without a yes. A contradiction gets a dated "Outdated" or "Disputed" line under the claim, never a silent rewrite (Astro-Han).

## 4. Capabilities

Each capability: what it does, who does what, and where it comes from. "Script" means a plain Node script, no judgement. "Assistant" means the assistant's judgement in the session.

### 4.1 Map

- **Script** walks the folder: skips dot folders and tool folders (`node_modules`, `.git`), does not follow linked folders, sorts the same way on every computer, and works without Git (OpenSpec, claude-obsidian).
- **Areas** are the existing top-level folders, in their own names, plus groups for loose top-level files by kind (notes, documents, images, media, data). File kind comes from the first bytes, not only the extension (claude-obsidian).
- **Code areas** are detected (manifests such as `package.json`, source folders) and marked "stays where it is".
- **Huge folders are handled as one unit**: a data folder with 19,000 files is one line ("data/: 19,270 data files"), never 19,000 lines.
- **Area descriptions:** taken from the folder's README first line when there is one; otherwise the assistant writes one line the first time the area is touched (OpenSpec's delta-first rule).

### 4.2 Organize

**The plan (script proposes, person approves once):**

| Situation found | Proposal | Source |
|---|---|---|
| Loose files at the top that are not standard root files (README, LICENSE, manifests, rule files, config) | Into the existing folder that fits their kind; else a new plain-named folder | own design, Johnny.Decimal |
| 3 or more files sharing a name start (after removing dates, "v2", "final", "copy") | A folder for them; the person names it if the shared part is too short | nvk check C9d (coded here) |
| Folders that look old (`old/`, `backup/`, "copy of", "New Folder", empty) | `archive/YYYY-MM-DD-<name>/` | OpenSpec archive naming |
| Exact duplicate files (same fingerprint) | Keep one; the copy goes to the archive, listed as "same as …" | claude-obsidian |
| Anything uncertain | `inbox/`, to file later | Johnny.Decimal |
| Two folders for the same role (for example two document folders) | **Listed as a suggestion only**, a separate yes: folder names are often mentioned in rules and tools | own design |
| Code, files mentioned by code, config or rule files, protected paths, dot folders, Git-ignored files | **Never moved.** Shown as "stays, because …" | Group 5 code-reference check |

**The one-click plan contains only moves and archives** of non-code files, plus creating `MAP.md`, index pages, `inbox/` and `archive/`. Merging the text of two notes is never in it: those appear afterwards as "may cover the same topic, look when you like".

**The safe move engine (script):**

1. **Plan the whole batch first** and resolve every link against the after-move state (Foam).
2. **Code-reference check:** search every text file for each path and file name; a hit outside Markdown means "do not move, show why" (Git docs).
3. **Rewrite links in both directions** (VS Code's algorithm): links to a moved file, and relative links inside it. Keep headings, aliases, embeds, link style, spaces style; skip code blocks; handle reference links, angle brackets, `%20`, wikilinks with aliases, links inside frontmatter, Unicode-normalized names (macOS) and case-only differences.
4. **Tie the yes to the exact plan:** a fingerprint of the plan and of every file in it. If anything changed after the preview, refuse and show a fresh plan (claude-obsidian). Users never see the fingerprint.
5. **Journal before the first move** (prepared → applying → complete), check destinations are free, roll back on any failure, recover after a crash (claude-obsidian, OpenSpec).
6. **Verify after:** same number of files; every moved file has the same content except edited link lines; the number of working links is the same or higher. If not, roll back automatically and say so.
7. **Undo** the whole plan in one command, or one batch at a time. It replays the receipt in reverse and refuses where a file changed since (today's `undo` behaviour, extended to moves). Works with and without Git. repo-fit still never commits.

### 4.3 Connect

- **`MAP.md` at the top of the folder.** One line per area: name, link to its index page, one line on why it exists. `inbox/` and `archive/` at the bottom. An "Open work" section (4.6). A soft warning when the map passes about 10 areas (Johnny.Decimal).
- **One index page per area** (`<area>/INDEX.md`): a top line on why the area exists, then one line per note: title, link, one-line summary, date. The summary comes from the note's frontmatter, else its first real paragraph, capped (nvk). Images and media are summarized as counts with a link to their folder when there are many. Links are always path links, so identical file names in different areas never become ambiguous.
- **Generated, but editable around:** the lists sit between markers with a banner ("made by repo-fit; the list is rebuilt, write above or below it"). Written safely (temporary file, then rename) (nvk, atomicstrata).
- **The index is a cache:** when the count of rows and files differ, a script rebuilds it from the files (nvk). A note that disappears is marked `[MISSING]` until the next rebuild confirms it, never dropped silently (Astro-Han).
- **The always-loaded part shrinks to a pointer:** inside repo-fit's versioned marker block in `AGENTS.md`, a few lines: start at `MAP.md`, new things go to `inbox/`, the briefing command (Backlog.md). The rest stays on demand.

### 4.4 Capture

- **A visible `inbox/`**, never a hidden folder (claude-obsidian).
- **Exact duplicates** are found by fingerprint: "already in notes/…" (claude-obsidian).
- **Standing rules** are a small table in `playbook.json` (JSON, since Node has no YAML reader): what matches (file kind, optional name pattern) → which folder, when approved. Filing is a lookup, never a guess (claude-obsidian, nvk).
- **A new rule is dry-run on the inbox before it starts:** "this rule would file 7 items" (agent-playbook's validate-before-apply idea).
- **When filing happens:** at session start, inside the briefing step, only for items that match approved rules, with a receipt and undo, and a line in the briefing. ⚠️ This changes one guarantee: the session-start step stops being read-only, **only** for standing rules the person approved. No background watcher (no running service).
- **New kinds of items** are offered with [Yes] [Yes, and always do this] [Not now]. "Always" creates the rule; "Not now" is remembered (backpass).
- **Dropped content is data, not instructions** (claude-obsidian).

### 4.5 Keep fit (the fit check)

- **Read-only script checks, every session, fast**, with one finding shape `{severity, code, message, target, fix}` and plain English first (OpenSpec, nvk). Three kinds (atomicstrata):

| Kind | Checks | What happens |
|---|---|---|
| **Fact** | broken links (fix offered only when exactly one file matches), notes missing from their index page, index lines pointing at nothing, inbox items waiting more than 14 days, loose files back at the top, exact duplicates, duplicate names (ignoring case), empty notes, notes not changed for a long time (Git date, else the file's own date when there is no Git) | Listed in the briefing as a count; fixed only with a yes |
| **Assistant's opinion** | notes that may cover the same topic, contradictions, outdated claims | Only in the judgement pass (3.3) |
| **Page to rebuild** | map or index out of date | Rebuilt alone (repo-fit's own pages, per Decision 3) |

- **Repairs are separate approved changes**, then the check runs again to confirm (claude-obsidian).
- Derived states such as "stale" are worked out when read, never written into notes (Backlog.md).

### 4.6 Open work in one list

- A script collects open items **where they already are**: unchecked checkboxes (`- [ ]`; only `x` counts as done), `TODO:` lines, an open-questions page, a board if the repo has one (OpenSpec's checkbox rules).
- `MAP.md` shows the count and the first few items with links to their notes; `repo-fit open` prints the full list. Nothing is moved out of the notes. The 0.6.0 board stays available for people who want it.

### 4.7 Improve (opt-in)

- **Signals, all private by design** (no reading of chat transcripts):
  1. repo-fit's own receipts: the person files the same kind of item to the same place by hand again and again → propose a standing rule.
  2. "Yes, and always do this" in the moment (the strongest signal: claude-reflect's own data shows a queue of saved corrections goes unread).
  3. A correction the assistant notices in the session, stored as a short candidate in `.playbook/` (local, ignored by Git); proposed only after it repeats (2 or more).
  4. **Regression flag:** a correction that matches a rule already approved means the written rule is not working → propose a script or check instead (agent-playbook).
- **A proposal shows** the exact rule text, where it goes (repo-fit's "your preferences" block, never anywhere else), why, how often it was seen, and how to undo. Rule text is checked before saving: one line, short, no secrets (claude-reflect). Never written without a yes. Rejections are remembered (backpass).

## 5. What changes in the code

| Area | Change | Status today |
|---|---|---|
| **New:** map | `repo-fit map <repo>`: read-only scan → areas, kinds, code areas, huge folders as units; `--json` | Partly in `detect` (file survey) and `audit` (Markdown walk) |
| **New:** organize plan | `repo-fit organize <repo>`: the plan with a "why" per move, grouped in batches; renders the before/after/why screen; `--apply` | Nothing: the audit plan is add-only |
| **New:** safe move engine | `lib/move.mjs`: link scanner and rewriter (one shared parser for Markdown links, images, reference links, wikilinks, embeds, frontmatter links), code-reference check, verify, rollback | Two separate link scanners (`lib/audit.mjs`, `scripts/playbook/lib.mjs`), read-only |
| **Changed:** apply and undo | Receipts gain a `move` entry; plan fingerprint (refuse if changed); journal states; crash recovery; undo of moves | `create` and `edit` only; `apply` rebuilds at write time instead of refusing |
| **New:** generated pages | `MAP.md` and `<area>/INDEX.md` builder, rebuilt as a cache; vendored into the repo so it works without repo-fit installed | Nothing |
| **New:** capture | Inbox filing with standing rules, duplicate check, "Not now" memory; runs at session start and on request (`repo-fit file`) | Nothing |
| **Changed:** briefing | Lines for filed items, inbox, fit, open work; quiet when there is nothing to say | Branch, board, review queue, update notice |
| **Changed:** check → fit check | Fact checks above, three kinds, one finding shape, `--json`; old-note check without Git | Board checks, orphans, stale (Git only) |
| **New:** open work | Collector and `repo-fit open` | Board table only |
| **New:** improve | Candidate store, repeat counter, proposal and "your preferences" block | A lessons file with no mechanism |
| **Changed:** `SKILL.md` | New flow: LOOK, SHOW before/after/why, ASK once, APPLY, BRIEFING, RECAP. Plain words. About the same length as today | Setup flow for add-only pieces |
| **Changed:** core block | Shrinks toward a pointer to the map and commands | 293 words |
| **Changed:** `dev/transcript-check.mjs` | Archive, stale and unlinked become on-topic; counts the plan's single yes; still at most 3 questions | Treats them as off-topic |
| **Changed:** starter kit | A new folder starts with `MAP.md`, `inbox/`, `archive/` | Notes-repo files |
| **Changed at release:** README, CHANGELOG, `package.json` description, guidance (Codex docs URL now redirects) | "From chaos to progress" | "Give your project a memory" |
| **Stays** | `detect` and `audit` (read-only), backups, receipts, update notices, `connect`, `tools`, `prefs`, the guidance layer, autosave (off by default) | |

**Codex:** it has no question buttons, so the skill offers numbered plain-text choices there. Codex hooks stay labelled untested until a Codex session shows the briefing.

## 6. Out of scope (on purpose)

- Search engines, embeddings, databases, services, background programs, and model calls from scripts.
- Deleting anything. Merging note text automatically.
- Moving code, or files that code, config or rule files mention.
- Renaming folders to a method (numbered folders, PARA folders) when the folder already has structure.
- Reading chat transcripts for self-improvement.
- An `AGENTS.md` in every folder (dox), Obsidian-only features, code-aware refactoring.
- Committing or pushing. repo-fit never commits; the repo's own rules decide.

## 7. Measurement (built before the features)

**Test folders** (synthetic, generated by a script so they are the same every run):

| Folder | What it contains | What it tests |
|---|---|---|
| **spaghetti** (with and without Git) | ~80 items: loose images, PDFs and notes on 4 topics with duplicates ("Meeting notes.md", "meeting-notes (1).md", an exact copy), a small program that uses two files by name, `old/`, "New Folder", `stuff/`, scattered checkboxes, broken links, notes nothing links to | The whole flow on a real mess |
| **code with document sprawl** | a program with tests, a model file the code loads, screenshots at the top, two document folders, a loose report, three results folders | Code never moves; docs get organized |
| **flat second brain** | 60 notes in one folder with `[[wiki links]]`, old notes (dated via Git), orphans, duplicates | Connect, keep fit, open work |
| **already tidy** (control) | a well-organized folder | The plan proposes almost nothing |
| **one sample per defect** | small folders, each with one problem (nvk's approach) | Each check and each link rewrite |

**Scores** (`dev/score.mjs <folder>`, deterministic):

| Outcome | Score |
|---|---|
| Orient in one minute | `MAP.md` exists and covers every top-level item; the pointer is in the rulebook; the briefing runs |
| Find anything | Share of notes reachable within two links from `MAP.md` (archive excluded) |
| One home per topic | Planted duplicates found (and resolved after a yes) |
| New input lands in the right place | Planted inbox items filed into the expected folder and listed in its index |
| Nothing silently rots | Planted problems surfaced by the fit check |
| Open work in one list | Planted open items listed in one place |
| Works on spaghetti | Loose top-level items before → after |
| Low ceremony | Live run: at most 3 questions, one yes for the plan (`dev/transcript-check.mjs`) |
| **Safety (must be 100% every time)** | No file lost (every original fingerprint present), code untouched, working links not fewer, undo restores the exact original tree |

**Baseline:** 0.6.0's recommended set run on each test folder and scored. Targets are set after the baseline is measured, not invented now.

## 8. Build order (slices on `dev`)

Each slice: tests that fail without it, `node --test` green, scores up, and a live run checked with `dev/transcript-check.mjs` where the flow changes.

| # | Slice | Scores it should move |
|---|---|---|
| 0 | Test folders, scorer, 0.6.0 baseline | (baseline) |
| 1 | Map + generated `MAP.md` and index pages + pointer (add-only) | Orient, Find |
| 2 | Safe move engine: move receipts, fingerprint, journal, link rewrite, code-reference check, verify, undo | Safety |
| 3 | Organize plan and the before/after/why screen; one-click apply | Spaghetti, Find, One home |
| 4 | `SKILL.md` flow and transcript checker; first live run on a test folder | Ceremony |
| 5 | Capture: inbox, standing rules, duplicates, "Not now"; briefing lines | New input |
| 6 | Fit check: facts, rebuild, judgement pass prompt; no-Git dates | Nothing rots |
| 7 | Open work collector and map section | Open work |
| 8 | Improve: receipts-based rules, candidates, preferences block (opt-in) | (new behaviour, measured by proposals made on planted repeats) |
| 9 | Release prep: README, CHANGELOG, guidance; pilots on **copies** of two real folders, only with the maintainer's approval for the exact folders | All |

## 9. Risks

| Risk | How the design handles it |
|---|---|
| ⚠️ **Link rewriting breaks something** (the hardest code) | One sample folder per link form; verify after every apply; automatic rollback if working links drop |
| Large folders are slow | Huge folders handled as one unit; walk caps; measured on a large test folder |
| People lose familiar paths | `MAP.md`, a "why" per move, undo in one command |
| One click moves a lot at once | The full list is one step away; uncertain items go to `inbox/`; nothing deleted; journal and rollback |
| The session-start step now moves files (standing rules only) | Opt-in per rule, receipt, undo, a briefing line every time |
| Obsidian does not see moves made outside it | repo-fit rewrites the links itself |
| Codex behaviour | Numbered choices; hooks labelled untested until seen working |
| Scope creep toward a second brain | Section 6, and the scope guard in `AGENTS.md` |

## 10. Sources

All mechanics are traced in `2026-10-05-borrow-research.md` (five groups, primary sources, fetched 5 Oct 2026) and `2026-10-05-progressive-disclosure-research.md`.
