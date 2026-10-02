---
topic: OpenAI models and Codex model guidance
tool: codex
models: gpt-6-astra, gpt-6.1-sol, gpt-6-luna
retrieved: 2026-10-02
review_after: 2026-11-01
confidence: medium (two primary pages read through a fetch tool that returns a summary, plus two local observations). Model IDs are quoted as the summaries gave them.
sources:
  - https://developers.openai.com/api/docs/models (primary, summary; read 2 Oct 2026)
  - https://learn.chatgpt.com/docs/models (primary, summary; read 2 Oct 2026; developers.openai.com/codex/models redirects here)
  - https://developers.openai.com/api/docs/guides/prompt-guidance (primary, summary only, 29 Sep)
  - https://learn.chatgpt.com/guides/best-practices (primary, summary only, 29 Sep)
  - ~/.codex/config.toml and `codex exec` runs (local, observed 2 Oct 2026)
---

# OpenAI models and Codex model guidance

**Read the model facts as current to 2 Oct 2026.** The prompt-guidance rows are still summaries from 29 Sep and stay labelled as such.

## What was seen

| Item | What the source said | Label |
|---|---|---|
| Lineup (API models page) | Flagship: **GPT-6 Astra** `gpt-6-astra` ("most capable"), **GPT-6.1 Sol** `gpt-6.1-sol` ("near-Astra performance at lower cost"), **GPT-6 Luna** `gpt-6-luna` ("most efficient, high volume"). `gpt-6-sol` and the GPT-5.6 Sol/Terra/Luna names seen on 29 Sep are no longer listed as flagship models. | primary summary |
| Codex with ChatGPT sign-in | Supports `gpt-6-astra` (eligible paid plans), `gpt-6.1-sol` (rolling out to Plus, Pro, Business, Enterprise, Edu) and `gpt-6-luna` (most paid plans). With no model in the config, Codex picks a recommended model for the plan and client. | primary summary |
| Retirements | GPT-5.5 retires from ChatGPT and Codex on **14 Oct 2026** (move to GPT-6 Sol-class on paid plans, Luna on Free/Go). GPT-5.3-Codex-Spark retired 14 Sep 2026. GPT-5.4 and 5.4-mini retired 31 Aug 2026. API-key access follows its own timelines. | primary summary |
| Image generation | GPT-Image-2.5 Sunburst (most capable) and GPT-Image-2.5 Flare (fast). In Codex the tool is called `image_gen`. | primary summary + local |
| Local setup | `~/.codex/config.toml` sets `model = "gpt-6.1-sol"`. Codex CLI **0.153.1 rejected that model** ("not supported when using Codex with a ChatGPT account", and "model metadata not found"); after `npm install -g @openai/codex@latest` (**0.160.0**) the same model answers normally. Keep the CLI current when a new model is set. | local |
| `codex exec` from a script | Version 0.160 reads extra prompt text from stdin when stdin is not a terminal and waits. Pass `< /dev/null` from scripts and hooks. | local |
| Prompt guidance | For the newest models: bias toward action, treat "can you" or "help me" as a go-ahead, ask for approval only after a concrete reviewable result, remove `temperature` and `top_p` when reasoning is on, prefer short clear instructions over long rule lists. | summary (29 Sep) |
| Reasoning levels by model name | A best-practices summary mapped Astra, Sol and Luna to light, medium and high reasoning. The 2 Oct lineup describes them by capability and cost instead, which reads as the opposite order. | **unconfirmed** |

## What this changes in the kit

- **O1. Stale model names in repos.** GPT-5.5 retires on 14 Oct 2026. Search your own repos for `gpt-5.5`, `gpt-5.4`, `gpt-5.3` and `gpt-6-sol` (replaced by `gpt-6.1-sol`). **Listed, not changed.**
- **O2. Model names stay out of the core block.** They expire. Reasoning effort and model choice belong in `~/.codex/config.toml`, not in a rulebook.
- **O3. No prompt-tuning rules are added to the kit from this file** until the prompt-guidance page is read directly.
- **O4. `tools` should warn when the Codex CLI is old.** Observed 2 Oct: an outdated CLI fails against a current model with a misleading "not supported for your account" error. Not built yet; `tools` checks only Claude Code today.
- **O5. Scripts that call `codex exec` pass `< /dev/null`.** Otherwise they hang waiting for stdin.

## Open checks

- Read the prompt-guidance page directly. Confirm which models it covers.
- Confirm the Astra, Sol, Luna reasoning mapping from a primary page before naming reasoning levels anywhere.
- repo-fit's README, skill and examples name no OpenAI model (since 0.5.0). With the lineup now read from primary pages, examples may name `gpt-6.1-sol` after the next review if it is still listed.

## Changed since last review

- 2 Oct 2026: lineup read from the API models page and the Codex models page (summaries). `gpt-6-sol` is out, `gpt-6.1-sol` is in. Retirement dates for 5.5, 5.4 and 5.3-Codex-Spark confirmed. Local: Codex CLI 0.153.1 could not use `gpt-6.1-sol`; 0.160.0 can. Review window moved from 7 to 30 days.
- 29 Sep 2026: first review, from snippets only.
