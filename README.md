<p align="center">
  <img src="assets/banner.png" alt="repo-fit: fit any repository for work. From chaos to progress." width="100%">
</p>

# repo-fit

[![Tests](https://github.com/JimmySadek/repo-fit/actions/workflows/test.yml/badge.svg)](https://github.com/JimmySadek/repo-fit/actions/workflows/test.yml) [![Version](https://img.shields.io/github/v/tag/JimmySadek/repo-fit?label=version&color=blue)](CHANGELOG.md) [![npm](https://img.shields.io/npm/v/repo-fit?color=cb3837)](https://www.npmjs.com/package/repo-fit) [![License: MIT](https://img.shields.io/github/license/JimmySadek/repo-fit)](LICENSE)

**From chaos to progress.**

repo-fit organizes your project folder, so you and your AI assistant can find anything, then keeps it organized. You see the before and after first. Nothing moves without your yes, and everything can be undone.

It is for people who do real work with an AI assistant such as Claude Code or Codex: notes, research, plans, decisions, client work, a product, a company. It works with a brand-new project and with a folder that grew for years. It looks at what you already have, designs the structure that fits it, and changes nothing without showing you first.

## Is this for you?

- You are a **founder, product manager, designer, marketer or consultant**, and you use an AI assistant to think and write, not only to code.
- You keep **notes, research and decisions** for a project, and you are tired of re-explaining everything at the start of each session.
- You have a **project folder that grew without structure** (photos, PDFs, notes, a bit of code), and you want it organized, after seeing the before and after.
- You work with **both Claude Code and Codex**, and you want them to follow the same rules.

You do not need to be a developer. You need an AI assistant and about 10 minutes.

**It is not** a search engine or a database. It works with plain files and folders, and it does not replace your assistant. It gives you both a tidy place to work.

## What you get

| In plain words | What it looks like |
|---|---|
| **An organized folder, with one yes** | Loose files go into folders that fit your folder's own names. Old folders and exact copies go to an archive. Nothing is deleted, and one command undoes it all. |
| **A map of everything** | `MAP.md` lists every area in one line, and each area has an index page. You and your assistant find any note in two steps. |
| **A safe start** | Before any change, Git saves a snapshot of your folder, so you can always go back. No Git yet? It starts Git for you. |
| **New things land in one place** | Drop things in `inbox/`. The rules you approved file them when a session starts. Anything new asks you once. |
| **A briefing at the start of every session** | Before your assistant says a word, it reads a short summary: where you are, what is open, what to look at. |
| **One list of everything open** | Open tasks from all your notes, collected in `MAP.md` with links. Nothing moves out of your notes. |
| **It stays fit** | The map follows your folder by itself, the briefing names real problems in one line each, and running repo-fit again starts with a checkup. |
| **The same rules for every assistant** | One short rulebook that Claude Code and Codex both read. repo-fit adds five short rules after yours (write it down, search before saying "unknown", never invent agreement), and yours win where they overlap. |
| **It fits what you already have** | Your own files stay where they are. repo-fit points at them instead of making copies. |

Here is a briefing from a test folder a week after it was organized:

```text
spaghetti · branch main · 4 changes not saved in Git yet · last save 2026-10-05
📥 Filed by your rules: 1 → media/. Undo: repo-fit undo <folder> --apply
📥 Inbox: 1 waiting: piano-idea.md. Ask the assistant to file the rest.
⚠️ 1 broken link: notes/todo.md → missing-file.md
✅ Open work: 10 items in 4 notes (see MAP.md)
```

## How it works

```
1. LOOK          2. SEE                    3. CHOOSE ONCE           4. KEEP FIT
It reads your    Your folder today →       Organize it all, see     New things get filed,
folder. It       after → why it is         the full list first, or  the map follows, and a
changes nothing. better for you.           not now, just the map.   re-run starts with a checkup.
```

Every change is shown to you first, keeps a backup, and can be undone with one command. It never uploads your files anywhere.

## Start in 2 minutes

Open your project in **Claude Code** or **Codex** and paste this:

```text
Install the repo-fit skill with `npx skills add JimmySadek/repo-fit -g -a claude-code codex -y`, then use it to organize this project. Before you change anything, show me the before and after and explain it in plain words.
```

That's it. Your assistant installs repo-fit, looks at your folder, shows you your folder today, after, and why it is better, and asks you one question: organize it all, see the full list first, or not now. Code and the files it uses never move, and your own rules stay as they are.

**One step is yours:** your assistant gives you one line to run that turns on the briefing, and a short reminder at the end of each reply when something changed but was not written down. Claude Code does not let an assistant change how your sessions start, so it asks you. **Next session,** open the project again and the briefing appears by itself.

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
- **It never deletes your files.** Old things go to an archive. Code, and every file your code or rules name, never moves.
- **Git saves a snapshot first.** Before any change, your folder is saved as it was, so you can always go back.
- **Everything it does can be undone.** It keeps a backup and a record of each change; `repo-fit undo` puts it back. To stop using repo-fit, `repo-fit remove` sets its own parts aside and leaves your files as they are.
- **Your files never leave your computer.** It does not upload, publish, or send anything. Two small exceptions: once a day the briefing asks npm whether a newer repo-fit exists (only the name "repo-fit" is sent; turn it off with `repo-fit prefs set updateCheck off`), and, only if you ask, it creates an empty, private backup location for your project on GitHub or GitLab.
- **It never reads the contents of files that look like secrets** (passwords, keys). It only warns you if such a file is in a risky place.

The [full list of what it reads and when it uses the network](docs/reference.md#security-and-privacy) is in the reference.

## Where this stands

**Public beta.** This version adds organizing (see the [changelog](CHANGELOG.md)). Built and used by one person so far, on a Mac, with Claude Code, and tried on test folders, not yet on many real ones. Automated tests pass on Mac, Linux and Windows. Codex support is written to the official documentation but has not been tried live yet. If you try it, [tell us what happened](https://github.com/JimmySadek/repo-fit/issues): that is the most useful thing you can do right now.

## For developers

Everything technical lives in one page: commands, the scripts, how it adapts to a repo that has its own system, the review queue, autosave rules, security details, tests, and what is not built yet.

- [Technical reference](docs/reference.md)
- [INSTALL.md](INSTALL.md): the step-by-step an AI assistant follows
- [CONTRIBUTING.md](CONTRIBUTING.md) and [CHANGELOG.md](CHANGELOG.md)

MIT licence. Made by [Jimmy Sadek](https://github.com/JimmySadek).
