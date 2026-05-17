# Worker 67 — remove-ha-trigger-endpoint-and-token

**Model:** Haiku · **Thinking:** OFF · **Effort:** Low
**Branch:** `feat/mux-magic-revamp/67-remove-ha-trigger-endpoint-and-token`
**Worktree:** `.claude/worktrees/67_remove-ha-trigger-endpoint-and-token/`
**Phase:** 4
**Depends on:** — (no upstream deps; touches files independent of other in-flight workers)
**Parallel with:** any worker that doesn't touch [packages/server/src/api/hono-routes.ts](../../packages/server/src/api/hono-routes.ts), [.env.example](../../.env.example), or [docs/workers/_context-for-remaining-prompts.md](_context-for-remaining-prompts.md).

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Context

Worker 1e added `POST /jobs/named/sync-mux-magic` (in [packages/server/src/api/routes/haTriggerRoutes.ts](../../packages/server/src/api/routes/haTriggerRoutes.ts)) as a Home-Assistant-specific entry point — a thin wrapper around `POST /sequences/run` with an `X-HA-Token` shared-secret middleware in front, guarded by the `HA_TRIGGER_TOKEN` env var.

That endpoint leaks a specific consumer's name (Home Assistant) into the mux-magic API surface. Mux-magic is a generic media-processing server; **any** orchestrator could POST to `/sequences/run` — HA happens to be the user's current choice, but the server should not encode that assumption into a route name. The token-auth pattern is also a one-off: no other endpoint requires it, so it doesn't generalize into a coherent server-wide auth story. If auth is needed in the future, the right answer is a reverse proxy at the network edge (Caddy / Nginx / Traefik) or a generic API-token middleware applied uniformly — not a single named-endpoint workaround.

User decision (verbatim): *"Remove that /named/sync-mux-magic. This is so dumb. I don't want mux-magic to know about Home Assistant. It could be anything calling those. I personally just happen to be using Home Assistant. That's not a universal thing. Just remove it and the HA_TOKEN crap."*

This worker undoes the inbound HA-specific surface only. The **outbound** webhook reporter (`WEBHOOK_JOB_STARTED_URL` / `WEBHOOK_JOB_COMPLETED_URL` / `WEBHOOK_JOB_FAILED_URL` in `.env.example` and the corresponding `webhookReporter.ts` plumbing) **stays** — those are generic outbound HTTP POSTs on job lifecycle events, not HA-specific. Any consumer (HA, n8n, Zapier, a script) can subscribe.

