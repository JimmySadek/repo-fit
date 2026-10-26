---
topic: OpenAI models and Codex model guidance
tool: codex
models: gpt-6-astra, gpt-6.1-sol, gpt-6-luna
retrieved: 2026-10-26
review_after: 2026-11-25
confidence: medium (four primary pages read through a fetch tool that returns a summary, plus local observations from 2 Oct). Model IDs are quoted as the summaries gave them. The release-notes page refused the fetch (HTTP 403) on 26 Oct.
sources:
  - https://developers.openai.com/api/docs/models (primary, summary; read 26 Oct 2026)
  - https://learn.chatgpt.com/docs/models (primary, summary; read 26 Oct 2026; developers.openai.com/codex/models redirects here)
  - https://developers.openai.com/api/docs/guides/prompt-guidance (primary, summary; read 26 Oct 2026)
  - https://learn.chatgpt.com/guides/best-practices (primary, summary; read 26 Oct 2026)
  - https://help.openai.com/en/articles/9624314-model-release-notes (primary; not readable on 26 Oct, HTTP 403)
  - ~/.codex/config.toml and `codex exec` runs (local, observed 2 Oct 2026)
---

# OpenAI models and Codex model guidance

**Read the model facts as current to 26 Oct 2026.**

## What was seen

| Item | What the source said | Label |
|---|---|---|
| Lineup (API models page) | Flagship: **GPT-6 Astra** `gpt-6-astra` ("most capable model for the most demanding work"), **GPT-6.1 Sol** `gpt-6.1-sol` ("near-Astra performance for complex work at a lower cost"), **GPT-6 Luna** `gpt-6-luna` ("most efficient model for focused, high-volume tasks"). Knowledge cutoff 30 Apr 2026 for Astra and Sol, 18 May 2026 for Luna. Specialised models listed too (GPT-5.6 Cyber, GPT-Image-2.5 Sunburst and Flare, realtime, voice and transcription models). | primary summary |
| Codex with ChatGPT sign-in | Use **GPT-6.1 Sol** `gpt-6.1-sol` "when available to your account and client" for complex coding and agentic work, and **Luna** `gpt-6-luna` for focused, repeatable tasks. Sol's launch rollout covers Plus, Pro, Business, Enterprise and Edu, not Free or Go; on Enterprise and Edu it is off until an administrator turns it on (Luna too). **Astra** runs with `codex -m gpt-6-astra`; the page names no plans for it. `gpt-6-sol` is named as the replacement for `gpt-5.4`. GPT-5.6 Sol, Terra and Luna "remain available during the rollout". With no model in the config, the page names no fixed default. | primary summary |
| Retirements (ChatGPT sign-in) | `gpt-5.5` retired on **14 Oct 2026** (noon PDT). `gpt-5.3-codex-spark` retired 14 Sep 2026. `gpt-5.4` and `gpt-5.4-mini` retired 31 Aug 2026. `gpt-5.2` and `gpt-5.3-codex` are deprecated. | primary summary |
| Codex with an API key | Models follow the API organisation and project; `gpt-5.5` is still available there, and the retirements above do not apply. Custom providers need a Responses API endpoint; `wire_api = "chat"` is no longer supported. | primary summary |
| Reasoning effort (prompt guidance) | Astra and GPT-6.1 Sol do not support `none`; use `low`. GPT-6.1 Sol takes `low`, `medium` (default), `high`, `xhigh` and `max`. Moving from `minimal`: start at `low` and compare. | primary summary |
| Reasoning effort (Codex best practices) | Starting points: GPT-6.1 Sol at the client's default, Luna at High, Astra at Light (`low` in the config). Low for quick, well-scoped tasks; Medium or High for complex changes and debugging; Extra High for long agentic work. | primary summary |
| Prompt guidance | Bias toward action: treat "can you" or "help me" as a go-ahead; finish authorised, reversible work first and ask for approval on a concrete result; remove `temperature`, `top_p` and `top_logprobs` when reasoning is on; Astra follows long instructions better but is more sensitive to conflicting guidance, so audit `AGENTS.md` and skills and say that the user's instructions win over a skill's; ask for a writing style; keep tests in proportion to the change. Use the Responses API for tool calling. | primary summary |
| Image generation | GPT-Image-2.5 Sunburst (most capable) and GPT-Image-2.5 Flare (fast). In Codex the tool is called `image_gen`. | primary summary + local (2 Oct) |
| Local setup | `~/.codex/config.toml` sets `model = "gpt-6.1-sol"`. Codex CLI **0.153.1 rejected that model** ("not supported when using Codex with a ChatGPT account", and "model metadata not found"); after `npm install -g @openai/codex@latest` (**0.160.0**) the same model answers normally. Keep the CLI current when a new model is set. | local (2 Oct) |
| `codex exec` from a script | Version 0.160 reads extra prompt text from stdin when stdin is not a terminal and waits. Pass `< /dev/null` from scripts and hooks. | local (2 Oct) |

## What this changes in the kit

- **O1. Stale model names in repos.** GPT-5.5 is retired for ChatGPT sign-in since 14 Oct 2026. Search your own repos for `gpt-5.5`, `gpt-5.4`, `gpt-5.3` and `gpt-6-sol` (`gpt-6.1-sol` is the current Sol). **Listed, not changed.**
- **O2. Model names stay out of the core block.** They expire. Reasoning effort and model choice belong in `~/.codex/config.toml`, not in a rulebook.
- **O3. The core block already matches the prompt guidance** (act on clear requests, ask only for consequential choices, tests in proportion). No prompt-tuning rules are added from this file; the guidance on user instructions winning over skills is a matter for each person's own rule files.
- **O4. `tools` should warn when the Codex CLI is old.** Observed 2 Oct: an outdated CLI fails against a current model with a misleading "not supported for your account" error. Not built yet; `tools` checks only Claude Code today.
- **O5. Scripts that call `codex exec` pass `< /dev/null`.** Otherwise they hang waiting for stdin.

## Open checks

- The release-notes page refused the fetch on 26 Oct; read it in a browser at the next review.
- repo-fit's README, skill and examples name no OpenAI model (since 0.5.0). `gpt-6.1-sol` has now been the listed Sol on two reviews (2 and 26 Oct), so examples may name it if one is ever needed.

## Changed since last review

- 26 Oct 2026: all four pages read again (summaries). Lineup unchanged: `gpt-6-astra`, `gpt-6.1-sol`, `gpt-6-luna`. New: Codex now recommends GPT-6.1 Sol, Enterprise and Edu need an administrator to turn Sol and Luna on, `gpt-6-sol` replaces `gpt-5.4`, `gpt-5.5` stays available with an API key, and `wire_api = "chat"` is gone. The prompt-guidance page is now read, not only a summary from 29 Sep: it confirms the reasoning levels per model, which replaces the unconfirmed Astra, Sol, Luna mapping. The release-notes page refused the fetch.
- 2 Oct 2026: lineup read from the API models page and the Codex models page (summaries). `gpt-6-sol` is out, `gpt-6.1-sol` is in. Retirement dates for 5.5, 5.4 and 5.3-Codex-Spark confirmed. Local: Codex CLI 0.153.1 could not use `gpt-6.1-sol`; 0.160.0 can. Review window moved from 7 to 30 days.
- 29 Sep 2026: first review, from snippets only.
