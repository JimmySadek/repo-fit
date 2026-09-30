<!-- playbook:core v{{version}} begin (managed by repo-fit: change it there, not in this block) -->
## Core rules

**The repository is the shared memory.** Codex, Claude Code and people read the same files. A chat is invisible to the others, so anything worth keeping is written here. Source order: current instructions, then the board and dated evidence, then artifacts and receipts, then the live system, then tool memory (orientation only). If memory and repository disagree, follow the repository and say so.

### Start of every session
1. Run `git status --short` and `git branch --show-current`. Fresh Git facts beat any saved note.
2. Read the session brief. Hooks print it where the tool supports them; otherwise run `node scripts/playbook/brief.mjs --text`. Tell the user its top lines in 3 to 5 lines. Then read `docs/00-home/current.md` and the notes it links for the topic.
3. Read `docs/decisions.md` before proposing anything that could conflict with an agreed choice.

### Search before saying "unknown"
Search `docs/00-home/people.md` and the whole repository (every spelling, Arabic too) before saying a person, fact or earlier discussion is unknown. Say what you searched. A missing record may mean it was said in a chat that was never saved: say so and ask.

### Capture by default
Capture without being asked: after a meaningful moment, before switching topics and before ending.
1. Exact wording of direction, corrections and approvals goes to `docs/sources/founder-input/YYYY-MM-DD-topic.md` (speaker, date, channel).
2. Update the topic note, or start one from `docs/templates/note.md` and list it in its folder README.
3. Board: add, move or close rows in `docs/00-home/board.md`. Questions go to `open-questions.md`, one question in one place.
4. `current.md`: update the topic block (word cap in `playbook.json`). `log.md`: add one dated line, newest first.
5. Run `node scripts/playbook/check.mjs`. Commit. Say "saved" only after the commit exists.

### Absorb, do not just file
Save the source. Search what exists. Merge into the existing note; make a new note only for a new topic. If input repeats a known point, add the new source and date. If it contradicts one, keep both with dates, mark the conflict and add a board row; only the owner resolves it. Label every point: fact, reported, hypothesis, idea or decision. Check primary sources for claims a decision depends on. Report back in 2 or 3 lines: what is new, what merged, which conflicts, which questions.

### Board
`docs/00-home/board.md` is the only place status lives. One row per task, job, question or idea, with a stable ID. Statuses: inbox, clarified, active, parked, blocked, done. Every open row has an owner and a next step. `active` and `blocked` rows also need evidence links and a verified date. A row is stale when its evidence changed after that date: re-check it before trusting it. Finish every open row before saying a long task is done.

### Approval
A decision is binding only when recorded in `docs/decisions.md` with who decided and their words. Capturing an idea approves nothing. A passing check approves nothing. Never invent attendees, owners, dates or agreements. Ask first before: recording a decision without the owner's words, pushing, deploying, sending anything outside the repo, buying, deleting source material or history.

### Commits and branches
Stage only intended files. Never push unasked. Never commit on `main` or `master`. Autosave (see `playbook.json`) commits allow-listed paths to a `wip/<date>-<tool>` branch with a `Host:` trailer; the owner merges or squashes.

### Keep this block small
Add a rule only after a measured gap. Model and tool tips expire, so they live in the playbook's guidance layer, not here. Repo-specific rules go outside this block.
<!-- playbook:core end -->
