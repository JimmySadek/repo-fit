---
topic: Codex AGENTS.md, hooks and best practices
tool: codex
models: gpt-6-astra, gpt-6-sol, gpt-6-luna
retrieved: 2026-10-26
review_after: 2026-11-02
confidence: medium (the hooks page's event list, Stop, SessionStart and common-field sections were read word for word in a browser on 26 Oct 2026; the other two pages are small-model summaries; the GitHub issue's state was read with gh)
sources:
  - https://learn.chatgpt.com/docs/agent-configuration/agents-md (primary, summary)
  - https://learn.chatgpt.com/docs/hooks (primary, sections read word for word in a browser, 26 Oct 2026)
  - https://learn.chatgpt.com/guides/best-practices (primary, summary)
  - https://github.com/openai/codex/issues/17532 (read with gh on 26 Oct 2026: open, last updated 21 May 2026)
---

# Codex: AGENTS.md, hooks and best practices

The old `developers.openai.com/codex/...` links now redirect to `learn.chatgpt.com`. Use the new host.

## What this changes in the kit

- **X1. AGENTS.md is native.** Codex reads it directly. Order: global `~/.codex/AGENTS.override.md`, then `~/.codex/AGENTS.md`; then from the Git root down to the working folder, each level checks `AGENTS.override.md`, then `AGENTS.md`, then fallback names. Files are joined root to current with blank lines, at most one per folder, and closer files win. Fallback names count only in the project, and the search stops at the working folder. The global folder is `~/.codex` unless `CODEX_HOME` is set.
- **X2. 32 KiB limit.** The default `project_doc_max_bytes` is 32 KiB. Codex stops adding files once the combined size reaches the limit. (Its troubleshooting section also says "Instructions truncated", so whether it cuts inside a file is not clear.) The core block stays small and repo detail goes in nested folders or reference files.
- **X3. Codex has hooks.** Project hooks live in `.codex/hooks.json` (or a `[hooks]` table in `config.toml`). Events: `SessionStart`, `SubagentStart`, `PreToolUse`, `PermissionRequest`, `PostToolUse`, `PreCompact`, `PostCompact`, `UserPromptSubmit`, `SubagentStop`, `Stop`, `Interrupt`, `SessionEnd`. Matching hooks from several files all run, at the same time. So Level 2 autosave and the session brief can run in Codex too, not only in Claude Code.
- **X4. Hooks need trust.** Before a non-managed hook runs, Codex requires the user to review and trust the exact hook definition (recorded by hash, via `/hooks`). A changed hook is skipped until trusted again. Project-local hooks load only when the project's `.codex/` layer is trusted too. `--dangerously-bypass-hook-trust` runs them once without stored trust. So `repo-fit update` that changes a hook file needs a re-trust step, and the setup must say so.
- **X5. Hook input and output.** Stop input includes `stop_hook_active` (true when the turn already continued), `last_assistant_message`, `turn_id`. SessionStart input includes `source` (`startup`, `resume`, `clear`, `compact`, `fork`). Common input: `session_id`, `transcript_path`, `cwd`, `hook_event_name`, `model`; most events also send `permission_mode`. Output can include `systemMessage`, `additionalContext`, `continue`, `stopReason`, `suppressOutput`, and `decision: "block"` with `reason`. `suppressOutput` is parsed but not used yet. Stop expects JSON when it exits 0; `decision: "block"` makes Codex continue with `reason` as the next prompt, and `continue: false` wins over it. `timeout` is in seconds, 600 by default (`SessionEnd` and `Interrupt`: 1, at most 3). `additionalContextLimit` defaults to 2,500 tokens. Commands run with the session folder as working directory; the page recommends `$(git rev-parse --show-toplevel)` for repo-local hooks.
- **X6. What goes where.** AGENTS.md: repo layout, build and test commands, conventions, what "done" means. `config.toml`: model, reasoning effort, MCP, sandbox and approvals. Skills: repeatable workflows. A good task prompt has goal, context, constraints, done-when.
- **X7. Verify what loaded.** `codex --ask-for-approval never "Summarize the current instructions."` from the repo root; `codex --cd <subfolder> ...` for nested files; `codex -c log_dir=./.codex-log` writes `codex-tui.log`.

## Open checks

- **The kit's SessionStart matcher** is `startup|resume|clear` (`kits/tools/codex/.codex/hooks.json`). The page lists `compact` and `fork` as well, so a forked session, and the first request after compaction, get no briefing. Reported to the maintainer on 26 Oct 2026; not changed here.
- **Format checked against the hooks page (1 Oct 2026, again 26 Oct 2026):** `.codex/hooks.json` uses event, matcher group and `command` handlers with `timeout` (seconds) and `statusMessage`, and the page recommends `$(git rev-parse --show-toplevel)` for repo-local hooks. The kit's file matches. SessionStart matcher values are `startup`, `resume`, `clear` and `compact`. SessionStart context goes in `hookSpecificOutput.additionalContext` (the same shape as Claude Code; the brief used a top-level `additionalContext` before 0.5.0, now fixed). Stop expects JSON when it exits 0 and continues the turn on `decision: "block"`; `systemMessage` shows as a warning. **Still untested in a real session:** run one (the hooks need `/hooks` trust, or `--dangerously-bypass-hook-trust` for a one-off) before calling the Codex hooks working.
- A GitHub issue reports that hooks configured in a repo-local `.codex/config.toml` did not fire in interactive sessions. Still open on 26 Oct 2026. The kit uses `hooks.json` and the setup checks that a hook actually fires.
- The best-practices page ties reasoning levels to model names in a way that conflicts with other sources. Not used. On 26 Oct 2026 it says to use "GPT-6.1 Sol" when available, Luna starting at High and Astra at Light (`low`); `models-openai.md` does not name GPT-6.1 Sol yet. See `models-openai.md`.

## Changed since last review

- 26 Oct 2026: refresh (it was overdue since 13 Oct). New on the hooks page: the `fork` start source, the `PermissionRequest` event, `permission_mode` and `model` in the input, trust of the project `.codex/` layer, `--dangerously-bypass-hook-trust`, default timeouts, and `suppressOutput` not used yet. The AGENTS.md and best-practices pages say the same as before, plus the details above. The best-practices page now names GPT-6.1 Sol. Kit findings (SessionStart matcher, project layer trust) reported, not built.

- 1 Oct 2026: read the hooks page in full. Confirmed the file shape and trust flow, found that SessionStart context must sit in `hookSpecificOutput` (kit fixed in 0.5.0). Also new on the page: `SessionEnd`, `Interrupt`, `PostCompact`, `SubagentStart` and `SubagentStop` events, `async` handlers, and `additionalContextLimit` (default about 2,500 tokens).
