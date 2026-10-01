# repo-fit · Working agreements for every assistant

A small, balanced foundation for any repository, technical or notes, for Claude Code and Codex. Version is in `VERSION`. Maintainer: Jimmy Sadek. Read [README.md](README.md) for the commands and [CHANGELOG.md](CHANGELOG.md) for what changed.

## Scope guard (the maintainer's decisions, 29 Sep 2026)

- **A foundation, not a second brain.** No semantic search, wiki, graph or memory database. Never claim more than the scripts really do. Keep the wording modest.
- **Two front doors:** a new repo gets the Starter kit. An existing repo gets detected, audited and adopted step by step, and adapts to what it already has.
- **Adaptability is core.** Detect the machine and the repo first (CLIs, logins, Git host, existing tools and rule files), then offer, then ask. Never force GitHub, Node, Obsidian or any tool. Never install a missing tool or log in for the user. Updating a tool the user already has is allowed only through `tools`, under the rules below. Offer a host feature only when the remote is that host and its CLI is logged in there.
- **Guidance stays current.** Claims about Claude Code, Codex and models live in `guidance/`, dated, sourced and refreshed. Never state a vendor fact from memory.
- **Add a piece only after a measured gap.** Keep the always-loaded core block small.

## Rules for changing other repos

- Read first: `detect`, then `audit`. Both are read-only.
- Changes go through `apply` (dry run, diff, backup, receipt, undo). Each step needs the user's yes to that exact dry run.
- Moves, deletes, secrets and big files are never automated. Adding a remote goes only through `connect`: an empty private repo, never a push.
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
| `bin/repo-fit.mjs` | The command: `init`, `status`, `update`, `detect`, `audit`, `apply`, `undo`, `connect`, `tools`, `prefs`, `guidance check` |
| `lib/` | `detect`, `audit`, `apply`, `core` (renders the core block with the repo's paths), `connect`, `tools`, `versions`, `prefs`. Not copied into repos |
| `scripts/playbook/` | `brief`, `check`, `autosave`, `lib`. Copied into every repo, version-stamped |
| `kits/` | Starter kit and per-tool files |
| `core/AGENTS.core.md` | The managed rules block |
| `guidance/` | Dated notes from official sources, and the refresh routine |
| `skill/repo-fit/SKILL.md` | The setup interview |
| `claudedocs/` | Research reports and the search data behind them |
