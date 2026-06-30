# 2026-05-14 — A new command must land on all of its wiring surfaces

- **Status:** Accepted
- **Date decided:** 2026-05-14 (gap surfaced by worker 40's incomplete landing)
- **Area:** web / process
- **Source:** memory `feedback_new_command_five_surfaces.md`; [docs/agents/architecture.md](../agents/architecture.md)

## Decision

Adding an app-command requires changing **every** surface in the same PR, or the command silently loses an access mode:

1. `packages/core` — the command implementation.
2. `packages/cli` — wiring (including `cli.ts`).
3. `packages/api` — the route.
4. `packages/api` — the request/response schema.
5. `packages/web/src/commands/commands.ts` — the `COMMANDS` map the CommandPicker iterates **and** `commandLabels.ts`, then regenerate `command-descriptions.js`.

There is no compile-time link between these; only a cross-grep catches a missing surface.

## What we rejected — DO NOT revert to this

Do not ship a command on only 3–4 surfaces. Worker 40 landed a command that was API-callable but **invisible in the builder UI** because the two web-registry files were skipped. A route-only command = no builder; a builder-only command = no CLI. "It typechecks and the test passes" does not mean it's wired — the web registry is plain data the type system doesn't enforce.

## Why it must not be re-litigated

This gap is silent and recurring: worker prompts themselves often list only 3–4 surfaces. Treat the five-surface checklist as mandatory and grep to confirm before calling a command done.
