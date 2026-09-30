# Changelog

## Unreleased

**Skill and INSTALL.md only. No kit change, so no version bump and no "behind" in adopted repos.**

- The interview no longer asks "what kind of repo is it?" or "is it shared?". Two of its three answers used the same kit, so they were not real choices. It now states plainly what exists: one kit, with the `paths` mapping for repos organized differently.
- Step 3 told agents to run `init` on an existing repo. `init` writes starter files at default paths, so a repo that keeps its notes elsewhere would get a duplicate set. Existing repos now go audit, then `apply --steps`, which reuses the files they already have.
- The interview asks fewer questions on an existing repo: tools and models, then which audit steps to apply.

**Code fixes found by a dry run on a real existing repo (non-vendored files only: no "behind" in adopted repos)**

- **New files go beside their siblings.** A repo that keeps `current.md` and `log.md` in `00-home/` at its root used to get the new board and people page in a second folder, `docs/00-home/`. They now go into `00-home/`. The rule is narrow: only next to an existing file that already uses this tool's own file name. Otherwise the default path is used. The new location is written to `paths`, `autosaveAllow` and `required` in `playbook.json`, also when the file is added in a later run.
- **The first board row no longer points at a file that may not exist.** It named `docs/00-home/current.md` in every repo, so `check` failed after setup when the current view lives elsewhere or does not exist yet. It now points at the real current view, or at `README.md` when there is none.
- **Files made from a template drop links to files that will not exist.** Applying only some steps used to leave a `current.md` with broken links to `log.md`, `open-questions.md` and `decisions.md`.

## 0.3.2 (draft)

**No personal defaults in the code.** Before this, `init` and `apply` wrote a fixed owner name into every new repo and allowed it in the log.

- The owner of a new repo now comes from, in order: `--owner`, your saved preference (`repo-fit prefs set owner "Your Name"`), the repo's `git user.name`, then the plain word `Owner`.
- `playbook.json` lists the owner in `recorders`, so `check` accepts log lines that name them. The built-in default list is now the four tools only.
- Skill text and guidance no longer say "Jimmy's playbook" or "this Mac".
- `audit` no longer looks for a specific hook file in the home folder, and `detect` uses neutral labels for task folders.
- This is the first public release.
- The vendored `scripts/playbook/lib.mjs` changed, so adopted repos show "behind" until `repo-fit update` (one dry run first).

## 0.3.1 (draft)

**The tool is now called repo-fit** (it was `repo-playbook` while it was being built).

- Command: `node bin/repo-fit.mjs <command>` (was `bin/playbook.mjs`). Every command and option is unchanged.
- Skill: `skill/repo-fit` with `name: repo-fit` (was `skill/repo-playbook`).
- Your standing choices now live in `~/.config/repo-fit/preferences.json`, and the override variable is `REPO_FIT_CONFIG` (was `REPO_PLAYBOOK_CONFIG`). Move the old file by hand if you have one.
- **Kept on purpose, so adopted repos need no migration:** `playbook.json`, `.playbook/`, `scripts/playbook/` and the `playbook:core` marker in `AGENTS.md`.
- The wording inside the core block and the vendored scripts now says repo-fit. Repos that adopted an earlier version show "behind" until `repo-fit update` (one dry run, three files, undoable).
- The research note that compared the maintainer's own repos is not part of the public copy. The landscape report carries a naming note.
- **Tested live:** the Stop-hook autosave in a real Claude Code 2.1.284 session (throwaway repo). It committed to a `wip/` branch and left the protected branch untouched. That Claude Code version sends `stop_hook_active`. The Stop block, its once-per-session guard and the PreCompact autosave were seen working there too. Still untested live: the terminal `claude` 2.1.270, Codex hooks, GitLab `connect`.
- Entries below this one keep the old command names, because that is what they were called then.

## 0.3.0 (draft)

- `INSTALL.md`: one file an agent can follow to set up any repo (look, audit, tools, ask, dry run, apply, verify, undo), with the rules that never bend. Works with or without the skill installed.
- `init --dry-run`; `init` now writes a receipt, so `undo` works on it.
- `--pin <version>` on `init`, `update` and `apply`: refuses to run unless this playbook copy is exactly that version.
- `playbook help` lists every command.
- Undo now removes exactly the folders the run created, once empty. A folder that existed before, and anything you put in it, is left alone.
- Version stamp moves to 0.3.0, so repos that adopted 0.2.0 show "behind" until `playbook update`.

## 0.2.0 (draft)

**New commands (none of them change a repo unless you add `--apply`)**
- `playbook detect <repo> [--json]`: read-only look at the machine (CLIs; `gh` and `glab` logins by host and account only), the Git host (GitHub, GitLab, Bitbucket, other, none), repo kind, rule files and how they link, task tools, CI, commands and big files (tracked or not). Ends with the questions it would ask. Tokens inside remote URLs are stripped. A host CLI counts only when logged in to the repo's own host.
- `playbook audit <repo> [--area <folder>] [--json] [--out <file>]`: read-only. 19 foundation checks, a map of existing files to foundation roles (mapped, never moved), and a plan: add-only steps, then decisions labelled edit, move, delete or outward. Proven read-only. 2 to 4 seconds on repos of 300 to 17,000 files. Ignores archives and outputs when looking for unlinked notes, and does not count links starting with "/" as broken.
- `playbook apply <repo> [--steps ...] [--tool] [--hooks all|brief|none] [--autosave on|off] [--apply]` and `playbook undo <repo> [--receipt] [--apply]`. Dry run by default. Backup before every edit, a receipt for every apply, undo that refuses to overwrite files changed since, created files moved aside (never deleted).

