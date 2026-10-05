# Changelog

## Unreleased

- **Organize a folder with one yes (redesign slice 3).** `repo-fit organize <repo>` shows one screen: the folder today, after, and why it is better, in plain words. `--list` shows every move with its reason; `--apply` does it; `repo-fit undo <repo> --apply` takes it all back in one step. Loose files at the top go into a folder for their kind (the folder's own names first, else `notes/`, `media/`, `documents/`, `data/`), 3 or more files that share a name start get their own folder (`notes/japan-trip/`), old-looking folders ("old", "New Folder", "old debug files") and exact copies go to `archive/<date>-…/`, empty or unknown files wait in `inbox/`, and code with every file it or the rules name stays. The moves, the link updates and the rebuilt map and index pages share one journal and one receipt. Scores on the test folders: loose files at the top 30 → 0, 30 → 0, 7 → 0, 18 → 0 (0.6.0: unchanged); every exact copy resolved (0.6.0: none); the map covers every area and every note is within two links; safety unchanged.
- **Fixes found while building it.** A link to a folder now follows the folder when all its files move together (the map's link to an archived folder broke, and the move check rolled it back). Notes repo-fit moved keep their old date for the old-note check, instead of looking new. The map lists `inbox/` even while it is empty, and lists what waits there. A rule file naming a folder ("Meeting notes go in notes/") no longer locks files in it; code or config naming a folder still does. repo-fit's own scripts no longer count as code that names a file. In a notes folder, personal notes go to `notes/`, not to the `docs/` folder repo-fit's setup made.
- **A safe way to move files (redesign slice 2, not used by any command yet).** `lib/move.mjs` plans a batch of moves and refuses, with a plain reason, anything that must stay: code and configuration, files inside a sub-project, files that code, config or rule files name, files leaving a folder that code or config names, protected paths, hidden folders, shortcuts, Git-ignored files, and taken destinations. It rewrites links to each moved file and inside it in the link's own style (headings, titles, `./`, with or without `.md`, `<...>` or `%20`, wiki links with aliases and embeds, reference links, HTML, front matter) and leaves code blocks alone. The yes is tied to the exact plan: if a file changed after the preview, nothing moves. A journal is written before the first move; after the moves it checks that no file is lost, content is unchanged apart from link lines and working links did not drop, and otherwise puts everything back. A run that stopped halfway is put back before the next one. `undo` now moves files back, and refuses where a moved file changed since. The organize screen (slice 3) will be its front door.
- **A map of the folder (redesign slice 1).** The recommended set now adds `MAP.md` (one line per area, plus the loose notes at the top), an index page per area (`<area>/INDEX.md`, or the area's own README when it already lists every note), and a short pointer at the end of the rulebook so every session starts from the map (steps A-13 and D-11, add-only, undoable). The lists sit between markers and are rebuilt; the person's words above and below stay, and a `MAP.md` or `INDEX.md` without the markers is theirs and never touched. `repo-fit map <repo>` shows the map without writing anything; `scripts/playbook/map.mjs --write` rebuilds it inside a repo. Links inside the generated lists do not count when looking for notes nothing links to, so the map does not hide them. Scores on the test folders: map covers every area, 100% of notes within two links of it (0.6.0: no map, 0%); safety and problems surfaced unchanged.
- **Outcome scores, before any new feature.** The redesign (`claudedocs/2026-10-05-redesign-design.md`) is measured by whether a folder is really better organized, not only by "nothing broke". `dev/measure.mjs` builds five synthetic test folders (an everything-folder with and without Git, a program with documents spread around, a flat second brain, an already tidy folder), sets each up with a repo-fit version and scores it with `dev/score.mjs`, which has its own file walk and link reader. 0.6.0's starting score: no map, 0% of notes findable from one, loose files unchanged, no new input filed, safety perfect (`claudedocs/2026-10-05-baseline-0.6.0.md`).
- **Releases publish themselves.** Merging a new version into `main` runs the tests and publishes it to npm through trusted publishing (no login, no stored token), then tags it. Ordinary merges publish nothing.

## 0.6.0 (5 Oct 2026)

**Useful, not ceremony.** From an impartial audit of three real setups (`claudedocs/2026-10-04-usefulness-audit.md`): setup now shows the briefing first and asks once, the shared rules block is 293 words and imposes nothing, and a test and a transcript checker hold the flow to that. Adopted repos see "behind" and get the new block and scripts through `update`.

- **The end-of-reply reminder works without autosave.** With autosave off (most repos), the Stop hook now only reminds: once per session, when files changed but no note, current view or log did, it asks the assistant whether anything is worth keeping, and never asks it to commit. It comes with the briefing (`--hooks brief`), so every repo gets it from the same one line. Its message pointed at a "Capture by default" section the shorter rules no longer have; it now says "Keep what matters". `status` tells a repo with the old briefing-only setup how to turn it on.
- **Fixes from the live test on a real code repo** (2 questions, no block, briefing printed): the `CLAUDE.md` it creates no longer claims the briefing and autosave are on (the assistant had fixed that by hand); `.playbook/` ignores itself, so receipts no longer show as untracked files (an older `.playbook/.gitignore` is widened); mixed repos are no longer offered a blank current-view page; the skill now says to write only what the approved dry run shows and to keep housekeeping out of questions. `dev/transcript-check.mjs` now sees quoted paths and hand edits, reads question options, and treats invoking the skill as no yes.
- **People hear about updates that matter.** Once a day the briefing asks npm for the latest repo-fit (package name only, cached, silent offline) and shows one line when a newer release is marked important, with why. Release notes moved to `package.json` (`repoFit.releases`), so npm carries them and `status` reads the same list. Off with `repo-fit prefs set updateCheck off`.
- **repo-fit is also a Claude Code plugin**, from this repo (`/plugin marketplace add JimmySadek/repo-fit`). Users who switch on auto-update in `/plugin` get new versions by themselves. Checked with `claude plugin validate` and a session with `--plugin-dir`.
- **The briefing is turned on by the person, with one line.** Claude Code's auto mode blocks an assistant from writing hook files ("self-modification"), which stopped a real setup after its one question. The recommended set now adds the scripts with `--hooks none`, and the new `repo-fit hooks <repo> --apply` turns the briefing on: merged with the repo's own hooks, recorded in `playbook.json`, undoable. The skill explains it with the person's own preview and says why Claude Code leaves it to them. If any step is blocked, the skill gives the exact command instead of working around it.
- **Older setups are brought up to date in the same one question.** `status` and `update` show what is new since the repo's version in plain words, and a skipped step that changed since as "worth a second look", quoting the old reason (`RELEASES` in `lib/versions.mjs`). The skill runs `update` and the recommended set together, and ends by saying repo-fit does not update itself.

- **The score counts only what is recommended for the kind of repo.** A code repo is no longer "7 missing" for not having a current view, log, board, people page or lessons file; a mixed repo counts only the current view. Those files stay on offer under "let me pick". F19 is now "Unsaved work on main", never a gap, and fine where the repo's own rules commit on main.
- **The review queue in the brief is a count above 3 notes**, with `node scripts/playbook/check.mjs` named to list them. One to three notes are still named.
- **The one question approves the dry run the user saw.** `SKILL.md` and `INSTALL.md` now run the recommended dry run while looking, show its files on the first screen, and apply that exact command after the yes. Before, the order was ask, then dry run, then apply: the dry run had no approval of its own (a real run did this).
- **The setup contract, tested** (`test/onboarding.test.mjs`): code, notes, mixed and mature repos. It found two bugs in the one-yes path, now fixed: a code repo without a rulebook got `AGENTS.md` but not its commands section (D-10 was offered only when `AGENTS.md` existed; it now goes into the new file), and a notes repo with its own `people.md` got an `AGENTS.md` linking `docs/00-home/people.md`, which failed `check`.
- **`dev/transcript-check.mjs`** checks a live `/repo-fit` run from its Claude Code transcript: questions (3 at most, none off-topic) and writes (only after an answer to the last dry run). On the three real setups before these changes it reports 17, 7 and 4 questions and unapproved writes; on the latest run, 1 question and every write approved.
- 12 new tests (120 in all).

- **The shared rules block is 293 words instead of 774, and imposes nothing.** It goes after the repo's own rules and says "where they overlap, the rules above win". Five rules stay, the ones that change what an assistant does: write it down, start from the files, search before saying "unknown", keep what matters, never invent agreement. Gone: rules about branches, when to commit, which checks to run, the board's columns, and fact/hypothesis labels. With nothing left to contradict, the "Conflicts with the core block" section, the slim-block switches (`deferVars`, `conflicts`) and the board-format detection are removed. The repo's own commit rules still turn autosave off in the recommended flags and appear under "Leave as is".
- **The brief sets no branch rule.** "On main: the playbook rule is never to commit here" is gone. With autosave on, it says autosave saves to a `wip/` branch instead.
- **Three false findings fixed** (found by auditing this repo): a commit rule quoted as an example ("Example: a repo that says ...") was read as the repo's own; notes in `kits/`, `starter/` and similar folders counted as unlinked; one banner image triggered the media `.gitignore` step, which now needs a video, zip or psd file.
- 5 new tests and 12 rewritten to the new intent (108 in all). The new ones fail without these changes. **The core block and the vendored `brief.mjs` and `lib.mjs` changed:** `update` will offer the new block to adopted repos after the next `VERSION` bump.

- **Setup asks once instead of a dozen times.** From an audit of three real setups (`claudedocs/2026-10-04-usefulness-audit.md`): 23 questions, about 5 that improved the repo. The rest were setup trivia, housekeeping outside repo-fit's job (one was about a scheduled CI workflow), or conflicts repo-fit's own rules started. Now:
  - **`audit` opens with a recommended set** for the kind of repo, with the exact `apply` command. Code repos: the briefing, one rulebook and their commands, no notes files. Notes repos: also a current view and a board. Autosave and full hooks only where the repo has no commit rules or hooks of its own. A `CLAUDE.md` that mostly repeats `AGENTS.md` gets `--claude-link merge`; one that differs a lot stays a separate question.
  - **`repo-fit preview <repo>`** prints the session briefing the recommended set would give. Read-only.
  - **The brief no longer says the board is missing** in a repo that did not adopt one. It shows the last three commits instead.
  - **`SKILL.md` rewritten** (2,537 to about 1,000 words): look, show, ask once, apply. At most 3 questions. Never asks which tools or models, what kind of repo it is, or about anything repo-fit does not change. Other findings become up to 5 lines of "also noticed", not questions. `INSTALL.md` follows the same flow.
  - **`detect` stops offering host files** (a PR template and workflow) that no command adds, and states detected tools as a fact instead of a question.
  - **Settings a repo already chose stay.** A `playbook.json` with autosave off keeps the recommended flags at autosave off, and `preview` says "would start" until the brief script is really in the repo. Both found by running the new flow read-only on three real repos.
  - **One question, never zero.** The first live run on a repo that already had repo-fit asked nothing and ran `update --apply` without a yes. The update path in `SKILL.md` and `INSTALL.md` now asks "update now or not now" first, and the guardrail says invoking the skill is not approval.
- 11 new tests (104 in all). Each fails without its change. **The vendored `scripts/playbook/brief.mjs` and `lib.mjs` changed:** bump `VERSION` before the next npm release.

- **Two more rule conflicts are detected, and the block defers on both.** From setting up a small writing repo whose only rulebook was `CLAUDE.md`. (1) **Main branch:** a rule that commits on main ("branch `main`. Commit finished steps") was missed, because commit rules that mention main were all read as "where not to commit". Now it is a "main branch" conflict; "never commit on main", "the guard blocks commits on main" and "the owner merges into main" still are not. The block then says "Which branch to commit on follows this repo's own rules above" instead of "Never commit on `main`", and A-01 writes an empty `protectedBranches` when autosave is off, so the brief stops warning about main. (2) **Board format:** a board that is a checklist or a folder (no ID column) is a "board format" conflict; the Board section then keeps the repo's format instead of asking for IDs, owners, evidence and verified dates.
- **Only `CLAUDE.md`, no `AGENTS.md`: D-02 now moves the rules.** Before, D-02 was offered only when both files existed, so `A-11` made a second, unlinked rulebook and Codex never saw the `CLAUDE.md` rules. Now the audit offers D-02 "Move CLAUDE.md's rules into AGENTS.md, word for word": `AGENTS.md` gets the rules plus a two-line note, `CLAUDE.md` keeps only the import (backup and undo as usual). With A-11 the core block is added after the moved rules, with no TODO placeholders.
- **A-11 leaves out "People who are always known"** when the repo has no people page and is not getting one. A personal or family repo should not be invited to write names into its rulebook.
- **`_template/` and `template/` folders** are treated like `templates/`: not unlinked notes, in the audit and in the review queue alike.
- Checked, no change: an installed skill folder that holds only `SKILL.md` is the designed fallback (it finds the clone through `home` in the preferences) and worked.
- 7 new tests (93 in all), on a generic writing-repo fixture. All 7 fail without these changes. **The vendored `scripts/playbook/lib.mjs` and the core block changed:** bump `VERSION` before the next npm release, so adopted repos see the update.

- **One-paste install.** `SKILL.md` moved to the root, so `npx skills add JimmySadek/repo-fit` installs the whole tool as one skill for Claude Code and Codex (tested from a local copy: the tool installs and runs). Its front matter is now a YAML block: the old one-line description contained ": ", and the installer skipped the skill as invalid. The skill runs the tool from its own folder. The README's start is one sentence to paste into the assistant.
- **Published to npm as `repo-fit` 0.5.0 (2 Oct 2026).** `npx repo-fit audit .` works from any folder with Node.js, no install. The package holds 47 files (94 kB), no tests or notes. Checked from a clean folder with an empty cache.
- 2 new tests: the SKILL.md front matter the installer accepts, and package.json matching VERSION and shipping every folder the tool reads.
- **README rewritten for non-technical readers** (founders, product, design, commercial; non-native English). What it is, who it is for, what you get, how to start through an AI assistant, safety, status. All technical content moved to `docs/reference.md`, unchanged.
- **Windows:** the audit's Markdown walk, its link resolver, the big-files scan and the receipt's folder list built paths with backslashes, so a tracked file was not recognized as tracked and protected paths did not match. All four now use forward slashes, like Git. Found by CI on 0.5.0 (3 of 84 tests failed on Windows only).

## 0.5.0 (draft)

**Adapt first: assess a repo, say what to leave as is, and fit repo-fit's pieces around what is already there.** From the setup of a mature notes repo on 1 Oct 2026 (it has its own checks, hooks, decision lifecycle, append-only archive and people register).

- **The audit sorts its findings.** A new "Leave as is" section lists what the repo already covers in its own way, with the line it came from. A new status, 🔁 "covered by an equivalent", counts as in place in the verdict (for example work tracked in the current view and open questions instead of a board; the board then becomes an optional decision).
- **Conflicts with the core block are listed before D-01** (checks, commits, decisions, raw input, status, word cap), and D-01 is marked "⚠️ conflicts with existing rules". `apply` writes a **slim block** that defers to the repo's own rule on each of those topics, and names `scripts/playbook/` only when the scripts are there. `update` renders the same block, so it stays stable.
- **Protected paths.** Folders the rules call append-only or read-only, `protectedPaths` in `playbook.json` (A-01 writes the detected ones), and delivered outputs are listed only: never offered for fixing, moving or archiving, and kept out of the review queue.
- **Dry runs show new file contents:** config files in full, other new files their first 12 lines, vendored scripts as one line. `--show` prints everything.
- **`status` and `update` manage only adopted parts.** `update` never adds the block or the scripts; `status` lists them as "not adopted" or "skipped on purpose" instead of "Behind". A version-stamp-only difference is not "Behind" either. `apply` records `adopted` steps (and `hooks` mode) in `playbook.json`. New `repo-fit skip <repo> <ID> --reason "..." [--remove]` (dry run, receipt, undo).
- **One rule, one cap.** The word cap comes from the repo's own check script or rules first, then `playbook.json`, then 900; two caps that disagree are flagged. `check` counts the body only (0.4.1). The recorder list is copied from the repo's scripts; the owner is added only with `--owner`.
- **A-10 is a decision when the repo runs its own hooks or checks**, and the dry run lists them ("repo already has ..."). Existing hooks are kept, as before.
- **Big files (F16):** a written policy (a "Big files" or "Media" heading, or Git LFS) counts, and tracked files are told apart from ignored ones (local only) and loose ones. D-05 is offered only for tracked files with no policy.
- **Less noise:** dot folders (`.claude/`, `.github/`, ...), templates and nested projects' `AGENTS.md`/`CLAUDE.md` are no longer counted as unlinked notes. In the audit and in the review queue alike.
- **`undo --force`** takes back files changed since repo-fit wrote them; your version is moved to `.playbook/undone/` first, nothing is deleted. Fixed: an undo that left files in place used to mark its receipt as done, so nothing could finish it.
- **Codex hooks, checked against the official hooks page (read in a browser, 1 Oct 2026).** The file format matches. Fixed: the session brief sent its context at the top level in Codex mode; Codex reads `hookSpecificOutput.additionalContext`. The Codex brief no longer sends `systemMessage` (Codex shows it as a warning). The Stop hook's reason no longer names the board or `check.mjs`.
- **No OpenAI model is named in examples or recommendations** while `guidance/models-openai.md` lists the model-name conflict as open.
- **Deferred, with reasons:** (1) a live Codex session against the hooks: running `codex exec` from this session was not permitted, so the Codex hooks stay "untested" until someone runs one (the guidance says how). (2) The `models-openai.md` refresh is due 6 Oct 2026 and needs the OpenAI pages read in a browser; not done in this release.
- **Version stamp moves to 0.5.0.** The vendored scripts and the core block changed, so adopted repos show "behind" for the parts they adopted until `repo-fit update` (dry run first).
- 20 new tests (84 in all), on a fixture shaped like a mature notes repo with generic names. 18 of them fail on 0.4.1; the other 2 guard behavior that must not change.

## 0.4.1 (draft)

**Fixes found on 1 Oct 2026 while auditing a real notes repo that keeps its files in its own places**

- **The core block now names the repo's own files.** `apply --steps D-01` (and A-11, `update` and `status`) wrote `docs/00-home/current.md`, `docs/decisions.md`, `docs/00-home/board.md` and other Starter kit paths into `AGENTS.md`, even when `paths` pointed elsewhere. The block is now written from the mapping. When a role has no file (for example no board), the sentence about it is left out or reworded, so the block never points at a missing file. `update` uses the same paths, so it does not put the old ones back.
- **`check` counts only the body of the current view against `currentWordCap`.** YAML frontmatter is metadata and no longer counts. On an existing repo, the audit reads a cap the repo already states (in the current view, or on a line of `AGENTS.md`, `CLAUDE.md` or `README.md` that names it) and A-01 keeps it. With no stated cap and a body over 900 words, F5 says so and `apply --word-cap <N>` sets the cap.
- **A people or entity register counts as the people record (F10).** The audit now finds `people.json`, `contacts.yaml`, `entity-register/registry.json` and similar files (archives and tests left out), so such a repo is no longer told to add a second people page. Any role in `playbook.json` `paths` can point at any file, and the audit respects it.
- The audit also maps a note template and a raw-input folder (`paths.template`, `paths.inputs`) for the core block.
- **Version stamp moves to 0.4.1.** The vendored `check.mjs` and `lib.mjs` and the core block changed, so adopted repos show "behind" until `repo-fit update` (dry run first).
- 11 new tests (64 in all). The 8 that cover the three fixes fail on 0.4.0.

## 0.4.0 (draft)

**Connecting the dots: a review queue, adopted from the maintainer's own knowledge repos**

- **`check` and the session brief now carry a review queue:** notes nothing links to, notes untouched for `staleNoteDays` (default 180) with no planned review, and notes whose `review_after: YYYY-MM-DD` has passed. Warnings, never failures. Archives, outputs, templates, folder READMEs and the root files are left out; `reviewIgnore` adds globs. Wiki-style `[[links]]` count as links. Same rules as the audit's F14 and F15, so daily checks and the one-time audit agree.
- **The core block's "Absorb" rule** now says to start at the topic's hub (the folder README, or a mapped hubs folder) and to work the review queue when touching a topic. The audit maps an existing `hubs` folder into `paths.hubs`.
- **Version stamp moves to 0.4.0.** The vendored scripts and the core block changed, so adopted repos show "behind" until `repo-fit update` (dry run first).
- Not built, by design: the AI checker that reads new input for repeats and contradictions (a vendor feature). See the README.
- 9 new tests (53 in all).

**Stale guidance no longer stops setup, and there are automated tests**

- **`init` warns instead of failing when guidance is past its review date.** Before, every user got an error once a guidance file expired, until the maintainer refreshed it by hand. Now `init` prints one warning and goes on. `--strict` brings the old stopping behavior back for maintainers. `guidance check` still exits 1 when something is overdue. The `--allow-stale` flag is gone (it has no effect now).
- **43 automated tests** (`node --test`, no dependencies) in `test/`, and a GitHub Actions workflow that runs them on macOS, Linux and Windows with Node 18, 20 and 22. Windows is allowed to fail until verified. Checked by putting eight old bugs back one at a time in a scratch copy: every one is caught by a test.
- `REPO_FIT_TODAY` (YYYY-MM-DD) fakes today's date. The tests use it to make guidance expire.
- **Found by the first CI run:** on Windows, Git checks files out with `\r\n` line endings, and the guidance dates read as missing, so every file looked overdue. The parser now reads both endings, a `.gitattributes` keeps this repo's own files on `\n` everywhere, and a test converts the guidance to Windows endings and checks again. macOS and Linux were green on Node 18, 20 and 22 in that run.
- The README now says **public beta** at the top.

Skill and INSTALL.md only, earlier in this release:

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
