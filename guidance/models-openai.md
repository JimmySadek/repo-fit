---
topic: OpenAI models and Codex model guidance
tool: codex
models: gpt-6-astra, gpt-6-sol, gpt-6-luna, gpt-5-6-sol, gpt-5-6-terra, gpt-5-6-luna, gpt-5-5
retrieved: 2026-09-29
review_after: 2026-10-06
confidence: low to medium (search snippets and small-model page summaries, plus one local observation). Short review window on purpose.
sources:
  - https://developers.openai.com/api/docs/models (snippet only, not read)
  - https://help.openai.com/en/articles/9624314-model-release-notes (snippet only, not read)
  - https://developers.openai.com/api/docs/guides/prompt-guidance (primary, summary only)
  - https://learn.chatgpt.com/guides/best-practices (primary, summary only)
  - ~/.codex/config.toml (local, observed 29 Sep 2026)
---

# OpenAI models and Codex model guidance

**Read this file as a lead list, not as facts.** Nothing here was read directly from an OpenAI page. Read the sources above in a real browser at the next refresh.

## What was seen

| Item | What the source said | Label |
|---|---|---|
| Lineup | GPT-6 family: Astra (flagship reasoning and coding), Sol (balance of intelligence and cost), Luna (cost-sensitive, high volume). GPT-5.6 family: Sol, Terra, Luna | snippet |
| Local default | `~/.codex/config.toml` sets `model = "gpt-6-sol"` and `model_reasoning_effort = "medium"` | local |
| Retirement | GPT-5.5 retires from ChatGPT, ChatGPT Work and Codex on **14 Oct 2026** | snippet |
| Prompt guidance | For the newest models: bias toward action, treat "can you" or "help me" as a go-ahead, ask for approval only after a concrete reviewable result, remove `temperature` and `top_p` when reasoning is on, prefer short paragraphs over lists | primary, summary (low trust: the summary named a model the search snippets did not agree on) |
| Reasoning levels by model name | The best-practices summary maps Astra, Sol and Luna to light, medium and high reasoning. This conflicts with the lineup above | **unconfirmed** |

## What this changes in the kit

- **O1. Stale model names in repos.** A search of the maintainer's repos on 29 Sep found `GPT-5.5` in a few instruction files. GPT-5.5 retires on 14 Oct 2026. Search your own repos for retiring model names. **Listed, not changed.**
- **O2. Model names stay out of the core block.** They expire. Reasoning effort and model choice belong in `~/.codex/config.toml`, not in a rulebook.
- **O3. No prompt-tuning rules are added to the kit from this file** until the prompt-guidance page is read directly.

## Open checks

- Read `developers.openai.com/api/docs/models` and the release notes in a browser. Confirm the lineup, the retirement date, and which model Codex uses by default.
- Read the prompt-guidance page directly. Confirm which models it covers.
- Resolve the Astra, Sol, Luna conflict before naming any model in a recommendation.

## Changed since last review

First review (29 Sep 2026). Nothing to compare yet.
