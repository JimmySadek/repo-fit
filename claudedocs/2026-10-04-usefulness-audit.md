# repo-fit usefulness audit (4 Oct 2026)

> Impartial review of repo-fit 0.5.0: is it useful, or good intent with ceremony? Evidence comes from the code, a read-only run on this repo, three real sessions where the maintainer used `/repo-fit`, and outside research. Real repos are described by kind only, per this repo's rule.

## 1. Short answer

🎯 **The maintainer's feeling is right, and the cause is in the design, not in the model.**

- **Most questions asked are not about value.** In three real sessions the skill asked **23 questions**. Only about **5** were about something that improved the repo. The rest were setup trivia, housekeeping outside repo-fit's job, or conflicts that repo-fit's own rules created.
- **The "safest is to adopt nothing" feeling is built in.** The skill is 2,537 words with 19 "never", 14 "do not" and 20 "ask". The audit labels the repo's own rules as **"Conflicts"**. The rules block then **defers to the repo on each conflict**. A careful model reads all this and correctly concludes that skipping is safest.
- **Part of the resistance was correct.** On a mature repo, the core rules block mostly repeats what the repo already has. In one session the model's first question offered only options that skipped the block. The fix is more value per step, not more persuasion.
- **The valuable core is small:** the session brief, one rulebook for Claude Code and Codex, and a short commands section. Those should be the product. Most of the rest should become optional or move out of onboarding.

## 2. Evidence: three real sessions

Counted from the local transcripts, from the `/repo-fit` call onward.

| Repo kind | Questions | Useful (changed the repo for the better) | Setup trivia | Housekeeping outside repo-fit's job | Conflicts created by repo-fit's rules |
|---|---:|---:|---:|---:|---:|
| Code repo (an app) | 12 | 2 | 3 | **6** | 1 |
| Writing studio | 7 | 1 | 3 | 0 | **3** |
| Knowledge repo | 4 | 2 | 0 | 1 | 1 (all options skipped the core block) |
| **Total** | **23** | **5** | **6** | **7** | **5** |

What the numbers show:

- ❌ **The screenshot question is not a repo-fit feature.** No repo-fit code looks at scheduled CI workflows. The model invented the question. It did so because the skill says "audit", "worth improving" and "every edit, one by one", and `detect` says "workflow can be offered" (`lib/detect.mjs:237`). Nothing tells the model where repo-fit's job ends.
- ❌ **"Never bundle" produced 3 identical questions** in a row: "Archive old note A?", "Archive B?", "Archive C?".
- ❌ **"Which models will you mostly use?" was asked in all 3 sessions and changes no file.** The answer is only written into `playbook.json` and printed (`bin/repo-fit.mjs:142`, `lib/apply.mjs:218`).
- ❌ **repo-fit's own branch rule caused 3 of the 7 questions in the writing studio.** The repo says "commit on main". The core block says "never commit on main". The user had to settle a fight the tool started.
- ✅ **What landed well:** the session brief, a shared `AGENTS.md` with `CLAUDE.md` importing it, small record pages in the notes repos, and refreshing an outdated `CLAUDE.md`.

## 3. Why the model resists adopting

