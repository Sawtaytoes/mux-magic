# Server-side SSE resume via `Last-Event-ID`

## Status

**Pending — handed off.** This is a planning doc for an agent to pick up. The user-visible duplicate-log bug is already fixed via the client-side dedup that shipped in PR #17 (see [src/api/routes/logRoutes.ts](../src/api/routes/logRoutes.ts) and the `lastLogIndexByJobId` map in [public/api/index.html](../public/api/index.html)). This work is purely a server-side bandwidth optimization on top of that.

## Background

Every log-line SSE event already carries `id: <index>` where the index is the line's position in `job.logs` (added in PR #17 to make client-side dedup possible). Browsers automatically:

1. Track the most recent `id:` value seen on the EventSource.
2. On a transient disconnect followed by an internal auto-reconnect, send a `Last-Event-ID: <last-seen>` header on the reconnect HTTP request.

Today the server ignores that header and replays the entire `job.logs` buffer from index 0 on every connection. The client-side dedup catches the duplicates, but the bytes still cross the wire. For long jobs with thousands of log lines and intermittent connectivity, the wasted bandwidth adds up.

This doc plans the server-side optimization: read the header, skip the replay range the client has already seen.

## Motivation

Saves bandwidth and replay latency on:

- Network blips (Wi-Fi handoff, brief connectivity loss).
- Keepalive timeouts where intermediate proxies drop the connection.
- Server restarts that retain in-memory job state (rare in dev but possible in long-lived processes).

Does **not** help (these always need full replay):

- Page reloads — fresh EventSource, no header.
- Disclosure re-open in the Jobs UI — fresh EventSource, no header.
- Cross-tab subscriptions — each tab has its own EventSource.

For the no-help cases, the existing client-side dedup already handles correctness.

## Browser behavior

The native `EventSource` API:

- Stores the most recent `id:` field across the connection's lifetime.
- On internal auto-reconnect (default 3 s after `onerror`), sends `Last-Event-ID: <last-seen>` as a request header.
- Resets the stored value to `""` only when the page reloads or the EventSource is explicitly `close()`d and re-`new`d.

