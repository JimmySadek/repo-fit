# Contributing

Thanks for looking. repo-fit is small on purpose, so the bar for a change is "a real gap, shown on a real repo".

## Before you change anything

- Read [AGENTS.md](AGENTS.md): the scope guard and the rules that never bend (dry run first, backups, receipts, undo, never push).
- Run the tests: `node --test` (no dependencies, about 40 seconds). They must stay green on macOS, Linux and Windows; CI runs all three.

## Making a change

1. Branch from `main`.
2. Every bug fix gets a test that fails without the fix. Every new behavior gets a test. Tests live in `test/` and run in a throwaway sandbox (see `test/helpers.mjs`).
3. If you change a vendored script (`scripts/playbook/`) or the core block (`core/AGENTS.core.md`), bump `VERSION` and say so in `CHANGELOG.md`: adopted repos will show "behind" until they run `update`. A release bumps `VERSION`, `package.json` and `.claude-plugin/plugin.json` together; merging it into `main` publishes it to npm by itself (`.github/workflows/publish.yml`, npm trusted publishing, no token). The release and adds an entry to `repoFit.releases` in `package.json`: plain words on why it matters, and `important: true` only when people should hear about it in their briefing.
4. If you change `SKILL.md` or `INSTALL.md`, run `/repo-fit` once on a sample repo and check the run: `node dev/transcript-check.mjs <session.jsonl>` (see the Tests section of `docs/reference.md`).
5. Keep the README honest: say "untested" when something is untested, and never invent numbers.
6. Open a pull request. Say what you checked and how.

## Good first contributions

- Run it on a kind of repo the maintainer does not have (Codex, GitLab, Windows by hand) and report what happened.
- A report of a real gap, with the repo shape that shows it, is worth as much as code.
