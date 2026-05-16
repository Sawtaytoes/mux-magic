# AGENTS.md

Guidelines for AI agents working on this codebase. **This file is an index.** The reference docs under [docs/agents/](docs/agents/) are the source of truth — open the one matching your task.

## Project

A Node.js CLI and REST API for batch media file operations (MKV track manipulation, file renaming, subtitle merging, etc.) using mkvtoolnix, ffmpeg, and mediainfo.

## Reference Docs (open the one for your task)

| Topic | Doc |
|-------|-----|
| Code rules, naming, function style, no-barrels, indentation | [docs/agents/code-rules.md](docs/agents/code-rules.md) |
| Testing — frameworks, pre-merge gate, forbidden styles, coverage discipline | [docs/agents/testing.md](docs/agents/testing.md) |
| Test interaction conventions — `user-event`, controlled inputs, `.toBeVisible()` | [docs/agents/test-interactions.md](docs/agents/test-interactions.md) |
| Storybook — required files for new components | [docs/agents/storybook.md](docs/agents/storybook.md) |
| Architecture — Observable-first, API structure, command modules | [docs/agents/architecture.md](docs/agents/architecture.md) |
| External tool binaries (Windows paths for mkvtoolnix / MediaInfo) | [docs/agents/external-tools.md](docs/agents/external-tools.md) |
| Workflows, roles, commit conventions | [docs/agents/workflows.md](docs/agents/workflows.md) |
| Worker port/PID protocol (parallel e2e without collisions) | [docs/agents/worker-port-protocol.md](docs/agents/worker-port-protocol.md) |
| npm publishing for `@mux-magic/tools` | [docs/agents/npm-publishing.md](docs/agents/npm-publishing.md) |
| PowerShell UTF-8 traps (Windows) | [docs/agents/powershell-windows.md](docs/agents/powershell-windows.md) |

## The Five Most-Violated Rules

Full details in [code-rules.md](docs/agents/code-rules.md) — these are the ones agents break most:

1. **No `for` / `for...of` / `while` loops over arrays.** Use `forEach` / `map` / `filter` / `reduce`.
2. **`const` only. No `var`. No `let` mutation.**
3. **Spell every variable name out.** No single letters or abbreviations.
4. **Booleans start with `is` or `has`.** `isSourceDeleted`, not `deleteSource`.
5. **No array mutation.** No `.push`, `.splice`, `.pop`, `.shift`, `.unshift`, in-place `.sort` / `.reverse`. Prefer `xs.concat(item)` over `[...xs, item]`.

Plus: function destructuring (2+ args → single object param), always-braced `if` / `else`, arrow functions with implicit returns, no barrel files, `Array.from(foo.values())` instead of `[...foo.values()]`.

## Before Every Commit

- `yarn lint` — auto-fix formatting (biome + eslint); re-stage changed files
- `yarn typecheck` — full monorepo type check
- `yarn test` — unit + integration

Before merging UI or API route changes, also run `yarn e2e`. Full pre-merge gate in [testing.md](docs/agents/testing.md).

## Roles (one-liner)

- **Primary** (repo root, branch `master` or `feat/mux-magic-revamp`): never push unless told; commit as you go.
- **Worker** (`.claude/worktrees/<id>_<slug>/`, branch `worker-<id>-<slug>`): commit and push every change; open a PR against `feat/mux-magic-revamp`; only merge when told.

Full worktree / commit conventions in [workflows.md](docs/agents/workflows.md).

## Package Manager

Always `yarn`, never `npm` or `npx`. One-off executables use `yarn dlx <pkg>`.
