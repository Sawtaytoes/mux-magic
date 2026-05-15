# Worker 47 — errors-panel-and-e2e

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `worker-47-errors-panel-and-e2e`
**Worktree:** `.claude/worktrees/47_errors-panel-and-e2e/`
**Phase:** 4 (server infrastructure follow-up)
**Depends on:** 2b (provides the `/api/errors` routes, store, and delivery state machine — without it there is nothing to render or to drive an e2e)
**Parallel with:** any other Phase 4 worker that does not touch `packages/web/src/components/ErrorsPanel/` or `e2e/errors/`.

> **Why this worker exists:** worker 2b shipped the API surface only — the on-disk job-error store, the persist-first webhook delivery state machine, the boot-time replay, and the four `/api/errors` routes (list / get / redeliver / delete). The web UI and end-to-end coverage were explicitly deferred per the 2b prompt: *"If layout time gets tight, this UI can be a follow-up worker — the API surface is the must-ship."* This worker is that follow-up. The user interaction the panel unlocks — "see what failed, see which deliveries are stuck, retry the ones you fixed upstream, dismiss the ones you handled" — is what makes 2b useful to a human operator rather than just to Home Assistant.

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Tests must cover the change scope. Yarn only. Manifest row update lands as its own `chore(manifest):` commit. See [AGENTS.md](../../AGENTS.md).

## Your Mission

### Web Errors panel

A new "Errors" tab/panel that shows the persisted-error records from worker 2b. Treat this as read-mostly — defer to the existing job-detail / job-log UI styles, do **not** invest in heavy custom layout.

Required surface:

- **List view** with one row per record showing:
  - `id` (or a short suffix of it)
  - `occurredAt` (relative-time format consistent with the rest of the app — see how `JobCard` renders timestamps)
  - `jobId` rendered as a link that scrolls/navigates to that job in the existing jobs panel
  - `msg` (single-line, truncated)
  - **Delivery-state badge** — three visual states: `pending` (neutral/grey), `delivered` (success/green), `exhausted` (danger/red). Use the existing badge component(s) if any exist; otherwise add a small `DeliveryStateBadge` component next to `ErrorsPanel.tsx`.
  - Two actions on the row, only enabled for the relevant state:
    - **Retry delivery** — visible only on `exhausted` rows. POSTs `/api/errors/:id/redeliver` and re-renders.
    - **Dismiss** — visible on every row. DELETEs `/api/errors/:id` after a confirmation step (use the same confirmation pattern the rest of the app uses for destructive single-item actions).
- **Detail view / expansion** for a single row, showing:
  - The full `stack` (monospace, scrollable if long)
  - `traceId` / `spanId` if present
  - `errorName`
  - `webhookDelivery.attempts`, `webhookDelivery.lastAttemptAt`, `webhookDelivery.lastError`
  - For records with `stepIndex` or `fileId`, surface those plainly.

Filtering: by `state` (the badge values) and by free-text `jobId` substring. Server already supports `?state=` and `?jobId=` query params — wire the panel to use them rather than client-side filtering.

Pagination: bare minimum. The server may return up to 1000 records (the eviction cap from 2b); render newest-first and let the user scroll. If a single-page render of 1000 rows is visibly janky during dev, add a 100-row windowing pass — but only if needed; do not pre-optimize.

### Storybook (mandatory — see AGENTS.md)

Every new component **must** ship with three files in the same directory:

1. `ComponentName.stories.tsx` — one story per distinct visual state. Required stories for `ErrorsPanel`:
   - `Empty` — no errors
   - `WithPending` — one pending record
   - `WithDelivered` — one delivered record
   - `WithExhausted` — one exhausted record with `lastError` populated
   - `Mixed` — at least one of each state, plus a few extras to show ordering
2. `ComponentName.mdx` — prose description, prop table, `<Canvas>` for every story
3. The component file itself

Stories must inject fake records via a Jotai `Provider` + `createStore` (or whatever atom-injection pattern the existing panel components use). **No live network calls in stories.**

### Tab wiring

Add the panel as a new top-level tab in whatever navigation the app uses (see `packages/web/src/App.tsx` and the existing jobs/logs tabs). Match the URL-routing pattern of the existing tabs so deep-linking to `/errors` works.

### e2e (the trust gate)

This is the e2e test that worker 2b deferred. It is **the** must-ship piece of this worker — the panel can be light, but the e2e proves the full persist → deliver → display loop.

Scenario: trigger a known-failing job (use the existing fake/test command handler — see `packages/server/src/__mocks__/` for the pattern) with `WEBHOOK_JOB_FAILED_URL` pointing at a local Playwright-spun HTTP server that:
1. Returns `500` on the first request.
2. Returns `200` on every subsequent request.

