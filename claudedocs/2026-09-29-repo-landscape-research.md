# What already exists: a look around before we build (29 Sep 2026)

> **Naming note (29 Sep 2026):** written while the tool was still called `repo-playbook`. It is now **repo-fit**. Name checks in this note refer to the old working name.

This note compares the **public** repos that solve nearby problems, so repo-fit does not reinvent the wheel. It was written before the first release.

Status: **research, no code changed.** Star counts are from 29 Sep 2026 and will move.

## 1. Short answer

- **Nobody I found does what repo-fit aims to do.** The closest tools are starter kits for Claude Code and template repos. None that I read is a *foundation for any repo, technical or notes*, and none that I read checks your machine and repo first (CLIs, logins, git host, existing tools) and then offers to adapt.
- **The big repos are a different job.** The giants are process frameworks (`superpowers` 293k stars, `spec-kit` 139k, `gstack` 134k, `OpenSpec` 71k), memory tools (`claude-mem` 95k) and "second brain" wikis (12 repos, about 58k stars together). You already use several of these. We complement them. We do not compete with them.
- **We already have a few things I did not find elsewhere.** A dated guidance layer with a refresh routine, autosave that never touches `main`, stale board rows that fail a check, and one rulebook that updates many repos.
- **We are missing things others do better.** The main gaps: detecting the environment, safe handling of existing repos (backup, receipt, undo), configurable folder paths, and a fuller board option. Section 5 lists them.

## 2. Your correction, written down

The playbook is a **balanced foundation for any repo**. It is not a second brain.

| In scope | Out of scope (on purpose) |
|---|---|
| Rulebook that both Claude Code and Codex read | Semantic search, embeddings, graphs |
| A board: tasks, jobs, questions, one status per item | Auto-ingesting sources into a wiki |
| Session brief, log, decisions, people | A memory database that records every tool call |
| Autosave that is safe (never on `main`, never pushed) | Multi-agent pipelines that need API keys |
| Guidance that stays current | Claiming intelligence the scripts do not have |
| **Detect, adapt, ask** on any repo (new or existing) | Forcing GitHub, Node, Obsidian or any one tool |

The 12 "LLM wiki" and second-brain repos are set aside. They are large and popular, but they are a different product. Two small things in them match what we already have: an append-only log and a "lint" check.

## 3. The landscape

All 81 repos with 40+ stars that my searches found are in the appendix. Summary by cluster:

| Cluster | Repos | Stars (sum) | Examples | How it relates to us |
|---|---:|---:|---|---|
| Process and spec frameworks | 11 | 782,583 | `superpowers`, `spec-kit`, `gstack`, `OpenSpec`, `get-shit-done`, `BMAD-METHOD` | Methods for **how to build**. You already use several. Complementary |
| Design-file formats | 2 | 146,893 | `awesome-design-md`, `design.md` | Same idea as AGENTS.md for visual identity. Not our job |
| Memory and recall | 11 | 123,952 | `claude-mem`, `TencentDB-Agent-Memory` | Automatic recall by database. Different approach from our curated files |
| LLM wiki and second brain | 12 | 57,547 | `llm_wiki`, `claude-obsidian` | **Set aside** (section 2) |
| Starters and scaffolds | 8 | 35,830 | `claude-code-starter-kit`, `ccsk-cli`, `orchestrated-project-template`, `claude-user-memory` | **Closest to us.** Mostly Claude-only and technical |
| Task board | 2 | 34,997 | `Backlog.md`, `claude-task-master` | The nearest to our **board** |
| Instruction files | 9 | 31,290 | `agents.md`, `dox`, `ClaudeForge`, `claude-code-auto-memory`, `agentrules-architect` | The nearest to our **rulebook** and to **organizing an existing repo** |
| Skill collections | 6 | 25,185 | `microsoft/skills`, `SkillOpt` | Not our job |
| Self-improvement from corrections | 3 | 3,126 | `claude-reflect`, `backpass`, `claude-memory-engine` | The nearest to our **LEARNINGS** loop |
| Named "playbook" | 3 | 423 | `agent-playbook`, `secure-agent-playbook` | **Name overlap.** See section 7 |
| Unrelated, or translations | 14 | 58,638 | | Ignored |

## 4. The repos that matter, one by one

Only repos I read (README, or a keyword search of a full README). "Better than ours" means better than the current draft.

### `Backlog.md` (6,887★, MIT): the board

- **What it is:** a task manager and kanban board that lives in your repo as Markdown. `backlog init` in any folder.
- **Better than ours:** one file per task with acceptance criteria and a Definition of Done; milestones and dependencies; a terminal kanban (`backlog board`) and a local web board; search; `--json` output; a `--no-git` mode for non-code projects. Its rule "one task = one context window = one PR" keeps work small.
- **Adaptable:** it asks how to connect AI tools (CLI instructions, MCP, or skip). It keeps existing `AGENTS.md` content and leaves unrelated `.cursor/rules` alone. The folder is configurable (`backlog/`, `.backlog/`, or your own path).
- **Ours is simpler:** one table, zero install. Stale rows fail a check, which it does not have (I did not find that).
- **Verdict:** **adopt as an optional board backend**. Keep our table as the default. Borrow the ideas: acceptance criteria per item, a Definition of Done, a kanban view, `--json`.

