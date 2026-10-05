# repo-fit: intent vs reality, and the way back (5 Oct 2026)

> Written after the maintainer said 0.6.0 feels weak. Sources: the session where repo-fit began (29 Sep), `CHANGELOG.md`, `AGENTS.md`, `claudedocs/2026-09-29-repo-landscape-research.md`, `claudedocs/2026-10-04-usefulness-audit.md`, and live runs on real repos (described by kind only). Status: **analysis and proposal. Nothing here is decided or built.**

## 1. Short answer

- **repo-fit kept its safety and lost its purpose.** The original intent was a system that makes any repo *fit*: it captures, absorbs, connects, organizes and keeps things tidy. What exists is a safe, polite **foundation**: a session briefing, one rulebook, an end-of-reply reminder, undo, update notices.
- **The heart is missing: organizing an existing mess.** repo-fit never moves, merges or restructures anything. It only adds a few files beside the mess.
- **This was not one mistake.** Each step was reasonable alone: a strict safety rule, then adapting to what exists, then cutting ceremony. Together they removed the organizing job. The last pass (mine, 4 Oct) fixed the noise by cutting, and did not check the result against the original intent.
- **The way back is a redesign around outcomes, not more fixes:** define what a "fit" repo looks like, measure it, then build Map → Tidy → Connect → Capture → Keep fit on top of the safety we already have. Borrow the organizing mechanics from the second-brain projects we set aside.

## 2. The original intent, in the maintainer's words (29 Sep)

> A holistic, reusable playbook for starting any repository: **a background system that captures and absorbs information, connects the dots, stays structured, self-improves, auto-commits/saves, and tracks backlog/jobs/tasks so nothing is dropped and work can start anytime with reminders of what's missing.** It must be improvable once and propagate everywhere. Must work on **existing** repos (**detect, organize**), not only new ones.

And the guard set the same day:

> "We're not building a second brain, rather we're trying to build a balanced foundation for a repository that can accommodate whatever type of project... I do not want to claim something too complex."

**The tension that was never resolved:** "organize the mess" and "not a second brain, nothing too complex". The guard won every time it was tested, so the organizing half shrank.

## 3. Promise vs today

| Original promise | Today (0.6.0) | Verdict |
|---|---|---|
| Work can start anytime, with reminders of what is missing | Session briefing: branch, unsaved work, open items, recent commits | ✅ Delivered |
| Improvable once, propagates everywhere | `update`, release notes in the briefing, automatic publishing, plugin auto-update | ✅ Delivered |
| Detect, adapt, ask | `detect`, `audit`, recommended set, one question | ✅ Delivered |
| **Organize existing repos** | Nothing is ever moved, merged or restructured. A few files are added beside the mess | ❌ **Missing** |
| Stays structured | No structure is proposed or kept for an existing repo | ❌ Missing |
| Connects the dots | The briefing counts notes nothing links to. Linking is a written rule | ⚠️ Weak |
| Captures and absorbs | A written rule ("keep what matters"), plus one end-of-reply reminder | ⚠️ Partial |
| Tracks backlog, jobs, tasks | A board table, offered only to notes repos | ⚠️ Partial |
| Self-improves | A lessons file with no mechanism behind it | ⚠️ Weak |
| Auto-saves | Built, but off almost everywhere: it moves the person to a side branch | ⚠️ Weak in practice |

## 4. How we drifted

```
29 Sep  0.1  Starter kit for NEW notes repos. Organizing existing repos planned as
             detect → audit → plan → apply, moves "never without your approval".
30 Sep–      0.2–0.5  Safety and adaptation: detect, audit, apply/undo with receipts,
 1 Oct       paths mapping, "leave as is", conflicts, protected paths.
             The guard became: "Moves, deletes ... are never automated."
             In practice: moves were never even offered.
 4 Oct  0.6  De-ceremony: one question, a minimal recommended set, rules cut from
             774 to 293 words. The noise went. So did the remaining ambition.
```

**Root causes**

1. **Organizing was never designed as a capability.** The plan only ever listed files to add. "Move", "merge" and "archive" existed as risk labels, never as a guided flow.
2. **"Never automated" was read as "never offered".** The intent was safety: nothing moves without a yes. The build made it: nothing moves.
3. **Success was measured by "nothing broke", not "the repo is better organized".** 135 tests prove safety. None measures whether a repo is more findable, connected or tidy afterwards.
4. **The intelligence lives in prose rules.** "Absorb, merge, connect" is text the assistant may follow. Research (ETH Zurich, Feb 2026) found rule files barely change agent behavior and cost over 20% more. The parts that work are the ones run by scripts (briefing, reminder).
5. **The best sources were set aside.** The 12 second-brain and LLM-wiki projects were excluded on 29 Sep, and most were read by title only. They hold the mechanics we need: ingest, organize, index, lint.
6. **The last pass optimized against the latest complaint.** I fixed "ceremony" by cutting and did not re-check against the original intent. That is on me.

## 5. What "fit" must mean: define the outcome first

A repo is **fit** when a fresh session, or a person, can do these without help. Each can be measured on a fixture repo before and after:

