# repo-fit: technical reference

The [README](../README.md) is written for non-technical readers. This page has everything else: commands, scripts, how repo-fit adapts to a repo that already has its own system, the review queue, autosave rules, security details, tests, and what is not built yet.

Vocabulary used below: a **dry run** shows what a command would do and writes nothing; `--apply` makes the change (with a backup and a receipt); **the core block** is the managed section of rules repo-fit keeps in `AGENTS.md`; **vendored scripts** are the four small files copied into a repo under `scripts/playbook/`.

Status, as it stood on 30 Sep 2026: automated tests green on macOS and Linux; on Windows two tests failed on line endings and were fixed the same day. Since then, all nine CI jobs (three systems, Node 18, 20, 22) pass.

## Get it

You need [Node.js](https://nodejs.org) 18 or later. Nothing else: no dependencies, no build step.

**As a skill (recommended).** `SKILL.md` sits at the root, so the skills installer takes the whole tool as one skill:

```bash
npx skills add JimmySadek/repo-fit -g -a claude-code codex -y   # install for both tools, for your user
npx skills update -g -y                                          # later: update
```

The skill runs the tool from its own folder (`$SKILL_DIR/bin/repo-fit.mjs`). If you keep the skill and the tool in different places, tell it where the tool is once: `node bin/repo-fit.mjs prefs set home /path/to/repo-fit`.

**From npm**, without installing anything (needs Node.js):

```bash
npx repo-fit help           # every command
npx repo-fit audit .        # read-only report on the current folder
```

Every command below works the same way: replace `node bin/repo-fit.mjs` with `npx repo-fit`.

**As a clone**, to run commands yourself:

```bash
git clone https://github.com/JimmySadek/repo-fit.git
cd repo-fit
node bin/repo-fit.mjs help
```

Three read-only commands to start with: `detect <repo>` (what the machine and the repo have), `audit <repo>` (a report and a plan for an existing repo, opening with the **recommended set** for its kind) and `preview <repo>` (the session briefing that set would give).

**Through any AI agent without the skill:** say *"Read INSTALL.md in the repo-fit folder at `<path>` and set up this project. Show me a dry run before you write anything."*

**Tip:** `node bin/repo-fit.mjs prefs set owner "Your Name"` sets who new repos name as owner. Without it, repo-fit uses `--owner`, then the repo's `git user.name`, then the word "Owner".

## What a repo gets

```
<repo>/
├─ README.md · AGENTS.md (short shared rules block) · LEARNINGS.md · playbook.json
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
node bin/repo-fit.mjs detect <repo>                  # read-only: machine, repo, existing tools, what it would offer
node bin/repo-fit.mjs detect <repo> --json           # the same, for scripts
node bin/repo-fit.mjs audit <repo>                   # read-only report and plan for an existing repo (prints Markdown)
node bin/repo-fit.mjs preview <repo>                 # read-only: the session briefing the recommended set would give
node bin/repo-fit.mjs hooks <repo> --apply           # turn on the start-of-session briefing; the person runs this, not the assistant
node bin/repo-fit.mjs audit <repo> --area docs/brand # only that area for notes, links and old documents
node bin/repo-fit.mjs audit <repo> --out report.md   # also --json; you choose where the file goes
node bin/repo-fit.mjs apply <repo> --steps A-01,A-10 --tool claude --hooks brief --autosave off   # dry run: shows every file and diff
node bin/repo-fit.mjs apply <repo> --steps A-01,A-10 ... --apply                                 # writes, backs up, writes a receipt
node bin/repo-fit.mjs apply <repo> --steps A-01 --word-cap 1500 ...                             # a cap for the current view, if the repo has none written down
node bin/repo-fit.mjs skip <repo> D-01 --reason "our rules cover it"                      # dry run; --apply records it in playbook.json
node bin/repo-fit.mjs undo <repo>                    # dry run; add --apply to put back what the last apply changed
node bin/repo-fit.mjs undo <repo> --force --apply    # also takes back files you changed since; your version is kept in .playbook/undone/
node bin/repo-fit.mjs connect <repo> --host github   # no remote yet: dry run; --apply creates an EMPTY PRIVATE remote. Never pushes
node bin/repo-fit.mjs tools <repo>                   # tool versions vs the limits in guidance/gates.json; --update claude [--apply]
node bin/repo-fit.mjs prefs                          # your standing choices, kept outside repos
node bin/repo-fit.mjs prefs set owner "Your Name"     # who new repos name as owner (else --owner, else git user.name, else "Owner")
node bin/repo-fit.mjs guidance check                 # which guidance is due for a refresh
node bin/repo-fit.mjs help                           # every command
node bin/repo-fit.mjs init <repo> --dry-run --name "Name" --owner "Owner" --tool both --models claude-opus-5-5
node bin/repo-fit.mjs status <repo>                  # is the repo behind the playbook?
node bin/repo-fit.mjs update <repo>                  # dry run: prints the diff
node bin/repo-fit.mjs update <repo> --apply          # writes it, commits nothing
```

`init` never overwrites a file, so it is safe on an existing repo. `update` manages only what the repo adopted: the core block (when `AGENTS.md` has it), the vendored scripts (when `scripts/playbook/` exists) and the version stamps in `playbook.json`. It never adds a part; `status` lists missing parts as "not adopted" or "skipped on purpose" (`repo-fit skip`), not as "behind". The core block is written with the repo's own paths (see `paths` below), so it never names a file the repo does not have.

**Setup by an agent:** give it [INSTALL.md](../INSTALL.md) (it names the steps, the approvals and the undo). Any writing command accepts `--pin <version>`.

The setup is meant to be run through the [repo-fit skill](../SKILL.md), which asks which tools and models the repo is for, reads the matching guidance, applies the kit, and verifies it.

## The four scripts

| Script | Job | Runs |
|---|---|---|
| `brief.mjs` | Prints where things stand: branch, board (active, blocked, inbox, stale), open questions, the review queue, gaps. Read-only | SessionStart hook, or by hand |
| `check.mjs` | Required files, board rules, stale rows, broken links, folder indexes, current-view word cap (the body only: frontmatter does not count), the review queue (as warnings) | By hand or in CI |
| `autosave.mjs` | Level 2 autosave of allow-listed files to a `wip/` branch, then a once-per-session reminder for anything left | Stop and PreCompact hooks, or `--report` by hand |
| `lib.mjs` | Shared helpers | Imported |

## Adapting to a repo that already has its own system

On an existing repo, `audit` assesses first and then sorts what it found:

- **Leave as is:** what the repo already covers in its own way. Its own check scripts and hooks, a word cap or recorder list in its scripts, a decision lifecycle (`decisions/proposed`, `accepted`), how it saves raw input, a written big-files policy, and work tracked in the current view instead of a board (🔁, counted as in place).
- **The shared rules block** (D-01, A-11) is about 300 words and goes **after** the repo's own rules. It says "where they overlap, the rules above win", names the repo's own files, and has no rule about branches, commits, checks or board format. So there is nothing to negotiate: the repo keeps one definition of done. The repo's commit rules still set the recommended flags (autosave off).
- **Protected paths:** folders the rules call append-only or read-only, `protectedPaths` in `playbook.json`, and delivered outputs. Findings inside are listed only, never offered for fixing, moving or archiving.
- **Worth improving:** the plan. A-10 becomes a decision when the repo runs its own hooks or checks. A-01 copies the repo's own word cap and recorder list.

`repo-fit skip <repo> <ID> --reason "..."` records a step you leave out on purpose, so `audit`, `status` and `update` stop offering it. The detection is pattern matching on rule files and scripts, so every finding quotes the line it came from: check it before you rely on it.

## Updates: how people learn about them

- **The briefing** shows one line when a newer release is marked important, with why it matters, once a day at most (see Security and privacy). Release notes live in `package.json` under `repoFit.releases` (`version`, `important`, `why`, `news`, `steps`), so npm carries them; `status` and `update` read the same list.
- **The Claude Code plugin** (`.claude-plugin/plugin.json` and `marketplace.json` in this repo): users add the marketplace with `/plugin marketplace add JimmySadek/repo-fit`, install `repo-fit@repo-fit`, and can switch on auto-update in `/plugin`. It is off by default, per Claude Code's design.
- **A release** bumps `VERSION`, `package.json` and `.claude-plugin/plugin.json` together, and adds a `repoFit.releases` entry. A test fails if any of these is missing. Merging it into `main` publishes it: `.github/workflows/publish.yml` runs the tests, publishes with npm trusted publishing (no stored token; set up once in the package settings on npmjs.com, workflow `publish.yml`), and tags `v<version>`. A version already on npm is skipped.

## Turning on the briefing, and upgrading an older setup

**The briefing is turned on by the person.** It runs from hook files (`.claude/settings.json`, `.codex/hooks.json`) that start a command at every session. Claude Code's auto mode, the default since 2.1.283, blocks an assistant from writing them as self-modification. So the recommended set adds the scripts with `--hooks none`, and the person runs `repo-fit hooks <repo> --apply` (a dry run without `--apply`). It merges with hooks already there, records the mode in `playbook.json`, writes a receipt, and `undo` turns it off. `--hooks brief` (the default when autosave is off) turns on the briefing and the end-of-reply reminder: when files changed but no Markdown file did, the Stop hook asks the assistant once per session whether anything is worth writing down, and never asks it to commit. `--hooks all` adds autosave; the default follows `autosave` in `playbook.json`.

**An older setup** (a repo with `playbook.json` from an earlier version): `status` and `update` list what is new since its version in plain words, and any step it skipped that has changed since, quoting the old reason ("worth a second look"). The skill shows these, asks once, then runs `update --apply` and the recommended set. The plain-word notes live in `RELEASES` in `lib/versions.mjs`: add an entry with every release that changes what a repo gets.

## Connecting the dots: the review queue

Adopted from the maintainer's own knowledge repos, where it is the part that keeps notes from going stale. No database, no search index, no vendor.

- **The keep-what-matters rule** (in the shared rules block): search every spelling, merge into the note that exists, keep contradicting input with dates and flag it, then update the current view, board, questions and log the repo has.
- **The hub** is the folder README that lists every note beside it (`check` enforces the listing). A repo that already has a hubs folder gets it mapped under `paths.hubs`.
- **The review queue**, in every session brief and in `check` as warnings: notes nothing links to, notes untouched for `staleNoteDays` (default 180) with no planned review, and notes whose `review_after: YYYY-MM-DD` date has passed. Archives, outputs, templates (`templates/`, `template/`, `_template/`, `kits/`, `starter/` and similar) and folder READMEs are left out. `reviewIgnore` takes extra globs. Wiki-style `[[links]]` count.
- **Not built, by design:** an AI checker that reads the *meaning* of new input and asks whether it repeats or contradicts a note. The maintainer's repos do that with a paid vendor. Here the assistant makes that judgment itself while absorbing, so nothing in a session is lost; what is missing is an automated second opinion outside a session. It would fit as an optional add-on later.

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
- **One side effect to know about:** to see what is installed, `detect` runs `--version` on the tools it looks for (git, gh, glab, node, python3, jq, claude, codex, gemini and a few more) and `auth status` on `gh` and `glab`. repo-fit writes nothing itself, but some of those tools create their own config or temp files in your home folder when they run. The tests saw `glab` and `gemini` do this.
- **Network:** once a day, the session brief asks npm for the latest repo-fit release (`registry.npmjs.org/repo-fit/latest`: the package name only, no file, 2-second limit) and caches the answer in `~/.config/repo-fit/update-check.json`. It shows a line only when a newer release is marked important, and stays silent offline. Off with `repo-fit prefs set updateCheck off` or `REPO_FIT_UPDATE_CHECK=off`. `tools` asks npm for the latest Claude Code version when Claude Code was installed with npm (`--offline` skips it). `connect` talks to your Git host only through `gh` or `glab`; its dry run does one read-only name check. `claude update` runs only with `--update claude --apply`. Nothing else calls out.
- **As a Claude Code plugin,** the repo's `bin/` folder is on the assistant's command path while the plugin is enabled (Claude Code puts a plugin's `bin/` there). claude.ai and Cowork do not install plugins that have a `bin/` folder; use the skill there.
- **Your standing choices** (`repo-fit prefs`) live in `~/.config/repo-fit/preferences.json`, outside every repo.

## Tests

```bash
node --test
```

120 automated tests, no dependencies. They run in a throwaway sandbox (a fake home folder, so nothing depends on your machine) and cover: every command on new and existing repos, dry runs writing nothing, undo, the safety rules (never overwrite, a token in a remote URL never printed), the session brief, autosave and the Stop and PreCompact hooks, and the stale-guidance warning. Each past bug has a test that fails without its fix.

**The setup contract** (`test/onboarding.test.mjs`): on a code, a notes, a mixed and a mature repo, the recommended set has no move, delete or outward step, applies in one go, leaves `check` passing and the brief without errors, and is not offered again afterwards.

**Live runs** cannot be tested without a model, so they are checked from the transcript. After running `/repo-fit` in Claude Code:

```bash
node dev/transcript-check.mjs ~/.claude/projects/<folder>/<session-id>.jsonl
```

It counts the questions after the last `/repo-fit`, flags any over 3 and any about things repo-fit does not change (CI, deploys, big files, models), and flags any write (`--apply`, or `init` without `--dry-run`) with no answer from the user after the last dry run. Read-only; `dev/` is not shipped to npm.

A GitHub Actions workflow (`.github/workflows/test.yml`) runs them on macOS, Linux and Windows with Node 18, 20 and 22. First run, 30 Sep 2026: **macOS and Linux green** on all three Node versions. **Windows failed 2 of 43** for one reason, Windows line endings in the guidance dates. That is fixed, but the Windows job is still allowed to fail until a run confirms it.

## Scope, in one line

A balanced foundation for **any** repo, technical or notes. **Not a second brain:** no semantic search, no wiki, no memory database. It should look at what a repo and a machine already have, adapt, and ask before using anything.

## Status (beta, 0.6.0)

**Built and tested** (each writing command is a dry run first, backs up before editing, writes a receipt, and can be undone):

| Piece | What it does |
|---|---|
| `detect` | Read-only look at the machine (CLIs, `gh` and `glab` logins), the Git host, repo kind, rule files, task tools, commands, big files |
| `audit` | Read-only report on an existing repo. It opens with the **recommended set** for its kind (code: briefing, one rulebook, its commands; notes: also a current view and a board), with the exact `apply` command. Then 19 foundation checks, a map of files it already has, and the full plan |
| `preview` | Read-only: runs the session brief against the repo as the recommended set would leave it, so the user sees the result before saying yes |
| `apply` and `undo` | Applies chosen plan steps. Adds files, links `CLAUDE.md` to `AGENTS.md` by case, drafts a Dev, test and lint section, merges hooks. Never overwrites |
| `paths` in `playbook.json` | Points each role (current view, board, log, ...) at a file the repo already has, so nothing has to move. The core block names these paths and leaves out a role the repo does not have. A role can point at any file, for example `paths.people` at a JSON register. The audit also finds a people or entity register (`people.json`, `entity-register/registry.json` and similar), a note template and a raw-input folder |
| `connect` | For a repo with no remote: creates an **empty private** remote after approval. Never pushes |
| `tools`, `prefs`, `guidance/gates.json` | Checks the Claude Code version that really ran in the repo against dated limits. Updates only with `--apply`, and automatically only if you opted in |
| `INSTALL.md`, `init --dry-run`, `--pin`, `help` | One file an agent can follow, a dry run for new repos, version pinning, a command list |

**Proven live:** the session-brief hook in a real Claude Code session (a studio repo), a thin `CLAUDE.md` import (a bot repo), a real private GitHub remote (on a real project, then on repo-fit itself), and the **Stop-hook autosave** in a real Claude Code 2.1.284 desktop session (a throwaway repo: it switched off a protected branch to `wip/<date>-claude-code`, committed one file with a `Host:` trailer, pushed nothing), the **Stop block** with its once-per-session guard, and the **PreCompact** autosave (it committed a file edited outside the session, just before the compact).

**Not built yet:**
- Board adapters (Backlog.md, GitHub or GitLab issues). Deferred on purpose: none of the audited repos uses one.
- Job-studio profile (creative-studio repos) and delivery profile (client-delivery repos). Today's kit is the knowledge-base profile. Repos organized differently (job folders, numbered specs, their own scripts) are adopted through the `paths` mapping (audit, then apply), which reuses the files they already have.
- Shared kit: hashed source archive, identity gate, entity register, CI. (The Working kit's coverage check and review queue are built; see "Connecting the dots".)
- Automatic drift detection of guidance sources. Today: dates, a weekly report-only refresh, and a manual routine.

**Not yet proven:**
- The Stop block was seen for one reason only: uncommitted files outside the autosave list. The other two (autosave failed, no log line today) were not triggered live.
- The terminal `claude` (2.1.270): its login had expired, so nothing ran there. Only 2.1.284 (desktop app) is proven.
- Everything Codex-specific (hooks, trust review). Drafted from documentation only.
- `connect` with a real GitLab host. Only the `gh` path ran for real.
- Windows. The tests pass on macOS and Linux (Node 18, 20, 22) in CI. On Windows, 41 of 43 passed before the line-ending fix; the run after the fix is not in yet.