### `spec-kit` (139,359★, MIT): process and integrations

- **What it is:** a toolkit of templates and processes (spec-driven development, bug fixing, idea assessment). Needs Python 3.11+ and `uv`.
- **Better than ours:** an "integration key" per agent, so one core supports many tools; extensions, presets and bundles; a written existing-project guide and upgrade guide; a **constitution** file (principles, once per project).
- **Verdict:** **borrow the structure** (one core, small adapters per tool, documented upgrade path). Skip the process itself. It is a method for building features, not a repo foundation.

### `OpenSpec` (70,641★): how to treat an existing repo

- **What it does:** "built for brownfield, not just greenfield". Its rule: *you do not document your whole codebase to start; you write specs only for what you are about to change.* It also has a guided tour on your own code.
- **Verdict:** **adopt as the principle for organizing existing repos.** Start with a minimal footprint. Organize only the area you touch. Never "boil the ocean".

### `ccsk-cli` (54★): safe re-runs and access checks

- **Better than ours:** re-running is safe. It never silently overwrites. When a file exists you choose: **overwrite** (old file saved as `.bak`), **keep mine** (theirs saved beside it), or **cancel**. Non-interactive runs default to overwrite-with-backup, so nothing is destroyed without a backup. It is **auth-aware**: it detects SSH and the `gh` CLI and guides you when access is missing. It has version channels: stable by default, `--pre` opt-in, `--version` to pin, `ccsk versions`.
- **Verdict:** **adopt** the conflict choice, the backup rule, the auth check pattern and version pinning.

### `claude-code-starter-kit` (151★, cloudnative-co): the setup wizard

- **Better than ours:** an interactive wizard with saved answers, and a page that maps each choice to the files it changes. `--non-interactive`, an environment variable and `--config=` for CI. `--dry-run`. Updates ask **only about new things**.
- **Weaker:** it also installs prerequisite tools, which is more than we want.
- **Verdict:** **adopt** saved answers, the "choice to files" map, a dry-run on `init`, and "update asks only what is new".

### `ClaudeForge` (430★): sibling instruction files

- **Better than ours:** it detects sibling files (`AGENTS.md`, `.cursorrules`, `.windsurfrules`) and chains them with `@` imports instead of overwriting. It detects the tech stack and project type.
- **Verdict:** **adopt.** This is the same problem we hit: a repo with `CLAUDE.md` and `AGENTS.md` and no link between them. In the maintainer's own repos, 13 of 17 with both files had no import.

### `claude-code-auto-memory` (158★) and `agents.md` (24,671★): commands in the rulebook

- `agents.md` is an open format: a "README for agents". Its example sections are dev environment tips, testing instructions and PR instructions. The auto-memory plugin detects frameworks and build commands and tracks file moves and deletes to keep `CLAUDE.md` in sync.
- **Better than ours:** our core block is about process. For a technical repo the most useful lines are the build, test and lint commands.
- **Verdict:** **adopt** detection of commands (from `package.json`, `Makefile`, CI files) to draft that section.

### `Agentic Substrate` (`claude-user-memory`, 211★): install by giving your agent a file

- **Better than ours:** you give your agent an `INSTALL.md`. The agent adapts it to the actual tool, operating system, permissions and project, keeps your existing config, verifies, writes an **installation receipt with backups and an undo procedure**. It aims for a very small always-loaded addition (about 200 words; the README text was cut off where I read it).
- **Verdict:** **adopt** the `INSTALL.md` path, the receipt with undo, and the small-footprint target. Our core block is 3.8 KB, about 600 words.

### `dox` (1,471★): nested rulebooks

- A tree of `AGENTS.md` files. The agent reads from the root down to the area it will edit and updates the local file after changes. No install: you copy one Markdown file. For an existing project you tell the agent to "initialize the tree".
- **Verdict:** **optional** for big repos. Not in the foundation.

### `claude-reflect` (1,703★) and `backpass` (1,289★): learning from corrections

- Hooks or history mining find repeated corrections, then propose edits to `CLAUDE.md` or `AGENTS.md` for you to review.
- Ours is manual: a lessons file with a promotion rule. Theirs is faster.
- **Risk:** they read your prompts and session history. That is a privacy choice.
- **Verdict:** **optional adapter later.** Ask first, never default on.

### `orchestrated-project-template` (95★): template plus a sync command

- A GitHub template with a `/start` interview and a `/sync-template` command that pulls template updates into a project. It also ships 12 specialist agents, which is more than a foundation needs.
- **Verdict:** confirms that **update-from-source** is a real need. Skip the agents.

### `claude-mem` (94,895★): memory

- Hooks capture what the agent does, summarize it and inject it into later sessions. Plugins for several tools. Services, workers and Docker in the repo. Some install paths default to a hosted service (per its Grok Bot instructions).
- **Verdict:** **complementary, not a competitor.** It is automatic recall. We are curated, human-readable files with approval gates. We should say so in one line and detect it, not replace it.