Reference: [WHATWG HTML spec — server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html#dispatchMessage).

## Server changes

Single file: [src/api/routes/logRoutes.ts](../src/api/routes/logRoutes.ts).

### Read the header

In Hono, the request header is accessed via `context.req.header("Last-Event-ID")`. Add this near the top of the handler, after the `getJob` lookup but before the `streamSSE` callback.

```ts
const lastEventIdHeader = context.req.header("Last-Event-ID")
const resumeFromIndex = (() => {
  if (lastEventIdHeader === undefined) return 0
  const parsed = Number(lastEventIdHeader)
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  // Header is the LAST seen id; replay starts at the next line.
  return Math.min(parsed + 1, job.logs.length)
})()
```

### Adjust the replay loop

Currently:

```ts
for (let logIndex = 0; logIndex < job.logs.length; logIndex += 1) {
  await stream.writeSSE({
    data: JSON.stringify({ line: job.logs[logIndex] }),
    id: String(logIndex),
  })
}
```

Becomes:

```ts
for (let logIndex = resumeFromIndex; logIndex < job.logs.length; logIndex += 1) {
  await stream.writeSSE({
    data: JSON.stringify({ line: job.logs[logIndex] }),
    id: String(logIndex),
  })
}
```

### Live phase is unchanged

`nextLiveIndex = job.logs.length` is already correct — it doesn't depend on `resumeFromIndex`. Live emissions continue at the actual current end of the buffer.

## Edge cases

- **Header present, value past end of buffer** (e.g. server restarted, job state lost and a new job exists at this id but with shorter logs): clamping via `Math.min(parsed + 1, job.logs.length)` ensures the replay loop simply doesn't run. The live phase begins immediately. The client's `lastLogIndexByJobId` dedup acts as a safety net if the client somehow has stale data.
- **Header present, value below 0 or non-numeric**: fall through to `resumeFromIndex = 0`. Defensive — should never happen with a well-behaved browser, but cheap to handle.
- **Header missing** (fresh EventSource, page reload, disclosure re-open): `resumeFromIndex = 0`, full replay. Same as today's behavior.
- **Keepalive comments** (`": keepalive\n\n"` written by [sseKeepalive.ts](../src/api/sseKeepalive.ts)): no `id:` field, so they don't advance the browser's stored `Last-Event-ID`. They're a no-op for resume.
- **Non-line events** (progress, prompt, done): no `id:` field by design. Resume only affects line replay.

## Out of scope

- **Don't remove the client-side `lastLogIndexByJobId` dedup.** It's the safety net for the cases this work doesn't help (page reload, disclosure re-open) and for any server bugs that re-send a line. Server-side resume is an *optimization*; client-side dedup is a *correctness* guarantee.
- **Don't change the SSE event shape.** The `id:` field is already there since PR #17. Keep it.
- **Don't add a max-age or trim policy on `job.logs`.** The buffer is bounded by job lifetime; trimming would invalidate the index-based dedup. Out of scope here.

## Test plan

### Unit

Add a test in [src/api/routes/logRoutes.test.ts](../src/api/routes/logRoutes.test.ts) (file may need to be created if it doesn't exist; pattern after [jobRoutes.test.ts](../src/api/routes/jobRoutes.test.ts)).

```ts
test("Last-Event-ID header skips already-seen replay lines", async () => {
  const job = createJob({ commandName: "noop", params: {}, outputFolderName: null })
  appendJobLog(job.id, "line-0")
  appendJobLog(job.id, "line-1")
  appendJobLog(job.id, "line-2")
  appendJobLog(job.id, "line-3")
  // Mark terminal so the SSE handler returns after replay.
  updateJob(job.id, { status: "completed" })

  const response = await logsRoutes.request(`/jobs/${job.id}/logs`, {
    headers: { "Last-Event-ID": "1" },
  })

  const text = await response.text()
  // Replay should have only emitted lines 2 and 3 (id=1 was the last
  // already-seen).
  expect(text).not.toContain("line-0")
  expect(text).not.toContain("line-1")
  expect(text).toContain("line-2")
  expect(text).toContain("line-3")
})

test("missing Last-Event-ID falls back to full replay", async () => {
  // ... same setup, no header ...
  // Assert all 4 lines present.
})

test("Last-Event-ID past buffer end emits no replay (live-only)", async () => {
  // ... seed 2 lines, set status=running, send Last-Event-ID: 99 ...
  // Assert no `line-N` strings in the immediate response.
})

test("non-numeric Last-Event-ID falls back to full replay", async () => {
  // Header value "garbage" → resumeFromIndex = 0.
})
```

### Manual

1. Start the API dev server.
2. Open `http://localhost:<PORT>/` (Jobs page) in a browser.
3. Trigger a long-running sequence (e.g. the anime-subtitles example).
4. Open DevTools → Network. Find the active `/jobs/<id>/logs` request, observe streaming events.
5. Right-click the request → Block request URL. Wait 4 s for the EventSource to fire `onerror` and reconnect.
6. Unblock the request URL.
7. Inspect the new request: it should carry `Last-Event-ID` with the index of the last line received pre-blip.
8. The new response should pick up at the next index, not from 0.
9. Visual check: the Jobs UI's log pane should not show duplicate entries during the reconnect (already true thanks to the client-side dedup; this just confirms the server is doing less work).

## Effort estimate

- Header parsing + replay-loop edit + comment: ~10 min.
- Unit tests: ~30 min (especially if `logRoutes.test.ts` doesn't exist yet — first test takes longer to wire up the harness).
- Manual verification: ~10 min.

Total: ~30–60 min depending on test setup.

## Files touched

- [src/api/routes/logRoutes.ts](../src/api/routes/logRoutes.ts) — header read + replay-loop start index.
- [src/api/routes/logRoutes.test.ts](../src/api/routes/logRoutes.test.ts) — new tests (likely a new file).

## Related

- PR #17 (Task scheduler + multi-file progress UI) — landed the client-side dedup and the per-line `id:` SSE tagging this work builds on.
- [docs/progress-events-followups.md](progress-events-followups.md) — companion follow-ups doc.
