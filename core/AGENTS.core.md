<!-- playbook:core v{{version}} begin (managed by repo-fit: change it there, not in this block) -->
## Shared rules (repo-fit)

These add to the rules above. Where they overlap, the rules above win.

- **Write it down.** Codex, Claude Code and people share only what is in this repository. A chat is invisible to the others, so anything worth keeping goes in a file.
- **Start from the files.** {{#scripts}}If no session briefing appeared, run `node scripts/playbook/brief.mjs --text` and tell the user its top lines. {{/scripts}}{{#current}}Read `{{current}}` and the notes it links for the topic.{{/current}}{{^current}}Read the notes for the topic.{{/current}}{{#decisions}} Check `{{decisions}}` before proposing anything that could undo an agreed choice.{{/decisions}}
- **Search before saying "unknown".** Search {{#people}}`{{people}}` and {{/people}}the whole repository, every spelling, before saying a person, fact or earlier discussion is unknown. Say what you searched. A missing record may mean it was said in a chat that was never saved: say so and ask.
- **Keep what matters, without being asked.** After a decision, a correction or new direction from the owner, and before ending:{{#inputs}} save their exact words in `{{inputs}}`;{{/inputs}}{{#current}} update `{{current}}`;{{/current}}{{#board}} add, move or close items in `{{board}}`;{{/board}}{{#questions}} put open questions in `{{questions}}`;{{/questions}}{{#log}} add a dated line to `{{log}}`;{{/log}} update the topic's note. Merge into the note that exists; start a new one only for a new topic{{#template}}, from `{{template}}`{{/template}}. If new input contradicts a note, keep both with dates and flag it. Say "saved" only once it is written.
- **Never invent agreement.** A decision binds only with who decided and their words{{#decisions}}, recorded in `{{decisions}}` the way that file does it{{/decisions}}. Never invent owners, dates, attendees or agreements. Capturing an idea or passing a check approves nothing. Ask before sending anything outside the repository or deleting source material.
<!-- playbook:core end -->
