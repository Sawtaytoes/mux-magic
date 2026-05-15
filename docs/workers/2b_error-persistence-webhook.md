# Worker 2b — error-persistence-webhook

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/2b-error-persistence-webhook`
**Worktree:** `.claude/worktrees/2b_error-persistence-webhook/`
**Phase:** 4 (server infrastructure)
**Depends on:** 41 (structured-logging — provides the structured error record format and the trace IDs to correlate)
**Parallel with:** 2a, 2c, 38, 3b, 3c, 3e, 40. NOT parallel with 41 — must wait for it.

> **Why this worker exists:** today a failed job emits a `console.error` (or, after worker 41, a structured `logger.error`), the failure is fed into `appendJobLog`, and [webhookReporter.ts](../../packages/server/src/tools/webhookReporter.ts)'s `reportJobFailed` fires a fire-and-forget HTTP POST. There is no persistent error record — once the job leaves `jobStore` (which is in-memory only), the error is gone. If Home Assistant missed the webhook (network blip, restart, downstream offline) there is no way to replay it. This worker adds a small on-disk error store and a replay-on-startup pass for unacked webhook deliveries.

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Tests must cover the change scope. Yarn only. Manifest row update lands as its own `chore(manifest):` commit. See [AGENTS.md](../../AGENTS.md).

## Your Mission

### Error record format

Use the structured `LogRecord` shape from worker 41 as the base:

```ts
type PersistedJobError = {
  id: string                  // uuid for the record itself
  jobId: string
  stepIndex?: number
  fileId?: string
  level: "error"
  msg: string
  errorName?: string
  stack?: string
  traceId?: string
  spanId?: string
  occurredAt: string          // ISO 8601
  webhookDelivery: {
    state: "pending" | "delivered" | "exhausted"
    attempts: number
    lastAttemptAt?: string
    lastError?: string
  }
}
```

### Persistence

A single JSON file at `${APP_DATA_DIR}/job-errors.json`, structure mirrors worker 2a's template store:

```ts
type JobErrorsFile = {
  version: 1
  errors: PersistedJobError[]
}
```

Atomic writes (write-temp-then-rename). Per-process serialization. **Same pattern as worker 2a** — if 2a lands first, factor the storage primitive into `@mux-magic/tools` and share. If this lands first, write it inline and let 2a refactor when it arrives. Either order is fine; the rebase is mechanical.

Cap the file at, say, 1000 errors — when full, evict oldest `delivered` records first, then oldest `exhausted`. Never evict `pending`.

### Webhook delivery state machine

Replace the current fire-and-forget `reportJobFailed` with a "persist first, then deliver" path:

1. Failure occurs → persist a record with `webhookDelivery.state = "pending"`, `attempts = 0`.
2. Trigger an async delivery attempt:
   - On 2xx response: update the record to `state: "delivered"`.
   - On 4xx (other than 429): mark `state: "exhausted"` (the receiver rejected the payload; retrying won't help).
   - On 5xx / 429 / network error: bump `attempts`, set `lastAttemptAt`, leave `state: "pending"`. Schedule the next attempt with exponential backoff (1s, 4s, 16s, 1m, 5m, 30m, cap at 1h).
3. Stop retrying after `attempts >= 8` (~36h of backoff total) — set `state: "exhausted"` with `lastError`.

On server boot, scan persisted records for `state: "pending"` and resume delivery attempts. This is the replay-on-restart behavior.

### Routes (additive)

- `GET /api/errors` — paginated list, newest first, filterable by `?state=pending|delivered|exhausted` and `?jobId=…`.
- `GET /api/errors/:id` — single record.
- `POST /api/errors/:id/redeliver` — manually re-queue an `exhausted` record. Returns the updated record.
- `DELETE /api/errors/:id` — manual clear (for the user to dismiss "I dealt with this").

All routes use `@hono/zod-openapi`'s `createRoute`.

### Web UI

A small "Errors" tab/panel that shows recent persisted errors with state badges. Defer to the existing job-detail/job-log UI styles — this is read-mostly and shouldn't get a heavy UI investment. Bare minimum:
- List view with `id`, `occurredAt`, `jobId` (linked to the job), `msg`, delivery-state badge.
- Detail view with the full record (stack, trace IDs, attempt history).
- "Retry delivery" button on exhausted rows.
- "Dismiss" button (calls `DELETE`).

If layout time gets tight, this UI can be a follow-up worker — the API surface is the must-ship.

### Out of scope

- A real queue (Redis, BullMQ, etc.) — the in-process state machine is good enough for the single-server deployment.
- Per-error notification routing (Slack, email, etc.) — webhook only.
- Aggregation / grouping of repeated errors — flat list with raw counts.
- Persisting non-error log records — only `level: "error"` records persist. Worker 41's full log stream is ephemeral.

## Tests (per test-coverage discipline)

- **Unit:** state machine — pending → delivered (2xx), pending → exhausted (4xx), pending → pending+attempt+1 (5xx/429/network).
- **Unit:** backoff schedule is monotonic and capped at 1h.
- **Unit:** eviction policy keeps pending and drops oldest delivered first.
- **Unit:** persist-first ordering — if the delivery fetch throws synchronously, the record is already on disk.
- **Integration:** server boot reads `job-errors.json` and resumes pending deliveries (mock the outbound HTTP).
- **Integration:** route handlers (list, get, redeliver, delete) round-trip through the store.
- **Integration:** an exhausted record + manual redeliver POST flips it back to `pending` and triggers a fetch attempt.
- **e2e:** trigger a known-failing job (fake handler) with a webhook URL pointing at a local test server that 500s once then 200s; verify the record progresses pending → delivered.

## TDD steps

1. Failing tests for the state machine. Commit `test(errors): failing tests for delivery state machine`.
2. Implement the state machine. Green.
3. Failing tests for the store (read/write/evict). Commit.
4. Implement the store. Green.
5. Wire into `webhookReporter.ts` — replace fire-and-forget with persist-first.
6. Add boot-time replay.
7. Failing tests for the routes. Commit.
8. Implement routes; register in [hono-routes.ts](../../packages/server/src/api/hono-routes.ts).
9. Add the minimal web Errors panel.
10. e2e + manifest row → `done`.

## Files

- [packages/server/src/api/jobErrorStore.ts](../../packages/server/src/api/jobErrorStore.ts) — new; the store
- [packages/server/src/api/jobErrorDeliveryQueue.ts](../../packages/server/src/api/jobErrorDeliveryQueue.ts) — new; the state machine + scheduler
- [packages/server/src/api/routes/errorRoutes.ts](../../packages/server/src/api/routes/errorRoutes.ts) — new
- [packages/server/src/tools/webhookReporter.ts](../../packages/server/src/tools/webhookReporter.ts) — modify `reportJobFailed` to persist + queue instead of fire-and-forget
- [packages/server/src/server.ts](../../packages/server/src/server.ts) — call the boot-time replay
- [packages/web/src/components/ErrorsPanel/](../../packages/web/src/components/ErrorsPanel/) — new (one component per file)
- Tests for all of the above

## Verification checklist

- [ ] Worker 41 ✅ merged before starting
- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Failing tests committed first
- [ ] State machine transitions correct under each delivery outcome
- [ ] Backoff schedule capped + monotonic
- [ ] Persist-first: record is on disk before the delivery fetch is awaited
- [ ] Boot-time replay resumes pending deliveries
- [ ] `POST /api/errors/:id/redeliver` re-queues exhausted records
- [ ] Web Errors panel renders state badges; retry and dismiss work
- [ ] Standard gate clean
- [ ] PR opened
- [ ] Manifest row → `done` in a separate commit
