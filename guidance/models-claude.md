---
topic: Claude models and what works best with each
tool: claude
models: claude-fable-5-1, claude-opus-5-5, claude-sonnet-5-5, claude-haiku-4-5
retrieved: 2026-09-29
review_after: 2026-10-29
confidence: high for the models overview and the Opus 5.5 and Sonnet 5.5 prompting pages (primary, read); medium for Fable 5.1 (primary, summary only)
sources:
  - https://platform.claude.com/docs/en/models/overview (primary, read)
  - https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5 (primary, read)
  - https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5 (primary, read)
  - https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5-1 (primary, not read in full)
  - https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices (primary, model table and migration notes read)
---

# Claude models and what works best with each

## Lineup (as listed on 29 Sep 2026)

| Model | API ID | Context | Max output | Default effort | Thinking | Retirement, not sooner than |
|---|---|---|---|---|---|---|
| Fable 5.1 | `claude-fable-5-1` | 1M | 128K | high | adaptive, always on | 1 Sep 2027 |
| Opus 5.5 | `claude-opus-5-5` | 1M | 128K | medium | adaptive, always on | 22 Sep 2027 |
| Sonnet 5.5 | `claude-sonnet-5-5` | 1M | 128K | high | adaptive (also `between_tools`) | 28 Sep 2027 |
| Haiku 4.5 | `claude-haiku-4-5-20251001` | 200K | 64K | not supported | extended | **15 Oct 2026** |

Anthropic's advice: start with Opus 5.5 for most work. Use Fable 5.1 for demanding reasoning and long-horizon agentic work, or when Opus 5.5 at higher effort still falls short. Sonnet 5.5 is the speed and intelligence balance. For the hardest long-horizon work, Sonnet's own page says an Opus model is the better choice.

## What this changes in the kit

- **M1. No "think carefully" lines in rulebooks** for Opus 5.5 and Sonnet 5.5. They always think (or decide how much). Effort is the control. Also drop "double-check your work" and "show your reasoning": prompts that push the model to reproduce its reasoning in the reply can be declined (`reasoning_extraction`).
- **M2. Set effort explicitly, per repo or task.** Levels are recalibrated between models, so do not carry a setting over. Opus 5.5 at `medium` matched Opus 5 at `high` on coding and knowledge work. Sonnet 5.5: `medium` for well-specified agentic coding, `high` for harder or longer work. Keep `xhigh` and `max` for work where a gain was measured.
- **M3. A text-only end of turn is a report, not proof of completion** (Opus 5.5, unattended runs). Keep the task list in a file, gate the end of a turn with a Stop hook, and stop after 2 or 3 automatic continuations. The playbook's **board** and the Stop-hook **loop guard** implement this.
- **M4. Sonnet 5.5 at low or medium effort may stop to check in.** For autonomous repos, Anthropic offers this addition: keep working until everything asked is done, stop only when blocked or before a risky step, and when done, report without adding unrequested features, tests or docs. It makes sessions longer and costlier.
- **M5. Sonnet 5.5 at low effort may skip verification.** If "done" arrives without test or build output, add a line telling it to run a real check that exercises the change (tests, type-check, build, or the changed command) before reporting done. The core block already says "a passing check approves nothing", which is a different point. Keep both.
- **M6. Ideas mean ideas.** "When the user asks for ideas, options or a plan, give them that and stop."
- **M7. Progress updates.** These models write updates between tool calls. For long silent turns, Anthropic's harness line is: "The user hasn't heard from you in a while, say in a few words what you're doing, then continue."
- **M8. Model names stay out of the core block.** They expire. `playbook.json` records which models a repo was set up for, so `status` can say when guidance for those models changed.

## Dates to watch

- **Haiku 4.5 retirement: not sooner than 15 Oct 2026** (16 days from this review). Search repos and configs for `claude-haiku-4-5` before then.

## Open checks

- Fable 5.1 page was not read in full. Read it before recommending Fable 5.1 for any repo.
- `/doctor prompt-audit` was not run on any repo in this review.

## Changed since last review

First review (29 Sep 2026). Nothing to compare yet.
