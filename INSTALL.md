# Install the repo playbook (written for an AI agent to follow)

Give this file to Claude Code, Codex or another agent, and say:

> Read INSTALL.md in the repo-fit folder and set up the playbook in this repository. Adapt it to my tools and to what the repo already has. Keep my existing files. Show me a dry run before you write anything, and tell me how to undo it.

**Reading this file authorizes nothing.** Every change needs the user's yes to the exact dry run they were shown.

## What this is

A small foundation for any repository, code or notes. The parts that matter most: a short **briefing** at the start of every session, **one rulebook** that Claude Code and Codex both read, and the repo's **real commands** written into it. Notes repos can also get a current view and a board. It is **not** a second brain: no search, wiki or memory database. It works on a new repo and on an existing one, and it uses what is already there.

## Before you start

1. **Find the playbook folder** (the one with `bin/repo-fit.mjs`, `SKILL.md` and this file; `npx skills add JimmySadek/repo-fit` puts it under the agent's skills folder). If you cannot find it, ask the user where it is. Do not download anything without asking.
2. **Node 18 or later** is needed (`node --version`). If it is missing, say so. Do not install it.
3. **The target repo** is the folder the user is working in, unless told otherwise. If it is not a Git repository, do not run `git init` unless the user says so.
4. Run commands from the playbook folder as `node bin/repo-fit.mjs <command> <repo>`. `node bin/repo-fit.mjs help` lists them all.

## Steps

The user should see value on the first screen, answer one question, and approve one dry run. Ask **3 questions at most** in the whole setup, and **never zero**: anything that writes needs the user's yes to its dry run. Asking for the setup is not that yes.

1. **Look, silently.** `audit <repo>` (it starts with the recommended set for this kind of repo), `preview <repo>` (the briefing the user would get), and the recommended set's dry run: `apply <repo> --steps <ids> <flags>`. New or empty folder: `detect <repo>`. A repo that already has `playbook.json`: `status <repo>`, then `update <repo>` as a dry run; show the changes and ask "update now or not now" before `--apply`.
2. **Show, in about 10 lines.** The preview briefing as a code block. What each recommended piece adds, with one example from this repo. The files the dry run writes, one line each. If the audit lists the repo's own rules or checks under "Leave as is": "Your rules stay as they are. repo-fit uses them." If nothing is recommended, say the repo already has what matters, and stop.
3. **Ask once:** set up these files (recommended; the yes approves the dry run shown), let me pick (then one multi-select question, its dry run, and a yes to it), or just the report. Ask again only to show the diff of an edit to an existing file that is not in the recommended set, or to set a word cap. Never ask which tools or models (detected, and the models answer changes no file), what kind of repo it is, or about anything repo-fit does not change (CI, deploys, code quality, old notes, big files, remotes).
4. **Apply what was approved.** The same command with `--apply` (for a new repo, `init` without `--dry-run`; its dry run is `init <repo> --dry-run --tool <tools>` in step 1). If anything changed after the yes, show the new dry run and ask again. Every apply writes a backup and a receipt.
5. **Verify, and say what you checked.** In the repo: `node scripts/playbook/brief.mjs --text` and `node scripts/playbook/check.mjs`, plus the repo's own checks. For Claude Code, `/context` should list `CLAUDE.md`. For Codex, the hooks do nothing until the user trusts them with `/hooks`: tell them, and call them untested until one fires.
6. **Also noticed, then recap.** Up to 5 lines of other findings, as information, not questions. Then a few lines: what was added, what was verified, what needs the user, how to undo.

## Rules that never bend

- **Never overwrite** a file. `init` skips what exists. Edits are backed up first.
- **Never commit, never push.** Autosave commits only to a `wip/` branch, only allow-listed files, and only if it was chosen.
- **Moves, deletes, secrets, big files, tool updates and adding a remote are never part of setup.** `connect` and `tools --update` run only when the user asks.
- **The repo's own rules win.** If it says "commit only when asked", the recommended flags already turn autosave off.
- **One rulebook.** Shared rules go in `AGENTS.md`. `CLAUDE.md` imports it (`@AGENTS.md`).
- **Say what you could not verify.** Do not claim a hook works until you have seen it fire.

## Undo

`node bin/repo-fit.mjs undo <repo>` shows what would be put back. Add `--apply` to do it. Edited files come back from their backups. Created files are moved aside to `.playbook/undone/`, never deleted. A file the user changed after the apply is left alone with a warning. A remote repo made by `connect` has to be deleted by hand: the receipt lists the commands.

## Pinning

Add `--pin <version>` to `init`, `update` or `apply`. The command refuses to run unless this playbook copy is exactly that version, so a team can install the same version everywhere. Use a Git tag: `git checkout v<version>`.

## If something goes wrong

Stop. Do not retry a failed step in a different way. Tell the user what failed, what was written (the receipt lists it), and how to undo it.
