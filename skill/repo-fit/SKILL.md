---
name: repo-fit
description: Set up, update or refresh a repository with the repo-fit playbook: capture by default, absorbing, a task board, a session brief, Level 2 autosave and a living guidance layer for Claude Code and Codex. Use when starting a new repo, adding the playbook to an existing repo, or when asked to refresh the playbook's guidance.
---

# repo-fit

For an agent without this skill installed, `INSTALL.md` in the playbook folder carries the same steps in one file.

The playbook sets up any repository so work can start at any time and nothing is dropped. It has two halves:

- **The kit** (files and small scripts) that goes into a repo.
- **The guidance layer** (`guidance/`), dated notes from official Anthropic and OpenAI sources that decide how the kit is set up for a given tool and model. It expires on purpose and is refreshed.

Find the playbook folder first (the one containing `bin/repo-fit.mjs`). All commands below run from it.

## Step 0. Guidance freshness (always first)

```sh
node bin/repo-fit.mjs guidance check
```

If any file is overdue, run the **Refresh routine** below before setting anything up. If the user says to go ahead anyway, use `--allow-stale` and say in the recap which guidance was stale.

## Step 0b. Detect first (read-only, always)

Before asking anything, look at the machine and the repo:

```sh
node bin/repo-fit.mjs detect <repo>          # readable
node bin/repo-fit.mjs detect <repo> --json   # for scripts
```

It reports the CLIs installed and whether `gh` and `glab` are logged in (host and account name only, never tokens), the Git host, the repo kind (technical, notes or mixed), existing rule files, existing task tools, CI files, detected commands, and big files. It ends with the questions it would ask. **It changes nothing, installs nothing and logs in to nothing.**

Rules for using it:
- Ask only about what was found or what is missing. Do not ask about a tool that is not there.
- Never force a host or a tool. Offer GitHub or GitLab features only when the remote is that host, and offer an issue board only when the matching CLI is logged in to that host.
- If something useful is not installed or logged in, say so and offer to skip it. Do not install or log in for the user.
- Do not add a second board when the repo already tracks work somewhere. Ask first.
- For an existing repo, work delta-first: organize only the areas the user names.

## Step 0c. Audit (existing repos only, read-only)

```sh
node bin/repo-fit.mjs audit <repo>                    # whole repo
node bin/repo-fit.mjs audit <repo> --area <folder>    # delta-first: only the area the user names
```

Show the user the **Verdict** and the top gaps in plain words, then the plan in two groups:
- **Safe to do now:** steps that only add files.
- **Needs your decision:** every edit, move, delete or outward step, one by one. Never bundle them.

Rules:
- The audit changes nothing. Do not save its output into the audited repo unless the user asks. `--out` writes only where the user points.
- Treat counts as leads, not facts, until checked. Broken-link and unlinked-note counts can be noisy on content folders.
- Never read or print the contents of a secret-like file. The audit lists names only. If one is found, say so plainly and recommend rotating the secret.
- Apply only steps the user approved, one decision at a time: `node bin/repo-fit.mjs apply <repo> --steps <ids> ...` is a dry run that prints every file and diff. Add `--apply` only after the user says yes to exactly that dry run. Every apply writes a backup and a receipt, and `undo` reverses it.
- For repos with their own commit rules (for example "commit only when asked"), use `--autosave off` and `--hooks brief`. Never add the core rules block if it would contradict the repo's own rules.
- For a `CLAUDE.md` that is a near copy of `AGENTS.md`, prefer `--claude-link merge` and show the user the diff. A plain import would load the same rules twice.
- Moves, deletes, secrets, big files and adding a remote are never automated. Explain the options and let the user do or approve them.

## Step 0d. Tools and versions (read-only unless the user says yes)

```sh
node bin/repo-fit.mjs tools <repo> [--json]
```

It compares the Claude Code version that actually ran in this repo's sessions (the desktop app can bundle a different version from the `claude` command in a terminal) with the limits in `guidance/gates.json`, and separates two cases:
- **Needed:** the repo depends on a feature the running version lacks. Example: `AGENTS.md` only, no `CLAUDE.md`, on Claude Code below 2.1.277.
- **Optional:** everything else. Example: the terminal command is older than the app.

