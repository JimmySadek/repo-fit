---
topic: Claude Code instruction files, hooks and habits
tool: claude-code
models: claude-fable-5-1, claude-opus-5-5, claude-sonnet-5-5, claude-haiku-4-5
retrieved: 2026-09-29
review_after: 2026-10-29
confidence: high for the memory and best-practices pages (primary, read); medium for hooks (primary, summary plus verbatim Stop and PreCompact sections)
sources:
  - https://code.claude.com/docs/en/memory (primary, read)
  - https://code.claude.com/docs/en/best-practices (primary, read)
  - https://code.claude.com/docs/en/hooks (primary, summary plus verbatim sections)
---

# Claude Code: instruction files, hooks and habits

## What this changes in the kit

- **C1. One rulebook, thin import.** Keep `AGENTS.md` as the rulebook and a `CLAUDE.md` that only imports it (`@AGENTS.md`). Claude Code reads `AGENTS.md` on its own only when no `CLAUDE.md` exists in or above the working folder (Claude Code v2.1.277 or later). With both files present it reads `CLAUDE.md` only, so the import is the link. Imports still load at launch, so they do not save context.
- **C2. Size.** Keep each instruction file under 200 lines. Long files lower how well rules are followed. Claude Code warns at startup and in `/status` above the recommended length. Move topic rules to `.claude/rules/*.md`. A rule file can be scoped with `paths:` frontmatter, and `paths` is the only field Claude Code reads.
- **C3. Rules are context, not enforcement.** Anything that must happen every time (autosave, branch guard, capture check) belongs in a hook. Prose in CLAUDE.md is advice.
- **C4. Chat-only instructions die at compaction.** The project-root CLAUDE.md is re-read after `/compact`. Things said only in conversation are not. This is the reason for capture by default.
- **C5. Auto memory is machine-local.** Only the first 200 lines or 25 KB of its `MEMORY.md` load, and it is not shared across machines. Treat it as orientation. The repository is the shared truth.
- **C6. Give Claude a check it can run.** Tests, a build, a script. A Stop hook can hold the end of a turn until a check passes.
- **C7. Prune.** Ask of each line: would removing it cause a mistake? Emphasis works on one line, not on many. `/doctor` proposes cuts. `/doctor prompt-audit` (v2.1.283 or later) flags instructions written for older models. Run it at each refresh.

## Hook facts the scripts rely on

- **SessionStart** matchers: `startup`, `resume`, `clear`, `compact`, `fork`. Output fields: `systemMessage` (shown to the user) and `additionalContext` (to the model, 10,000 character limit), either top level or inside `hookSpecificOutput`.
- **Stop** input fields listed in the docs: `last_assistant_message`, `stop_reason`, `tool_use_id`, plus the common fields (`session_id`, `cwd`, `transcript_path`, ...). **`stop_hook_active` is not listed.** A Stop hook can block several times in a row in one turn. So the playbook scripts guard against repeat blocks themselves (per session and reason), and still honour `stop_hook_active` when a tool sends it. **Observed live on 2.1.284 (30 Sep 2026, desktop app):** the Stop input did carry `stop_hook_active` (false on the first stop), plus `hook_event_name`, `effort`, `background_tasks` and `session_crons`. `stop_reason` and `tool_use_id` were not in that event. The docs still do not list it, so the guard stays.
- **PreCompact** input: `trigger` (`manual` or `auto`) and token estimates. It can block compaction with `decision: "block"`. The playbook never does.
- **Paths in hooks:** repo hooks use `${CLAUDE_PROJECT_DIR}`. Plugin hooks also get `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}`.
- **Cowork sessions** skip a symlinked `~/.claude/CLAUDE.md`. Install global files as copies.

## Open checks

- Does the installed Claude Code send `stop_hook_active` to Stop hooks? **Answered for 2.1.284: yes** (see the Stop input note above, observed 30 Sep 2026). It **did turn true** on the Stop right after a block (observed 30 Sep 2026). Not checked: other versions (the terminal `claude` 2.1.270 could not be run: its login had expired).
- `/config` has a **Project instructions** setting that changes which of CLAUDE.md and AGENTS.md load. Confirm with `/context` on the actual machine.

## Live checks on the maintainer's machine (29 Sep 2026, local)

- **SessionStart hook works** in a real Claude Code session: the log shows `SessionStart:startup` succeeding, with `systemMessage` shown to the user and `additionalContext` delivered to the model.
- **A thin `CLAUDE.md` with `@AGENTS.md` loads both files** (`/context` listed `CLAUDE.md` at 92 tokens and `AGENTS.md` at 3.2k), with no approval prompt for an in-repo import.
- **Two Claude Code versions can run on one machine.** On the maintainer's Mac the `claude` command in a terminal was 2.1.270 (installed with npm; latest on npm was 2.1.285), while the desktop app's sessions ran **2.1.284** (read from the session logs). The app was above both limits (2.1.277 and 2.1.283). Only the terminal command was below them. `repo-fit detect` and `repo-fit tools` report both, and judge a repo by the version its sessions ran on.
- **Proven live on 2.1.284 (30 Sep 2026):** the Stop hook ran the autosave. It created `wip/<date>-claude-code`, committed the one changed file with a `Host:` trailer, left the protected branch untouched and pushed nothing.
- **Also proven live on 2.1.284:** the Stop *block* (one reminder, reason text delivered, no second block: the app's `stop_hook_active` stopped it right after; our own once-per-session guard stopped a repeat on the next turn), and **PreCompact** (it committed a file changed outside the session 11 seconds before the compact marker, with no Stop in between).
- **Still untested live:** the terminal `claude` 2.1.270 (login had expired), and the block reasons "autosave failed" and "no log line today".

## Changed since last review

First review (29 Sep 2026). Nothing to compare yet.
