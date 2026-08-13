# AGENTS.md

Guidelines for AI agents working on this codebase. **This file is an index.** The reference docs under [docs/agents/](docs/agents/) are the source of truth — open the one matching your task.

## ⛔ Locked Decisions — read before changing behavior

[docs/decisions/](docs/decisions/) is an **append-only log of settled decisions**. Many were explicit user corrections ("no, that's wrong — do it this way"). **Do not silently reverse, re-litigate, or "improve" a locked decision back into the thing it replaced.** Before redesigning a feature, removing something that looks unused, or "simplifying" an API shape, check the decision log. If you genuinely believe a locked decision should change, do not just change it — propose a new ADR that supersedes the old one and get the user's sign-off first. Skim the [decisions index](docs/decisions/README.md) at the start of any non-trivial task.

## Project

A Node.js CLI and REST API for batch media file operations (MKV track manipulation, file renaming, subtitle merging, etc.) using mkvtoolnix, ffmpeg, and mediainfo.

## Reference Docs (open the one for your task)

| Topic | Doc |
|-------|-----|
| **Locked decisions — settled choices that must not be silently reverted** | [docs/decisions/](docs/decisions/README.md) |
| Runbook — combine two releases (video from A, subs from B); flatten + filename-pairing recipe | [docs/combining-two-releases.md](docs/combining-two-releases.md) |
| Code rules, naming, function style, no-barrels, indentation | [docs/agents/code-rules.md](docs/agents/code-rules.md) |
| Testing — frameworks, pre-merge gate, forbidden styles, coverage discipline | [docs/agents/testing.md](docs/agents/testing.md) |
| Test interaction conventions — `user-event`, controlled inputs, `.toBeVisible()` | [docs/agents/test-interactions.md](docs/agents/test-interactions.md) |
| Storybook — required files for new components | [docs/agents/storybook.md](docs/agents/storybook.md) |
| Architecture — Observable-first, API structure, command modules | [docs/agents/architecture.md](docs/agents/architecture.md) |
| Variables system — `runtimeValueType`, two-sources-of-truth contract for numeric variable types | [docs/agents/variables-system.md](docs/agents/variables-system.md) |
| External tool binaries (Windows paths for mkvtoolnix / MediaInfo) | [docs/agents/external-tools.md](docs/agents/external-tools.md) |
| Workflows, roles, commit conventions | [docs/agents/workflows.md](docs/agents/workflows.md) |
| Worker port/PID protocol (parallel e2e without collisions) | [docs/agents/worker-port-protocol.md](docs/agents/worker-port-protocol.md) |
| npm publishing — **bump `packages/tools` version in your PR to release `@mux-magic/tools`** | [docs/agents/npm-publishing.md](docs/agents/npm-publishing.md) |
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

- **Primary** (repo root, branch `master`): never push unless told; commit as you go.
- **Worker** (`.claude/worktrees/<id>_<slug>/`, branch `worker-<id>-<slug>`): commit and push every change; open a PR against `master`; **merge it yourself once CI is green** (below).

`master` is the only base branch — the `feat/mux-magic-revamp` integration branch was retired on 2026-08-03 ([decision](docs/decisions/2026-08-03-master-is-the-only-base-branch.md)). Older worker specs under [docs/workers/](docs/workers/) still say "PR against `feat/mux-magic-revamp`"; that text is stale and the branch no longer exists.

**Merge your own PR the moment CI goes green — don't ask.** Squash, via `gh api -X PUT repos/Sawtaytoes/mux-magic/pulls/<n>/merge -f merge_method=squash` (`gh pr merge` trips the shared-worktree lock). The ruleset below is what makes this safe: you cannot merge anything red, so "green" is the whole permission ([decision](docs/decisions/2026-08-13-agents-merge-their-own-prs-when-ci-is-green.md)). Leaving a green PR open to be asked about is the failure mode this replaced — it stalls the work and makes the owner the queue.

Two things are still his call, not yours: **merging someone else's PR**, and **anything a merge sets in motion that a merge can't undo** — a master merge builds and pushes `ghcr.io/sawtaytoes/mux-magic:latest`, but the TrueNAS app is only redeployed onto it deliberately, so say what shipped and what still needs a redeploy.

**Merging to `master` is hard-gated on green CI** by a GitHub ruleset — squash-only PRs, linear history, all CI jobs (`lint`, `typecheck`, `unit-tests`, `e2e`, `storybook-build`, `build-budget`) required, and **no bypass** (the owner token cannot merge past red CI either). Don't try to route around a blocked merge — a red gate means CI failed; fix it ([decision](docs/decisions/2026-08-05-master-merges-are-gated-on-ci-by-a-github-ruleset.md)).

Full worktree / commit conventions in [workflows.md](docs/agents/workflows.md).

## Package Manager

Always `yarn`, never `npm` or `npx`. One-off executables use `yarn dlx <pkg>`.

## Git — this checkout may be shallow

Some checkouts of this repo are **shallow clones** (check `test -f .git/shallow`). When shallow, history is truncated and grafted, so `git merge-base`, `git log`, `git rev-list --count`, and ancestry checks **lie**: unrelated-looking roots appear, branches seem to have "no common ancestor," and a plain fast-forward can look like a destructive 1000-commit rewind. It is an artifact, not reality. **Before reasoning about branch relationships, deleting/overwriting, or force-related operations, run `git fetch --unshallow` first** (or `--depth` deeper), then re-check. Trust `git ls-remote origin <ref>` for the true remote head over a possibly-stale local `origin/*` tracking ref.
