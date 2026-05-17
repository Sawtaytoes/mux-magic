# Worker 68 — exitIfEmpty step and exited status

**Model:** Opus · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp` (landed direct — hotfix-class follow-on to a prod regression)
**Phase:** 4
**Depends on:** none (no upstream worker; motivated by a prod incident on the deployed `mux-magic-revamp` branch)

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Context

Production regression on a Home Assistant automation that runs the anime-sync sequence per series, hourly. The HA `rest_command` POSTs a sequence body to [`/api/sequences/run`](../../packages/server/src/api/routes/sequenceRoutes.ts) whose first step copies files from `G:\Downloads` into a per-series `work` folder, then runs `keepLanguages` / `extractSubtitles` / `modifySubtitleMetadata` / `addSubtitles` / `copyFiles` / `deleteFolder` against that work folder. When no new files arrived this hour (the common case — episodes air weekly, not hourly), the copy step is a clean no-op but doesn't create the destination, and the **next** step (`keepLanguages`) blows up with `ENOENT: no such file or directory, scandir '/media/Anime/.../work'`.

That `ENOENT` becomes `status: "failed"` on the umbrella job, which fires `reportJobFailed` via [jobRunner.ts:94](../../packages/server/src/api/jobRunner.ts#L94), which pages the user every hour for "nothing to do." The right semantic isn't "failed" (nothing went wrong) and it isn't "completed" (we didn't do the work either). It's a third thing: the sequence reached a planned exit point.

User's exact framing (in conversation): *"This shouldn't show up as 'skipped' or 'canceled' or 'complete', it should have a new state because it was ended by the sequence itself."*

## Your Mission

Add **two coupled additions**:

### 1. `exitIfEmpty` sequence-step command

[packages/server/src/app-commands/exitIfEmpty.ts](../../packages/server/src/app-commands/exitIfEmpty.ts) — single-emission Observable taking `{ sourcePath: string }`. "Empty" is the disjunction of two cases the caller can't and shouldn't have to distinguish:

- `sourcePath` does not exist (`readdir` rejects with `ENOENT`).
- `sourcePath` exists but contains zero entries.

Both emit `{ shouldExit: true, exitReason: "..." }`. Non-empty emits `{ shouldExit: false, exitReason: "" }`. Pointing at a file rather than a directory throws (caller error — fail honestly rather than paper over the mistake). Any other `fs` error (EACCES etc.) throws too — those are real failures, not "empty."

Schema [packages/server/src/api/schemas.ts](../../packages/server/src/api/schemas.ts) is one required field (`sourcePath: string`). Registration in [commandRoutes.ts](../../packages/server/src/api/routes/commandRoutes.ts) under `commandNames` + `commandConfigs` with `extractOutputs` that lifts the emission's two fields onto the child job's `outputs` map. Tag: `"Flow Control"` — establishes a category for future siblings (`exitIfFileCountBelow`, generic `exitIf`).

### 2. New `JobStatus = "exited"` peer status

[packages/server/src/api/types.ts](../../packages/server/src/api/types.ts) — add `"exited"` to the union. Cascading semantics in the sequence runner:

- The **triggering step** stays `completed` (it ran successfully — it just published `shouldExit: true`).
- The **umbrella** finalizes as `exited`.
- **Every later flat step** that was still `pending` cascades to `exited` (not `skipped` — these steps never ran *by design*, not because something earlier failed).

The runner [sequenceRunner.ts](../../packages/server/src/api/sequenceRunner.ts) reads `outputs.shouldExit === true` in `runOneStep` and transmutes the completed outcome into a new `kind: "exited"` outcome. The item loop, serial-group loop, and parallel-group branch each call a new `finalizeFromExit(step, reason)` helper (symmetric to the existing `finalizeFromChildCancel`). `markRemainingTerminalFromFlatIndex(idx, status)` is the parameterized successor of `markRemainingSkippedFromFlatIndex` — same cascade walk, status now a parameter.

### Reserved-output protocol

The runner's check is *not* `command === "exitIfEmpty"`. It's `outputs.shouldExit === true`. Any future flow-control command publishing the same shape gets the same treatment for free — no runner changes needed. Document this as a reserved-key contract so a non-flow-control command can't accidentally publish `shouldExit` and end up short-circuiting a sequence.

### Surface area touched

- Server types: [types.ts](../../packages/server/src/api/types.ts) — `JobStatus` union.
- OpenAPI: [jobRoutes.ts](../../packages/server/src/api/routes/jobRoutes.ts) — `jobDetailSchema.status` z.enum.
- Terminal-status switch: [logRoutes.ts](../../packages/server/src/api/routes/logRoutes.ts) — `/jobs/:id/logs` SSE done-event guard.
- Runner: [sequenceRunner.ts](../../packages/server/src/api/sequenceRunner.ts) — outcome union, finalize signature, cascade helper, runOneStep transmutation, all three loop branches.
- Command: [exitIfEmpty.ts](../../packages/server/src/app-commands/exitIfEmpty.ts), schema entry, command registration.
- Web badges: [StatusBadge.tsx](../../packages/web/src/components/StatusBadge/StatusBadge.tsx) and [SequenceRunModal.tsx](../../packages/web/src/components/SequenceRunModal/SequenceRunModal.tsx) — neutral-indigo styling for `exited`.

### What this does NOT do

- No new webhook fan-out. `reportJobCompleted` still fires per-step from `jobRunner`. Nothing on the umbrella's `exited` path fires `reportJobFailed`, which is the point of the worker — HA should stop getting paged on no-files-to-process hours.
- No "skip group wrapper" — that's a separate non-terminal flow-control concept the user mentioned for the future. `exited` is terminal.
- No generic `exitIf` expression language. Start narrow.

## Tests

- [exitIfEmpty.test.ts](../../packages/server/src/app-commands/exitIfEmpty.test.ts) — four unit tests covering missing path, empty path, populated path, and "pointing at a file" rejection.
- [sequenceRoutes.test.ts](../../packages/server/src/api/routes/sequenceRoutes.test.ts) — three integration tests covering the umbrella + child-step status cascade for missing, empty, and non-empty cases.

## Status

Done. Direct commit on `feat/mux-magic-revamp`.