Rules:
- **Needed, and `autoUpdateAllowed` is true in the JSON:** run `node bin/repo-fit.mjs tools <repo> --update claude --apply` yourself, then report the before and after version. The user opted in to exactly this case.
- **Needed, no opt-in:** ask one clear question: update now, or use the fallback (a thin `CLAUDE.md` that imports `AGENTS.md`, which works on every version and is the playbook's default).
- **Optional:** mention it once and offer the update. Never run it unasked.
- The opt-in is `repo-fit prefs set autoUpdate.claude-code when-required`. Only the user can grant it. Never set it yourself.
- Only Claude Code's own `claude update` is ever run. Never install anything, never change a system setting, never touch the desktop app's own copy.
- `/doctor prompt-audit` is available only where `tools` shows it as met. Do not suggest it otherwise.

## Step 0e. Connect (only when the repo has no remote)

```sh
node bin/repo-fit.mjs connect <repo>                     # shows which hosts are usable (installed and logged in)
node bin/repo-fit.mjs connect <repo> --host github|gitlab [--owner <group-or-org>] [--name <name>]   # dry run
```

Add `--apply` only after the user approves that exact dry run. It creates an **empty private** remote and adds `origin`. It **never pushes or commits**. Pushing sends files off the machine, so it is a separate decision. For a work repo, do not assume the personal account: ask which owner or group. The tool cannot delete a remote repo. The receipt lists the undo commands to run by hand.

## Step 1. Interview

Use AskUserQuestion. One decision per question, plain options, a recommended one first. Pre-fill each question from the detect output.

1. **Which tools will work in this repo?** Claude Code, Codex, or both. Recommend both when the user switches between them.
2. **Which models will they mostly use?** List the models named in `guidance/models-*.md`. Allow several. If they name a model with no guidance file, say so and offer to add one after the setup.
3. **What kind of repo is it?** Knowledge base (supported now), job studio or delivery (not built yet: say so, and offer the knowledge kit plus a note of what is missing).
4. **Is it shared with other people or CI?** If yes, tell them the Shared kit items that are not built yet (hashed source archive, identity gate, entity register, CI).
5. **How automatic should saving be?** Level 2 autosave is the default (small `wip:` commits of allow-listed knowledge files to a session branch, never on `main` or `master`, never pushed). Level 1 asks the assistant to commit. Level 3 is manual.
6. **Where do big files live?** Video, large images and decks stay out of Git. Ask where, and write it in the repo's README.

## Step 2. Read the guidance for the answers

Open the files that match the answers: `guidance/claude-code.md` and/or `guidance/codex.md`, and the model files chosen. Read "What this changes in the kit" and "Open checks". Tell the user in a short list what will differ from the defaults, and which open checks matter for this repo. Ask before changing anything in an existing repo's rulebook.

## Step 3. Apply (dry run first)

New repo (always show `--dry-run` first; `init` never overwrites and now writes a receipt, so `undo` works on it):

```sh
node bin/repo-fit.mjs init <repo> --dry-run --name "Name" --owner "Owner" --tool both --models claude-opus-5-5,gpt-6-sol
```

Existing repo. `init` is additive: it never overwrites a file and lists what it left alone. Then `update` adds the managed core block to an existing `AGENTS.md`:

```sh
node bin/repo-fit.mjs init <repo> --name "Name" --tool both     # adds only what is missing
node bin/repo-fit.mjs update <repo>                              # dry run, prints the diff
node bin/repo-fit.mjs update <repo> --apply                      # only after the user approves the diff
```

If the repo already has a `CLAUDE.md` that does not import `AGENTS.md`, Claude Code will not read the rulebook. `status` and `check.mjs` warn about it. Ask before editing that `CLAUDE.md`.

Later, to see which repos are behind the playbook: `node bin/repo-fit.mjs status <repo>`.

## Step 4. Verify (done means proven)

In the target repo:

- `node scripts/playbook/check.mjs` passes.
- `node scripts/playbook/brief.mjs --text` prints a sensible brief.
- `node scripts/playbook/autosave.mjs --report --host "<tool>"` runs.
- **Claude Code:** run `/context` and confirm `CLAUDE.md` is listed. Run `/doctor prompt-audit` only if `repo-fit tools` shows it as available (2.1.283 or later), and report its findings.
- **Codex:** the hooks in `.codex/hooks.json` do nothing until the user reviews and trusts them with `/hooks`. Tell the user. Then confirm one hook actually fires. Until then, say the Codex hooks are untested.
- Say plainly what was not checked.

## Step 5. Recap

Short: what was set up, for which tools and models, which guidance date it used, what was verified, what needs the user (Codex trust, open checks), and the next step.

## Refresh routine (keeps the playbook alive)

1. `node bin/repo-fit.mjs guidance check` lists files by due date.
2. For each due file, re-read every source in its header, primary first.
   - If the fetch tool returns a summary, ask for the exact section verbatim.
   - If a page loads empty, read it in a real browser.
   - Do not state a vendor fact from memory.
3. Update the file: facts, `retrieved`, `review_after` (7 days if confidence is low, otherwise 30), `confidence`, and one line under "Changed since last review". Where sources disagree, say so and mark it unconfirmed.
4. Search the user's repos for stale references (retired model names, removed features). List them with paths. **Do not edit the repos without approval.**
5. If the kit should change, edit it, bump `VERSION`, add a line to `CHANGELOG.md`.
6. For each repo that uses the playbook: `node bin/repo-fit.mjs status <repo>`, then `update` as a dry run.
7. Report what changed and what needs a decision.

A weekly scheduled refresh is possible. It must only run steps 1 to 3 and write a report. It must never apply changes to a repo. Creating the schedule needs the user's approval.