Consumers (like the user's HA setup) move to `POST /sequences/run` directly — same wire format, same response, just no token gate. Network-level access control is the user's problem to solve at the edge.

## Your Mission

Mechanical deletion + updates. No new code.

### Delete

- `packages/server/src/api/routes/haTriggerRoutes.ts` — the entire file.
- `packages/server/src/api/routes/haTriggerRoutes.test.ts` — the entire test file.

### Edit

- `packages/server/src/api/hono-routes.ts` — remove the `import { haTriggerRoutes } from "./routes/haTriggerRoutes.js"` line at ~line 9 and the `app.route("/", haTriggerRoutes)` registration at ~line 51.
- `.env.example` — remove the `HA_TRIGGER_TOKEN` section (the header comment block and the commented-out env var line). Leave the outbound webhook URL block untouched — it's not HA-specific.
- `docs/workers/_context-for-remaining-prompts.md` — delete the line at ~116 that reads: *"Inbound HA-trigger route lives at `packages/server/src/api/routes/haTriggerRoutes.ts` — `X-HA-Token` validated when `HA_TRIGGER_TOKEN` env var is set."* Any surrounding paragraph context becomes orphaned — clean that up too.

### Do NOT touch

- `docs/workers/1c_gallery-downloader-decouple-and-ha-endpoint.md` — historical worker spec. The "never renumber filed workers" rule extends to "never rewrite history" — old worker docs describe what *was* done at the time, not what the codebase should look like now. Leave it alone.
- `docs/workers/1e_mux-magic-webhook-reporter.md` — same reasoning. Historical spec stays.
- `webhookReporter.ts` and the outbound webhook URL env vars (`WEBHOOK_JOB_*_URL`). Generic outbound notification surface; not HA-specific.
- Anything related to `WEBHOOK_JOB_STARTED_URL` / `WEBHOOK_JOB_COMPLETED_URL` / `WEBHOOK_JOB_FAILED_URL`. Stay.

### Verify

After the deletions, grep the repo for `haTriggerRoutes`, `HA_TRIGGER_TOKEN`, `sync-mux-magic`, `X-HA-Token`, `/jobs/named` — only the two historical worker docs (1c and 1e) should still match. If anything else does, follow up.

Also grep the openapi-spec output (if the build generates one) to confirm the route is gone from the generated spec.

## Files

### Deleted

- `packages/server/src/api/routes/haTriggerRoutes.ts`
- `packages/server/src/api/routes/haTriggerRoutes.test.ts`

### Modified

- `packages/server/src/api/hono-routes.ts` — remove import + registration.
- `.env.example` — remove `HA_TRIGGER_TOKEN` block.
- `docs/workers/_context-for-remaining-prompts.md` — remove the HA-trigger sentence.
- `docs/workers/MANIFEST.md` — flip this worker's row to `in-progress` at start, `done` after PR merge.

## TDD steps

1. **Confirm the grep is clean post-removal.** `grep -r 'haTriggerRoutes\|HA_TRIGGER_TOKEN\|sync-mux-magic\|X-HA-Token\|/jobs/named' .` should return only `docs/workers/1c_*.md` and `docs/workers/1e_*.md` matches after the changes land.
2. **Server boot test**: existing server-startup tests still pass; the missing route doesn't cause a registration error or a missing-import error.
3. **Route smoke test**: `POST /jobs/named/sync-mux-magic` now returns 404 (route truly gone, not 401 or 500).
4. **`/sequences/run` regression test**: existing `sequenceRoutes.test.ts` tests still pass — the canonical endpoint is untouched and unchanged.
5. **OpenAPI spec test** (if there's one in the test suite): confirm `/jobs/named/sync-mux-magic` is no longer in the emitted spec.

## Verification checklist

- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Two route files deleted
- [ ] `hono-routes.ts` cleaned up (import + registration removed)
- [ ] `.env.example` cleaned up (HA_TRIGGER_TOKEN block removed; webhook block preserved)
- [ ] `_context-for-remaining-prompts.md` cleaned up
- [ ] Grep clean (only historical worker docs match)
- [ ] Standard pre-merge gate clean: `yarn lint → typecheck → test → e2e → lint`
- [ ] PR opened against `feat/mux-magic-revamp`
- [ ] Manifest row → `done`

## Out of scope

- **Generic API-token middleware for `/sequences/run`** (or any other endpoint). The user's call is to defer auth concerns entirely until a unified design exists; network-edge proxy is the recommended interim. Don't bolt token auth onto `/sequences/run` as a like-for-like replacement.
- **Removing the outbound webhook plumbing.** The outbound side (`webhookReporter.ts`, `WEBHOOK_JOB_*_URL` env vars) is generic and stays. Any consumer that wants job lifecycle notifications subscribes by setting those env vars.
- **Editing historical worker docs.** 1c and 1e are immutable history. Their accuracy at the time of writing stands; they don't need a "superseded by 67" annotation.
- **Migrating the user's HA automation config.** That's documentation for the user, not a code change. Document the new pattern (POST to `/sequences/run` directly) in the PR description if helpful, but no in-repo HA docs exist to update.
- **Removing the `WEBHOOK_*_URL` outbound webhook example comments mentioning Home Assistant** in `.env.example`. Those are just example URLs (`http://homeassistant.local:8123/api/webhook/...`); replace with neutral examples if the cleanup feels right, but it's not required for this worker's stated scope.
