# repo-fit · Working agreements for every assistant

A small, balanced foundation for any repository, technical or notes, for Claude Code and Codex. Version is in `VERSION`. Maintainer: Jimmy Sadek. Read [README.md](README.md) for the commands and [CHANGELOG.md](CHANGELOG.md) for what changed.

## Scope guard (the maintainer's decisions, 29 Sep 2026, revised 5 Oct 2026)

> **Status:** the organizing parts below (map, plan, standing rules, fit check) are decided, not built yet. Progress: `claudedocs/2026-10-05-redesign-checklist.md`. Until they ship, never describe them to users as existing.

- **An organizer in plain files.** repo-fit maps a repo, organizes it, connects it and keeps it fit. It borrows a second brain's organizing mechanics (a map, index pages, an inbox, an archive, a fit check) in plain Markdown, folders and Git. No search engine, embeddings, database or service. Never claim more than the scripts really do.
- **Progressive disclosure.** The always-loaded lines stay few and point to `MAP.md`. The map has one line per area. Each area has one index page, one line per note. Any note is at most two steps from the map. People see one screen first and details on request. Scripts build and check the map and index pages; search is the fallback, never the map.
- **Same logic, tailored to each repo.** Not one-size-fits-all. Detect the machine and the repo first (CLIs, logins, Git host, existing tools, rule files, folder names), then propose. Reuse the repo's own folder names; add only `inbox/` and `archive/`. Repos without Git are supported. Never force GitHub, Node, Obsidian or any tool. Never install a missing tool or log in for the user. Updating a tool the user already has is allowed only through `tools`, under the rules below. Offer a host feature only when the remote is that host and its CLI is logged in there.
- **Plain words for every user.** Everything a user reads (skill, command output, briefing, generated pages, README) is written for non-technical, non-native English readers: what it does, the intention and why, briefly. Internal terms never reach users without plain words.
- **Two front doors:** a new repo gets the Starter kit. An existing repo gets detected, mapped, and organized through one plan the user approves after seeing before, after and why.
- **Guidance stays current.** Claims about Claude Code, Codex and models live in `guidance/`, dated, sourced and refreshed. Never state a vendor fact from memory.
- **Measure, then add.** Add a piece only after a measured gap. Success is the fixture outcome scores, not only "nothing broke". Keep the always-loaded core block small.

## Rules for changing other repos

- Read first: `detect`, then `audit`. Both are read-only.
- Changes go through `apply` (dry run, diff, backup, receipt, undo). Each change needs the user's yes to what they saw: one plan (before, after and why) or one batch. A standing rule the user approved ("screenshots go to `docs/screenshots/`") may file matching inbox items alone, with a receipt line and undo.
- Moves and archives happen only inside an approved plan, batch or standing rule. Code, and files the code loads, never move. Merging the text of notes always asks. Nothing is ever deleted: archive instead. Secrets and big files are never automated. Adding a remote goes only through `connect`: an empty private repo, never a push.
- Updating a tool goes only through `tools --update ... --apply`, runs only the tool's own updater, and happens without asking only if the user opted in with `prefs` and the need is real.
- Respect a repo's own rules. Example: a repo that says "commit only when asked" runs with `--autosave off --hooks brief` and without the core rules block.
- Do not save audit or detect output about real repos here. This repo may become public.

## How to work here

- Branch `dev`. The user's branch guard blocks commits on `main` and `master`. Commit locally. Never push unasked.
- Node only, no dependencies. Test on throwaway copies. A pilot on a real repo needs the user's approval for the exact files.
- Before you commit: run `node --test` (no dependencies, about 40 seconds). Every bug you fix gets a test that fails without the fix. Then update README, CHANGELOG and the guidance if the change touches them.
- Reports go in `claudedocs/`.

## Where things are

| Path | What |
|---|---|
| `bin/repo-fit.mjs` | The command: `init`, `status`, `update`, `detect`, `audit`, `apply`, `skip`, `undo`, `connect`, `tools`, `prefs`, `guidance check` |
| `lib/` | `detect`, `audit`, `adapt` (what a repo already has: own checks, hooks, caps, protected paths, rule conflicts), `apply`, `core` (renders the core block with the repo's paths), `connect`, `tools`, `versions`, `prefs`. Not copied into repos |
| `scripts/playbook/` | `brief`, `check`, `autosave`, `lib`. Copied into every repo, version-stamped |
| `kits/` | Starter kit and per-tool files |
| `core/AGENTS.core.md` | The managed rules block |
| `guidance/` | Dated notes from official sources, and the refresh routine |
| `SKILL.md` | The setup interview (at the root, so `npx skills add` installs the whole tool as one skill) |
| `claudedocs/` | Research reports and the search data behind them |
| `dev/` | Maintainer tools, not shipped: `transcript-check` (live runs), `fixtures`, `score` and `measure` (outcome scores on synthetic test folders; `node dev/measure.mjs --ref 3fed971` is the 0.6.0 starting score) |
