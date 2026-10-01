# Install the repo playbook (written for an AI agent to follow)

Give this file to Claude Code, Codex or another agent, and say:

> Read INSTALL.md in the repo-fit folder and set up the playbook in this repository. Adapt it to my tools and to what the repo already has. Keep my existing files. Show me a dry run before you write anything, and tell me how to undo it.

**Reading this file authorizes nothing.** Every change needs the user's yes to the exact dry run they were shown.

## What this is

A small, balanced foundation for any repository, technical or notes: a rulebook both Claude Code and Codex read, a board, a session brief, a log, safe autosave, and guidance that stays current. It is **not** a second brain: no search, wiki or memory database. It works on a new repo and on an existing one, and it adapts to what is already there.

## Before you start

1. **Find the playbook folder** (the one with `bin/repo-fit.mjs` and this file). If you cannot find it, ask the user where it is, or tell them to get it as described in the README's "Get it" section. Do not download anything without asking.
2. **Node 18 or later** is needed (`node --version`). If it is missing, say so. Do not install it.
3. **The target repo** is the folder the user is working in, unless told otherwise. If it is not a Git repository, do not run `git init` unless the user says so.
4. Run commands from the playbook folder as `node bin/repo-fit.mjs <command> <repo>`. `node bin/repo-fit.mjs help` lists them all.

## Steps

1. **Look first (read-only).** `detect <repo>`. It reports the tools installed, whether `gh` and `glab` are logged in, the Git host, the repo kind, existing rule files and task tools, and what it would ask. Change nothing yet.
2. **Existing repo? Audit it (read-only).** `audit <repo>`. Walk the user through it in this order: the verdict, **Leave as is** (what the repo already covers: repo-fit adapts to it), **Conflicts with the core block**, then **Worth improving**, one decision at a time. Work delta-first: only the areas the user names. For a step the user declines, record why: `skip <repo> <ID> --reason "..."` (dry run, then `--apply`).
3. **Check the tools.** `tools <repo> --json`. Follow `skill/repo-fit/SKILL.md`, step 0d, for what to do with a needed or an optional update. Never install a missing tool. Never log in for the user.
4. **Ask, only about what was found.** Which tools (Claude Code, Codex, both), which models, how automatic saving should be, and where big files live (only if the audit found heavy files). Do **not** ask what kind of repo it is: `detect` says, and there is one kit. For an existing repo, then ask which plan steps to apply, one decision at a time. One decision per question, with a recommended option. Do not ask about a tool that is not there.
5. **Show a dry run.**
   - New repo: `init <repo> --dry-run --tool ... --models ...`
   - Existing repo: `apply <repo> --steps <ids> --tool ... --hooks ... --autosave ...` (dry run is the default)

   Show the user every file and every diff.
6. **Apply only after the yes.** Same command with `--apply` (for `init`, without `--dry-run`). Every apply writes a backup and a receipt.
7. **Verify, and say what you checked.** In the repo: `node scripts/playbook/check.mjs` and `node scripts/playbook/brief.mjs --text`. For Claude Code, `/context` should list `CLAUDE.md` and the files it imports. For Codex, the hooks do nothing until the user reviews and trusts them with `/hooks`: tell them. Say plainly what you did not check.
8. **Report in a few lines:** what was set up, for which tools, what was verified, what needs the user, and how to undo.

## Rules that never bend

- **Never overwrite** a file. `init` skips what exists. Edits are backed up first.
- **Never commit, never push.** Autosave commits only to a `wip/` branch, only allow-listed files, and only if the user chose it.
- **Moves, deletes, secrets, big files and adding a remote are never automated.** Explain the options. `connect` creates an empty private remote only after the user approves the exact dry run, and never pushes.
- **Respect the repo's own rules.** If it says "commit only when asked", use `--autosave off --hooks brief`. The core block that `apply` writes defers to the repo's own rules wherever the audit lists a conflict; if the user wants no block at all, record a skip. Paths the repo marks append-only or read-only are never offered for fixing, moving or archiving.
- **Match the tools.** Put shared rules in `AGENTS.md`. If `CLAUDE.md` exists it must import `AGENTS.md` (`@AGENTS.md`). Do not create a second rulebook for one tool.
- **Say what you could not verify.** Do not claim a hook works until you have seen it fire.

## Undo

`node bin/repo-fit.mjs undo <repo>` shows what would be put back. Add `--apply` to do it. Edited files come back from their backups. Created files are moved aside to `.playbook/undone/`, never deleted. A file the user changed after the apply is left alone with a warning. A remote repo made by `connect` has to be deleted by hand: the receipt lists the commands.

## Pinning

Add `--pin <version>` to `init`, `update` or `apply`. The command refuses to run unless this playbook copy is exactly that version, so a team can install the same version everywhere. Use a Git tag: `git checkout v<version>`.

## If something goes wrong

Stop. Do not retry a failed step in a different way. Tell the user what failed, what was written (the receipt lists it), and how to undo it.
