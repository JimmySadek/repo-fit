---
topic: The code tools deep sweep 2 uses when a repo has them installed (knip, dependency-cruiser, jscpd)
tool: deep-mode
models:
retrieved: 2026-10-25
review_after: 2026-11-24
confidence: high for knip's JSON reporter, exit codes and flags (primary, read); medium for dependency-cruiser (the flags are read, the "circular" field is only shown in a sample, never defined); medium for jscpd (flags and report name read; the line fields of a duplicate are not shown in the part read)
sources:
  - https://knip.dev/features/reporters (primary, read)
  - https://knip.dev/reference/cli (primary, read)
  - https://github.com/sverweij/dependency-cruiser/blob/main/doc/cli.md (primary, read)
  - https://github.com/sverweij/dependency-cruiser/blob/main/doc/output-format.md (primary, read)
  - https://github.com/kucherenko/jscpd (primary, read)
  - https://github.com/kucherenko/jscpd/blob/master/docs/rust.md (primary, read in part)
---

# Code tools for deep sweep 2

Sweep 2 uses a repo's own code tools when they are installed (in its `node_modules/.bin`, or on the PATH), and repo-fit's built-in import graph and copy finder otherwise. It never installs them and never runs `npx`. Each tool's answer replaces only its own part of the analysis; when its output is not what this note expects, the built-in part answers instead.

## What this changes in the kit

- **T1. knip finds unused files and exports.** repo-fit runs `knip --reporter json --no-progress --no-exit-code` and reads the `issues` array: one entry per file, with `file`, a `files` array (the file itself is unused) and an `exports` array (items with `name`). `lib/analyze.mjs` `viaKnip`.
- **T2. knip's exit codes.** 0: no issues. 1: issues found. 2: knip did not run (bad input, a plugin config that failed to load, an internal error). `--no-exit-code` turns 1 into 0; 2 stays 2. repo-fit reads the output, not the exit code, and falls back when there is no JSON.
- **T3. dependency-cruiser finds import loops.** repo-fit runs `depcruise --no-config --output-type json --exclude "<pattern>" .`. `--no-config` runs without the repo's own config file. `--exclude` takes a regular expression. The JSON has a `modules` array; each module has a `source` and a `dependencies` array with `resolved` and `circular`. repo-fit links only the dependencies marked `circular: true`. The docs show `circular` only in a sample, so a version that leaves it out makes repo-fit use its own graph. `lib/analyze.mjs` `viaDepcruise`.
- **T4. jscpd finds copied code.** repo-fit runs `jscpd --silent --reporters json --output <temp folder> --min-lines 6 --ignore "<globs>" .` and reads `jscpd-report.json` (`--report-name` defaults to `jscpd-report`). jscpd 5 is a Rust rewrite with the same `jscpd` command; `--min-lines` defaults to 5 there, so repo-fit sets 6 to match its own finder. Each duplicate has `firstFile` and `secondFile`; repo-fit reads their `name` and the line numbers as `start`/`end` or `startLoc.line`/`endLoc.line`, whichever is there. `lib/analyze.mjs` `viaJscpd`.

## Open checks

- dependency-cruiser: confirm in a real run what `circular: true` marks (each edge of a loop, or only one).
- jscpd 5: confirm the line fields of a duplicate in a real `jscpd-report.json`.

## Changed since last review

- 2026-10-25: first version, for 0.9.0 deep sweep 2.
