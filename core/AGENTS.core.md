<!-- playbook:core v{{version}} begin (managed by repo-fit: change it there, not in this block) -->
## Core rules

**The repository is the shared memory.** Codex, Claude Code and people read the same files. A chat is invisible to the others, so anything worth keeping is written here. Source order: current instructions, then {{#board}}the board and {{/board}}dated evidence, then artifacts and receipts, then the live system, then tool memory (orientation only). If memory and repository disagree, follow the repository and say so.

### Start of every session
1. Run `git status --short` and `git branch --show-current`. Fresh Git facts beat any saved note.
2. {{#scripts}}Read the session brief. Hooks print it where the tool supports them; otherwise run `node scripts/playbook/brief.mjs --text`. Tell the user its top lines in 3 to 5 lines. {{/scripts}}Read {{#current}}`{{current}}` and the notes it links{{/current}}{{^current}}the notes{{/current}} for the topic.
3. {{#decisions}}Read `{{decisions}}` before proposing anything that could conflict with an agreed choice.{{/decisions}}

### Search before saying "unknown"
Search {{#people}}`{{people}}` and {{/people}}the whole repository (every spelling, Arabic too) before saying a person, fact or earlier discussion is unknown. Say what you searched. A missing record may mean it was said in a chat that was never saved: say so and ask.

### Capture by default
Capture without being asked: after a meaningful moment, before switching topics and before ending.
1. Exact wording of direction, corrections and approvals goes to {{#own_inputs}}`{{inputs}}`, saved the way this repo's own rules above say{{/own_inputs}}{{^own_inputs}}{{#inputs}}`{{inputs}}YYYY-MM-DD-topic.md`{{/inputs}}{{^inputs}}a dated source file (name its folder as `inputs` under `paths` in `playbook.json`){{/inputs}}{{/own_inputs}} (speaker, date, channel).
2. Update the topic note, or start one{{#template}} from `{{template}}`{{/template}} and list it in its folder README.
3. {{#board}}Board: add, move or close {{#own_board}}items{{/own_board}}{{^own_board}}rows{{/own_board}} in `{{board}}`. {{/board}}{{#questions}}Questions go to `{{questions}}`, one question in one place.{{/questions}}
4. {{#current}}`{{current}}`: update the topic block (word cap in `playbook.json`). {{/current}}{{#log}}`{{log}}`: add one dated line, newest first.{{/log}}
5. {{#own_checks}}Run this repo's own checks ({{own_checks}} and the others its rules name), then commit as its rules say.{{/own_checks}}{{^own_checks}}{{#scripts}}Run `node scripts/playbook/check.mjs`. {{/scripts}}Commit.{{/own_checks}} Say "saved" only after the commit exists.

### Absorb, do not just file
Save the source. Start at the topic's hub (its folder README, or the hubs folder named under `paths` in `playbook.json`) and search what exists, every spelling. Merge into the existing note; make a new note only for a new topic. If input repeats a known point, add the new source and date. If it contradicts one, keep both with dates, mark the conflict and add {{#board}}a board row{{/board}}{{^board}}an open question{{/board}}; only the owner resolves it. Label every point: fact, reported, hypothesis, idea or decision. Check primary sources for claims a decision depends on. Report back in 2 or 3 lines: what is new, what merged, which conflicts, which questions.{{#scripts}} The session brief's review queue lists notes nothing links to, notes untouched for a long time and notes past their `review_after` date: link, merge, archive or re-date them when you touch that topic.{{/scripts}}

{{#board}}### Board
{{#own_board}}`{{board}}` keeps this repo's own format: add, move or close items there, the way it already does. Finish every open item before saying a long task is done.{{/own_board}}{{^own_board}}{{#own_status}}`{{board}}` holds tasks and ideas; where status lives follows this repo's own rules above.{{/own_status}}{{^own_status}}`{{board}}` is the only place status lives.{{/own_status}} One row per task, job, question or idea, with a stable ID. Statuses: inbox, clarified, active, parked, blocked, done. Every open row has an owner and a next step. `active` and `blocked` rows also need evidence links and a verified date. A row is stale when its evidence changed after that date: re-check it before trusting it. Finish every open row before saying a long task is done.{{/own_board}}

{{/board}}### Approval
{{#own_decisions}}A decision is binding only as this repo's own decision rules above define it{{#decisions}} (`{{decisions}}`){{/decisions}}.{{/own_decisions}}{{^own_decisions}}A decision is binding only when recorded in {{#decisions}}`{{decisions}}`{{/decisions}}{{^decisions}}the repository{{/decisions}} with who decided and their words.{{/own_decisions}} Capturing an idea approves nothing. A passing check approves nothing. Never invent attendees, owners, dates or agreements. Ask first before: recording a decision without the owner's words, pushing, deploying, sending anything outside the repo, buying, deleting source material or history.

### Commits and branches
Stage only intended files. Never push unasked. {{#own_main}}Which branch to commit on follows this repo's own rules above. {{/own_main}}{{^own_main}}Never commit on `main` or `master`. {{/own_main}}{{#own_commits}}When to commit follows this repo's own rules above; autosave stays off unless they allow it.{{/own_commits}}{{^own_commits}}{{#scripts}}Autosave (see `playbook.json`) commits allow-listed paths to a `wip/<date>-<tool>` branch with a `Host:` trailer; the owner merges or squashes.{{/scripts}}{{/own_commits}}

### Keep this block small
Add a rule only after a measured gap. Model and tool tips expire, so they live in the playbook's guidance layer, not here. Repo-specific rules go outside this block.
<!-- playbook:core end -->