### Others I read

| Repo | What I took from it |
|---|---|
| `fable5-methodology` (92★) | "Written rules decay". What a script can enforce, a script enforces. Prose is for judgement. Same stance as our hooks |
| `Aegis` (1,303★) | Baseline first, proof before "done". It publishes its own benchmark numbers. I did not verify them |
| `agent-playbook` (80★) | Named "playbook" but it is "behavior CI": repeated corrections become reviewed changes. Its design principles match ours: short always-on rules, methods as skills, state outside chat |
| `secure-agent-playbook` (181★) | Security procedures. Different meaning of "playbook" |
| `agentrules-architect` (124★) | Multi-agent pipeline that generates `AGENTS.md` and needs provider API keys. **Skip.** Too heavy |
| `superpowers`, `gstack`, `get-shit-done`, `BMAD-METHOD`, `OpenSpec`, `SuperClaude`, `serena` | Process and tooling that pair well with repo-fit. Complementary. Only metadata was checked for most |

## 5. Comparison with the current draft

| Capability | Ours today | Best seen elsewhere | Verdict |
|---|---|---|---|
| Start a new repo | ✅ `init` | many | Have |
| Existing repo, never overwrite | ⚠️ `init` skips existing files; no audit | ccsk: choose overwrite, keep mine or cancel, `.bak` backups. OpenSpec: change only what you touch | **Adopt** |
| Receipt and undo | ❌ Git only | Agentic Substrate: receipt, backups, undo steps | **Adopt** |
| Detect machine (CLIs, logins) | ❌ | ccsk: detects SSH and `gh` | **Adopt (core)** |
| Detect git host (GitHub, GitLab, none) | ❌ | none found | **Build** |
| Detect sibling instruction files | ⚠️ warns if `CLAUDE.md` lacks an import | ClaudeForge: chains with `@` imports | **Adopt** |
| Detect build, test, lint commands | ❌ | auto-memory, `agents.md` format | **Adopt** (technical repos) |
| Adapt to existing folder layout | ❌ paths are hard-coded (`docs/00-home/...`) | Backlog.md: configurable folder, `--no-git` | **Adopt** (`paths` setting) |
| Works for notes-only repos | ⚠️ designed for it, not tested on one | Backlog.md `--no-git` | Test |
| Pick tools at setup | ✅ Claude Code, Codex, both | spec-kit: many agents | Have |
| Board | ⚠️ one table, stale rows fail the check | Backlog.md: per-task files, criteria, kanban, dependencies, search | Optional adapter |
| Version and update | ✅ stamp, `status`, `update` dry run | ccsk: channels and pinning; starter kit: asks only about new items | Have; add pinning |
| Dry run | ⚠️ `update` only | starter kit: `--dry-run` | Add to `init` |
| Saved wizard answers, CI flags | ⚠️ flags only | starter kit: saved config, `--non-interactive` | Adopt lightly |
| Machine-readable output | ❌ | Backlog.md `--json` | Adopt |
| Install by giving the agent a file | ❌ (skill and CLI) | Agentic Substrate `INSTALL.md` | **Adopt** |
| Dated, refreshed guidance | ✅ | not found | **Ours** |
| Autosave that never touches `main` | ✅ | not found | **Ours** |
| One block updates many repos | ✅ | `orchestrated-project-template` `/sync-template` (similar need) | Have |
| Learn from corrections | ⚠️ manual lessons file | claude-reflect, backpass | Optional later |
| Nested rulebooks | ❌ | `dox` | Optional |
| Small always-on footprint | ⚠️ 3.8 KB | about 200 words | Decide |
| Semantic memory, graph | ❌ on purpose | `claude-mem`, wiki family | **Skip on purpose** |

## 6. New core: detect, adapt, ask

This is the design change behind repo-fit's detect, adapt, ask approach. It has three steps and one rule.

```
DETECT (read-only)  →  ADAPT (choose defaults)  →  ASK (you decide)
machine + repo          from what was found         use it, skip it, or set it up
```

**Rule: never force, never install, never log in for you.** Every integration is optional and offered only when detected or asked for.

### What detect looks at

