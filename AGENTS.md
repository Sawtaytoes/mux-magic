# AGENTS.md

Guidelines for AI agents working on this codebase.

## Project

A Node.js CLI and REST API for batch media file operations (MKV track manipulation,
file renaming, subtitle merging, etc.) using mkvtoolnix, ffmpeg, and mediainfo.

## Code Rules & Conventions

👉 **Full reference:** [docs/agents/code-rules.md](docs/agents/code-rules.md)

Quick summary of the four most-violated rules:

1. **No `for`/`for...of`/`while` loops over arrays.** Use `forEach`/`map`/`filter`/`reduce`.
2. **`const` only. No `var`. No `let` mutation.**
3. **Spell every variable name out.** No single letters or abbreviations.
4. **Booleans start with `is` or `has`.** `isSourceDeleted`, not `deleteSource`.

Plus function destructuring (2+ args → single object param), always-braced `if`/`else`, arrow functions with implicit returns, and no barrel files.

**Before opening a PR:** Search your diff for `for(`, `var`, `let` (with reassignment), single-letter names, boolean names without `is`/`has`, `return` (outside tests), and import paths ending in folders. Fix every hit.

## Testing

👉 **Full reference:** [docs/agents/testing.md](docs/agents/testing.md)

Quick checklist:

- Write a test when you fix a bug — every fix needs a regression guard
- Run `yarn test` and `yarn typecheck` before every commit
- Run `yarn e2e` before merging UI or API route changes
- Keep tests in sync with code changes — tests are documentation
- Verify Playwright tests pass before reporting a fix

Frameworks: vitest (unit + app-command), Hono in-process testing, Playwright (e2e).

## Architecture & Design Patterns

👉 **Full reference:** [docs/agents/architecture.md](docs/agents/architecture.md)

Key concepts:

- **Package manager:** Always `yarn`, never `npm` or `npx`
- **Observable-first:** Every command returns an Observable; errors via `catchNamedError`
- **Pure functions:** No direct mutation; use store functions that return new objects
- **API structure:** Focused modules (types, jobStore, logCapture, jobRunner, routes)
- **Sequence Runner:** `/sequences/run` DSL for multi-step job composition

See the detailed guide for CLI command modules, adding new commands, and utility patterns.

## Workflows & Collaboration

👉 **Full reference:** [docs/agents/workflows.md](docs/agents/workflows.md)

**Role identification:**

- **Primary** (`media-tools/`): Never push unless told. Commit-as-you-go keeps work safe.
- **Worker** (`media-tools-worker-<name>/`): Commit and push every change to feature branch. Merge only when told.

**Worktree workflow:** Commit as you go → push to PR → user reviews → merge when told.

**Commit conventions:** One logical group per commit. Don't batch multi-step work into a single end-of-session commit. Use `git add -p` to split unrelated concerns in the same file.
