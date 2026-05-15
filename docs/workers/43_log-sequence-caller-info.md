# Worker 43 — log-sequence-caller-info

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/43-log-sequence-caller-info`
**Worktree:** `.claude/worktrees/43_log-sequence-caller-info/`
**Phase:** 5
**Depends on:** 01 (rebrand), 41 (structured logging — soft; this worker uses the same `logInfo` path either way)
**Parallel with:** any Phase 5 worker that doesn't touch [packages/server/src/api/routes/sequenceRoutes.ts](../../packages/server/src/api/routes/sequenceRoutes.ts), [packages/server/src/api/sequenceRunner.ts](../../packages/server/src/api/sequenceRunner.ts), [packages/server/src/api/jobStore.ts](../../packages/server/src/api/jobStore.ts), [packages/server/src/api/types.ts](../../packages/server/src/api/types.ts), or [packages/web/src/components/JobCard/JobCard.tsx](../../packages/web/src/components/JobCard/JobCard.tsx).

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Context

Today, when someone POSTs to `/sequences/run`, the resulting Job has no record of *who* kicked it off. The user routinely triggers sequences from multiple machines on the LAN (Home Assistant, a desktop browser, ad-hoc curl/scripts on other boxes). When something looks off in the Jobs UI later, there is currently no way to tell which machine dispatched the run — the umbrella sequence Job only carries the parsed `params` body, not the caller's network identity.

This worker captures the caller's identity at dispatch time and surfaces it on the umbrella sequence Job. Two surfaces are needed because each fills a different gap:

- **Structured field on the Job record** — queryable later, survives re-renders, doesn't pollute the per-step log stream. Required so future tooling (filtering jobs by caller, error-persistence webhook in worker `2b`) can read it programmatically.
- **First log line of the sequence** — visible immediately in the existing logs disclosure with zero extra UI work. Without it, the structured field alone is invisible: the current [JobCard](../../packages/web/src/components/JobCard/JobCard.tsx) only renders specific fields (status, times, params, results, logs) and a new field would silently no-op until rendered.

Caller identity captured: remote IP, reverse-DNS hostname of that IP, `Origin` header, `Referer` header, and `User-Agent`. Reverse DNS is best-effort with a short timeout — when it resolves it tells the user "this came from `nas.local`" instead of "this came from `192.168.1.42`," which is the form the user actually thinks in.

## Your Mission

### 1. New helper — `getCallerInfo` + `resolveCallerHostname`

New file: `packages/server/src/api/utils/getCallerInfo.ts`.

```ts
export type CallerInfo = {
  ip: string | null
  hostname: string | null
  origin: string | null
  referer: string | null
  userAgent: string | null
}

export const getCallerInfo = (context: Context): CallerInfo => { … }
export const resolveCallerHostname = (
  ip: string | null,
  timeoutMs?: number,
): Promise<string | null> => { … }
```

`getCallerInfo` is **sync**. It pulls:

- `ip`: first non-empty value from `x-forwarded-for` (comma-split, trimmed) → `x-real-ip` → `getConnInfo(context).remote.address` (import `getConnInfo` from `@hono/node-server/conninfo`).
- `origin`: `context.req.header("origin") ?? null`
- `referer`: `context.req.header("referer") ?? null`
- `userAgent`: `context.req.header("user-agent") ?? null`
- `hostname`: always `null` here — resolved later inside the job so the 202 response is not delayed.

`resolveCallerHostname` is **async**, uses `node:dns/promises` `reverse(ip)`, returns the first name. Wraps in `Promise.race` with a default `500ms` timeout. Swallows `ENOTFOUND`, `ENODATA`, and timeout, returning `null`. Skips obvious loopback (`127.0.0.1`, `::1`) without making a DNS call.

Follow the `(context: Context) => …` pattern already used by `isFakeRequest` / `getFakeScenario` in [packages/server/src/fake-data/index.ts](../../packages/server/src/fake-data/index.ts) — same arg shape, same export style.

### 2. Job type + jobStore — persist `callerInfo`

[packages/server/src/api/types.ts](../../packages/server/src/api/types.ts): add `callerInfo: CallerInfo | null` to the `Job` type (and ensure the `JobWire` projection picks it up). `null` for non-sequence jobs and child step jobs.

[packages/server/src/api/jobStore.ts](../../packages/server/src/api/jobStore.ts):

- Extend `createJob` to accept and persist `callerInfo` (default `null`).
- Add `setJobCallerHostname(jobId, hostname)` that mutates the field on the existing job record and emits a job-update event over SSE so the UI re-renders once reverse-DNS finishes. Reuse the existing `emitJobEvent` channel — no new event type needed; the standard job-update payload carries the full updated Job.

### 3. Wire through `sequenceRoutes.ts`

[packages/server/src/api/routes/sequenceRoutes.ts](../../packages/server/src/api/routes/sequenceRoutes.ts) at the dispatch handler (currently ~lines 598–649), before `runSequenceJob`:

```ts
const callerInfo = getCallerInfo(context)