| Area | Looks for | Example decision |
|---|---|---|
| Machine | `git`, `gh`, `glab`, `node`, `python3`, `jq`, `claude`, `codex`, `backlog`, `specify`, `openspec` (installed? version?) | Node missing → offer the no-Node path, or say what is lost |
| Access | `gh auth status`, `glab auth status`, SSH keys (login name only, never a token) | `gh` installed but logged out → offer to guide login, or skip GitHub features |
| Git host | remote URL: GitHub, GitLab, other, none | GitLab remote → `.gitlab-ci.yml` and MR template, never `.github/`. No remote → say "no off-machine backup" |
| Repo kind | manifests (`package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `Makefile`), source folders, share of Markdown, `.obsidian/` | Technical, notes or mixed → choose defaults for the autosave allow-list and the rulebook sections |
| Existing rules | `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.cursorrules`, `.windsurfrules`, `.github/copilot-instructions.md`, `.claude/`, `.codex/` | Sibling files → link with imports, never overwrite |
| Existing task tools | `backlog/`, `.specify/`, `openspec/`, `.taskmaster/`, `TODO.md`, issues via `gh` or `glab` | Found `backlog/` → ask: use Backlog.md as the board? |
| Existing memory tools | claude-mem, Serena, `.obsidian/`, `wiki/` | Found → stay out of the way, do not restructure |
| Commands | scripts in `package.json`, Makefile targets, CI steps | Draft the "dev, test, lint" lines for the rulebook |
| Clutter | files over 5 MB, media folders, duplicate rulebooks, orphan docs, folders with no README | Feeds the audit report |

### Adapters (each optional, each asked)

| Slot | Default | Offered when detected |
|---|---|---|
| Board | Markdown table | Backlog.md; GitHub Issues via `gh`; GitLab issues via `glab` |
| Git host files | none | GitHub: PR template, workflow. GitLab: MR template, CI file |
| AI tools | Claude Code and Codex via `AGENTS.md` | Others through `AGENTS.md`, since many tools read it |
| Learning from corrections | off | a corrections inbox (privacy note first) |

## 7. Organizing an existing repo

Two front doors, one engine.

```
new repo  ──►  Starter kit
                    ▲
existing repo ─►  detect → audit → plan → apply (step by step) → verify
```

1. **Detect** (read-only), as in section 6.
2. **Audit** (read-only report): what is there, what is missing against the kit, duplicates (for example `AGENTS.md` and `CLAUDE.md` as separate copies), orphan docs, media sprawl, stale files. Same shape as the maintainer's earlier hand-written audits of their own repos.
3. **Plan:** every step labelled by risk: **add only**, **edit**, **move**, **delete**. The default plan contains add-only steps.
4. **Apply, one step at a time.** Each step: dry run, your approval, a backup, a line in a **receipt** file, and an undo step.
5. **Verify** with the repo's own checks.
6. **Delta-first** (from OpenSpec): organize only the areas you name. Do not restructure the whole repo to start.
7. **Adapt to the layout that is there.** A `paths` setting in `playbook.json` says where the board, log and decisions live. If the repo already has `notes/` or `docs/`, use it.

Moves and deletes never happen without your approval for that exact step.

## 8. What changes in the build plan

Nothing here is built yet.

| # | Piece | Source of the idea | Size |
|---|---|---|---|
| 1 | `playbook detect` (read-only, `--json`) | ccsk, auto-memory, ClaudeForge, Backlog.md | Medium |
| 2 | `playbook audit` (report only) | earlier hand-written audits, OpenSpec | Medium |
| 3 | `paths` setting, scripts read paths from config | Backlog.md | Small |
| 4 | Conflict choice, `.bak` backups, receipt and undo | ccsk, Agentic Substrate | Medium |
| 5 | Sibling-file linking, commands section from detected scripts | ClaudeForge, auto-memory | Small |
| 6 | Board adapters (Backlog.md first, then `gh` and `glab` issues) | Backlog.md | Medium, optional |
| 7 | Git host adapter (GitHub, GitLab, none) | new | Small |
| 8 | `INSTALL.md` agent path | Agentic Substrate | Small |
| 9 | `--dry-run` on `init`, version pinning, saved answers | starter kit, ccsk | Small |
| 10 | Trim the core block toward the smallest useful size | Agentic Substrate | Small, needs a maintainer decision |

## 9. Naming and positioning: what this research says

These are **observations from about 30 repos, not proof**.

- **Repos that spread fast share some traits:** a one-sentence install ("tell your agent to..."), a "no dependencies" or "tiny footprint" claim, riding a named idea (AGENTS.md, spec-driven development, Karpathy's wiki), measured claims (`Aegis`), a demo, translations (`claude-mem` lists about 35 languages), and using their own tool on themselves (`Backlog.md`).
- **The names that won are short and literal:** `claude-mem`, `spec-kit`, `llm-wiki`, `get-shit-done`, `agents.md`. Your own 484-star repo is literal too.
- **Words to avoid, given the scope decision (a foundation, not a second brain):** "memory", "brain", "wiki", "knowledge". They promise a second brain. That rules out `ai-repo-memory` and `amnesia-proof` from the earlier list. `cairn`, `handover` and `pickup` lean toward memory and continuity, so they need a second look.
- **"Playbook" is already used for other things:** `agent-playbook` means behavior CI, and `secure-agent-playbook` means security plays. `repo-playbook` had no same-name repo, and the word "repo" separates it.
- **One honest line to test:** "A small foundation for any repo: rules, a board, a session brief and safe autosave. It looks at what you have first, and adapts."

## 10. Open decisions

1. Shrink the core block (3.8 KB, about 600 words) toward the ~200-word idea? A smaller block is easier to trust. Some rules would move to reference files.
2. Board default: keep the single table, or ship per-task files like Backlog.md for bigger projects?
3. Which adapter first: Backlog.md, or `gh` and `glab` issues?
4. Should `init` on an existing repo default to **add-only** and require `--adopt` for any edit? (Recommended.)
5. Name: still open. The word list above narrows it.

## 11. Limits

- Search recall is limited. My first pass missed famous repos (`superpowers`, `gstack`, `get-shit-done`), which I then looked up by name. There may be relevant repos with 40+ stars that I did not find, and relevant repos below 40 were out of scope.
- **Read depth:** 20 repos README read (some by keyword search of a long README), 6 opening only, **55 from name and description only**. No code was read or run.
- Claims about features come from READMEs. I did not run any tool.
- "I did not find X" means I did not find it in what I read.
- Star counts are a popularity signal, not a quality signal.
- `Aegis` benchmark figures are the repo's own claims.

# Addendum (29 Sep, found while checking names): RepoReady, the closest neighbour, sat below the 40-star cut-off

`shidesheng0218/repo-ready` (28 stars, created June 2026, MIT, JavaScript). README read in full for its opening sections; no code read or run.

**What it is:** "a CLI-first AI coding agent readiness checker and fixer". You run `npx @shidesheng0218/repo-ready@latest`. It scans a repo, gives scores (overall, agent-ready, safety), shows the evidence behind each finding, and previews fixes (`fix --plan`, `--dry-run`, `--apply-safe`, `--write`, `--branch`). `init-agent` generates `AGENTS.md`, `CLAUDE.md` and Cursor rules. `--ci --min-score 80` works as a CI gate. Profiles for Codex, Claude and Cursor. Reports in English and Chinese.

| | RepoReady | This playbook |
|---|---|---|
| Scan and score an existing repo | ✅ | ✅ report and plan, **no invented score** by choice |
| Preview before writing | ✅ | ✅ dry run, diff, backup, **receipt and undo** |
| Generate rule files | ✅ | ✅ and links `CLAUDE.md` to `AGENTS.md` by case |
| One-line trial with `npx` | ✅ | ❌ needs a clone today |
| CI gate | ✅ | ⚠️ `check.mjs` has exit codes, no CI template yet |
| Danger scan (force push, DB reset, production deploy scripts) | ✅ | ❌ **gap** |
| Session brief, board, log, safe autosave | not in its README | ✅ |
| Detects host, logins, versions, offers `connect` | not in its README | ✅ |
| Guidance dated and refreshed | not in its README | ✅ |

**What to adopt (not built):** (1) a **danger scan** in the audit: risky commands in `package.json` scripts and the Makefile, with a note to fence them in `AGENTS.md`. (2) **`npx` distribution**, which depends on a name that is free on npm and on publishing, both maintainer decisions. (3) A **CI gate template**, with the deferred host files. **Not adopting:** a numeric score (the project rule is no invented numbers) and "agent simulation" (it claims more than a script can know).

**Consequence for naming:** `repo-ready` and `agent-ready-repo` are taken in meaning as well as in name. Avoid "ready" and "readiness".

**Consequence for the landscape report:** the closest neighbour was below my 40-star cut-off. The report's claim "nobody I found does what repo-fit aims to do" still holds for the whole idea (foundation, adapt, ask, safe changes, continuity), but not for the audit-and-fix slice, which RepoReady covers.

# Appendix: every repo with 40+ stars that the searches found (81)

The list comes from 36 search queries and 9 direct lookups. The raw search output and the generator script are in `claudedocs/research-data/`. "How far I checked" is honest: most rows are metadata only.

| Stars | Repo | Cluster | How far I checked | Last push | What it says it is |
|---:|---|---|---|---|---|
| 292,703 | `obra/superpowers` | Process and spec frameworks | README read | 2026-09-27 | An agentic skills framework & software development methodology that works. |
| 139,359 | `github/spec-kit` | Process and spec frameworks | README read | 2026-09-29 | 💫 Toolkit to help you get started with SDD or any other process! |
| 134,460 | `garrytan/gstack` | Process and spec frameworks | metadata only | 2026-09-29 | Use Garry Tan's exact Claude Code setup: 23 opinionated tools that serve as CEO, Designer, Eng  |
| 118,735 | `VoltAgent/awesome-design-md` | Design-file formats | metadata only | 2026-09-29 | A collection of DESIGN.md files analysis by popular brand design systems. Drop one into your pr |
| 94,895 | `thedotmack/claude-mem` | Memory and recall | README opening | 2026-09-29 | Persistent Context Across Sessions for Every Agent –  Captures everything your agent does durin |
| 70,641 | `Fission-AI/OpenSpec` | Process and spec frameworks | README read | 2026-09-28 | Spec-driven development (SDD) for AI coding assistants. |
| 64,436 | `gsd-build/get-shit-done` | Process and spec frameworks | metadata only | 2026-05-31 | A light-weight and powerful meta-prompting, context engineering and spec-driven development sys |
| 53,628 | `bmad-code-org/BMAD-METHOD` | Process and spec frameworks | metadata only | 2026-09-29 | Breakthrough Method for Agile Ai Driven Development |
| 32,139 | `davila7/claude-code-templates` | Starters and scaffolds | metadata only | 2026-09-29 | CLI tool for configuring and monitoring Claude Code |
| 29,893 | `oraios/serena` | Unrelated or domain-specific | metadata only | 2026-09-29 | A powerful MCP toolkit for coding, providing semantic retrieval and editing capabilities  - the |
| 28,158 | `google-labs-code/design.md` | Design-file formats | metadata only | 2026-09-29 | A format specification for describing a visual identity to coding agents. DESIGN.md gives agent |
| 28,110 | `eyaltoledano/claude-task-master` | Task board | metadata only | 2026-04-28 | An AI-powered task-management system you can drop into Cursor, Lovable, Windsurf, Roo, and othe |
| 27,491 | `TencentCloud/TencentDB-Agent-Memory` | Memory and recall | metadata only | 2026-09-29 | TencentDB Agent Memory is a team-level memory hub for AI Agents - turning conversations, docs,  |
| 24,671 | `agentsmd/agents.md` | Instruction files (AGENTS.md, CLAUDE.md) | README read | 2026-09-29 | AGENTS.md - a simple, open format for guiding coding agents |
| 23,911 | `SuperClaude-Org/SuperClaude_Framework` | Process and spec frameworks | metadata only | 2026-09-27 | A configuration framework that enhances Claude Code with specialized commands, cognitive person |
| 20,074 | `nashsu/llm_wiki` | LLM wiki and second brain (set aside) | metadata only | 2026-09-29 | LLM Wiki is a cross-platform desktop application that turns your documents into an organized, i |
| 17,846 | `microsoft/SkillOpt` | Skill collections | metadata only | 2026-09-29 | SkillOpt is a text-space optimizer that trains reusable natural-language skills for frozen LLM  |
| 16,022 | `wasp-lang/open-saas` | Unrelated or domain-specific | metadata only | 2026-09-29 | A 100% free modern JS SaaS boilerplate (React, NodeJS, Prisma). Full-featured: Auth (email, goo |
| 15,290 | `AgriciDaniel/claude-obsidian` | LLM wiki and second brain (set aside) | README opening | 2026-09-29 | Self-organizing AI second brain for Obsidian + Claude Code. Drop any source and Claude reads, l |
| 6,887 | `MrLesk/Backlog.md` | Task board | README read | 2026-09-29 | Backlog.md - A tool for managing project collaboration between humans and AI Agents in a git ec |
| 4,347 | `inkeep/open-knowledge` | LLM wiki and second brain (set aside) | metadata only | 2026-09-29 | Beautiful, AI-native markdown IDE and LLM wiki |
| 3,835 | `gadievron/raptor` | Unrelated or domain-specific | metadata only | 2026-09-29 | Raptor turns Claude Code into a general-purpose AI offensive/defensive security agent. By using |
| 3,588 | `SamurAIGPT/llm-wiki-agent` | LLM wiki and second brain (set aside) | README opening | 2026-09-29 | A personal knowledge base that builds and maintains itself. Drop in sources - Claude (or Codex/ |
| 3,064 | `microsoft/skills` | Skill collections | metadata only | 2026-09-29 | Skills, MCP servers, Custom Agents, Agents.md for SDKs to ground Coding Agents |
| 2,957 | `jsynowiec/node-typescript-boilerplate` | Starters and scaffolds | metadata only | 2026-09-29 | Production-ready Node.js TypeScript boilerplate: ESM, Vitest, ESLint, Prettier, GitHub Actions, |
| 2,885 | `ciembor/agent-rules-books` | Instruction files (AGENTS.md, CLAUDE.md) | metadata only | 2026-09-29 | AGENTS.md rules / skills for AI coding agents: Codex, Cursor & Claude Code. Inspired by Clean C |
| 2,527 | `Piebald-AI/tweakcc` | Unrelated or domain-specific | metadata only | 2026-09-29 | Customize Claude Code's system prompts, create custom toolsets, input pattern highlighters, the |
| 2,506 | `sdyckjq-lab/llm-wiki-skill` | LLM wiki and second brain (set aside) | metadata only | 2026-09-29 | 基于 Karpathy llm-wiki 方法论的个人知识库构建 Skill，支持多平台！ |
| 2,384 | `Astro-Han/karpathy-llm-wiki` | LLM wiki and second brain (set aside) | README opening | 2026-09-29 | Agent Skills-compatible LLM wiki for Claude Code, Cursor, and Codex. Build a Karpathy-style kno |
| 2,150 | `atomicstrata/llm-wiki-compiler` | LLM wiki and second brain (set aside) | metadata only | 2026-09-29 | The knowledge compiler. Raw sources in, interlinked wiki out. Inspired by Karpathy's LLM Wiki p |
| 1,925 | `skalesapp/skales` | Unrelated or domain-specific | metadata only | 2026-09-29 | Personal AI agent for macOS, Windows, Linux, Android & iOS. Set a goal, it works alone: coding  |
| 1,703 | `BayramAnnakov/claude-reflect` | Self-improvement from corrections | README read | 2026-09-28 | A self-learning system for Claude Code that captures corrections, positive feedback, and prefer |
| 1,690 | `skyllwt/AutoSci` | LLM wiki and second brain (set aside) | metadata only | 2026-09-29 | Karpathy's LLM-Wiki vision, fully realized - wiki-centric full-lifecycle AI research platform p |
| 1,653 | `lucasastorian/llmwiki` | LLM wiki and second brain (set aside) | metadata only | 2026-09-29 | Open Source Implementation of Karpathy's LLM Wiki. Upload documents, connect your Claude accoun |
| 1,650 | `spec-kitty/spec-kitty` | Process and spec frameworks | metadata only | 2026-09-29 | Spec-Driven Development for serious software developers. Spec Coding with with Claude, Cursor,  |
| 1,471 | `agent0ai/dox` | Instruction files (AGENTS.md, CLAUDE.md) | README read | 2026-09-29 | Self-documenting AGENTS.md |
| 1,445 | `twostraws/SwiftAgents` | Instruction files (AGENTS.md, CLAUDE.md) | metadata only | 2026-09-29 | An AGENTS.md file for Swift and SwiftUI projects. |
| 1,357 | `nvk/llm-wiki` | LLM wiki and second brain (set aside) | metadata only | 2026-09-29 | LLM-compiled knowledge bases for any AI agent. Parallel multi-agent research, thesis-driven inv |
| 1,329 | `sceneview/sceneview` | Unrelated or domain-specific | metadata only | 2026-09-29 | 3D & AR SDK for Android (Jetpack Compose + Filament), Apple (SwiftUI + RealityKit), Web, Flutte |
| 1,303 | `GanyuanRan/Aegis` | Process and spec frameworks | README read | 2026-09-29 | Make AI coding agents architecture-aware: baseline-first, evidence-verified, drift-checked, and |
| 1,294 | `coleam00/claude-memory-compiler` | LLM wiki and second brain (set aside) | README read | 2026-09-29 | Give Claude Code a memory that evolves with your codebase. Hooks automatically capture sessions |
| 1,289 | `kunchenguid/backpass` | Self-improvement from corrections | README opening | 2026-09-29 | You don't write AGENTS.md. You train it with gradient descent. |
| 1,223 | `gamedev-skills/awesome-gamedev-agent-skills` | Skill collections | metadata only | 2026-09-29 | 74 game-dev skills for AI coding agents - Godot, Unity, Unreal, Phaser, PixiJS, three.js, Bevy, |
| 1,214 | `yuezhiai/jonex` | LLM wiki and second brain (set aside) | metadata only | 2026-09-29 | All-in-One Multimodal Parsing Engine + Ontology-Powered, LLM Wiki-Driven AI-Ready Knowledge Eng |
| 1,209 | `GPTomics/bioSkills` | Skill collections | metadata only | 2026-09-27 | a set of SKILLS.md for doing bioinformatics with agents like claude code |
| 1,178 | `michaelshimeles/skills` | Skill collections | README read | 2026-09-29 | Agent skills and an AGENTS.md workflow template - isolate in worktrees, build to a service laye |
| 999 | `lucasrosati/claude-code-memory-setup` | Memory and recall | metadata only | 2026-09-29 | Up to 71.5x fewer tokens per session on Claude Code with Obsidian + Graphify. Persistent memory |
| 953 | `wordflowlab/novel-writer` | Unrelated or domain-specific | metadata only | 2026-09-28 | 参考Spec-kit 实现小说撰写工具 |
| 703 | `Linfee/spec-kit-cn` | Translation of another repo | metadata only | 2026-09-24 | Clone of https://github.com/github/spec-kit but in Chinese |
| 665 | `ThibautBaissac/rails_ai_agents` | Skill collections | metadata only | 2026-09-26 | Specialized AI skills, agents, rules and hooks for modern Rails AI driven-development + Spec-Dr |
| 430 | `alirezarezvani/ClaudeForge` | Instruction files (AGENTS.md, CLAUDE.md) | README read | 2026-09-25 | A CLAUDE.md Generator and Maintenance tool for for Claude Code to create high-quality CLAUDE.md |
| 400 | `rihebty/flow-kit` | Process and spec frameworks | metadata only | 2026-09-23 | 一套融合了bmad、spec-kit、OpenSpec、GSD、claude-task-master、superpowers、gstack、skills的 AI 编程规范化流程 |
| 338 | `loulanyue/spec-kit-zh` | Translation of another repo | metadata only | 2026-09-23 | Chinese-localized spec-driven development toolkit for Codex, Claude Code, Cursor, and other AI  |
| 294 | `wordflowlab/article-writer` | Unrelated or domain-specific | metadata only | 2026-09-18 | 使用Claude Code，Cursor, codex, gemini 写微信公众号文章工具。 |
| 291 | `doggy8088/spec-kit` | Translation of another repo | metadata only | 2026-09-26 | 💫 幫助您開始規格驅動開發的工具包 |
| 258 | `hiFOFA/spec-kit-chinese` | Translation of another repo | metadata only | 2026-09-24 | 🇨🇳 Spec-Kit 中文汉化版 / GitHub 规范驱动开发工具包完整汉化 / Chinese Localization of GitHub Spec-Kit |
| 211 | `VAMFI/claude-user-memory` | Starters and scaffolds | README read | 2026-09-28 | Portable agent setup through one INSTALL.md: minimal project instructions, verified workflows,  |
| 205 | `guiguiyan930-source/game-ui-design-workflow` | Unrelated or domain-specific | metadata only | 2026-09-29 | 一套面向游戏 UI 设计的 Cursor Agent Skills 工作流，覆盖原型视觉生成、风格切换、页面延展与组件拆解，并通过 Spec-Kit 文档、视觉契约和资源清单保证多页面一致性 |
| 181 | `OWASP/secure-agent-playbook` | Named 'playbook' | README read | 2026-09-29 | OWASP Secure Agent Playbook Project |
| 162 | `bingbing-gui/dotnet-agent-playbook` | Named 'playbook' | metadata only | 2026-09-23 | 一个面向 .NET + AI Agent 开发的实践型仓库，涵盖 Web、云原生与微服务场景，聚焦智能应用的工程化落地。 |
| 158 | `severity1/claude-code-auto-memory` | Instruction files (AGENTS.md, CLAUDE.md) | README read | 2026-09-02 | Claude Code plugin that automatically maintains CLAUDE.md files |
| 151 | `cloudnative-co/claude-code-starter-kit` | Starters and scaffolds | README read | 2026-09-13 | One-command setup of a complete Claude Code development environment with interactive wizard |
| 134 | `HelloRuru/claude-memory-engine` | Self-improvement from corrections | README read | 2026-09-14 | Claude Code 的記憶系統 / A memory system built with hooks + markdown. Zero dependencies. |
| 126 | `textura-agency/next16-claude-starter` | Starters and scaffolds | metadata only | 2026-09-28 | AI-first Next.js 16 starter for animation-heavy sites, wired with an Obsidian vault & Claude Co |
| 124 | `trevor-nichols/agentrules-architect` | Instruction files (AGENTS.md, CLAUDE.md) | README read | 2026-09-24 | AGENTS.md/CLAUDE.md generator and ExecPlan harness for Codex, Claude Code, Cursor, Antigravity, |
| 119 | `obra/claude-memory-extractor` | Memory and recall | metadata only | 2026-09-22 |  |
| 101 | `srijanshukla18/claude-memory-viz` | Memory and recall | metadata only | 2026-08-18 | Claude Memory MCP Visualizer |
| 97 | `pavrus117/ai-os-maps-guide` | Starters and scaffolds | metadata only | 2026-09-29 | Free MAPS guide: set up your own AI operating system on Claude Code (Memory, Agent, Pulse, Scre |
| 95 | `josipjelic/orchestrated-project-template` | Starters and scaffolds | README read | 2026-09-08 | A Claude Code project template with pre-configured specialist agents, living documentation, Con |
| 92 | `UnpaidAttention/fable5-methodology` | Process and spec frameworks | README opening | 2026-09-18 | A transferable, self-enforcing software-engineering methodology for AI coding agents - playbook |
| 80 | `zhaono1/agent-playbook` | Named 'playbook' | README read | 2026-09-23 |  |
| 75 | `Durafen/Claude-code-memory` | Memory and recall | metadata only | 2026-09-22 | 🧠 Universal semantic indexer providing persistent memory for Claude Code through knowledge   g |
| 69 | `WhenMoon-afk/claude-memory-mcp` | Memory and recall | metadata only | 2026-09-26 | Local citation-backed recall for Pi, OMP, Claude Code, Codex, and ChatGPT history. |
| 65 | `oratelecom/tokenwar` | Unrelated or domain-specific | metadata only | 2026-09-29 | 6-tool token-saving stack for Claude Code (caveman + RTK + context-mode + claude-mem + ponytail |
| 63 | `kuitos/opencode-claude-memory` | Memory and recall | metadata only | 2026-09-27 | OpenCode plugin for Claude Code memory: persistent local Markdown memory shared with Claude Cod |
| 63 | `DominikTobureto/awesome-grok-build` | Instruction files (AGENTS.md, CLAUDE.md) | metadata only | 2026-09-27 | Grok Build resources, reusable .grok/skills, AGENTS.md templates, hooks, prompts, and starter w |
| 54 | `ccsk-org/ccsk-cli` | Starters and scaffolds | README read | 2026-09-18 | Claude Code Starter Kit CLI - scaffold Claude-ready projects |
| 53 | `debugtheworldbot/msync` | Memory and recall | metadata only | 2026-09-14 | Sync Claude Code memories to Claude clients (claude.ai / Claude App) |
| 45 | `MadAppGang/mnemex` | Memory and recall | metadata only | 2026-09-09 | Claude code memory, or maybe not code.  |
| 43 | `binarshina/agents-md-templates` | Instruction files (AGENTS.md, CLAUDE.md) | metadata only | 2026-09-15 | Этот репозиторий содержит в себе готовые темплейты agents.md(спецификации для ии-агентов по раб |
| 42 | `hudrazine/claude-code-memory-bank` | Memory and recall | metadata only | 2026-09-15 | Memory management optimized for Claude Code, based on the Cline Memory Bank. |
