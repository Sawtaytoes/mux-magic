# Worker 11 — limit-execution-threads-ui

**Model:** Sonnet · **Thinking:** ON · **Effort:** High
**Branch:** `feat/mux-magic-revamp/11-limit-execution-threads-ui`
**Worktree:** `.claude/worktrees/11_limit-execution-threads-ui/`
**Phase:** 1B web
**Depends on:** 01 (rename), **36 (Variables foundation must land first)**
**Parallel with:** all other 1B web workers (but coordinates with the Variables foundation via Variable type registration)

> **Status as of 2026-05-13:** Verified still pending. `DEFAULT_THREAD_COUNT` has zero occurrences outside docs; `threadCount` is reserved only as a forward-looking comment in [packages/web/src/types.ts:38](../../packages/web/src/types.ts#L38) (placed by worker 36). The scheduler still uses a single global `MAX_THREADS` cap.

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Tests must cover the change scope (see [feedback_test_coverage_required.md](C:\Users\satur\.claude\projects\d--Projects-Personal-media-tools\memory\feedback_test_coverage_required.md)). Yarn only. See [AGENTS.md](../../AGENTS.md). Background context lives in [docs/PLAN.md §5.B](../PLAN.md).

## Your Mission

Add a **per-job** execution-thread cap. Today the task scheduler at [packages/server/src/tools/taskScheduler.ts](../../packages/server/src/tools/taskScheduler.ts) uses a single global `mergeAll(concurrency)` cap fed by `MAX_THREADS`. New model: **each job declares a per-job claim** (stored as a singleton `threadCount` Variable in the new Variables system from worker 36). The scheduler enforces two coupled constraints on task admission: `inflight-global < MAX_THREADS` AND `inflight-this-job < job.claim`.

This lets two concurrent jobs share the pool fairly (e.g. 4-thread + 8-thread jobs both run on an 8-core CPU; the 8-thread one is throttled to 4 until the 4-thread one finishes).

### Three pieces

#### Piece 1: Server-side env vars + system endpoint

Two env vars (both read at server boot):

- **`MAX_THREADS`** (existing) — system ceiling. Defaults to `os.cpus().length` if unset. Stays as the upper bound.
- **`DEFAULT_THREAD_COUNT`** (NEW) — default per-job claim value. **Default = 2** (safe for most machines). If `≤ 0`, treated as "no per-job restriction; use MAX_THREADS as default."

```ts
// Pseudocode for the resolution logic
function resolveDefaultThreadCount(): number {
  const raw = Number(process.env.DEFAULT_THREAD_COUNT ?? 2)
  if (raw <= 0) {
    return resolveMaxThreads()
  }
  return Math.min(raw, resolveMaxThreads())
}
```

New endpoint **`GET /system/threads`**:

```ts
type SystemThreadsResponse = {
  maxThreads: number          // resolved MAX_THREADS (ceiling)
  defaultThreadCount: number  // resolved DEFAULT_THREAD_COUNT (effective)
  totalCpus: number           // os.cpus().length (informational)
}
```

The UI calls this to display the ceiling and pre-fill the default. The endpoint goes in a new module `packages/server/src/api/routes/systemRoutes.ts` (or extends an existing system/health route module if one already exists — grep first).

#### Piece 2: Per-job quota enforcement in `taskScheduler.ts`

Today the scheduler uses `mergeAll(concurrency)`. To add per-job quota, **tag each task with its `jobId`** and enforce both constraints at admission time.

Approach options (pick after reading [taskScheduler.ts](../../packages/server/src/tools/taskScheduler.ts)):

- **Option A — Hierarchical schedulers**: outer `mergeAll(MAX_THREADS)` + inner per-job `mergeAll(claim)` selected by jobId. Cleanest in rxjs but needs care around scheduler lifecycle.
- **Option B — Single scheduler with custom admission predicate**: replace `mergeAll` with a custom operator that tracks per-job in-flight counts and only admits tasks when BOTH `inflight-global < MAX_THREADS` AND `inflight-for-this-jobId < claim`. More code; more flexibility.

Pick B if the existing scheduler is shaped around per-task tagging already (e.g. tasks carry context); A if rxjs `mergeAll` boundaries are the right abstraction.

#### Piece 3: Web UI — register `threadCount` as a Variable type (singleton)

Worker 36 (Variables foundation) provides the generic `Variable = { id, label, value, type }` system. This worker **registers `threadCount` as a singleton type**:

- Cardinality: exactly **one** per sequence (or zero, falling back to server's `defaultThreadCount`).
- Step fields cannot link to it (it's read by the runtime, not by step params).
- The Edit Variables modal (worker 37) provides a special UI affordance for the threadCount variable: a numeric input with the system's `maxThreads` ceiling shown as helper text and clamping on input.

Type registration shape (verify against worker 36's actual API after it lands):

```ts
registerVariableType({
  type: "threadCount",
  label: "Max threads (per job)",
  cardinality: "singleton",
  defaultValue: () => fetch("/system/threads").then(r => r.json()).then(s => String(s.defaultThreadCount)),
  validate: (value, system) => {
    const num = Number(value)
    if (!Number.isInteger(num) || num < 1) {
      return { isValid: false, message: "Must be a positive integer" }
    }
    if (num > system.maxThreads) {
      return { isValid: false, message: `Clamped to system max ${system.maxThreads}` }
    }
    return { isValid: true }
  },
  isLinkable: false,  // not selectable from step-field link pickers
})
```

#### Wiring it all together (jobRunner reads the Variable at job start)

When a job is created, the job runner reads the sequence's `threadCount` Variable (if any), falls back to `defaultThreadCount`, clamps to `maxThreads`, and stores the resolved value on the job record. The scheduler reads `job.threadCountClaim` to enforce per-job admission.

## Tests (per the test-coverage feedback memory)

Required test coverage:

- **Unit (server):** `GET /system/threads` returns the right shape with stub env vars.
- **Unit (server):** `resolveDefaultThreadCount()` returns `MAX_THREADS` when `DEFAULT_THREAD_COUNT ≤ 0`; returns `min(MAX_THREADS, DEFAULT_THREAD_COUNT)` otherwise; returns 2 when env var unset.
- **Unit (server):** `taskScheduler` admits a task when both `inflight-global < MAX_THREADS` AND `inflight-for-job < claim` hold; rejects (queues) when either fails.
- **Integration (server):** two concurrent jobs with different claims share the pool correctly (Job A claim 4, Job B claim 8, MAX_THREADS 8 → A peaks at 4 in-flight, B peaks at 4 while A runs, then 8 after A finishes).
- **Unit (web):** Variable type registration for `threadCount` validates input and clamps.
- **Component (web):** Edit Variables modal renders the threadCount input with system-ceiling helper text.
- **e2e:** full flow — set threadCount to 2 in a sequence → run → server logs show task concurrency for that job capped at 2.

## TDD steps

1. Failing tests (commit each):
   - `test(server): /system/threads endpoint shape`
   - `test(server): resolveDefaultThreadCount cases (≤0, normal, unset)`
   - `test(server): taskScheduler per-job admission`
   - `test(server): concurrent jobs share pool with different claims`
   - `test(web): threadCount variable type validates`
   - `test(e2e): threadCount cap enforced at runtime`
2. Implement server endpoint + env var resolution.
3. Refactor taskScheduler for per-job quota.
4. Wire jobRunner to read the threadCount Variable.
5. Register threadCount as a Variable type in web.
6. Verify all tests pass.

## Files

- [packages/server/src/tools/taskScheduler.ts](../../packages/server/src/tools/taskScheduler.ts) — refactor for per-job quota
- New: `packages/server/src/api/routes/systemRoutes.ts` (or extend existing) — `GET /system/threads`
- [packages/server/src/api/jobRunner.ts](../../packages/server/src/api/jobRunner.ts) — read threadCount Variable at job start
- [packages/server/src/api/jobStore.ts](../../packages/server/src/api/jobStore.ts) — store `threadCountClaim` on job record
- Web: threadCount Variable type registration (location depends on worker 36's foundation)
- `.env.example` — document `DEFAULT_THREAD_COUNT`
- [AGENTS.md](../../AGENTS.md) or a `docs/` page — env var documentation
- Tests for all of the above

## Verification checklist

- [ ] Worker 36 ✅ merged before starting (verify in manifest)
- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Failing tests committed first
- [ ] `GET /system/threads` returns ceiling + default + total CPUs
- [ ] `resolveDefaultThreadCount` handles `≤ 0` (special case), normal, and unset cases
- [ ] taskScheduler enforces both constraints (global + per-job)
- [ ] Two concurrent jobs with different claims share the pool fairly (verified by integration test)
- [ ] `threadCount` registered as singleton Variable type
- [ ] Edit Variables modal (worker 37) renders threadCount with system-ceiling helper text
- [ ] e2e proves the cap is enforced at runtime
- [ ] Standard gate clean
- [ ] PR opened
- [ ] Manifest row → `done`

## Out of scope

- Per-step thread caps (sequence-level is enough; covered by [docs/PLAN.md §5.C](../PLAN.md) as a future possibility)
- Changing the existing `MAX_THREADS` env var semantics — it stays as the ceiling
- GPU thread cap (different resource; covered by worker 30)
- Live-update the cap on running jobs (cap applies to new jobs only)