| Outcome | Measure (proposal) |
|---|---|
| **Orient in one minute** | The briefing plus one map page say what lives where, what is open, and what changed |
| **Find anything** | Share of notes reachable from an index page (target: nearly all, archives excepted) |
| **One home per topic** | Duplicate or near-duplicate notes on one topic, found and merged with approval |
| **New input lands in the right place** | A dropped-in note or decision is filed into its area and linked, not left loose |
| **Nothing silently rots** | Stale, orphaned or contradicting notes surface on a schedule and get resolved |
| **Open work in one list** | Every task, question and idea has one place, with a next step |
| **Works on spaghetti** | A one-folder-for-everything repo (work, second brain, code, media) gets a map and a tidy plan in batches |
| **Low ceremony** | At most 3 questions to start; each tidy batch is one plain yes; everything undoable |

The last line is the guardrail from this week's audit. The others are the original intent made measurable.

## 6. What to keep: the base is solid

These stay and become the safety floor the organizer stands on:

- **Look before touching:** `detect`, `audit`, `preview`.
- **Every write is reversible:** dry run, backup, receipt, `undo`.
- **Fits what exists:** the `paths` mapping, protected paths, the repo's own rules win.
- **Low-ceremony flow:** show first, one question, a plain explanation, the person runs the hook line.
- **Keeps itself current:** briefing, end-of-reply reminder, update notices, automatic publishing, plugin.
- **Proof tools:** the setup-contract tests and `dev/transcript-check.mjs` for live runs.

## 7. What to borrow (do not reinvent)

From the 29 Sep research, plus the second-brain projects set aside then. **Most of the second-brain ones were read by title only: the next session must read them from their own READMEs and code before borrowing.**

| Source | What to take | Read status |
|---|---|---|
| Karpathy's "LLM wiki" pattern (`karpathy-llm-wiki`, `llm-wiki-agent`, `nvk/llm-wiki`, `llm-wiki-compiler`) | **Ingest → file → index → lint**: raw sources in, an index page and a log, a "lint" pass that finds orphans, contradictions and gaps | Title or README opening only |
| `claude-obsidian` ("self-organizing second brain") | How a drop-in source gets read, classified, filed and linked | README opening only |
| `claude-memory-compiler` | Hooks capture sessions and compile them into evolving notes | README read |
| `OpenSpec` | **Delta-first**: organize the area you touch, never boil the ocean. Key for big messy repos | Read |
| `Backlog.md` | Task files with acceptance criteria; a board view; `--json` | Read |
| `dox` | One small rulebook per area in big repos, read from the root down | Read |
| `claude-reflect`, `backpass`, `agent-playbook` | Self-improvement: repeated corrections become proposed rule edits, reviewed by the person | Read |
| `fable5-methodology` | "Written rules decay": what a script can enforce, a script enforces | Read |
| Organizing methods (PARA, Johnny.Decimal, Zettelkasten) | A default structure to propose when a repo has none | **Not yet researched** |

## 8. A holistic direction (proposal for the design session)

```
          ┌──────────── safety floor (kept): look first · dry run · yes · undo ────────────┐
 MAP      read everything, group into areas, draw the current mess in the person's own words
 TIDY     propose a structure; move, merge, archive in small batches; one yes per batch; undoable
 CONNECT  one index page per area; every note reachable; links kept up to date
 CAPTURE  new input goes to an inbox, then is absorbed into its area (script-assisted, not prose)
 KEEP FIT briefing + reminder + a periodic "fit check" (lint) that proposes small fixes
 IMPROVE  repeated corrections become proposed rule edits (opt-in)
```

- **Delta-first for big repos:** map everything, tidy one area at a time.
- **Scripts over prose:** each capability is a command with a dry run, not a paragraph in `AGENTS.md`.
- **Plain files only:** Markdown, folders and Git. Whether to add anything heavier (search, embeddings) is a decision, not a default.

## 9. Decisions the maintainer needs to make first

1. **The scope guard.** Change "moves are never automated" to "moves only with a yes per batch, always undoable"? Allow wiki-like index pages and an inbox? Is "not a second brain" still the line, or is it "a second brain's organizing mechanics, in plain files"?
2. **Default structure.** Propose areas from the repo's own content, or start from a known method (PARA or similar)?
3. **Autonomy.** How big is a tidy batch? Which kinds of change can a "fit check" make without asking?
4. **Who it is for first.** The maintainer's repos, a friend's everything-folder, or public users? The answer sets the defaults.
5. **Positioning.** Today's README promises "give your project a memory". Keep, or say "makes a messy repo fit"?

## 10. How the next session should work

1. Read the intent (section 2), this report and `AGENTS.md`. Restate the goal in 5 lines and get the maintainer's yes.
2. Settle the decisions in section 9 with the maintainer, one question at a time.
3. Research the borrowed sources properly (section 7), primary sources only, dated.
4. Write the design: outcomes (section 5) → capabilities (section 8) → what changes in the code. One document in `claudedocs/`.
5. **Build the measurement before the feature:** fixture repos, including a "spaghetti everything-folder", with the outcome measures from section 5, run against today's 0.6.0 as the baseline.
6. Build in slices, each proven by the outcome measures and a live run checked with `dev/transcript-check.mjs`.
7. Release only when the spaghetti fixture and two real repos are measurably more fit, with the ceremony limits still met.

## 11. Limits

- The intent quote comes from the session summary of 29 Sep, not a verbatim chat line. The scope guard quote is verbatim from that summary.
- Most second-brain sources in section 7 have not been read beyond their titles or README openings.
- The outcome measures in section 5 are proposals. None has been built or run yet.
