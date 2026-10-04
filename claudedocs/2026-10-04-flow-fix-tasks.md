# Flow fix: show, then ask once (4 Oct 2026)

From `2026-10-04-usefulness-audit.md`, section 7, "First: the flow". Tick as done.

- [x] Audit computes a **recommended set** by repo kind, with the exact `apply` flags, shown at the top of the report
- [x] `repo-fit preview <repo>`: prints the session brief the repo would get, writes nothing
- [x] Brief: no "board is missing" line when the repo did not adopt a board; show recent commits instead
- [x] `detect` stops seeding out-of-scope questions (host files) and the tools question when tools are detected
- [x] Rewrite `SKILL.md`: look, show, ask once, apply. Question budget of 3, scope fence, no models question
- [x] Mirror the flow in `INSTALL.md`; update README, `docs/reference.md`, CHANGELOG
- [x] Tests for each code change (fail without the fix), then `node --test`
- [x] Local commit on `dev`

## Found on the way

- [x] Recommended flags ignored `autosave: false` already in `playbook.json` (found on a real repo, read-only)
- [x] `preview` said "start with today" in a repo without the brief script
- [ ] Later: quieter review queue: the brief's review queue is noisy in repos with many small unlinked files; consider leaving it out for code repos

## Batch 2: shrink the rules block (audit items 7, 8, 10)

- [x] Core block rewritten: 293 words, after the repo's rules, "the rules above win", no branch/commit/check/board-format rules
- [x] Conflicts section and defer machinery removed; repo rules still drive flags and "Leave as is"
- [x] Brief: no imposed main-branch line
- [x] False findings: example lines, kit/starter folders, media rule for one image
- [x] Tests rewritten and added; docs and CHANGELOG
- [ ] Open: F19 "work happens off main" still scores branch practice (item 6, the score)
- [ ] Open: onboarding eval (item 9), quieter review queue, VERSION bump and release