| Root cause | Where | Effect |
|---|---|---|
| **Fear-heavy instructions.** Safety is already enforced in code (dry run, backup, receipt, undo), then repeated in prose many times. | `SKILL.md`, 2,537 words | The model learns "this tool is risky" and recommends the smallest change or none |
| **The repo's own rules are framed as "Conflicts" with a ⚠️.** | `lib/audit.mjs:354`, `:437` | repo-fit looks like an intruder. "Skip" looks like respect |
| **The slim block defers on every topic the repo covers.** | `lib/adapt.mjs:242` | On a mature repo, little is left to add. The model sees this and offers to skip |
| **Options are IDs and file names, not outcomes.** "A-01 add playbook.json", "D-02 link CLAUDE.md". | `lib/audit.mjs:441-450` | The user cannot see what they gain, so "no" is the easy answer. This is the missing "show me examples" step |
| **The score measures conformity, not value.** A code repo scores "7 missing" for not having a people page, log, lessons file and so on. | `lib/audit.mjs:239-268` | Seven empty template files look like the plan. Users rightly reject them |
| **No question budget and no scope fence.** | `SKILL.md` Step 0c, Step 1 | Every finding becomes a question, including ones outside the tool's job |
| **Brittle detection creates fake conflicts.** On this repo: the commit rule detected is a sentence about *other* repos (`AGENTS.md:19`). Templates are flagged as unlinked notes. One banner image triggers a media `.gitignore` step. | `lib/adapt.mjs:151`, `lib/audit.mjs:293`, `:374` | Each false positive becomes one more question |

A read-only `audit` on this repo (a code repo) proposes **8 add-only files and 4 decisions**: 12 decision points before the user sees any benefit.

## 4. Keep, shrink, park

| Piece | Verdict | Why |
|---|---|---|
| Session brief (hook + `brief.mjs`) | ✅ **Keep, make it the hero** | Visible value every session. A hook runs every time, unlike a rule the model may ignore (Anthropic) |
| One rulebook: `AGENTS.md` + `CLAUDE.md` import | ✅ Keep | Real, cheap fix for using Claude Code and Codex together |
| Dev, Test and Lint commands section (D-10) | ✅ Keep, promote | Research: exact commands and non-standard practices are what rule files are good for |
| Undo, backup, receipt | ✅ Keep, make it quiet | Good safety. It should let the flow move faster, not add more warnings |
| Core rules block (774 words, always loaded) | ⚠️ **Shrink hard** | Long rule files raise cost and do not raise compliance (see section 5). Keep only rules that change behavior |
| Board with 10 columns, current view, log, decisions, people, lessons | ⚠️ Optional, for notes repos | Useful in knowledge repos. Noise in code repos |
| Imposed branch and commit rules | ❌ Stop imposing | Read the repo's own rules and the user's guard. Never add a competing rule |
| Housekeeping (old notes, unlinked notes, media rules, big files) | ⏳ Move to an "also noticed" list | Not onboarding. Never asked as questions |
| Tools and models questions | ❌ Drop | Tools can be detected. Models change nothing |
| Guidance freshness check, `tools --update`, `connect` | ⏳ Out of onboarding | Maintainer and on-request features. Users never asked for them |

## 5. What others do well (research)

