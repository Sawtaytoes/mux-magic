# Worker 1e — mux-magic-webhook-reporter

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/1e-webhook-reporter`
**Worktree:** `.claude/worktrees/1e_mux-magic-webhook-reporter/` (in the Mux-Magic repo)
**Phase:** 1B cross-repo
**Depends on:** 01
**Parallel with:** all other 1B workers

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Your Mission

Add **outbound webhook reporter** to Mux-Magic for Home Assistant integration. Mirrors the pattern Gallery-Downloader (formerly Media-Sync) already uses in `webhookReporter.ts`. Also add **inbound auth** so HA-triggered sequence runs can authenticate.

### Outbound webhook reporter

A new module `packages/server/src/tools/webhookReporter.ts` that POSTs job lifecycle events to configured HA webhook URLs:

- Job started: `POST $WEBHOOK_JOB_STARTED_URL` with `{ jobId, type, source: "step" | "sequence" }`
- Job completed: `POST $WEBHOOK_JOB_COMPLETED_URL` with `{ jobId, type, summary: { /* counts, timing */ } }`
- Job failed: `POST $WEBHOOK_JOB_FAILED_URL` with `{ jobId, type, error: { message, code } }`

Env vars determine which webhooks are configured. If unset, that event simply doesn't fire (no error). If set but the POST fails (4xx/5xx), log a warning but don't crash the job.

### Reference

Read [Gallery-Downloader's webhookReporter.ts](D:\Projects\Personal\media-sync\packages\sync-scheduler\src\webhookReporter.ts) (path uses old name on disk pre-rename; verify) for the existing pattern. Copy structure; adapt for Mux-Magic's job system.

### Integration

The webhook reporter hooks into the existing job lifecycle. Find where job state transitions are dispatched server-side (likely in [packages/server/src/api/jobRunner.ts](../../packages/server/src/api/jobRunner.ts) or `jobStore.ts`). Add `await reportWebhook(event)` calls at the appropriate transitions.

### Inbound auth wrapper

For HA-triggered runs, add a shared-secret check on `/sequences/run`:

- Read `HA_TRIGGER_TOKEN` env var on startup.
- If unset: existing behavior (open). Documented as dev-only.
- If set: requests must include header `X-HA-Token: $HA_TRIGGER_TOKEN`. Mismatch → 401.

Apply as Hono middleware. Don't break local web UI (web doesn't send the header; either allow same-origin OR provide a separate non-auth route for the UI, OR require auth only on POST endpoints that HA calls).

Recommendation: middleware applied only to a NEW route `POST /jobs/named/sync-mux-magic` (or similar) that HA targets, leaving `/sequences/run` open for the web UI. Document choice in PR.

## TDD steps

1. Failing tests:
   - Job lifecycle transitions trigger webhook reporter calls.
   - Webhook POST failures don't crash the job.
   - HA-trigger endpoint with valid token: 202.
   - HA-trigger endpoint with invalid token: 401.
   - HA-trigger endpoint with missing env var: documents that auth is off.
2. Implement reporter + auth middleware.
3. Verify tests pass.

## Files

- New: [packages/server/src/tools/webhookReporter.ts](../../packages/server/src/tools/webhookReporter.ts)
- New: HA-trigger route (find appropriate location in [packages/server/src/api/routes/](../../packages/server/src/api/routes/))
- [packages/server/src/api/jobRunner.ts](../../packages/server/src/api/jobRunner.ts) — wire reporter into job lifecycle
- Tests for both

## Verification checklist

- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Failing tests first
- [ ] Webhook reporter module implemented
- [ ] Job lifecycle wired
- [ ] Failure path doesn't crash
- [ ] Inbound auth middleware on HA-trigger route
- [ ] Env vars documented (in AGENTS.md or `.env.example`)
- [ ] Standard gate clean
- [ ] PR opened
- [ ] Manifest row → `done`

## Out of scope

- Adding HA receiver code (HA-side YAML configs — user does that manually)
- Email / Slack / other notification channels
- Persistence of webhook delivery failures (just log a warning)
- Retry logic (one-shot for now; user can layer in retries later if needed)
