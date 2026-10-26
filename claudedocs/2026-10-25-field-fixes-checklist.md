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
- [x] Local commit (c58f8a9), report to hub

## 0.9.0 deep mode (two sweeps)

Jimmy's decisions of 25 Oct 2026: wait for 0.9.0 before any release; backlog B34465ca in; deep mode in a separate
worktree, never moving the checkout's branch; unused code deleted on the deep branch; slices A, B and C in one go with
a report after each. Design: `claudedocs/2026-10-25-deep-mode-design-note.md`.

- [x] B34465ca: `update` adds a missing CLAUDE.md to a Codex-only setup made before 0.7.3 (843dc75, test first)
- [x] Slice A, sweep 1 (documents): inventory, plan checks, screen, `--list`, `--json`, apply in a worktree on `repo-fit/deep-<date>`, one commit per step, proofs (files, links, rules, the folder's own check), take-back, yes tied to commit and plan, no second branch for the same yes
- [x] Slice A live run on a throwaway synthetic fixture set up with repo-fit: 4 issues found and fixed, each with a test that failed first (playbook.json locked docs/, index pages counted as documents, the rebuilt map tripped the link proof, an empty last step, the same yes twice)
- [x] Slice A: full `node --test`, measure, fresh review (9 findings fixed, each with a test that failed first; 2 left as is, see the design note), local commit
- [x] Slice A: report to hub
- [x] Slice B, sweep 2 read-only: project type, research-note check, built-in analysis (`lib/analyze.mjs`) plus the repo's own knip/jscpd/dependency-cruiser if installed, proof baseline (`lib/proof.mjs`), screen, `field-app` fixture
- [x] Slice B: full `node --test` (300 pass; the 5 slice C tests wait), measure unchanged, fresh review (findings fixed with tests), local commit, report to hub
- [x] Slice C, sweep 2 apply: node_modules link into the worktree (or "proof limited"), relative import rewrites, plan edits, unused code deleted, proof per step, deliberate-break check, take-back
- [x] Slice C hub additions: built-CSS proof (custom properties resolved, planned changes under `visible`), packages cloned copy-on-write with the link as fallback (Jimmy, 26 Oct), Codex F1 matcher, F3 trust wording, F2 models refresh
- [x] Slice C: two fresh reviews (14 findings fixed, each with a test that failed first; one guard left, see the design note), full `node --test`, measure
- [x] Slice C: local commit, report to hub
