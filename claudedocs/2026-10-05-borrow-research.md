# What to borrow: research on the organizing sources (5 Oct 2026)

> Step 3 of the redesign. Five research agents read each source's own README, docs and code (primary sources only, fetched 5 Oct 2026). This report merges their findings into one borrow/skip list mapped to repo-fit's capabilities: **Map, Organize, Connect, Capture, Keep fit, Improve, Open work**. "Script" means a plain Node script can do it with no judgement. "Judgement" means the assistant decides.

## 1. Short answer

- **Nobody organizes an existing mess in place, safely.** The five wiki tools build a separate wiki beside your files. `nvk/llm-wiki` moves files, but without a receipt or undo. `claude-obsidian` cannot move files at all. So repo-fit's core job (one approved plan that organizes the person's own files, fully undoable) is new. **Every mechanic it needs exists somewhere, in pieces.**
- **The design should be built from about a dozen proven pieces**, nearly all of them plain scripts with no judgement. They fit repo-fit's limits (Node only, no dependencies, no services).
- **Licenses:** borrow code-level ideas only from MIT sources. `claude-memory-compiler` and `fable5-methodology` have **no license**: ideas only, never code or text.

### The pieces that shape the design

| # | Piece | From | Capability |
|---|---|---|---|
| 1 | **The yes is tied to the exact plan:** a fingerprint of the plan and files; if anything changed after the preview, refuse and show a fresh plan | claude-obsidian `transaction.py` | Organize |
| 2 | **Journal before the first move;** roll back on failure; recover after a crash; date-stamped archive names; collision check first | claude-obsidian; OpenSpec `archive.ts` | Organize |
| 3 | **Safe move algorithm:** plan the whole batch first, rewrite links in both directions, resolve against the after-move state, keep fragments and aliases, skip code blocks, refuse to overwrite | VS Code Markdown language service; Foam | Organize |
| 4 | **Code-reference check:** search text files for the path and file name; any hit outside Markdown → do not move it, show it | Git docs (`git grep`) | Organize |
| 5 | **Uncertain items go to `inbox/`,** not into a guess | Johnny.Decimal | Organize |
| 6 | **The map and index pages are a cache** built by script from the files: rebuilt when counts differ; one-line summary from frontmatter or the first paragraph; missing notes marked, never dropped; a "why this area exists" line | nvk; Astro-Han; Johnny.Decimal; Zettelkasten structure notes | Connect |
| 7 | **A tiny pointer in AGENTS.md** inside a versioned marker block (about 20 lines at most), detail on demand. OpenSpec stopped writing rules into AGENTS.md because agents read passive files unreliably | Backlog.md; OpenSpec | Connect |
| 8 | **Fit check = fixed script checks,** split into three kinds (proven fact, assistant's opinion, page to rebuild); fast every session, judgement pass now and then; it only reads, repairs are separate approved changes | atomicstrata; SamurAIGPT; claude-obsidian lint | Keep fit |
| 9 | **Capture:** visible `inbox/`; exact duplicates found by fingerprint; standing rules as a lookup table; a new rule is dry-run against the inbox first; "Not now" is remembered | claude-obsidian; nvk; backpass; agent-playbook | Capture |
| 10 | **Improve:** propose a rule only after a pattern repeats (2+); ask in the moment, not from a queue; a correction that matches an approved rule means "make it a script"; show exact text, target and reason; never edit rule files automatically | claude-reflect's own data; backpass; agent-playbook; nvk | Improve |
| 11 | **Open work:** checkbox parser (only `x` is done); states like "stale" worked out when read, never stored; a generated board between markers | OpenSpec; Backlog.md | Open work |
| 12 | **Test with one healthy sample repo plus one sample per defect** | nvk test fixtures | Measurement |

### What the sources get wrong, and repo-fit must avoid

- **Deleting:** nvk's inbox deletes processed files by default; atomicstrata's `rm` deletes immediately; SamurAIGPT can delete sources after converting them.
- **Moves without a receipt** (nvk) and **model-written pages without review** (SamurAIGPT, claude-memory-compiler).
- **English-only pattern matching** for corrections (nvk, claude-reflect), which fails repo-fit's non-native English users.
- **Index pages kept current only by a written rule** (claude-obsidian, dox). repo-fit enforces it in code.

### What ran on this machine during research

Three agents ran third-party test suites inside the session's scratch folder: claude-obsidian (4 suites), Astro-Han (52 tests) and nvk (47 tests), all passing. No tool was installed and nothing was written into this repo or any other.

## Group 5: organizing methods and safe moves

| ID | Source | Date | License |
|---|---|---|---|
| S1–S4 | Forte Labs: PARA page; Building a Second Brain overview; "Why PARA is the key to the AI era"; version notes | 2018–2026 (PARA page updated 15 Apr 2026) | © Forte Labs |
| S5–S6 | Johnny.Decimal documentation (areas and categories, IDs, the index "JDex", inbox and archive, "standard zeros"); `johnnydecimal/index-spec` | pages undated; spec draft 6 Aug 2026 | spec MIT |
| S7 | zettelkasten.de: introduction, atomicity, hubs, structural layers | 2015–2025 | CC (inconsistent statements) |
| S8 | Obsidian help source (internal links, files and links settings, embeds, properties, symlinks) | 2025–2026 | none in repo |
| S9–S11 | CommonMark 0.31.2; GitHub Flavored Markdown; GitHub docs on relative links and section links | 2024–2026 | — |
| S12–S13 | VS Code Markdown docs; `microsoft/vscode-markdown-languageservice` code (`fileRename.ts`, `rename.ts`, `mdLinks.ts`, tests) | 2026 | MIT |
| S14 | Foam: wikilinks and rename docs; `rename.ts`, `link-integrity.ts`, `markdown-link.ts` | 2026 | MIT |
| S15 | `notesmd-cli` (formerly obsidian-cli): `move.go` | 2026 | MIT |
| S16 | remark-validate-links; lychee | 2025–2026 | MIT; Apache-2.0 |
| S17–S18 | Git docs (`git mv`, rename detection, `--follow`, `core.ignoreCase`, `core.precomposeUnicode`, `git revert`, `git grep`); VS Code TypeScript refactoring | Git docs 2.50–2.56 | — |

### Part A: organizing methods

| Method | Structure | Starting from a mess | Index | Fit for a mixed repo |
|---|---|---|---|---|
| **PARA** | Projects, Areas, Resources, Archives; sort by what you are acting on | Move all old files into one archive folder **named with today's date** (a "time capsule"); nothing deleted. ⚠️ Only in the 2023 guide, not on today's PARA page | None: folders and search | Active vs reference works for notes and media, not for code |
| **Johnny.Decimal** | Numbered areas → categories → IDs (10 × 10 × 100 at most) | Move everything into the right category's **inbox** first, then file | 🎯 **The index is separate from the folders** ("your filesystem is not your index"); one line per entry is a valid format; each category has a note on **why it exists** | Inbox, archive and index fit; numeric prefixes do not (they rename every folder) |
| **Zettelkasten** | Flat atomic notes with stable IDs | Do not invent categories; just write | 🎯 **Structure notes**: a note that lists other notes, like a table of contents, added as the collection grows | Structure notes = "one index page per area"; IDs and splitting are too heavy |

**Borrow for structure**

1. Skeleton for a repo with no structure: `inbox/`, a few active areas, `archive/`, explained in plain words ("active work", "reference", "done") [S1, S5].
2. Items the plan cannot place confidently go to `inbox/` (Johnny.Decimal's approach), not into a guess [S5]. PARA's dated time capsule is an alternative for a large leftover pile [S2].
3. `MAP.md` = one line per area: name, path, short description [S5, S6].
4. Area index page = structure note + index entry: a top line saying **why this area exists**, then one line per note [S5, S7].
5. Soft warning when the map passes about 10 areas: suggest fewer, broader areas [S5].
6. The inbox is temporary: a batch review is the normal rhythm (Forte's example: weekly) [S2].
7. Archive: never deleted, one line in the map, outside the active list [S3, S5].
8. Forte's caution: filing by hand reminds people of their actions. So the plan shows a short **"why" per moved item** [S3].

### Part B: checklist for a safe move

**1. Plan**
- Build the whole old → new list first, and resolve every link against the **after-move** state (Foam's "future workspace") [S14].
- Refuse if a destination exists [S14, S17].
- Check for names that become ambiguous: if every area index is called `index.md`, `[[index]]` stops being unique. Give index pages unique names, or always write path links [S8, S14].

**2. Scan every Markdown file, not only the moved ones**
- Inline links, images, reference definitions (`[id]: path`), angle-bracket destinations (`<my file.md>`), HTML `src`/`href`, wikilinks with headings, block refs and aliases, embeds (`![[img.png|100]]`: there `|100` is a size), wikilinks inside frontmatter, folder links [S8, S9, S13, S14].
- Skip code blocks and inline code: they are not links. List path hits found there for the person [S9, S13].
- Resolve relative paths from the linking file's folder; percent-decode; match links without `.md`; normalize Unicode (macOS stores names decomposed, which matters for Arabic and accented names); flag case-only differences (macOS ignores case, other systems do not) [S8, S11, S13, S17].
- **Code and config references:** search all text files for the old path and the bare file name (`git grep -F -I -n --untracked`, or `--no-index` without Git). **Any hit outside Markdown → do not move that file automatically; show it** [S17]. No language-neutral tool exists for more.

**3. Rewrite**
- Two directions (VS Code's algorithm): links **to** the moved file from other files, and relative links **inside** the moved file [S13].
- Keep headings and block fragments, alias text, the embed `!`, link titles, `./` style, and the original with-or-without-`.md` style [S13, S14].
- Keep each link's own style for spaces (`<...>` or `%20`); prefer new names without spaces [S8, S13].
- Never change headings during a move: GitHub builds anchors from heading text [S11].
- Fail loudly if a file cannot be read; never write empty content [S14].
- ⚠️ Obsidian does not update links for moves made outside Obsidian. repo-fit must rewrite them itself [S8].
- ⚠️ Counter-example: `notesmd-cli` does plain string replacement and misses relative links and `%20` links, and edits inside code blocks [S15].

**4. Verify**
- Re-scan: every internal link and fragment resolves, and the number of working links is the same or higher than before [S12, S16].
- Same number of files before and after; moved files keep the same content fingerprint except edited link lines.
- With Git, `git status` shows "renamed". Git guesses renames by **50% similarity** by default and gives up above `diff.renameLimit` (1,000 files) [S17].

**5. Undo**
- Without Git: write the receipt **before** touching anything (ordered old → new list, backups of edited files, fingerprints). Undo replays in reverse and refuses if a fingerprint changed. Never delete. (Design inference; matches repo-fit's `apply`/`undo`.)
- With Git: Git stores **no rename record** [S17]. Inference: keep pure moves and link edits separate, so history follows each file. Never use `reset --hard` or `restore`, which discard uncommitted work [S17].
- If a repo says "commit only when asked", use the receipt method even when Git is present.

**Skip:** Johnny.Decimal numeric prefixes and hard limits; Zettelkasten IDs and splitting; Zettelkasten "no categories"; PARA's four folders on a repo that already has structure; PARA "archive everything" for a whole repo (would move code); creating Obsidian block refs; Foam, remark or lychee as dependencies (borrow the algorithm); code-aware rewriting (code never moves: detect and stop).

**Limits:** PARA's time capsule is in the 2023 guide only; the PARA book and course were not read. Johnny.Decimal pages show no dates. Obsidian is closed source and its outside-move behaviour is stated only on the symlinks page (untested). GitHub's rendering of `[[...]]` was not tested. "Separate commits for moves and link edits" is an inference, not official guidance. No VS Code, Foam or notesmd-cli tests were run.

## Group 1: the LLM wiki family (Karpathy's note and four implementations)

| Source | What was read | Latest commit seen | License |
|---|---|---|---|
| Karpathy, "LLM Wiki" gist | In full | 4 Apr 2026 (only revision) | none stated |
| `Astro-Han/karpathy-llm-wiki` | README, `SKILL.md`, templates, `scripts/check_evidence.py` and its tests (the agent ran them: 52 pass) | `eafcc77`, 23 Jul 2026 | MIT |
| `SamurAIGPT/llm-wiki-agent` | README, `CLAUDE.md`, commands, `tools/` (`health.py`, `lint.py`, `ingest.py`, `heal.py`, `refresh.py` and others) | `572c8eb`, 28 Sep 2026 | MIT |
| `nvk/llm-wiki` v0.25.1 | README, the wiki-manager skill and its references (structure, linting, indexing, ingestion, feedback, archive), lint functions of its Python helper, hooks (the agent ran its lint tests: 47 pass) | `95a042c`, 2 Oct 2026 | MIT |
| `atomicstrata/llm-wiki-compiler` v1.4.2 | README, architecture and sources contract, docs, `indexgen.ts`, `hasher.ts`, `rule-candidates.ts`, linter (`rules.ts`, `tiers.ts`, `fix-plan.ts`), `next.ts`, `slugify` | `605461f`, 2 Oct 2026 | MIT |

**Main findings**

- ⚠️ **None of the five organizes an existing mess in place.** All create a separate `raw/` + `wiki/` area that the model writes. repo-fit's job (organize the person's own files) is new; only the mechanics transfer.
- 🎯 **nvk: an index page in every folder, and "the index is a cache".** An index counts as stale when its number of rows differs from the number of files, and is then rebuilt from the files by plain code. Reading goes master index → folder index → files.
- 🎯 **nvk: "lint is the migration".** A misplaced file moves to the folder its metadata implies; an unknown file goes to an "unknown" inbox; unknown folders are never touched; grouping loose files into a project is **never** automatic. ❌ But its moves leave no receipt and cannot be undone, and its inbox deletes processed files by default.
- 🎯 **Astro-Han: repair a broken link only when exactly one matching file exists;** otherwise report it. A missing note's index row is marked `[MISSING]`, never dropped. Never silently rewrite an old claim: add a dated "Outdated" or "Disputed" note under it.
- 🎯 **atomicstrata: three kinds of finding.** Proven fact (a broken link), the model's opinion (a contradiction), and a generated file to rebuild. Only proven facts answer "is it broken?". Its fixer returns proposed edits as data and never writes.
- **A fast script check every session, a slower judgement pass now and then** (SamurAIGPT's health vs lint split).
- **Safe file names for every language:** keep any letter or digit; nvk's version keeps only English letters, so Arabic or Chinese names come out empty.
- **Moving single files breaks links** (nvk's archive design avoids moves for that reason): after a move, recompute links and rewrite them.
- **Learning from corrections:** nvk classifies messages by English-only patterns and only proposes exact rule text with a target and a reason, never editing rule files itself. atomicstrata stores proposed rules as files with a status field (proposed, approved, rejected).

**Borrow**

| Capability | What | Source | Who |
|---|---|---|---|
| Map | A read-only status with one recommended next step | atomicstrata `next.ts` | Script |
| Map | One-line summary for a note without metadata: a "Summary:" line, else the first real paragraph, link syntax stripped, length capped | nvk `first_body_summary` | Script |
| Map | Safe names in any language (any letter or digit; suffix on a clash; refuse empty) | atomicstrata `slugify` | Script |
| Organize | Suggest a group when 3+ files share a name start after removing dates, "v2", "final"; the person names the folder when the shared part is too short | nvk check C9d (spec only; repo-fit would code it) | Script suggests, person names |
| Organize | Reuse an existing folder if close enough; a new one only for a clearly separate topic | Astro-Han `SKILL.md` | Judgement |
| Organize | Destination exists → skip and warn; `-2`, `-3` on clashes; never move unknown folders | nvk `unique_destination`, `handle_unknown` | Script |
| Organize | After a move, recompute links and propose rewrites as data `{file, line, from, to}` | nvk `archive.md`; atomicstrata `fix-plan.ts` | Script |
| Connect | Index page per area (File, Summary, Updated); pointer → map → area index → note | nvk structure and indexing docs | Script |
| Connect | The index is a cache: rebuilt from the files when counts differ | nvk indexing docs | Script |
| Connect | Generated files carry a banner and a count footer, and are written safely (temporary file, then rename) | nvk; atomicstrata `atomic-write.ts` | Script |
| Connect | A missing note's row is marked `[MISSING]`, never dropped | Astro-Han | Script |
| Connect | Link paths with spaces wrapped in `<...>` | nvk | Script |
| Connect | A one-line description under each area heading | Astro-Han index template | Judgement once, script keeps it |
| Capture | Inbox filed by file kind first; processed items move, **never deleted** | nvk inbox processing (without its delete) | Script |
| Capture | Standing rules as a table (condition → folder) | nvk `canonical_path_for` | Script after a yes |
| Capture | Proposed rules as records with status proposed / approved / rejected | atomicstrata `rule-candidates.ts` | Script stores, person approves |
| Capture | Record "nothing new here" so the item is not asked about again | Astro-Han triage | Judgement decides, script tracks |
| Keep fit | Three kinds of finding: fact, opinion, rebuild | atomicstrata `tiers.ts` | Script |
| Keep fit | Fast script check every session; judgement pass now and then | SamurAIGPT | Script + judgement |
| Keep fit | Script checks: broken links (fix only on exactly one match), orphans, duplicate titles, stubs, index vs disk both ways, inbox items never filed, notes past an age | Astro-Han, atomicstrata, SamurAIGPT, nvk | Script |
| Keep fit | Dated "Outdated" / "Disputed" note under a contradicted claim; never rewrite silently | Astro-Han article template | Judgement writes, script checks the format |
| Keep fit | Numbers, dates and quotes in a summary must appear word for word in the cited note (report only) | Astro-Han `check_evidence.py` (port) | Script |
| Keep fit | Plain-English findings first; severity levels | nvk report format | Script |
| Keep fit | Tests: one healthy sample repo plus one sample per defect | nvk test fixtures | Script |
| Improve | Proposed rule edit shows exact text, target and reason; never edits rule files automatically | nvk `ll.md` | Judgement + person |
| Improve | When repo-fit changes its own formats, keep an old→new name table instead of migration code | nvk | Script |

**Skip:** embeddings, BM25 search, MCP servers, web viewers; scripts that call a model API; knowledge graphs; pages generated without review; every delete path in these tools (inbox delete, `rm`, `--delete_source`); moves without a receipt; 0–100 scores; a fixed `raw/` + model-owned `wiki/` layout; a hub outside the repo; Obsidian-only double link format.

**Limits:** most ingest and lint steps in all five are prompt text; whether agents follow them was not checked. SamurAIGPT and atomicstrata were not run. Several docs disagree with their code (noted by the agent).

## Group 2: drop-in capture (claude-obsidian, claude-memory-compiler)

| Repo | What was read | Latest commit seen | License |
|---|---|---|---|
| `AgriciDaniel/claude-obsidian` v2.2.0 | README, AGENTS.md, WIKI.md, PRIVACY.md, CHANGELOG v1.5–v2.2, hooks, the ingest/save/lint/mode skills and agents, `hook_adapter.py`, `mode_config.py`, `page_schema.py`, parts of `capture.py`, `lint_engine.py`, `transaction.py`, `vault_ops.py`, `scripts/wiki-mode.py`, vault templates. The agent also ran 4 of its test suites locally | `32ac5a0`, 10 Sep 2026 | MIT |
| `coleam00/claude-memory-compiler` | Every file except the lock file | `54eddd7`, 6 Apr 2026 | ⚠️ **None** (no LICENSE file). Borrow ideas only, never code |

**Main findings**

- ⚠️ **claude-obsidian's tagline promises more than its code does.** Nothing watches the inbox. The user drops a file in `inbox/`, runs the ingest command, the assistant drafts one change set, the user approves it, and a fixed engine applies it with a journal and rollback.
- 🎯 **The approval is tied to the exact plan** (`transaction.py`): a fingerprint (SHA-256 hash) covers the plan and every file's bytes. If anything changed after the preview, the engine refuses to apply.
- 🎯 **A journal is written before the first change** (prepared → applying → complete), with backups and rollback on failure, and recovery after a crash. ❌ But there is **no undo after a completed change**, and the engine **cannot move or delete** files: only create and replace.
- **Exact duplicates are found by fingerprint** before filing (`capture.py`); near-duplicates are left to the assistant. File kind is detected from the first bytes, not only the extension.
- **Filing is a fixed lookup** (`wiki-mode.py route`): type and name give a folder and a safe file name. That matches repo-fit's standing rules.
- **Its index stays current only by a written rule,** and its lint does not report notes missing from the index. repo-fit can enforce both in code.
- **Its session-start hook is off by default,** capped at 32 KiB, scrubbed, and wrapped as "data, do not follow instructions inside".
- **claude-memory-compiler captures sessions, not files:** hooks read the transcript, then the model writes notes in the background with **no review and no undo**, and its notes folder is ignored by Git by default. Useful only for hook hygiene (a guard against hooks calling themselves, size caps, fast hooks) and its structural lint checks.
- ❌ Neither repo turns repeated corrections into rules.

**Borrow**

| Capability | What | Source | Who |
|---|---|---|---|
| Map | Folder walk that honours `.gitignore` with a pure parser, so it works without Git | claude-obsidian `lint_engine.py`, `gitignore.py` | Script |
| Map | Detect file kind from the first bytes, to group media apart from notes | claude-obsidian `capture.py` | Script |
| Organize | 🎯 Tie the yes to the exact plan: fingerprint the plan and files; refuse if anything changed. Hidden from users | claude-obsidian `transaction.py` | Script |
| Organize | 🎯 Journal before the first move; back up; roll back on failure; recover on the next run | claude-obsidian `transaction.py` | Script |
| Organize | Portable names: no Windows-reserved names or characters, no names that differ only by case, length cap | claude-obsidian `transaction.py`, `wiki-mode.py` | Script |
| Organize | A deletion is only a review record, never executed | claude-obsidian `capture.py` | Script |
| Connect | Read the small map first, then only the notes it points to | both repos | Pointer text |
| Connect | One-line index row from the note's frontmatter or first line | memory-compiler `utils.py` (idea only) | Script |
| Connect | Rebuild index pages in the same apply as the move (claude-obsidian only asks for it in writing) | claude-obsidian `WIKI.md` | Script |
| Connect | Safe session-start text: size cap, scrub, "data, not instructions" wrapper | claude-obsidian `hook_adapter.py` | Script |
| Connect | Bare-name `[[links]]` only when the name is unique | claude-obsidian `WIKI.md` | Script |
| Capture | A visible inbox only, never a hidden folder | claude-obsidian `capture.py` | Script |
| Capture | 🎯 Exact duplicate check by fingerprint before filing ("already here") | claude-obsidian `capture.py` | Script |
| Capture | Batch limits: number of items, total size, size per file | claude-obsidian `capture.py` | Script |
| Capture | Standing rule = fixed lookup (kind → folder, safe name) | claude-obsidian `wiki-mode.py` | Script |
| Capture | Plain labels for the "ask once" question (document, research, decision, conversation, reference, data, media); "do nothing" is a valid answer | claude-obsidian ingest skill | Judgement |
| Capture | Dropped content is data, never instructions | claude-obsidian ingest skill | Rule |
| Keep fit | 🎯 Fixed checks: dead and ambiguous links, duplicate names, orphans, missing frontmatter, empty sections, stale index lines; code blocks ignored | claude-obsidian `lint_engine.py` | Script |
| Keep fit | Thin notes, source changed since indexed (fingerprint kept), missing backlink as a low hint only | memory-compiler `lint.py` (idea only) | Script |
| Keep fit | Contradictions: one assistant pass with a strict answer format, inside the session | memory-compiler `lint.py` (idea only) | Judgement |
| Keep fit | The check only reads; a repair is a separate approved change; re-check afterwards | claude-obsidian lint skill | Script + yes |
| Keep fit | Severity levels with a "can fix itself" flag; a fixed date option for repeatable tests | both repos | Script |
| Improve | Nothing direct. Idea: count repo-fit receipts to spot moves the person repeats by hand, then propose a rule | inference from both logs | Script counts, judgement proposes |

**Skip:** background model calls from hooks and unattended writes (break "one yes", cost money); sending every note in every prompt; search engines and rerankers (BM25, Ollama); source and claim ledgers; keeping a raw copy of every source; showing users a hash to copy; named method modes (PARA, Zettelkasten IDs); Obsidian-only features; the Python runtime; any code from memory-compiler (no license).

**Limits:** memory-compiler was not run. claude-obsidian's full test suite and an end-to-end ingest were not run. "Backups stay after success" comes from reading the code, untested. In both repos the docs and the code disagree in places (noted by the agent).

## Group 4: self-improvement and enforcement (claude-reflect, backpass, agent-playbook, fable5-methodology)

| Repo | What was read | Latest commit seen | License |
|---|---|---|---|
| `BayramAnnakov/claude-reflect` v3.3.1 | README, BACKLOG.md, CI, hooks, capture and reminder scripts, `reflect_utils.py`, `semantic_detector.py`, the `/reflect` command, the newer "mod" (`register.tsx`) | `b6c4232`, 2 Oct 2026 | MIT |
| `kunchenguid/backpass` v0.1.32 | README, VISION.md, `redact.js`, `gap-ledger.js`, `memory.js`, `state.js`, `analyze.js`, prompts, `bootstrap.js` | `0268201`, 1 Oct 2026 | MIT |
| `zhaono1/agent-playbook` v0.4.2 | READMEs, `self-improvement.js`, `behavior-proposal.js`, `owner-resolver.js`, `eval-runner.js` (structure), parts of `cli.js`, the self-improving skill, `host-conformance.md` | `be7a9d7`, 25 Aug 2026 | MIT |
| `UnpaidAttention/fable5-methodology` | README, all 7 hook scripts, AUDIT.md (part), MEMORY.md, evals runner | `ee559b5`, 7 Jul 2026 | ⚠️ **None** (all rights reserved). Ideas only |

**Main findings**

- 🎯 **Repetition is the signal, not wording.** claude-reflect's own backlog found only about 1 in 5 captured "corrections" was a reusable rule, while real rules kept coming back (one was typed 4 times and never saved). backpass needs a gap seen in **2 or more sessions** before proposing; agent-playbook ranks by repeats. → repo-fit proposes a rule only after a pattern repeats.
- 🎯 **Ask right away, not from a queue.** claude-reflect's queue grew to 102 items across 37 projects that nobody cleared; its author built a second version that asks right after the correction. → Supports the "Yes, and always do this" button at the moment of filing.
- **Most of the safety is plain code:** write inside one marked block and refuse if the markers are broken; spot "the same rule" with word-pair similarity; remember a "Not now" and ask again only when evidence grows; expire stale candidates; a size gauge for always-loaded files.
- **fable5's enforcement idea:** map every rule to what enforces it (hook, script, check) and label prose-only rules honestly. "Which file enforces this tomorrow?" (No license: idea only.)
- **A "regression" flag** (agent-playbook): a correction that matches a rule already approved means the written rule is not working, so suggest a script instead.
- ⚠️ **None of the four shows measured proof** that its loop improves agent behaviour. fable5 says so openly.
- ❌ Regex detection of corrections is weak (about 20% precision by claude-reflect's own count) and covers only English and Chinese/Japanese/Korean patterns, not repo-fit's users. Transcript mining reads private sessions and needs a model and extra tools.

**Borrow**

| Capability | What | Source | Who |
|---|---|---|---|
| Capture | Rules written inside one marked block; re-read before writing; skip near-duplicates; refuse if markers are broken | reflect mod `register.tsx` | Script |
| Capture | Rule hygiene before saving: one line, under 200 characters, no control characters, no secret shapes | reflect mod `register.tsx` | Script |
| Capture | "Same item" counter with word-pair similarity (Unicode letters) | reflect mod; backpass `memory.js` | Script (weak for languages without spaces) |
| Capture | Remember "Not now" with the count at that moment; ask again only when the count grows | backpass `state.js` | Script |
| Capture | Dry-run a new standing rule against the inbox before it starts ("this would file 7 items") | adapted from agent-playbook validate-before-apply | Script |
| Keep fit | Expire stale candidates; retire one once an existing rule covers it | backpass `gap-ledger.js` | Script |
| Keep fit | Size gauge for always-loaded files; warn when over budget | backpass README; reflect's 150-line warning | Script |
| Keep fit | Show pending decisions in the briefing, at most 5 lines | reflect, fable5 | Script |
| Keep fit | Refuse to apply if a file changed since the dry run; all or nothing per file | backpass README | Script (⚠️ repo-fit's `apply` today rebuilds at apply time instead of refusing; see Group 2's plan fingerprint) |
| Keep fit | Honest status words: seen working / failed / not set up / not supported / untested | agent-playbook `host-conformance.md` | Script |
| Keep fit | Never count "maybe" or "skipped" as a pass | fable5 evals | Script |
| Improve | Rank by repeats; propose only at 2 or more | agent-playbook, backpass, reflect backlog | Script ranks; spotting a correction is judgement |
| Improve | Regression flag: a correction matching an approved rule → suggest a script | agent-playbook | Script match, judgement suggests |
| Improve | A broken rule needs reinforcing, not deleting; remove only when following it caused harm | backpass | Judgement, script applies the policy |
| Improve | Plain proposal: problem, proposed rule, times seen, where it lives, how to undo | agent-playbook `behavior-proposal.js` | Script template |
| Improve | Each approved rule records what enforces it (hook, script or "written only") | fable5 idea; agent-playbook `--change-ref` | Script |
| Scripts over prose | Hook hygiene: exit quietly on internal error, never loop in Stop hooks, a header saying what each hook enforces | fable5 hooks (idea) | Script |

**Skip:** a model call per prompt; regex correction detection; mining transcripts across sessions; keeping transcripts forever; syncing rules to many files (drift); executable tests as a gate for non-technical users; fable5's code-only gates and long playbook; claude-reflect's 1,536-line prompt; backpass's browser review and extra dependencies.

**Limits:** nothing was run; test counts are from text search. Several large files were read only in part. No repo shows outcome evidence.

## Group 3: big repos and open work (OpenSpec, Backlog.md, dox)

| Repo | What was read | Latest commit seen | Version | License |
|---|---|---|---|---|
| `Fission-AI/OpenSpec` | README; docs `existing-projects.md`, `concepts.md`, `agent-contract.md`, `migration-guide.md`; code `src/core/archive.ts`, `legacy-cleanup.ts`, `project-config.ts`, `init.ts`, `src/utils/spec-discovery.ts`, `task-progress.ts`, `change-utils.ts`; two skills | `2500d6d`, 2 Oct 2026 | 1.14.0 | MIT |
| `MrLesk/Backlog.md` | README, CLI instructions, `serializer.ts`, `operations.ts`, `agent-instructions.ts`, `cli-agent-nudge.md`, `init.ts`, `json-output.ts`, `readiness.ts`, `board.ts`, `readme.ts`, `scripts/cli.cjs` | `69e7b15`, 28 Sep 2026 | 1.53.0 | MIT |
| `agent0ai/dox` | Whole repo (README and AGENTS.md; it has no code), all 6 commits | `765ae4a`, 1 Sep 2026 | none | MIT |

**Main findings**

- ⚠️ **OpenSpec stopped writing into AGENTS.md and CLAUDE.md.** It now removes its old marker block and injects project context through its own command. Its migration guide says agents read the old passive file unreliably. This supports repo-fit's "scripts over prose" stance.
- **Delta-first is real and explicit** (`docs/existing-projects.md`): do not document the whole codebase; write only for what you are about to change; existing documents are source material and stay where they are.
- **OpenSpec's safe archive move** (`src/core/archive.ts`): date-prefixed name `YYYY-MM-DD-<name>` (keeps an existing date), checks the destination is free before touching anything, snapshots and rolls back on failure, moves by `rename`, and falls back to copy, fingerprint check, then remove when a rename fails across disks.
- **Backlog.md's tiny pointer** (`cli-agent-nudge.md`): a marked block of about 20 lines in AGENTS.md says only "run this first"; the full guidance comes on demand. The block carries a version line, is replaced in place, and a broken block (start marker without end) is left untouched.
- **Backlog.md moves files with plain `rename`**, so Git sees a move. It distinguishes "done" (a status), "complete" (moved, links kept) and "archived" (cancelled, references removed). "Ready" is worked out when read, never stored.
- **Backlog.md works without Git** (`--no-git`), but it is **not** dependency-free: it ships a compiled binary.
- **dox has no code and no checker.** The tree of AGENTS.md files is kept current by the agent alone. Its index format is not specified. repo-fit can add the checker dox lacks.
- 💡 None of the three has a "next step" field. repo-fit's "next step" line would be new.

**Borrow**

| Capability | What | Source | Who |
|---|---|---|---|
| Map | Folder walk: skip dot folders, do not follow linked folders, sort the same way on every computer, fail loudly on read errors | OpenSpec `spec-discovery.ts` | Script |
| Map | Map every area as one line; write the area's description only when it is first worked on | OpenSpec `existing-projects.md` | Script skeleton, judgement for text |
| Map | "Lasting boundary" test: a folder earns its own area when it has its own purpose and rules | dox `AGENTS.md` | Script proposes, judgement confirms |
| Organize | Archive name `YYYY-MM-DD-<name>`; collision check first; roll back on failure; rename, else copy + verify + remove | OpenSpec `archive.ts` | Script |
| Organize | Plain rename so Git sees a move; safe file names with an `untitled` fallback | Backlog `operations.ts` | Script |
| Organize | Never delete a user's rule file; remove only our own marker block | OpenSpec `legacy-cleanup.ts` | Script |
| Connect | Tiny always-loaded pointer, detail on demand (pointer → `MAP.md` → area index) | Backlog `cli-agent-nudge.md` | Script |
| Connect | Marker block with a version line, replaced in place, broken block skipped, report created/updated/unchanged | Backlog `agent-instructions.ts` | Script |
| Connect | Three reading depths: list (area and count), summary (one line per note), full note | OpenSpec explore skill | Script builds the layers |
| Connect | Hard size cap on always-loaded text, checked by a script | OpenSpec `project-config.ts` (50 KB) | Script |
| Capture | Inbox vs filed, with promote and demote (drafts vs tasks) | Backlog `operations.ts` | Script moves, judgement files |
| Capture | Look for an existing item by exact or normalized title before creating a new one | Backlog `task-creation.md` | Script |
| Keep fit | One finding shape `{severity, code, message, target, fix}`; one JSON document on stdout; findings exit 0 | OpenSpec `agent-contract.md` | Script |
| Keep fit | Checkbox parser: only `x`/`X` is done; nested and ordered lists count | OpenSpec `task-progress.ts` | Script |
| Keep fit | Derived states (stale, blocked) worked out when read, never written into notes | Backlog `readiness.ts` | Script |
| Keep fit | Unknown folders: warn and leave alone | OpenSpec `agent-contract.md` | Script |
| Improve | Durable preferences go into one "preferences" section (maps to standing rules) | dox `AGENTS.md` | Judgement proposes, script stores |
| Open work | Small task fields: `id, title, status, created, updated, labels, dependencies` | Backlog `serializer.ts` | Script |
| Open work | Body sections between HTML comment markers, so a script edits one section safely | Backlog structured sections | Script |
| Open work | Generated Markdown board between markers | Backlog `board.ts`, `readme.ts` | Script |
| Open work | `--json` with `schemaVersion` and `kind`; windowed lists for big repos | Backlog `json-output.ts` | Script |

**Skip**

- OpenSpec's requirement-spec format and merge engine (thousands of lines; notes are not specs), its adapters, telemetry and 10 runtime dependencies.
- YAML config: Node has no built-in YAML parser. Keep rules in Markdown or JSON.
- Backlog's compiled binary, MCP server, web UI and fuzzy search (Fuse.js breaks "no search engine").
- Backlog's "edit only through the command" rule: non-technical users edit by hand, so repo-fit must accept hand edits.
- Shouting instruction tone (`<CRITICAL_INSTRUCTION>`): conflicts with modest wording.
- dox's AGENTS.md in every folder: conflicts with the decided design (one `MAP.md`, one index per area).
- Letting the model scan tens of thousands of files: a script scans, the model only names things.

**Limits:** neither tool was run; claims come from reading code and docs. Performance on very large repos was not measured. dox's index format could not be verified beyond one old example.
