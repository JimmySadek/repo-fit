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

Assume the person does not know what hooks, dry runs or rule files are. Say what changes for them, with lines from their own repo (their branch, their last commit, their test command), never a made-up example.

The person should see value on the first screen, answer one question, and approve exactly what they saw. Ask **3 questions at most**, and **never zero**: anything that writes needs their yes first. Asking for the setup is not that yes. **Never ask before you have shown the folder before and after.**

1. **Look, silently.** `audit <repo>` (it starts with the recommended set and its dry-run command), `preview <repo>` (the briefing they would get), that dry run: `apply <repo> --steps <ids> <flags>`, and the organize plan: `organize <repo>` (today → after → why; `--list` gives every move with its reason). A repo set up with an older repo-fit (`playbook.json` exists): also `status <repo>` (what is new since their version, and skipped steps worth a second look) and `update <repo>` (a dry run). New or empty folder: `detect <repo>` and `init <repo> --dry-run --tool <tools> --no-hooks`.
2. **Show safety first,** the 🛟 line at the top of the screen: Git saves a snapshot of the folder before anything changes (or starts Git here), highly recommended, so they can always go back. If Git does not know their name and email, give the two lines and wait. If Git is not installed, give the install line; repo-fit's undo still works. **Then the organize plan,** exactly as `organize` printed it (the two columns as a code block, and the "why" lines), then a sentence or two in their own folder names: nothing is deleted, code and the files it uses stay, links are updated, one command undoes it all. If it says the folder is already organized, say so. Then, in about 8 lines: their briefing as a code block, with one sentence on why it matters here. What each recommended piece adds, tied to something in this repo. For an older setup, what the update fixes, and any second-look step with their old reason quoted. "Your own rules and files stay as they are; where they overlap, yours win." The files it writes, one line each. If nothing is recommended and nothing is behind, say so and stop.
3. **Ask once, only after that screen:** organize it all (recommended; the yes approves every dry run shown: `apply`, `organize` and, for an older setup, `update`), show me the full list first (show `--list`, then ask once more), or not now, just the map (the recommended `apply` only; nothing moves). For a folder that is already organized: set these up / let me pick / just the report. Never ask which tools or models, what kind of repo it is, or about anything repo-fit does not change (CI, deploys, code quality, big files, remotes); old folders, copies and loose files are in the plan, never a separate question.
4. **Apply what was approved,** with `--apply`: `update` first for an older setup, then `organize <repo> --apply --plan <code>` (the code is in the command the screen printed; it ties the yes to the plan they saw), then `apply` (for a new repo, `init` without `--dry-run`). Organize goes first so the setup's new files cannot change the approved plan. The first write saves the snapshot; if Git will not save it, nothing changes: show what Git said and stop (`--no-snapshot` only if the person asks). If the folder changed after the yes, `organize` refuses and prints the new screen: show it and ask again. `undo <repo> --apply` takes the organizing back in one step. Then verify: `node scripts/playbook/brief.mjs --text` and `node scripts/playbook/check.mjs`, plus the repo's own checks.
5. **The briefing: one line the person runs.** Claude Code's auto mode blocks an assistant from changing how sessions start, so the person turns the briefing on: `node <playbook folder>/bin/repo-fit.mjs hooks <repo> --apply`, in its own `bash` block with full paths. Explain it with their real preview: each new session starts blank today; with this line it starts with the briefing, and the assistant is reminded once to write down what matters when a reply changed files but no note (it never saves on its own); Claude Code leaves it to them because it changes how every session runs; `undo` turns it off. Codex runs it only after they allow it once with `/hooks`.
6. **Also noticed, then recap.** Up to 5 lines of other findings, as information, never offered as edits in this run. Write only what an approved dry run shows; if a file repo-fit wrote looks wrong, say so instead of fixing it by hand. Then: what was added or fixed, what was verified, what is theirs to do, how to undo, the repo-fit version, and "repo-fit does not update itself: `npx skills update -g -y`".

## Rules that never bend

- **Never overwrite** a file. `init` skips what exists. Edits are backed up first.
- **Never commit, never push.** Autosave commits only to a `wip/` branch, only allow-listed files, and only if it was chosen.
- **Files move only through `organize --apply`, after the yes. Nothing is ever deleted or merged.** Secrets, big files, tool updates and adding a remote are never part of setup. `connect` and `tools --update` run only when the user asks.
- **If a safety check blocks a step, do not work around it.** Say what was blocked and why, and give the person the exact command to run themselves.
- **The repo's own rules win.** If it says "commit only when asked", the recommended flags already turn autosave off.
- **One rulebook.** Shared rules go in `AGENTS.md`. `CLAUDE.md` imports it (`@AGENTS.md`).
- **Say what you could not verify.** Do not claim a hook works until you have seen it fire.

## Undo

`node bin/repo-fit.mjs undo <repo>` shows what would be put back. Add `--apply` to do it. Edited files come back from their backups. Created files are moved aside to `.playbook/undone/`, never deleted. A file the user changed after the apply is left alone with a warning. A remote repo made by `connect` has to be deleted by hand: the receipt lists the commands.

## Pinning

Add `--pin <version>` to `init`, `update` or `apply`. The command refuses to run unless this playbook copy is exactly that version, so a team can install the same version everywhere. Use a Git tag: `git checkout v<version>`.

## If something goes wrong

Stop. Do not retry a failed step in a different way. Tell the user what failed, what was written (the receipt lists it), and how to undo it.
