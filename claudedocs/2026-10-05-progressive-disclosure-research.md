# Progressive disclosure: is it the right mechanism for repo-fit? (5 Oct 2026)

> Asked by the maintainer during Decision 1 (scope guard): state progressive disclosure clearly, or use a better mechanism if one exists. Primary sources only, fetched 5 Oct 2026.

## 1. Short answer

- **Yes. Progressive disclosure is the right mechanism, and no better one turned up.** Every primary source that solves "too much to load at once" uses it: Anthropic's Agent Skills, Anthropic's context-engineering guidance, Claude Code's subfolder rules, Codex's root-down rule files, `dox`, Karpathy's LLM wiki, and the UX source (Nielsen Norman Group).
- **Its weak point is staleness.** An index page that lies is worse than none. So the mechanism needs one addition: **scripts build and check the layers**, not written rules.
- **Use plain index pages as the main layer, not nested rulebooks.** Claude Code loads a subfolder's rule file when it reads a file there. Codex loads rule files only on the path from the repo root to the folder it started in. A Markdown index page works the same in both, and for a person.

## 2. What it means, from the sources

| Source (date) | What it says |
|---|---|
| Nielsen Norman Group, Jakob Nielsen (3 Dec 2006) | Show core options first and defer rare ones to a second screen. Improves learnability, efficiency and error rate. Designs typically work best with **two levels at most**; more levels disorient people |
| Anthropic, Agent Skills overview (fetched 5 Oct 2026) | Three levels: metadata always loaded (~100 tokens per skill), instructions when triggered (under 5k tokens), resources only when read ("none until accessed"). "Only relevant content occupies the context window at any given time" |
| Anthropic, "Effective context engineering for AI agents" (29 Sep 2025) | "Just in time": keep lightweight identifiers such as file paths and load data at runtime. Progressive disclosure lets agents "incrementally discover relevant context through exploration". "Folder hierarchies, naming conventions, and timestamps all provide important signals." A hybrid (some up front, the rest explored) can be best |
| Claude Code memory docs (fetched 5 Oct 2026) | Rule files above the working folder load at launch. "Files in subdirectories load on demand when Claude reads files in those directories." Path-scoped rules load only for matching files. Imports do **not** save context: they load at launch. Target under 200 lines per file |
| Codex AGENTS.md docs (fetched 5 Oct 2026; old URL now redirects to `learn.chatgpt.com/docs/agent-configuration/agents-md`) | Walks from the project root down to the current working folder, one file per folder, concatenated root first. Stops at 32 KiB (`project_doc_max_bytes`). Loading follows the start folder, not the files read |
| Karpathy, "LLM Wiki" gist (4 Apr 2026) | `index.md` is "a catalog of everything in the wiki", one line per page. The LLM reads it first, then drills into pages. Works "at moderate scale (~100 sources, ~hundreds of pages)" without embedding search. Proper search only "as the wiki grows". Plus `log.md` (append-only) and a lint pass for orphans, contradictions and stale claims |
| `dox` README (fetched 5 Oct 2026) | Root `AGENTS.md` holds the top-level index; child files hold local rules. Before an edit the agent walks from the root to the area, then updates the affected files after |
| `llms.txt`, Jeremy Howard (3 Sep 2024, revised 10 Aug 2026) | A Markdown map for agents: title, one-line summary, lists of links with a note each, and an "Optional" section for secondary material |

## 3. Alternatives compared

| Mechanism | Strength | Weakness | Verdict |
|---|---|---|---|
| Everything in one always-loaded rulebook | Simple | Costs context every session. Claude Code advises under 200 lines; Codex stops at 32 KiB. The ETH Zurich study (in the 4 Oct audit) found long context files raise cost over 20% | ❌ |
| Search only (the assistant greps when needed) | No upkeep | Finds words, not "which note is the current one". Finds nothing you did not think to search for. Gives a person nothing to browse | ⚠️ Fallback only |
| Meaning-based search (embeddings, a database) | Finds by meaning at large scale | Needs installs or a service. Karpathy: an index is enough up to hundreds of pages | ❌ Out of scope; revisit only at a measured scale |
| Nested rulebooks per folder (`dox`) | Local rules where they matter | Loads on demand in Claude Code, but in Codex only along the start path | ⚠️ Optional for big code repos |
| **Layered index pages (progressive disclosure), kept true by scripts** | Works for Claude Code, Codex and people alike. Cheap: one line per note. Matches every source above | Goes stale without upkeep | ✅ **Recommended** |

## 4. What this means for repo-fit

```
Always loaded (a few lines)    "Start at MAP.md"
        │
MAP.md        one line per area: what lives there, where its index is
        │
area index    one line per note: title, one-line summary, date
        │
the note
```

1. **For the assistant:** the always-loaded part stays tiny and points at the map. Any note is at most **two steps from the map** (map, then area index). This is measurable: it becomes the "Find anything" score.
2. **For the person:** one screen first, detail on request. A tidy batch shows a short summary; the full list of moves is one step away. Two levels at most (Nielsen).
3. **Scripts keep the layers true:** the map and the index pages are built and checked by a script. The fit check flags notes missing from an index, index lines pointing at nothing, and stale entries.
4. **Search stays the fallback,** never the map.

## 5. Limits

- Codex loading behaviour is from its docs, not tested here. The repo's `guidance/codex.md` cites the old URL, which now redirects; the next guidance refresh should update it.
- Karpathy's "hundreds of pages" is his observation, not a measured limit.
- I did not find a mechanism that beats this one. That is "not found in what I read", not proof that none exists.
