---
name: repo-fit
description: >-
  Set up or update a repository so every AI session starts with a short briefing and one shared rulebook for Claude Code and Codex. It looks at the repo first, shows the user what they would gain, then asks once. Use when starting a new repo, adding repo-fit to an existing repo, or updating a repo that already has it.
---

# repo-fit

For an agent without this skill installed, `INSTALL.md` beside this file carries the same steps.

**The playbook folder is the folder that contains this SKILL.md.** Run commands as `node "$SKILL_DIR/bin/repo-fit.mjs" <command> <repo>`, where `$SKILL_DIR` is that folder. If `bin/` is not beside this file, read `home` from `~/.config/repo-fit/preferences.json`; if there is none, ask where the clone is. Never download or install it yourself.

## What a good setup looks like

The user sees value on the first screen, answers **one** question, and approves **one** dry run. Ask **3 questions at most** in the whole setup. Most repos need only the first. **One, never zero:** anything that writes needs the user's yes to its dry run.

```
1. LOOK     detect + audit + preview, silently
2. SHOW     the briefing they would get, what each piece adds, "your rules stay"
3. ASK      recommended set / let me pick / just the report
4. APPLY    one dry run, one yes, --apply, verify
5. NOTICED  up to 5 lines of other findings. Not questions
```

## 1. Look (read-only, say nothing yet)

```sh
node "$SKILL_DIR/bin/repo-fit.mjs" audit <repo>      # existing repo; starts with the recommended set
node "$SKILL_DIR/bin/repo-fit.mjs" preview <repo>    # the session briefing the recommended set would give
```

An empty or new folder: run `detect <repo>` instead, and use `init` in step 4. A repo that already has `playbook.json`: run `status <repo>` and `update <repo>` (a dry run), show what would change as a short list, and ask the one question: update now (recommended) or not now. Run `update <repo> --apply` only after the yes.

Do not paste the reports. They are your working notes.

## 2. Show

In about 10 lines, plain words, no step IDs:

- **The briefing** from `preview`, as a code block: "Every session would start with this."
- **What each piece adds**, from the audit's "Recommended set", with one concrete example from this repo. Example: "The rulebook would list `npm test`, so the assistant runs your real test command."
- **What stays the same.** If the audit lists the repo's own rules, checks or hooks under "Leave as is", say so in one line: "Your rules stay as they are. repo-fit uses them." These are not conflicts to discuss.

If the recommended set is empty, say plainly that the repo already has what matters and stop. That is a good result.

## 3. Ask once

One question, these three options:

1. **Set up the recommended pieces (Recommended).** Name them in the description.
2. **Let me pick.** Then one multi-select question with the other add-only steps and edits from the audit, each in plain words.
3. **Just the report.** Summarize the audit in a short table and stop.

Ask a second question only for a choice the code cannot make:

- An **edit to an existing file** that is not in the recommended set: show its diff. Examples: moving `CLAUDE.md` rules into `AGENTS.md` (D-02), or adding the rules block to an `AGENTS.md` whose rules differ (D-01).
- A **word cap** when the audit says the current view is over the default and none is written down.

**Never ask about:**

- which tools are used (`detect` finds them) or which models (the answer changes no file)
- what kind of repo it is
- anything repo-fit does not add or change: CI and scheduled workflows, deploys, code quality, other automation, old or unlinked notes, big files, branches or remotes

Those go in step 5 as one line each, if at all.

## 4. Apply

```sh
node "$SKILL_DIR/bin/repo-fit.mjs" apply <repo> --steps <ids> <flags>            # dry run: every file and diff
node "$SKILL_DIR/bin/repo-fit.mjs" apply <repo> --steps <ids> <flags> --apply    # after the user's yes to that dry run
```

Use the steps and flags from the audit's "Recommended set" (or the user's pick). A new repo uses `init <repo> --dry-run --tool <tools>`, then `init` without `--dry-run`.

Show the dry run as a short list of files with one line each ("new: AGENTS.md section with your test command"), not the full diff, unless the user asks or an existing file is edited. Then apply. Every apply writes a backup and a receipt, and `undo <repo>` reverses it. Say that once.

Then verify in the repo, and say what you checked:

- `node scripts/playbook/brief.mjs --text` prints the briefing.
- `node scripts/playbook/check.mjs` passes, and so do the repo's own checks if it has them.
- **Claude Code:** `/context` lists `CLAUDE.md`.
- **Codex:** hooks do nothing until the user trusts them with `/hooks`. Tell them. Until one fires, call the Codex hooks untested.

## 5. Also noticed, then the recap

At most 5 lines of other audit findings (old notes, big files, no remote, a stale guidance warning). Each line says what was found and the command to look further. They are information, not questions.

Recap in a few lines: what was added, what was verified, what needs the user (Codex trust), and how to undo.

## Guardrails

The CLI already guarantees dry runs, backups, receipts, undo, no overwrites, and no commits to `main`. These rules are what it cannot enforce:

- Add `--apply` to `apply`, `update` or `skip`, or run `init` without `--dry-run`, only after the user said yes to that exact dry run. Invoking the skill is not that yes.
- Never move, delete, push, install a tool, log in, or create a remote as part of setup. `connect` and `tools --update` run only when the user asks for them.
- Never read or print the contents of a secret-like file. If the audit lists one, say so and recommend rotating it.
- The repo's own rules win. If it says "commit only when asked", the recommended flags already turn autosave off.
- Do not save audit output inside the audited repo unless the user asks.

## For maintainers

Refreshing the guidance layer and the version rules: `guidance/README.md`. Command reference: `docs/reference.md`.
