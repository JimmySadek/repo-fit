<p align="center">
  <img src="assets/banner.png" alt="repo-fit: fit any repository for work. From chaos to progress." width="100%">
</p>

# repo-fit

[![Tests](https://github.com/JimmySadek/repo-fit/actions/workflows/test.yml/badge.svg)](https://github.com/JimmySadek/repo-fit/actions/workflows/test.yml) [![Version](https://img.shields.io/github/v/tag/JimmySadek/repo-fit?label=version&color=blue)](CHANGELOG.md) [![npm](https://img.shields.io/npm/v/repo-fit?color=cb3837)](https://www.npmjs.com/package/repo-fit) [![License: MIT](https://img.shields.io/github/license/JimmySadek/repo-fit)](LICENSE)

**Give your project a memory, so every work session starts where the last one stopped.**

repo-fit is for people who do real work with an AI assistant such as Claude Code or Codex: notes, research, plans, decisions, client work, a product, a company. It sets up your project folder so that nothing gets lost between sessions, your assistant always knows what is open, and your work is saved safely as you go.

It works with a brand-new project and with one you have had for years. It looks at what you already have, suggests only what is missing, and changes nothing without showing you first.

## Is this for you?

- You are a **founder, product manager, designer, marketer or consultant**, and you use an AI assistant to think and write, not only to code.
- You keep **notes, research and decisions** for a project, and you are tired of re-explaining everything at the start of each session.
- You have a **project folder that grew without structure**, and you want order without moving or rewriting anything.
- You work with **both Claude Code and Codex**, and you want them to follow the same rules.

You do not need to be a developer. You need an AI assistant and about 10 minutes.

**It is not** a second brain or a search engine. It does not read the internet, it does not build a database, and it does not replace your assistant. It gives your assistant a tidy place to work.

## What you get

| In plain words | What it looks like |
|---|---|
| **A briefing at the start of every session** | Before your assistant says a word, it reads a short summary: where you are, what is open, what to do next. |
| **One list of everything open** | Tasks, questions and ideas live in one place, each with an owner and a next step. Nothing is "somewhere in a chat". |
| **Your work saved automatically, safely** | Small automatic saves while you work. Never on your main version, never sent anywhere. You stay in control. |
| **A memory that does not rot** | Your assistant gets reminded of notes nobody links to and notes that went quiet, so they get merged, linked or archived. |
| **The same rules for every assistant** | One short rulebook that Claude Code and Codex both read. repo-fit adds five short rules after yours (write it down, search before saying "unknown", never invent agreement), and yours win where they overlap. |
| **It fits what you already have** | Your own files stay where they are. repo-fit points at them instead of making copies. |

Here is a real briefing from a small test project (two lines left out to keep it short):

```text
📍 acme-notes · main · 7 uncommitted · last commit 2026-10-02
🔄 Active (1): B-001 Fill in the README, people page and current view → Write the one-sentence purpose in README.md
➡️ Suggested start: B-001 Write the one-sentence purpose in README.md
🧹 Review queue: 4 nobody links to (notes/launch-plan.md · notes/meetings/2026-09-12-acme-call.md · +2 more)
```

## How it works

```
1. LOOK          2. SEE                   3. CHOOSE ONCE           4. WORK
It reads your    It shows the briefing    Recommended set, or      Every session starts
project. It      your sessions would      pick pieces, or just     with the briefing.
changes nothing. start with.              the report.
```

Every change is shown to you first, keeps a backup, and can be undone with one command. It never uploads your files anywhere.

## Start in 2 minutes

Open your project in **Claude Code** or **Codex** and paste this:

```text
Install the repo-fit skill with `npx skills add JimmySadek/repo-fit -g -a claude-code codex -y`, then use it to set up this project. Before you change anything, show me what you would change and explain it in plain words.
```

That's it. Your assistant installs repo-fit, looks at your project, shows you the briefing your sessions would start with, and asks you one question: set up the recommended pieces, pick your own, or just see the report. Your own files and rules stay as they are.

**One step is yours:** your assistant gives you one line to run that turns on the briefing. Claude Code does not let an assistant change how your sessions start, so it asks you. **Next session,** open the project again and the briefing appears by itself.

**Updates:** repo-fit does not update itself. When a release matters for your project, the briefing tells you in one line, with why. Then paste: `Update repo-fit with npx skills update -g -y, then run /repo-fit here`.

**Using Claude Code? Install it as a plugin instead,** and it can update itself. In Claude Code, run `/plugin marketplace add JimmySadek/repo-fit`, then `/plugin install repo-fit@repo-fit`. To get new versions automatically: `/plugin` → **Marketplaces** → **repo-fit** → **Enable auto-update** (it is off until you turn it on). The skill is then `/repo-fit:repo-fit`.

**What your computer needs:** [Node.js](https://nodejs.org), version 18 or newer. It is a free program; if it is missing, your assistant will tell you.

**Prefer the terminal?** One line looks at any project and changes nothing:

```bash
npx repo-fit audit .
```

Everything else is in the [technical reference](docs/reference.md).

## A few words on safety

- **It changes nothing without showing you first.** Every step is a preview, then your yes.
- **Everything it writes can be undone.** It keeps a backup and a receipt of each change.
- **Your files never leave your computer.** It does not upload, publish, or send anything. Two small exceptions: once a day the briefing asks npm whether a newer repo-fit exists (only the name "repo-fit" is sent; turn it off with `repo-fit prefs set updateCheck off`), and, only if you ask, it creates an empty, private backup location for your project on GitHub or GitLab.
- **It never reads the contents of files that look like secrets** (passwords, keys). It only warns you if such a file is in a risky place.

The [full list of what it reads and when it uses the network](docs/reference.md#security-and-privacy) is in the reference.

## Where this stands

**Public beta, version 0.6.0.** Built and used by one person so far, on a Mac, with Claude Code. Automated tests pass on Mac, Linux and Windows. Codex support is written to the official documentation but has not been tried live yet. If you try it, [tell us what happened](https://github.com/JimmySadek/repo-fit/issues): that is the most useful thing you can do right now.

## For developers

Everything technical lives in one page: commands, the four scripts, how it adapts to a repo that has its own system, the review queue, autosave rules, security details, tests, and what is not built yet.

- [Technical reference](docs/reference.md)
- [INSTALL.md](INSTALL.md): the step-by-step an AI assistant follows
- [CONTRIBUTING.md](CONTRIBUTING.md) and [CHANGELOG.md](CHANGELOG.md)

MIT licence. Made by [Jimmy Sadek](https://github.com/JimmySadek).
