---
topic: Codex AGENTS.md, hooks and best practices
tool: codex
models: gpt-6-astra, gpt-6-sol, gpt-6-luna
retrieved: 2026-09-29
review_after: 2026-10-13
confidence: medium (primary pages, but only small-model summaries; one search snippet; one GitHub issue not verified)
sources:
  - https://learn.chatgpt.com/docs/agent-configuration/agents-md (primary, summary)
  - https://learn.chatgpt.com/docs/hooks (primary, summary)
  - https://learn.chatgpt.com/guides/best-practices (primary, summary)
  - https://github.com/openai/codex/issues/17532 (snippet only, status unknown)
---

# Codex: AGENTS.md, hooks and best practices

The old `developers.openai.com/codex/...` links now redirect to `learn.chatgpt.com`. Use the new host.

## What this changes in the kit

- **X1. AGENTS.md is native.** Codex reads it directly. Order: global `~/.codex/AGENTS.override.md`, then `~/.codex/AGENTS.md`; then from the Git root down to the working folder, each level checks `AGENTS.override.md`, then `AGENTS.md`, then fallback names. Files are joined root to current, and closer files win.
- **X2. 32 KiB limit.** The default `project_doc_max_bytes` is 32 KiB. Codex stops adding files once the limit is reached. The core block stays small and repo detail goes in nested folders or reference files.
- **X3. Codex has hooks.** Project hooks live in `.codex/hooks.json` (or a `[hooks]` table in `config.toml`). Events include `SessionStart`, `Stop`, `PreCompact`, `PreToolUse`, `PostToolUse`, `UserPromptSubmit`, `SessionEnd`. So Level 2 autosave and the session brief can run in Codex too, not only in Claude Code.
- **X4. Hooks need trust.** Before a non-managed hook runs, Codex requires the user to review and trust the exact hook definition (recorded by hash, via `/hooks`). A changed hook is skipped until trusted again. So `repo-fit update` that changes a hook file needs a re-trust step, and the setup must say so.
- **X5. Hook input and output.** Stop input includes `stop_hook_active` (true when the turn already continued), `last_assistant_message`, `turn_id`. SessionStart input includes `source` (`startup`, `resume`, `clear`, `compact`). Output can include `systemMessage`, `additionalContext`, `continue`, `stopReason`, `suppressOutput`, and `decision: "block"` with `reason`. Commands run with the session folder as working directory, so scripts find the repo root themselves.
- **X6. What goes where.** AGENTS.md: repo layout, build and test commands, conventions, what "done" means. `config.toml`: model, reasoning effort, MCP, sandbox and approvals. Skills: repeatable workflows. A good task prompt has goal, context, constraints, done-when.
- **X7. Verify what loaded.** `codex --ask-for-approval never "Summarize current instructions"`.

## Open checks

- The `.codex/hooks.json` entry format was not read directly. The playbook's Codex hook file follows the Claude Code shape (event, matcher group, command handlers). **Untested.** Read the hooks page in a browser and run one real session before trusting it.
- A GitHub issue reports that hooks configured in a repo-local `.codex/config.toml` did not fire in interactive sessions. Status unknown. The kit uses `hooks.json` and the setup checks that a hook actually fires.
- The best-practices page ties reasoning levels to model names (Astra, Sol, Luna) in a way that conflicts with other sources. Not used. See `models-openai.md`.

## Changed since last review

First review (29 Sep 2026). Nothing to compare yet.
