# Starting prompt: make repo-fit deliver its original intent

Paste the block below into a new Claude Code session opened in `~/Developer/Personal/repo-fit`.

```text
We are redesigning repo-fit so it finally delivers its original intent: make ANY repository truly fit, including a messy "one folder for everything" repo (work, second brain, code, media). Today (0.6.0) it is a safe foundation (briefing, one rulebook, reminder, undo, update notices) but it never organizes anything. I want this done holistically, once, not fixed one piece at a time.

Read first, in this order, before proposing anything:
1. claudedocs/2026-10-05-intent-vs-reality.md  (the diagnosis, the outcomes, what to borrow, the decisions I must make)
2. AGENTS.md  (working agreements and the current scope guard, which this work may change with my approval)
3. claudedocs/2026-10-04-usefulness-audit.md  (why we cut ceremony; those limits still apply)
4. claudedocs/2026-09-29-repo-landscape-research.md  (earlier research; the second-brain projects there were set aside and mostly read by title only)

Then work in this order, and do not write product code until step 5:
1. Restate the goal in 5 plain lines and ask me to confirm it.
2. Walk me through the decisions in section 9 of the report, one question at a time, with a recommendation and a plain example for each. I am not technical: no jargon without a gloss, examples from real repos, not hypotheticals.
3. Research the sources in section 7 properly (their own READMEs and code, dated, primary sources only). Borrow what works; do not reinvent. Save the findings in claudedocs/.
4. Write one design document in claudedocs/: outcomes (section 5) → capabilities (Map, Tidy, Connect, Capture, Keep fit, Improve) → what changes in the code, with what stays out of scope. Show it to me and get my yes.
5. Build the measurement before the features: fixture repos, including a spaghetti everything-folder, scored on the section 5 outcomes, with 0.6.0 as the baseline.
6. Build in slices on branch dev. Each slice: tests that fail without it, `node --test` green, the outcome scores improve, and a live run checked with `node dev/transcript-check.mjs <session.jsonl>`.
7. Keep the ceremony limits from the audit: at most 3 questions to start, one plain yes per tidy batch, every change undoable, nothing moved or deleted without my yes.

Keep a checklist in claudedocs/ and tick it as you go. Commit locally on dev; ask before any push. Tell me plainly when something is untested.
```

## Why this order

- **Decisions before design:** the scope guard has to change before organizing can exist (report, section 9).
- **Research before design:** the organizing mechanics already exist in the second-brain projects; they were never read properly.
- **Measurement before features:** last time, success was "nothing broke". This time it is "the repo is measurably more fit".