- Step 4: audit and apply tell three `CLAUDE.md` situations apart (identical copy, near copy, different) and pick the right link. `--claude-link merge` keeps only CLAUDE-only lines under the import. New step D-10 drafts a marked Dev, test and lint section from detected scripts (runner chosen from the lockfile). Two steps that edit the same file now build on each other instead of overwriting.

- `playbook connect <repo> [--host github|gitlab] [--owner] [--name] [--apply]`: for a repo with no remote. Lists hosts that are installed **and** logged in, checks the name is free (read-only), dry run by default. `--apply` creates an **empty private** remote and adds `origin`. Never pushes or commits. Always passes `--private` (glab defaults to internal). Receipt lists the undo commands, which are never run for you. Tested with stand-in `gh` and `glab`, then **once for real with `gh`** (29 Sep 2026, on a real private project: created an empty private repo, the host reported it empty, the local repo was unchanged, `origin` was set to the HTTPS URL). The `glab` path has not run against a real GitLab yet.
- `playbook tools <repo> [--json] [--offline] [--update claude [--apply]]`: compares the Claude Code version that ran in the repo's sessions (read from the session logs) with `guidance/gates.json`, separating **needed** from **optional**. `--update` runs only `claude update`, only with `--apply`. `autoUpdateAllowed` is true only if the user ran `playbook prefs set autoUpdate.claude-code when-required` and a need is real.
- `playbook prefs`: standing choices kept in `~/.config/repo-playbook/preferences.json` (or `REPO_PLAYBOOK_CONFIG`). Written only by `prefs set`.
- `guidance/gates.json`: the version limits, dated and sourced, refreshed with the guidance. `detect` now reads them and reports both the terminal command and session versions.

**Changed in the kit (repos show "behind" until `playbook update`)**
- `lib.mjs`, `brief.mjs`, `check.mjs`, `autosave.mjs` read file locations from `paths` in `playbook.json` (defaults unchanged). `required` limits what `check` demands for a partly adopted repo. A board that is another tool or a different table shape is reported as external, not as an error. Autosave no longer asks for a log file the repo does not have.
- `update --apply` now uses the same safe writer (backup, receipt, undo). `update` never creates an `AGENTS.md`. `check` and `status` no longer warn about a missing `@AGENTS.md` import when there is no `AGENTS.md`. Both were found by a pilot on a real repo.

**Other**
- Setup skill: "Detect first" and "Audit" steps, and rules for asking only about what was found.
- Research: landscape report of 81 public repos with 40+ stars (`claudedocs/`).
- Weekly guidance refresh scheduled (report only).

**Pilots on real repos (each approved by the owner, nothing committed or pushed):** a repo with no remote (`connect --host github`, an empty private remote), a creative-studio repo (README, playbook.json, scripts, session-brief hook, then one `update`), a bot repo (step 4, identical-copy case: `CLAUDE.md` replaced by a thin import; the backup is byte-identical to `AGENTS.md`).

**Live-verified in real Claude Code sessions (29 Sep 2026):** the session-brief hook fires and reaches both the user and the model (a studio repo); a thin `CLAUDE.md` importing `AGENTS.md` loads both files with no approval prompt (a bot repo). `detect` now notes that Claude Code below 2.1.277 does not read `AGENTS.md` directly and below 2.1.283 has no `/doctor prompt-audit`.

**Tested:** dry run writes nothing, subset apply, edit with diff and backup, undo, undo conflict, no-op second apply, hook merge keeps existing hooks, update with drift, and a live pilot on a real repo. **Not tested:** the hooks inside a real Claude Code or Codex session.

## 0.1.0 (29 Sep 2026): first draft

Built from a comparison of about a dozen of the maintainer's own repos, then checked against 81 public projects with 40+ stars. See `claudedocs/2026-09-29-repo-landscape-research.md`.

**Kit**
- Starter kit for a knowledge-base repo: front door, rulebook with a managed core block, board, current view, log, open questions, people, decisions, lessons.
- Four small scripts, no dependencies (Node): session brief, checks, Level 2 autosave, shared helpers.
- `playbook` tool: `init`, `status`, `update` (dry run by default), `guidance check`.

**Guidance layer (new)**
- First refresh done 29 Sep 2026 from official Anthropic and OpenAI pages. See `guidance/`.
- Setup asks which tools (Claude Code, Codex, both) and which models, then applies the matching kit.

**Findings from the first refresh that changed the design**
- Claude Code reads `AGENTS.md` directly only when no `CLAUDE.md` exists, so a thin `CLAUDE.md` with `@AGENTS.md` stays the standard.
- Claude Code's documented Stop input has no `stop_hook_active`, and a Stop hook can block repeatedly. The autosave script keeps its own once-per-reason guard per session.
- Codex has hooks (`.codex/hooks.json`), gated by a trust review per hook hash. The kit ships a Codex hook file. Untested.
- Model names do not go in the core block.

**Known limits**
- Knowledge-base profile only. Job-studio and delivery profiles are not built.
- Codex hook file format follows the Claude Code shape and is untested.
- OpenAI model facts are low confidence (7-day review window).