| Source | Finding | Lesson for repo-fit |
|---|---|---|
| ETH Zurich study on AGENTS.md ([arXiv 2602.11988](https://arxiv.org/abs/2602.11988)) | Repo context files tend to **reduce** task success compared to none. LLM-generated files lowered success by about 0.5 to 2%. Developer-written files helped about 4%. Both raised cost by **over 20%**. Overviews did not help; non-standard practices did | Every always-loaded line must earn its place. Prefer commands and repo-specific gotchas |
| Instruction adherence study ([arXiv 2605.10039](https://arxiv.org/abs/2605.10039)) | File size, position, structure and conflicts showed no detectable effect on compliance. Compliance fell about 5.6% per extra function generated in a session | A longer block does not buy obedience. Put must-happen behavior in hooks or scripts |
| Claude Code best practices ([docs](https://code.claude.com/docs/en/best-practices)) | "For each line, ask: *Would removing this cause Claude to make mistakes?*" Bloated files make Claude ignore instructions. Hooks are deterministic, rules are advisory | Same test for the core block. The brief hook is the strongest piece |
| Skill authoring best practices ([docs](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)) | "Concise is key." Low freedom (a literal script) for fragile steps, high freedom where many paths work | Safety lives in the CLI already. The skill can be short and confident |
| Claude Code auto mode ([Anthropic, 25 Mar 2026](https://www.anthropic.com/engineering/claude-code-auto-mode)) | Users approve **93%** of permission prompts, which leads to approval fatigue | 12 separate approvals do not make users safer. They make them stop reading |
| `create-next-app` ([docs](https://nextjs.org/docs/app/api-reference/cli/create-next-app)) | One question: use the recommended defaults (it lists them), reuse previous settings, or customize | One "recommended set" question, with what it contains spelled out |
| Earlier landscape note (`claudedocs/2026-09-29-repo-landscape-research.md`) | Backlog.md asks how to connect AI tools, keeps existing `AGENTS.md`, leaves unrelated files alone | Adapting means working beside what exists, not negotiating with it |

## 6. Proposed flow: show, then one question

```
1. LOOK        detect + audit run silently. No report dump.
2. SHOW        One screen:
               • "Your next session would start like this:" a real brief built from this repo
               • 2 or 3 pieces it would add, each with a one-line before/after example
               • "Your rules stay as they are. repo-fit reads them and uses them."
3. ASK ONCE    [Set up the recommended pieces] [Let me pick] [Just show me the report]
4. APPLY       One dry run for the whole add-only set, one yes, one undo line.
               Edits to existing files: one question each, with the diff.
5. ALSO NOTICED  Up to 5 lines (old notes, big files...). Not questions. Offer later on request.
```

Recommended set by repo kind:

| Repo kind | Recommended set | Optional, offered with "Let me pick" |
|---|---|---|
| **Code** | One rulebook, commands section, session brief | Board, decisions |
| **Notes / knowledge** | One rulebook, session brief, current view, board | Log, decisions, people, lessons, autosave |
| **Mixed** | The code set plus current view | Everything else |

**Question budget: 3 at most** in onboarding. Out of scope, always: CI, deploys, code quality, existing automation, cleanup of old files.

## 7. Changes, ordered by impact

**First: the flow (mostly `SKILL.md`, little code)**

1. Add a **scope fence** and a **question budget** (3 at most). Housekeeping goes into "also noticed", never into questions. This fixes the screenshot case.
2. **Drop the tools and models questions.** Detect tools; keep `--models` as an optional flag.
3. Add the **SHOW step**: a brief preview (`brief.mjs` run against a temporary view of the planned files, or a template filled with detected facts) and plain before/after examples.
4. **One approval for the add-only set.** Undo already exists. Keep per-item approval only for edits to existing files. Moves and deletes leave onboarding.
5. **Rewrite `SKILL.md` to about 800 words.** State the happy path with confidence. Keep one short safety section that points at the CLI's guarantees.

**Second: the product**

6. **Kind-aware plan.** Replace "10 of 18 checks" with "what you would gain". Stop scoring code repos on notes files.
7. **Cut the core block** to the rules that pass the "would removing it cause mistakes" test. Never add branch or commit rules; read the repo's own rules and the user's global guard instead.
8. **Rename "Conflicts" to "Your rules win"** and drop the defer machinery where it only exists to resolve conflicts repo-fit created.

**Third: proof**

9. **Add an onboarding eval.** Fixture repos (code, notes, mixed, mature with its own rules). Measure: number of questions, whether the recommended set is offered first, whether any out-of-scope question appears. Target: 3 questions or fewer, value shown on the first screen.
10. **Fix the detector false positives** found on this repo: commit rules quoted from examples, templates counted as unlinked notes, media rule for a single image.

## 8. Limits

- ✅ Checked: the code (`SKILL.md`, `lib/audit.mjs`, `lib/adapt.mjs`, `core/AGENTS.core.md`), one read-only `audit` and `detect` run on this repo, and question counts from three transcripts.
- ⚠️ The "useful vs trivia vs housekeeping" split is my judgement from the question wording. Counts are exact; categories are not.
- ⚠️ Three sessions by one user is a small sample. The eval in step 9 is how to measure the change.
- ❓ Not checked: Codex behavior with the skill, and what non-maintainer users experience.