Steps:
1. Start the local mock receiver on a Playwright-managed port.
2. Set `WEBHOOK_JOB_FAILED_URL` to its address (use the worker-port protocol from AGENTS.md).
3. Trigger the failing job.
4. Navigate to the Errors panel.
5. Assert: a record appears with state `pending`.
6. Wait for the delivery queue to retry (the backoff schedule starts at 1s — the test can wait ~2s).
7. Assert: the record transitions to `delivered`.
8. Click **Dismiss**, assert the row disappears.
9. Tear down the receiver and the job state.

Additional e2e for the exhausted path:
- Mock receiver returns `404` every time.
- Trigger the failing job.
- Assert: the record reaches `exhausted` after the first attempt (4xx-non-429 short-circuits per 2b's state machine).
- Click **Retry delivery**, assert the record goes back to `pending`, then to `delivered` after the receiver is switched to `200`.

### Out of scope

- Reworking the delivery state machine or backoff schedule (that's 2b's territory; if you find a bug, fix it under the same `feat(errors):` namespace but flag it in the PR description).
- Persistent UI filters / saved searches.
- Aggregation / grouping of repeated errors.
- Notification routing beyond the existing webhook (Slack, email, etc.).

## Tests (per test-coverage discipline)

- **Component:** `ErrorsPanel` renders each state badge with the right colour token; row actions disabled/enabled per state; dismiss confirmation gates the DELETE call.
- **Component:** filter inputs build the correct query-string into the `/api/errors` request (assert via a mocked fetch).
- **Integration (vitest):** the panel re-renders after a successful `redeliver` POST — i.e. the state transition is reflected without a manual reload.
- **Storybook:** every story renders without runtime errors (covered by the storybook-vitest run).
- **e2e:** the two scenarios above.

## TDD steps

1. Failing component test for the row's state-badge rendering. Commit `test(errors): failing tests for ErrorsPanel state badges`.
2. Implement the badge component. Green.
3. Failing component test for row actions (retry visible only on exhausted, dismiss everywhere). Commit.
4. Implement the row component. Green.
5. Failing component test for the list-level filter + fetch wiring. Commit.
6. Implement the panel container + Jotai atoms. Green.
7. Stories + mdx. Run Storybook locally and confirm.
8. Wire the tab into the app shell.
9. e2e: write the two failing scenarios first. Commit.
10. Make them pass (the only edits should be UI glue; the API is already correct).
11. Full pre-merge gate.
12. Manifest row → `done`.

## Files

- [packages/web/src/components/ErrorsPanel/ErrorsPanel.tsx](../../packages/web/src/components/ErrorsPanel/ErrorsPanel.tsx) — new (container)
- [packages/web/src/components/ErrorsPanel/ErrorRow.tsx](../../packages/web/src/components/ErrorsPanel/ErrorRow.tsx) — new (row + actions)
- [packages/web/src/components/ErrorsPanel/DeliveryStateBadge.tsx](../../packages/web/src/components/ErrorsPanel/DeliveryStateBadge.tsx) — new
- [packages/web/src/components/ErrorsPanel/ErrorsPanel.stories.tsx](../../packages/web/src/components/ErrorsPanel/ErrorsPanel.stories.tsx) — new
- [packages/web/src/components/ErrorsPanel/ErrorsPanel.mdx](../../packages/web/src/components/ErrorsPanel/ErrorsPanel.mdx) — new
- [packages/web/src/components/ErrorsPanel/errorAtoms.ts](../../packages/web/src/components/ErrorsPanel/errorAtoms.ts) — new (Jotai state)
- [packages/web/src/App.tsx](../../packages/web/src/App.tsx) — modify (tab wiring)
- [e2e/errors/](../../e2e/errors/) — new (two Playwright specs)
- Tests for all of the above

## Verification checklist

- [ ] Worker 2b ✅ merged before starting
- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Failing tests committed first
- [ ] One-component-per-file rule observed (worker 07's ESLint rule will fail the build otherwise)
- [ ] Three Storybook files present for each new component
- [ ] State badge colours match an existing token in the design system (don't introduce ad-hoc hex values)
- [ ] Filter UI sends server-side `?state=` / `?jobId=` rather than filtering client-side
- [ ] Retry visible only on `exhausted` rows; Dismiss has a confirmation step
- [ ] Two e2e scenarios pass (5xx-then-success, and exhausted-then-manual-retry)
- [ ] Standard pre-merge gate clean
- [ ] PR opened against `feat/mux-magic-revamp`
- [ ] Manifest row → `done` in a separate commit
