# Guidance layer

The playbook's **living** part. Facts that change (tool behaviour, model names, model tips) live here, dated, and are re-checked on a schedule. They never sit inside the vendored kit or the core rules block, because they expire.

## How it works

```
sources (official docs)  →  guidance/*.md  →  setup interview reads it  →  kit choices
        ↑                         │
        └──── refresh routine ────┘   (due dates, weekly scheduled check, on demand)
```

- **One file per topic.** Each file starts with a header: `topic`, `tool`, `models`, `retrieved`, `review_after`, `confidence`, `sources`.
- **"What this changes in the kit"** is the part that matters. Every rule there says which kit choice it drives.
- **"Open checks"** lists what is not yet proven. Those are the first things to test.
- **"Changed since last review"** keeps a short history, so a refresh shows what moved.

## Confidence labels

| Label | Meaning |
|---|---|
| **primary, read** | Official page, read in full or copied verbatim |
| **primary, summary** | Official page, but only a small model's summary of it |
| **snippet** | Seen only in search-result text |
| **local** | Observed on the maintainer's machine (a config file, a command) |
| **unconfirmed** | Sources disagree or nothing checks it. Do not use it in the kit |

## Rules

1. Never state a vendor fact from memory. Read the source, note the date.
2. Prefer official docs. If a fetch returns an empty page or a summary, ask for the exact section verbatim, or read it in a real browser.
3. Mark disagreement between sources. Do not pick a side silently.
4. Fast-moving or low-confidence files get a short `review_after` (7 days). Stable, high-confidence files get 30 days.
5. A refresh may propose kit changes. It never edits a repository without approval.
6. A weekly scheduled refresh may run only steps 1 and 2 of the routine below and write a report. It never applies changes to a repo. Creating the schedule needs the user's approval.

## Refresh routine

1. `node bin/repo-fit.mjs guidance check` lists files by due date.
2. For each due file (and `gates.json`), re-read every source in its header. Update the facts, `retrieved`, `review_after` and `confidence`. Add a line under "Changed since last review".
3. Search your repositories for stale references (retired model names, removed features). List them. Do not edit them without approval.
4. If the kit should change: edit the kit, bump `VERSION`, add a line to `CHANGELOG.md`.
5. For each repo: `node bin/repo-fit.mjs update <repo>` shows the diff first. `--apply` writes it.

## Files

| File | Covers |
|---|---|
| [claude-code.md](claude-code.md) | CLAUDE.md, AGENTS.md, rules, hooks, habits in Claude Code |
| [codex.md](codex.md) | AGENTS.md discovery, hooks, best practices in Codex |
| [models-claude.md](models-claude.md) | Claude model lineup and what works best with each |
| [models-openai.md](models-openai.md) | OpenAI model lineup and Codex model guidance |
| [sources.json](sources.json) | Machine-readable list of every source URL |
| [gates.json](gates.json) | Version limits the tools check against (for example the Claude Code version that reads `AGENTS.md` directly) |