const job = createJob({
  commandName: "sequence",
  params: parsed,
  callerInfo,
})

runSequenceJob(job.id, parsed, {
  isUsingFake: isFakeRequest(context),
  globalScenario: getFakeScenario(context),
  callerInfo,
})
```

### 4. Extend `runSequenceJob`

[packages/server/src/api/sequenceRunner.ts](../../packages/server/src/api/sequenceRunner.ts) `runSequenceJob` (~line 153): add `callerInfo?: CallerInfo` to the options.

Near the top of the async start (before the first-step loop, ahead of the existing `logInfo("SEQUENCE", …)` site around line 365), guarded by `if (callerInfo)`:

1. `await resolveCallerHostname(callerInfo.ip)` — short, bounded by the timeout.
2. `setJobCallerHostname(jobId, hostname)` to enrich the Job record + push the SSE update.
3. Emit the first log line:

   ```
   Dispatched by ip=<ip> host=<hostname> origin=<origin> ua=<ua>
   ```

   Use `-` placeholders for missing fields (not the literal word "null"). Use the existing `logInfo("SEQUENCE", …)` from `@mux-magic/tools` ([packages/tools/src/logMessage.ts](../../packages/tools/src/logMessage.ts)).

Keep the option optional so non-HTTP callers (tests, internal callers) still work — `if (callerInfo)` short-circuits the entire block.

### 5. Render `callerInfo` in `JobCard`

[packages/web/src/components/JobCard/JobCard.tsx](../../packages/web/src/components/JobCard/JobCard.tsx): when the Job has a non-null `callerInfo`, show a compact "Dispatched by" line in the header showing `ip` and `hostname` (fall back to `origin` when `ip` is null). Put the full set (Origin, Referer, User-Agent) inside a disclosure, mirroring the existing params/results/logs disclosure pattern in the same component.

Render nothing when `callerInfo` is `null` — non-sequence jobs and child step jobs must look unchanged.

If a web-side type mirror of `JobWire` exists (e.g. in [packages/web/src/types.ts](../../packages/web/src/types.ts) or a generated server-types barrel), update it to include the new field.

## TDD steps

1. **`getCallerInfo` extraction** — unit test with a stubbed Hono `context`:
   - Returns `x-forwarded-for` first value (trimmed) when present, comma-split correctly.
   - Falls through to `x-real-ip`, then to `getConnInfo` remote address.
   - Returns `null` for missing headers (origin/referer/user-agent), never throws.
2. **`resolveCallerHostname` behaviour** — unit test:
   - Returns `null` for `null`, `127.0.0.1`, `::1` without hitting DNS (assert the mock was not called).
   - Returns the first name from `dns.reverse` when it resolves.
   - Returns `null` when `dns.reverse` rejects (`ENOTFOUND`) or exceeds the timeout.
3. **`createJob` persists `callerInfo`** — unit test that the stored Job round-trips the field on `getJob`.
4. **`setJobCallerHostname` mutates + emits** — unit test that the field updates and `emitJobEvent` is called.
5. **Route integration** — POST `/sequences/run` with `x-forwarded-for: 10.0.0.42`, assert the resulting Job's `callerInfo.ip === "10.0.0.42"`.
6. **Sequence-runner log line** — run a trivial single-step sequence with a fake `callerInfo`, assert the first emitted log line matches `/^Dispatched by ip=.* host=.* origin=.* ua=.*/`.
7. **`JobCard` rendering** — story/test covering: caller info renders when present; nothing renders when `callerInfo` is null; disclosure expands to show all fields.
8. **E2E (Playwright)** — drive a sequence run end-to-end, confirm the Job header shows the dispatched-by row and the first log line matches the format.

## Files

### New

- [packages/server/src/api/utils/getCallerInfo.ts](../../packages/server/src/api/utils/getCallerInfo.ts) — `getCallerInfo` + `resolveCallerHostname` + `CallerInfo` type
- `packages/server/src/api/utils/getCallerInfo.test.ts` — unit tests for both helpers

### Extend

- [packages/server/src/api/types.ts](../../packages/server/src/api/types.ts) — add `callerInfo: CallerInfo | null` to `Job` (and `JobWire` if it has its own field list)
- [packages/server/src/api/jobStore.ts](../../packages/server/src/api/jobStore.ts) — `createJob` accepts `callerInfo`; add `setJobCallerHostname`
- [packages/server/src/api/routes/sequenceRoutes.ts](../../packages/server/src/api/routes/sequenceRoutes.ts) — call `getCallerInfo(context)` at dispatch; pass through `createJob` + `runSequenceJob`
- [packages/server/src/api/sequenceRunner.ts](../../packages/server/src/api/sequenceRunner.ts) — accept `callerInfo` option; resolve hostname + emit first log line
- [packages/web/src/components/JobCard/JobCard.tsx](../../packages/web/src/components/JobCard/JobCard.tsx) — render caller info + disclosure when present
- Web-side `JobWire` type mirror (wherever it lives) — include `callerInfo`

### Reuse — do not reinvent

- `getConnInfo` from `@hono/node-server/conninfo` — supported Hono-on-Node socket info accessor. No custom middleware required.
- `(context: Context) => …` extraction pattern from [packages/server/src/fake-data/index.ts](../../packages/server/src/fake-data/index.ts) (`isFakeRequest`, `getFakeScenario`).
- `logInfo` from `@mux-magic/tools` ([packages/tools/src/logMessage.ts](../../packages/tools/src/logMessage.ts)) — flows through the existing `appendJobLog` capture path; nothing new on the transport layer.
- The job-update SSE channel — `emitJobEvent` already pushes the full Job; no new event type needed for the hostname enrichment.
- `JobCard`'s existing disclosure pattern — copy the params/results/logs structure for the "Dispatched by" disclosure.

## Out of scope (explicit)

- Logging caller info on **per-command** `/commands/<name>` runs. Only the sequence dispatch endpoint is in scope; per-command runs typically share the same caller context as their parent sequence and don't need a separate logging path.
- Anti-spoofing of `x-forwarded-for`. The user's network is trusted; no reverse-proxy chain whitelist is configured. Document this in the helper's comment so a future reader doesn't assume the field is authenticated.
- A jobs-filter UI by caller. The structured field is captured here for later consumers; no new filter control is built.
- Geo-IP enrichment or WHOIS lookups — out of scope and a network-leak risk.

## Verification checklist

- [ ] Standard gates clean (`lint → typecheck → test → e2e → lint`)
- [ ] All TDD steps pass
- [ ] Manual: POST a sequence from a second machine on the LAN; Jobs UI header on the umbrella job shows IP + hostname within ~500ms; first log line matches the expected format.
- [ ] Manual: POST via `curl` from localhost; IP shows `127.0.0.1` / `::1`, hostname shows `-` gracefully, origin/referer/UA show `-` when absent — nothing crashes.
- [ ] Manual: POST with a manually-set `x-forwarded-for: 10.0.0.42`; that value wins over the socket address.
- [ ] PR opened against `feat/mux-magic-revamp`
- [ ] [docs/workers/MANIFEST.md](MANIFEST.md) row updated to `done`
