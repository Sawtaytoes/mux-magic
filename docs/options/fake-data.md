# Fake-data approaches for the Jobs / Builder UI

## Goal

We want to exercise the Jobs page (`public/api/index.html`) and the Builder
page run modal (`public/api/builder/index.html`) end-to-end without
actually running real ffmpeg / mkvtoolnix / filesystem commands. That
means: a "Run" click should still produce a real job in `jobStore`, real
SSE frames over `/jobs/stream` and `/jobs/:id/logs`, real per-step
`step-started` / `step-finished` umbrella events, real cancel semantics,
real progress events — but driven by a scripted observable instead of
the actual command pipeline. The point is to demo, design-review, and
regression-test the UI surfaces without touching the disk.

## Validated seams (spot-checked against the prior plan)

- `src/api/sequenceRunner.ts` — confirmed: line **225** does
  `const config: CommandConfig = commandConfigs[step.command]`. (Plan
  said "~250"; actual is 225. Close enough; the seam is real.)
- `src/api/routes/commandRoutes.ts` — confirmed: exports
  `CommandConfig` (line 121) and `commandConfigs` (line 146); every
  entry has `getObservable` + optional `extractOutputs`.
- `public/api/sse-utils.js` — confirmed: defines
  `createTolerantEventSource(url, opts)` at line 25 and exposes it as
  `global.createTolerantEventSource` at line 90.
- `src/api/jobStore.ts`, `src/api/jobRunner.ts`, `src/api-server.ts`,
  `src/api/hono-routes.ts`, `src/api/routes/jobRoutes.ts`,
  `src/api/routes/logRoutes.ts` — referenced as in the prior plan; no
  contradictions found. The route layer reads from `jobStore` only and
  is agnostic to whether jobs were driven by real or fake observables.

## The four options

| # | Approach | How it works | Seam | Covers | Doesn't cover | Effort | Risk |
|---|----------|--------------|------|--------|---------------|--------|------|
| A | `--fake-data` server flag | At boot, read `process.argv` / `MEDIA_TOOLS_FAKE_DATA`; swap the `commandConfigs` map (consumed by both `commandRoutes` and `sequenceRunner`) for a fake table whose `getObservable` returns a timer-driven RxJS observable emitting log lines, occasional `ProgressEvent`s via `progressEmitter`, then `complete` / `throw`. Optional second flag picks scenario id. | `getCommandConfigs()` accessor, or env-driven branch in `commandRoutes.ts` / `sequenceRunner.ts` at module load. | Every UI surface that hits real endpoints: Jobs page, Builder run modal, per-step SSE, cancel, sequence umbrella, parallel/serial groups, external `gh`/`curl` callers. Real wire format, real keepalive, real unsubscribe. | Filesystem-backed reads (`/files`, `/inputs`, `/queries`) unless extended explicitly. | Small (~150 LOC fake table + ~10 LOC seam). | Low — off by default; no prod path change when unset; one diff to delete. |
| B | In-browser MSW / hand-rolled shim | A header checkbox sets a `localStorage` flag; a `fake-api.js` shim intercepts `fetch(...)` and `EventSource(...)` for `/commands/*`, `/jobs*`, `/jobs/:id/logs` before real handlers see them. Either MSW (service worker) or monkey-patch globals. | Browser-side global patches; no server change. | No server needed — designers / reviewers play with UI on a deploy preview without Node. | SSE framing, keepalive, `lastEventId` resume (see `docs/sse-last-event-id-resume.md`), cancellation cascade, parent/child step plumbing all have to be re-implemented in JS. `createTolerantEventSource` must keep working unchanged. Drift risk: server changes invisible to shim. | Medium-large for MSW (v2 has no native SSE, custom handler required); medium hand-rolled. | High drift / divergence; service-worker scope finicky for static-served pages. |
| C | Recorded fixture replay | Capture a real run's `/jobs/stream` + logs SSE transcript into JSON fixtures under `tests/fixtures/fake-runs/`. A `--replay <name>` server flag (or `?replay=…` per request) plays them back via existing `jobStore` writers with recorded timing. | Recorder/player module + a switch in the in-process scheduler; reuses `createJob` / `appendJobLog` / `emitJobEvent` / `updateJob`. | Highest fidelity — "this is exactly what the UI rendered for this scenario." Useful as a regression artifact. | Zero interactivity: param changes do nothing meaningful, the run is whatever was recorded. Cancel mid-run is awkward (truncate playback?). Fixtures rot as SSE schema evolves. | Medium for recorder + player; ongoing fixture-maintenance cost. | Low correctness risk, high maintenance risk. |
| D | Per-request `?fake=1` toggle (combine with A) | Ship A. Add a one-line UI toggle in the run modal that rewrites the launch URL to `/commands/<name>?fake=1` (or sets a request header). Server reads the per-request flag and swaps the config for that one job. Single build can do fake or real runs without restarting. | Same as A, but resolved per request inside the route handler / `sequenceRunner` step lookup, not at module load. | Per-run scoping; mixes real and fake side by side; avoids "two server instances on different ports" foot-gun. | Same gaps as A regarding non-job routes. | Small + small (on top of A). | Low — but the fake path must be gated behind an env var so it cannot fire in a production deployment. |

## Recommendation: Option A combined with Option D

Adopt Option A as the foundation and layer Option D on top. The
combination reuses every real seam — `commandConfigs` (the single
intercept point), `jobStore` (state + `jobEvents$` Subject + per-job log
subjects), the route layer (`/commands/:name`, `/jobs`, `/jobs/stream`,
`/jobs/:id/logs`), the existing SSE wire format, and the client-side
`createTolerantEventSource` consumer — so the UI sees authentic timing,
authentic cancellation, and authentic step plumbing without us
re-implementing any of the protocol pieces. The server-instance flag
(A) handles the "boot a fake API for designers" use case; the
per-request flag (D) handles the "demo a fake run alongside real ones
on the same dev box" use case. Both paths sit behind the same env-var
gate, so a production deployment with the flag unset has zero new
surface area, and the whole feature can be deleted in a single diff if
we change our minds.

## Open questions

1. **Number and shape of canned scenarios.** Just a happy path, or also
   `failsAtStepN`, `slowBurn`, `parallel-group fail-fast`, `keepalive-stress`,
   `cancelled-mid-step`, `skipped-children`? This decides whether scenario
   id is a boot-time choice (Option A only) or per-request (forces D).
2. **Should fake mode also fake the read-only routes** — `/files`,
   `/inputs`, `/queries` — that drive the file-browser dropdowns? The
   user's ask was about "Run" / step states, but Builder param pickers
   feel real only if those dropdowns are populated.
3. **Per-run vs server-instance toggle.** Both, just A, or just D?
   Affects how `fake=1` is gated against accidental production firing.
4. **Log realism.** Random Lorem-ipsum-ish strings, deterministic
   templated lines (`"[ffmpeg] frame=  120 fps= 30 ..."`), or replays
   of real captured log content? Highest realism = closest to Option C
   for log content even while keeping A's interactive control flow.
5. **Cancellation, parallel-group fail-fast, and skipped-children**
   semantics — are these part of "looks like it ran" (so the fake
   observable must honour unsubscribe and emit the right umbrella
   events on sibling failure), or out of scope for v1?
