# Adapt-first release (0.5.0): task list

Goal: repo-fit assesses a repo first, then walks the user through what to **improve** and what to **leave as is**, and adapts its own pieces to what the repo already does. Source: a setup brief of 1 Oct 2026 (Parts A to D) from adopting a mature notes repo, on top of 0.4.1.

Rules: never `--apply` against the real test repo; edit only repo-fit; a test for every fix; full suite before commit.

## Audit: assess, then sort

- [x] C5 word cap: also read playbook.json `currentWordCap` and a cap in the repo's own check scripts (`CURRENT_MAX_WORDS = 1200` style)
- [x] C7 new status `equivalent` (🔁), counted as in place; verdict shows it separately; the board becomes optional
- [x] C3 F16: documented policy (README heading or Git LFS), tracked vs ignored vs loose
- [x] B1 protected paths: `protectedPaths` in playbook.json + append-only/read-only wording in rule files + delivered outputs; listed only
- [x] D2 orphans: skip dot folders, templates, nested rule files (audit and review queue agree)
- [x] C6 existing hooks and check scripts detected; A-10 becomes a decision with "repo already has"
- [x] A2 conflicts between the core block and the repo's rules (checks, commits, decisions, inputs, status, word cap)
- [x] Audit report: "Leave as is" and "Conflicts" sections before "Plan: worth improving"

## Apply, status, update

- [x] A1 block paths from the mapping (0.4.1), plus `scripts` only when present
- [x] A2 slim core block: a topic the repo covers defers to the repo's rule
- [x] B2 dry run prints new file contents (config in full, others 12 lines, vendored scripts one line, `--show` for all)
- [x] C4 `adopted` / `hooks` in playbook.json; `update` only manages adopted parts; `status` lists not-adopted and skipped; `skip` command
- [x] D1 recorders: copy the repo's own list; owner only with `--owner`
- [x] D3 undo `--force` (moves aside, never deletes); receipts stay open while files were left in place

## Guidance and docs

- [x] D4 Codex hooks format checked against the official hooks page in a browser; SessionStart output shape fixed
- [ ] D4 one real Codex session: **deferred**, running `codex exec` from the session was not permitted. Script handed to the user
- [x] D4 no OpenAI model named in examples or recommendations
- [ ] models-openai.md refresh: **deferred**, due 6 Oct 2026, needs the OpenAI pages read in a browser
- [x] Skill: assess → walk through leave as is / conflicts / improve → decisions → record skips
- [x] README, INSTALL, AGENTS, CHANGELOG, VERSION 0.5.0

## Proof

- [x] 20 tests with a mature-repo fixture (generic names); 18 fail on 0.4.1
- [x] Full suite: 84 of 84 pass
- [x] Read-only re-run on the real repo: audit, status, D-01 and A-10 dry runs, undo dry run
