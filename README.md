# repo-fit

**Fit any repository for work.** One small foundation for starting or tidying any repo, so work can begin at any time and nothing is dropped. Improve it here once, and every repo can pick the change up.

It has two halves:

| Half | What it is | Changes how |
|---|---|---|
| **The kit** | Files and four small scripts that go into a repo | Versioned. `update` shows a diff first |
| **The guidance layer** | Dated notes from official Anthropic and OpenAI pages: Claude Code, Codex, each model | Refreshed on a schedule. See [guidance/](guidance/README.md) |

## Get it

You need [Node.js](https://nodejs.org) 18 or later and Git. There is nothing to install: no dependencies, no build step.

```bash
git clone https://github.com/JimmySadek/repo-fit.git
cd repo-fit
node bin/repo-fit.mjs help
```

Try it on any repo. These two are read-only:

```bash
node bin/repo-fit.mjs detect /path/to/your/repo
node bin/repo-fit.mjs audit /path/to/your/repo
```

**With an AI agent:** open the repo you want to set up in Claude Code or Codex and say: *"Read INSTALL.md in the repo-fit folder at `<path to your clone>` and set up the playbook in this repository. Show me a dry run before you write anything."*

**As a Claude Code skill (optional, untested outside the maintainer's machine):** copy `skill/repo-fit` to `~/.claude/skills/repo-fit`. The skill asks where your clone is.

**Tip:** `node bin/repo-fit.mjs prefs set owner "Your Name"` sets who new repos name as owner. Without it, repo-fit uses `--owner`, then the repo's `git user.name`, then the word "Owner".

## What a repo gets

```
<repo>/
├─ README.md · AGENTS.md (managed core block) · LEARNINGS.md · playbook.json
├─ CLAUDE.md                  only if Claude Code is a chosen tool: 3 lines, imports AGENTS.md
├─ .claude/settings.json      Claude Code hooks: session brief, autosave, capture check
├─ .codex/hooks.json          Codex hooks (untested, needs /hooks trust)
├─ scripts/playbook/          brief · check · autosave · lib (vendored, version-stamped)
├─ docs/00-home/              current · board · log · open-questions · people
├─ docs/decisions.md · docs/sources/founder-input/ · docs/research/ · docs/templates/
└─ outputs/                   one folder per output, each with a README
```

## Commands

```sh
node bin/repo-fit.mjs detect <repo>                  # read-only: machine, repo, existing tools, what it would ask
node bin/repo-fit.mjs detect <repo> --json           # the same, for scripts
node bin/repo-fit.mjs audit <repo>                   # read-only report and plan for an existing repo (prints Markdown)
node bin/repo-fit.mjs audit <repo> --area docs/brand # only that area for notes, links and old documents
node bin/repo-fit.mjs audit <repo> --out report.md   # also --json; you choose where the file goes
node bin/repo-fit.mjs apply <repo> --steps A-01,A-10 --tool claude --hooks brief --autosave off   # dry run: shows every file and diff
node bin/repo-fit.mjs apply <repo> --steps A-01,A-10 ... --apply                                 # writes, backs up, writes a receipt
node bin/repo-fit.mjs undo <repo>                    # dry run; add --apply to put back what the last apply changed
node bin/repo-fit.mjs connect <repo> --host github   # no remote yet: dry run; --apply creates an EMPTY PRIVATE remote. Never pushes
node bin/repo-fit.mjs tools <repo>                   # tool versions vs the limits in guidance/gates.json; --update claude [--apply]
node bin/repo-fit.mjs prefs                          # your standing choices, kept outside repos
node bin/repo-fit.mjs prefs set owner "Your Name"     # who new repos name as owner (else --owner, else git user.name, else "Owner")
node bin/repo-fit.mjs guidance check                 # which guidance is due for a refresh
node bin/repo-fit.mjs help                           # every command
node bin/repo-fit.mjs init <repo> --dry-run --name "Name" --owner "Owner" --tool both --models claude-opus-5-5,gpt-6-sol
node bin/repo-fit.mjs status <repo>                  # is the repo behind the playbook?
node bin/repo-fit.mjs update <repo>                  # dry run: prints the diff
node bin/repo-fit.mjs update <repo> --apply          # writes it, commits nothing
```

`init` never overwrites a file, so it is safe on an existing repo. `update` manages only three things: the core block in `AGENTS.md`, the vendored scripts, and the version stamps in `playbook.json`.

**Setup by an agent:** give it [INSTALL.md](INSTALL.md) (it names the steps, the approvals and the undo). Any writing command accepts `--pin <version>`.

The setup is meant to be run through the [repo-fit skill](skill/repo-fit/SKILL.md), which asks which tools and models the repo is for, reads the matching guidance, applies the kit, and verifies it.

## The four scripts

| Script | Job | Runs |
|---|---|---|
| `brief.mjs` | Prints where things stand: branch, board (active, blocked, inbox, stale), open questions, gaps. Read-only | SessionStart hook, or by hand |
| `check.mjs` | Required files, board rules, stale rows, broken links, folder indexes, current-view word cap | By hand or in CI |
| `autosave.mjs` | Level 2 autosave of allow-listed files to a `wip/` branch, then a once-per-session reminder for anything left | Stop and PreCompact hooks, or `--report` by hand |
| `lib.mjs` | Shared helpers | Imported |

## Level 2 autosave: the rules

- Never commits on `main` or `master`. On a protected branch it switches to `wip/<date>-<tool>`.
- Commits only allow-listed paths (`playbook.json`, default `docs/**`, output READMEs, `LEARNINGS.md`). Skips secret-looking names and files over 5 MB.
- Commits with `--only`, so anything else you staged stays staged.
- Adds a `Host:` trailer naming the tool.
- Never pushes.
- The Stop hook blocks at most once per session for the same set of reasons. It does not depend on `stop_hook_active`. Claude Code's docs do not list it, though 2.1.284 was seen sending it.

## Security and privacy

- **Nothing is written without `--apply`.** Every writing command is a dry run first, backs up what it edits, writes a receipt and can be undone.
- **It never pushes, never installs a tool, never logs in for you.** `connect` can create an *empty private* remote, only after you approve the exact command.
- **What it reads:** the repo you point it at (file names and sizes, rule files, Git remotes with any password or token stripped from the URL, secret-like file *names* but never their contents); which accounts `gh` and `glab` are logged in to (never tokens); and, for `tools`, the version number in the newest Claude Code session log under `~/.claude/projects`.
- **Network:** `tools` asks npm for the latest Claude Code version when Claude Code was installed with npm (`--offline` skips it). `connect` talks to your Git host only through `gh` or `glab`; its dry run does one read-only name check. `claude update` runs only with `--update claude --apply`. Nothing else calls out.
- **Your standing choices** (`repo-fit prefs`) live in `~/.config/repo-fit/preferences.json`, outside every repo.

## Scope, in one line

A balanced foundation for **any** repo, technical or notes. **Not a second brain:** no semantic search, no wiki, no memory database. It should look at what a repo and a machine already have, adapt, and ask before using anything.

## Status (draft 0.3.2)

**Built and tested** (each writing command is a dry run first, backs up before editing, writes a receipt, and can be undone):

| Piece | What it does |
|---|---|
| `detect` | Read-only look at the machine (CLIs, `gh` and `glab` logins), the Git host, repo kind, rule files, task tools, commands, big files |
| `audit` | Read-only report on an existing repo: 19 foundation checks, a map of files it already has, and a plan (add only, then edit, move, delete or outward decisions) |
| `apply` and `undo` | Applies chosen plan steps. Adds files, links `CLAUDE.md` to `AGENTS.md` by case, drafts a Dev, test and lint section, merges hooks. Never overwrites |
| `paths` in `playbook.json` | Points each role (current view, board, log, ...) at a file the repo already has, so nothing has to move |
| `connect` | For a repo with no remote: creates an **empty private** remote after approval. Never pushes |
| `tools`, `prefs`, `guidance/gates.json` | Checks the Claude Code version that really ran in the repo against dated limits. Updates only with `--apply`, and automatically only if you opted in |
| `INSTALL.md`, `init --dry-run`, `--pin`, `help` | One file an agent can follow, a dry run for new repos, version pinning, a command list |

**Proven live:** the session-brief hook in a real Claude Code session (a studio repo), a thin `CLAUDE.md` import (a bot repo), a real private GitHub remote (on a real project, then on repo-fit itself), and the **Stop-hook autosave** in a real Claude Code 2.1.284 desktop session (a throwaway repo: it switched off a protected branch to `wip/<date>-claude-code`, committed one file with a `Host:` trailer, pushed nothing), the **Stop block** with its once-per-session guard, and the **PreCompact** autosave (it committed a file edited outside the session, just before the compact).

**Not built yet:**
- Board adapters (Backlog.md, GitHub or GitLab issues). Deferred on purpose: none of the audited repos uses one.
- Job-studio profile (creative-studio repos) and delivery profile (client-delivery repos). Today's kit is the knowledge-base profile. Repos organized differently (job folders, numbered specs, their own scripts) are adopted through the `paths` mapping (audit, then apply), which reuses the files they already have.
- Working kit and Shared kit: topic hubs, hashed source archive, identity gate, entity register, CI.
- Automatic drift detection of guidance sources. Today: dates, a weekly report-only refresh, and a manual routine.

**Not yet proven:**
- The Stop block was seen for one reason only: uncommitted files outside the autosave list. The other two (autosave failed, no log line today) were not triggered live.
- The terminal `claude` (2.1.270): its login had expired, so nothing ran there. Only 2.1.284 (desktop app) is proven.
- Everything Codex-specific (hooks, trust review). Drafted from documentation only.
- `connect` with a real GitLab host. Only the `gh` path ran for real.
- Windows and Linux.
