---
name: repo-fit
description: >-
  Set up, update or repair a repository so every AI session starts with a short briefing and one shared rulebook for Claude Code and Codex. It looks at the repo first, shows the user what they would gain with examples from their own repo, then asks once. Use when starting a new repo, adding repo-fit to an existing repo, or bringing a repo set up with an older repo-fit up to date.
---

# repo-fit

For an agent without this skill installed, `INSTALL.md` beside this file carries the same steps.

**The playbook folder is the folder that contains this SKILL.md.** Run commands as `node "$SKILL_DIR/bin/repo-fit.mjs" <command> <repo>`, where `$SKILL_DIR` is that folder. If `bin/` is not beside this file, read `home` from `~/.config/repo-fit/preferences.json`; if there is none, ask where the clone is. Never download or install it yourself.

## Who you are talking to

Assume the person does not know what hooks, dry runs, rule files or Git branches are, and should not need to. Say what changes for **them**, with lines from **their own repo**: their real branch, their last commit, their test command, their file names. Never a made-up example. Use a technical word only with a plain gloss beside it.

## What a good run looks like

The person sees value on the first screen, answers **one** question, and the yes approves exactly what they saw. **3 questions at most**, and **never zero**: anything that writes needs their yes first.

```
1. LOOK      audit, preview, update and the recommended dry run, silently
2. SHOW      their briefing, what each piece adds, what changes since their old version
3. ASK       set these up / let me pick / just the report
4. APPLY     the approved commands with --apply, then verify
5. BRIEFING  one line the person runs to turn on the start-of-session briefing
6. RECAP     up to 5 "also noticed" lines, then a short recap
```

## 1. Look (read-only, say nothing yet)

```sh
node "$SKILL_DIR/bin/repo-fit.mjs" audit <repo>       # starts with the recommended set and its dry-run command
node "$SKILL_DIR/bin/repo-fit.mjs" preview <repo>     # the briefing their sessions would start with
node "$SKILL_DIR/bin/repo-fit.mjs" apply <repo> --steps <ids> <flags>   # the recommended dry run, from the audit
```

- **Repo set up with an older repo-fit** (it has `playbook.json`): also run `status <repo>` and `update <repo>` (a dry run). `status` lists what is new since their version and any step they skipped that has changed since ("worth a second look").
- **Empty or new folder:** run `detect <repo>` and `init <repo> --dry-run --tool <tools> --no-hooks` instead.

Do not paste the reports. They are your working notes.

## 2. Show

In about 10 lines, plain words, no step IDs:

- **Their briefing**, from `preview`, as a code block, with one sentence on why it matters here. Example from a real repo: "Right now a new session knows nothing. With this, it starts by seeing you are on `main` with 1 unsaved file and that your last work was 'AWS spend fix' on 29 Sep."
- **What each piece adds**, from the audit's "Recommended set", each tied to something in this repo ("the rulebook would list `npm test`, so the assistant runs your real test command").
- **For an older setup:** what the update fixes, from `status`'s "New since" lines, in a sentence each. A skipped step marked "worth a second look": quote their old reason and say what changed.
- **What stays the same:** "Your own rules and files stay as they are; where they overlap, yours win." If the audit lists the repo's own rules or checks under "Leave as is", that is the reason.
- **What it writes**, one line per file, from the dry runs.

If nothing is recommended and nothing is behind, say the repo already has what matters, and stop. That is a good result.

## 3. Ask once

1. **Set these up (Recommended).** The yes approves the dry runs shown: the recommended `apply` and, for an older setup, the `update`.
2. **Let me pick.** One multi-select question with the other steps from the audit, in plain words. Run their dry run, show the files, and ask for the yes to it (question 3).
3. **Just the report.** A short table of the audit, then stop.

Ask a second question only for what the code cannot decide: an edit to an existing file outside the recommended set (show its diff), a second-look step (re-adding something they once said no to), or a word cap the audit asks for.

**Never ask about** which tools or models (found, or changes nothing), what kind of repo it is, or anything repo-fit does not change: CI and scheduled workflows, deploys, code quality, old notes, big files, branches, remotes. Those go in the recap, one line each.

## 4. Apply

Run exactly what was approved, with `--apply`: `update <repo> --apply` first for an older setup, then `apply <repo> --steps <ids> <flags> --apply`. A new repo: `init` with the same flags, without `--dry-run`. If anything changed after the yes, show the new dry run and ask again. Every write keeps a backup and a receipt; `undo <repo> --apply` puts things back. Say that once.

Verify, and say what you checked: `node scripts/playbook/brief.mjs --text` prints the briefing, and `node scripts/playbook/check.mjs` passes, plus the repo's own checks.

## 5. The briefing: one line the person runs

If the audit shows a "turn on the start-of-session briefing" command, the person runs it, not you. Claude Code's safety check (auto mode) blocks an assistant from changing how sessions start, and that is right: it is their call. Explain it like this, with their real preview:

> **One last step, and it is yours to run.** Right now each new session starts blank. This line makes every new session in this folder start with the briefing above, so the assistant knows where you left off without you explaining. Claude Code does not let an assistant switch this on by itself, because it changes how every future session starts. To turn it off later: `undo`.

Then give the command in its own `bash` block, with the full path, so it has a Run button:

```bash
node "<full path to the playbook folder>/bin/repo-fit.mjs" hooks "<full path to the repo>" --apply
```

After they run it: check that `.claude/settings.json` names `scripts/playbook/brief.mjs`, and tell them a new session will show the briefing. **Codex:** it runs this only after they allow it once with `/hooks` in Codex. Until a Codex session shows the briefing, call it untested.

If they would rather not, the rest still works: the shared rules tell the assistant to run the briefing itself when none appeared.

## 6. Also noticed, then the recap

Up to 5 lines of other findings (old notes, big files, no remote), each with the command to look further. Information, not questions.

Recap in a few lines: what was added or fixed, what was verified, what is theirs to do (the briefing line, Codex `/hooks`), and how to undo. End with the repo-fit version and one line on updates: "When a newer repo-fit matters for this repo, the briefing will say so." (Plugin installs in Claude Code can also switch on auto-update in `/plugin`.)

## Guardrails

The CLI already guarantees dry runs, backups, receipts, undo, no overwrites, and no commits to `main`. These rules are what it cannot enforce:

- Add `--apply` to `apply`, `update`, `skip` or `hooks`, or run `init` without `--dry-run`, only after the person said yes to that exact dry run. Invoking the skill is not that yes.
- **If a safety check blocks a step, do not work around it** and do not offer a path that will hit the same block later. Say in one plain sentence what was blocked and why, and give the person the exact command to run themselves in a `bash` block.
- Never move, delete, push, install a tool, log in, or create a remote as part of setup. `connect` and `tools --update` run only when the person asks.
- Never read or print the contents of a secret-like file. If the audit lists one, say so and recommend rotating it.
- Do not save audit output inside the audited repo unless the person asks.

## For maintainers

Refreshing the guidance layer: `guidance/README.md`. Command reference and tests: `docs/reference.md`. After changing this file, check a live run: `node dev/transcript-check.mjs <session.jsonl>`.
