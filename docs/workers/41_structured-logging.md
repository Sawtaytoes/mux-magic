# Worker 41 — structured-logging

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/41-structured-logging`
**Worktree:** `.claude/worktrees/41_structured-logging/`
**Phase:** 4 (server infrastructure)
**Depends on:** 21 (observables-shared-split — provides the place where the logger lives)
**Parallel with:** 2a (server-template-storage), 2c (pure-functions-sweep), 2d (asset-fallback-to-cli), 3b, 3c, 3e, 40 — none of these touch the central logging surface. NOT parallel with 38 (per-file-pipelining), 2b (error-persistence-webhook), or 2f (ffmpeg-gpu-reencode) — those depend on this one landing first.

> **Why this worker exists:** the server today routes per-job output through [logCapture.ts](../../packages/server/src/api/logCapture.ts) (an `AsyncLocalStorage`-keyed ANSI-stripping router that calls `appendJobLog`), but underneath every call site is still a plain `console.log` / `console.warn` / `console.error` writing a single human-formatted line. There is no machine-readable structure, no trace correlation across rxjs boundaries beyond the job ID that `logCapture` already threads, and no replay-friendly format for worker 2b's error store to attach to. Worker 2b (error persistence + webhook) wants to attach structured fields to errors. Worker 38 (per-file pipelining) wants to follow one file across N steps. Both currently can't, because the logging surface is string-shaped. This worker introduces a structured logger, migrates the server's call sites, and preserves the existing `appendJobLog` + SSE behaviour so the web UI is unaffected.

> **ID note:** this worker was originally numbered `28` in the plan. Slot `28` was reassigned to a Phase 1B follow-up (`28_threadcount-variable-registry-unification.md`). This worker now lives at `41` per the "never renumber existing workers" rule.

> **Observability scope:** the user is running this self-hosted on a single server with no observability stack. **No OpenTelemetry, no OTLP, no external exporter.** Structured records live in process memory + on the SSE feed, and (for `level: "error"` records) get persisted by worker 2b. The `startSpan(name, fn)` API is preserved with a synthetic-uuid implementation so a future worker can swap in real OTel without touching call sites — but that future worker is not in scope here.

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Tests must cover the change scope. Yarn only. Manifest row update lands as its own `chore(manifest):` commit — never bundled with code. One component per file (the `react/no-multi-comp` rule is load-bearing). See [AGENTS.md](../../AGENTS.md). Background context lives in [docs/workers/PLAN.md](./PLAN.md) and [docs/workers/_context-for-remaining-prompts.md](./_context-for-remaining-prompts.md).

## Your Mission

Add a thin structured logger to `@mux-magic/tools` that:

1. Emits structured records (`{ level, msg, jobId, stepIndex?, fileId?, traceId?, spanId?, ...extra }`) instead of opaque strings.
2. Bridges back to the existing line-based UI surface (`appendJobLog`, the SSE log feed) so nothing observable to the user changes by default.
3. Carries trace context across rxjs `mergeMap` / `concatMap` boundaries via `AsyncLocalStorage` (the same mechanism `logCapture` already uses for `jobId`).
4. Ships a `/api/logs/structured` SSE endpoint (additive — the legacy line endpoint stays).
5. Migrates `packages/server/**` call sites away from raw `console.*` for everything that is part of a job (sequence runs, command handlers, route handlers). Out-of-band lifecycle logs (`logBuildBanner`, startup banners) stay on `console.*`.

The deliverable is the foundation that workers 2b and 38 will build on.

### Where the logger lives

In `packages/tools/src/logging/` (this package was renamed from `packages/shared/` in worker 39 and is published as `@mux-magic/tools`). The server, the CLI (worker 20), and Gallery-Downloader (worker 1d, already consuming `@mux-magic/tools`) all get the logger from the same place. **No new runtime dependencies** — the logger uses only Node built-ins (`node:async_hooks`, `node:crypto`, `node:perf_hooks`).

### Logger shape

```ts
// packages/tools/src/logging/logger.ts
export type LogLevel = "debug" | "info" | "warn" | "error"

export type LogRecord = {
  level: LogLevel
  msg: string
  jobId?: string
  stepIndex?: number
  fileId?: string
  traceId?: string
  spanId?: string
  // arbitrary structured fields the call site adds
  [extraKey: string]: unknown
}

export type Logger = {
  debug(msg: string, extra?: Record<string, unknown>): void
  info(msg: string, extra?: Record<string, unknown>): void
  warn(msg: string, extra?: Record<string, unknown>): void
  error(msg: string, extra?: Record<string, unknown>): void
  child(bindings: Record<string, unknown>): Logger
  startSpan<T>(name: string, fn: () => Promise<T> | T): Promise<T>
}
```

`logger.child({ stepIndex: 2 })` returns a derived logger whose every record carries `stepIndex: 2`. This is how `sequenceRunner` will tag per-step records, and how worker 38's per-file pipelining will tag per-file records once it lands.

### `startSpan` — synthetic-uuid implementation

```ts
const startSpan = async <T>(name: string, fn: () => Promise<T> | T): Promise<T> => {
  const parentContext = loggingContext.getStore()
  const traceId = parentContext?.traceId ?? crypto.randomUUID()
  const spanId = crypto.randomUUID()
  const startedAt = performance.now()

  logger.debug(`span enter: ${name}`, { traceId, spanId, spanName: name })

  return loggingContext.run(
    { ...parentContext, traceId, spanId },
    async () => {
      try {
        const result = await fn()
        logger.debug(`span exit: ${name}`, {
          traceId,
          spanId,
          spanName: name,
          elapsedMs: performance.now() - startedAt,
        })
        return result
      } catch (error) {
        logger.error(`span error: ${name}`, {
          traceId,
          spanId,
          spanName: name,
          elapsedMs: performance.now() - startedAt,
          errorName: error instanceof Error ? error.name : "unknown",
        })
        throw error
      }
    },
  )
}
```

No OTel anywhere. The API survives a future OTel adoption by swapping this helper's body without touching call sites — a follow-up worker could replace `crypto.randomUUID()` with a real tracer's span context if the project ever grows an observability backend.

**Nested-span rule (load-bearing):** an inner `startSpan` inherits the outer `traceId` and generates a fresh `spanId`. The synthetic implementation must respect this — if it doesn't, a future OTel swap will silently change span topology. Test it explicitly.

### Async-context wiring

Reuse the `AsyncLocalStorage` pattern already in [logCapture.ts](../../packages/server/src/api/logCapture.ts). Create a single `loggingContext = new AsyncLocalStorage<LoggerContext>()` in `@mux-magic/tools`. The server's existing `withJobContext(jobId, fn)` wrapper additionally seeds `loggingContext.run({ jobId }, fn)`. After this worker lands, `jobContext` from logCapture and `loggingContext` from the new logger are the same context object (or one re-exports the other — your call, document the pick in the PR).

### Bridge layer (the part that preserves UI behaviour)

The web UI displays job logs by reading `appendJobLog`'s flat-line buffer and streaming via SSE ([logRoutes.ts](../../packages/server/src/api/routes/logRoutes.ts)). Do not change either. Instead, the default logger sink renders each `LogRecord` as a single line:

```text
[2026-05-14T08:21:33.512Z] info  step=2 file=…/foo.mkv  copy finished
```

and feeds it through the same `appendJobLog` path the old `console.log` calls used. The structured JSON version of the same record is fed to:

- A separate `/api/logs/structured` SSE endpoint (NEW, additive — the legacy line endpoint stays). Reuse [sseKeepalive.ts](../../packages/server/src/api/sseKeepalive.ts) for the heartbeat.
- Worker 2b's error store (only for `level: "error"` records, once 2b lands).

Two sinks, one record. The bridge is the centre of this worker's complexity.

### Migration plan for server call sites

There are ~50–100 `console.*` call sites under `packages/server/src/`. Migrate the ones that fire **during a job run** (sequence execution, command handlers, route handlers that participate in job lifecycle). Out-of-band lifecycle logs (`logBuildBanner`, server-startup banners, top-level uncaught error handlers) stay on `console.*` — they don't belong to a job.

Migration rule:

- `console.log(msg)` → `logger.info(msg, extraFieldsIfYouHaveThem)`
- `console.warn(msg)` → `logger.warn(...)`
- `console.error(err)` → `logger.error(err.message, { errorName: err.name, stack: err.stack })`
- `console.log(\`Step \${i}: \${detail}\`)` → `logger.info("step started", { stepIndex: i, detail })` — break template strings into structured fields where the field is reusable.

Pick the **getter** form: `getLogger()` reads the AsyncLocalStorage context and returns a context-bound logger. Avoid importing a module-singleton logger that has no job context attached.

### What NOT to do

- **No new runtime dependencies** in `packages/tools/package.json`. The logger is hand-rolled and small; resist abstraction-fishing. No pino, winston, bunyan, or OTel SDKs.
- Do not change `appendJobLog`'s line shape or the SSE feed's wire format. The web UI uses both verbatim today; preserving them is what makes this worker non-breaking.
- Do not migrate `console.*` calls in `packages/web/` — those are browser logs and not in scope.
- Do not migrate the CLI's user-facing prompts/output (the stuff users see on the terminal). That's UI, not telemetry.
- Do not delete `logCapture.ts`'s `jobContext` — workers 38 and 2b will both read from it. If you fold `jobContext` and the new logging context together, leave a comment marking that "this used to be two pieces; if you split them again, fix logCapture.ts:withJobContext".

## Tests (per test-coverage discipline)

- **Unit:** logger emits one record per `.info/.warn/.error/.debug` call; child loggers merge bindings; record JSON shape matches `LogRecord`.
- **Unit:** logger reads `jobId` / `stepIndex` / `fileId` from AsyncLocalStorage context when not passed explicitly.
- **Unit:** explicit fields override context-derived fields (caller can always override).
- **Unit:** default line sink produces the human-readable line shape `[<iso>] <level> <field=value...> <msg>`.
- **Unit:** bridging — a `logger.info(...)` call inside `withJobContext(jobId, …)` results in one `appendJobLog(jobId, …)` invocation. Mock `appendJobLog`; assert call shape.
- **Unit:** `startSpan` enter + exit records share the same `traceId` and `spanId`; `elapsedMs` on exit is ≥ 0.
- **Unit:** `startSpan` propagates trace/span IDs into the AsyncLocalStorage context — `logger.info` called inside `fn` carries them.
- **Unit:** nested `startSpan` — the inner span gets a fresh `spanId` but **inherits** the outer `traceId` (assert this explicitly; a future OTel swap depends on it).
- **Unit:** `startSpan` emits an `error`-level record on throw, with `elapsedMs` and `errorName`, and re-throws.
- **Integration:** running a 2-step sequence end-to-end (with a fake handler) results in the legacy `/api/jobs/:id/log` SSE feed receiving the same lines as before, and the new `/api/logs/structured` feed receiving JSON records with `jobId` and `stepIndex` set.
- **e2e:** existing job-log UI in the web app still renders job logs identically (no visual regression) — run an existing e2e that asserts log content.

## TDD steps

1. Write all failing unit tests above as a single `test(logging): failing tests for structured logger` commit.
2. Implement the logger + AsyncLocalStorage context + line sink. Get unit tests green. Commit `feat(logging): add structured logger to @mux-magic/tools`.
3. Implement `startSpan` with synthetic uuids; get the span tests green (including the nested-span rule). Commit `feat(logging): synthetic-span helper for trace correlation`.
4. Wire the bridge to `appendJobLog`. Update `logCapture.ts` to also seed the logging context. Commit `feat(logging): bridge structured logger to appendJobLog`.
5. Migrate `packages/server/src/api/sequenceRunner.ts` first — its `console.*` calls are the highest-value targets. Commit `refactor(server): migrate sequenceRunner to structured logger`.
6. Migrate `packages/server/src/app-commands/*.ts` (one commit per file or one for all, your call — keep commits reviewable).
7. Migrate the route handlers that emit job-context logs.
8. Add the `/api/logs/structured` SSE endpoint. Commit `feat(server): structured-log SSE endpoint`.
9. Run integration + e2e suites; fix what breaks (typically a test that asserted exact `console.log` strings).
10. Final lint + manifest row → `done` (separate `chore(manifest):` commit).

## Files

- [packages/tools/src/logging/logger.ts](../../packages/tools/src/logging/logger.ts) — new; the core logger
- [packages/tools/src/logging/context.ts](../../packages/tools/src/logging/context.ts) — new; AsyncLocalStorage wrapper
- [packages/tools/src/logging/lineSink.ts](../../packages/tools/src/logging/lineSink.ts) — new; the human-readable formatter
- [packages/tools/src/logging/startSpan.ts](../../packages/tools/src/logging/startSpan.ts) — new; synthetic-uuid span helper
- [`packages/tools/src/logging/__tests__/`](../../packages/tools/src/logging/__tests__/) — new; unit tests
- [packages/tools/src/index.ts](../../packages/tools/src/index.ts) — re-export the public logger API
- [packages/server/src/api/logCapture.ts](../../packages/server/src/api/logCapture.ts) — seed the new context in `withJobContext`
- [packages/server/src/api/sequenceRunner.ts](../../packages/server/src/api/sequenceRunner.ts) — migrate `console.*` calls
- [packages/server/src/app-commands/*.ts](../../packages/server/src/app-commands/) — migrate `console.*` calls in handler bodies
- [packages/server/src/api/routes/logRoutes.ts](../../packages/server/src/api/routes/logRoutes.ts) — add `/api/logs/structured` SSE endpoint; keep the legacy line endpoint untouched
- Tests for all of the above

## Verification checklist

- [ ] Worker 21 ✅ merged before starting (the logger lives in the shared package it produces)
- [ ] Worktree created at `.claude/worktrees/41_structured-logging/`
- [ ] Manifest row → `in-progress`
- [ ] Failing tests committed first
- [ ] Logger lives in `@mux-magic/tools`, not in `packages/server/`
- [ ] **No new runtime deps in [packages/tools/package.json](../../packages/tools/package.json)** — diff the file before/after, confirm only Node built-ins are used
- [ ] `appendJobLog` shape preserved (legacy SSE feed unchanged)
- [ ] New `/api/logs/structured` SSE feed emits valid JSON `LogRecord`s
- [ ] AsyncLocalStorage context propagates through rxjs `mergeMap` / `concatMap` (write an explicit test)
- [ ] Nested `startSpan` inherits `traceId`, fresh `spanId` (test asserts this — future OTel swap depends on it)
- [ ] All `packages/server/src/` job-context `console.*` calls migrated
- [ ] Out-of-band lifecycle `console.*` (banners, startup) intentionally NOT migrated — documented in PR
- [ ] Standard gate clean (`yarn lint → typecheck → test → e2e → lint`)
- [ ] e2e proves the web UI still renders job logs identically
- [ ] PR opened against `feat/mux-magic-revamp`
- [ ] Manifest row → `done` in a separate `chore(manifest):` commit
