# Field fixes 0.8.0 and 0.9.0: checklist

Stream `repo-fit-field-fixes` (one-repo). Plan: one-repo `claudedocs/2026-10-25-repo-fit-field-report-plan.md`.
Worktree branch `ClaudeCode-Desktop-/field-fixes-0-8-0-9-910293`, from `main` at `ae0b67f` (0.7.3).
Rules: test first, synthetic fixtures only, local commits only. VERSION bump, push, tag and npm wait for Jimmy.

## 0.8.0 safety and privacy

- [x] S1 snapshot on a private ref (`refs/repo-fit/snapshots/<time>-<random>`), temp index, branch/index/files untouched; receipts record the ref; undo points to it; "already saved" when every pending path matches the newest snapshot on HEAD
- [x] S2 🛟 line names files (first 10, folders grouped) and flags untracked private-looking folders or folders the rules say never to commit; `apply --ignore` offered, and what it ignores is never saved in the snapshot first (found in the live run)
- [x] S3 map leaves out Git-ignored files (areas, index pages, open work, loose, off-index, nothing-links-to)
- [x] S4 MAP.md open work: count and `map.mjs --open` only
- [x] S5 pointer names README.md when MAP.md is ignored; audit offers D-11 again; status warns
- [x] S6 status says what it did not check
- [x] S7 rule-file edits list other worktrees and unmerged branches that touch AGENTS.md/CLAUDE.md, plus the restart line
- [x] S8 lint-clean scripts and a no-dependency lint test
- [x] S9 steps left out of the chosen set recorded as skipped; "wrote N" explains files already in place; SKILL.md stops after install-only
- [x] Docs: AGENTS.md 5 Oct rule, SKILL.md, INSTALL.md, README, CHANGELOG, HELP text
- [x] `node --test` (275/275), `node dev/measure.mjs` (same as 0.7.3 on every row), live run on a throwaway synthetic fixture
- [x] Fresh Opus review of S1 and S7. Fixed, each with a test that failed first: `--ignore ./x/` prefix, a path staged then deleted, an ignored file added with `-f`, a Git repo inside the folder, a subfolder of a repo as the target, a link saved twice, a tag with a branch's name. Git errors now stop the run with nothing changed
- [ ] Local commit, report to hub

## 0.9.0 organize inside the folders

⏳ Scope question sent to the hub: the plan was revised to D1-D8 (a deep pass that moves documents), while the brief said report-only D1-D5. Build waits for the answer.
