# Worker 1c — gallery-downloader-decouple-and-ha-endpoint

**Model:** Sonnet · **Thinking:** ON · **Effort:** High
**Branch:** `feat/gallery-downloader-revamp/1c-decouple` (in the Gallery-Downloader repo)
**Worktree:** `D:\Projects\Personal\media-sync\.claude\worktrees\1c_decouple\` (path uses old name on disk; user hasn't renamed the directory yet)
**Phase:** 1B cross-repo
**Depends on:** 1b (rename complete)
**Parallel with:** 1e, 1f (different repo)

## Universal Rules (TL;DR)

Worktree-isolated in the Gallery-Downloader repo. Yarn only.

## Your Mission

Convert Gallery-Downloader (formerly `media-sync`) from a **scheduled background process** into a **stateless HTTP service** triggered by Home Assistant. Three concurrent changes in one worker:

### Change 1: Remove the scheduler

Delete the 4-daily cron at `packages/sync-scheduler/src/schedule.ts` (verify path after worker 1b's rename) and any associated boot code that starts it.

### Change 2: Add `WEBTOONS_LIST_SOURCE` env var + parser

Replace the hardcoded `webtoonUrisString.ts` with a runtime-resolved list. The server reads `WEBTOONS_LIST_SOURCE` env var on startup (or per-request) and resolves it:

```ts
// Pseudocode in a new module: packages/<scheduler-replacement>/src/webtoonsListSource.ts
type WebtoonsListSource = {
  uri: string  // e.g. "file:///path/to/list.yaml" or "https://gist.../raw/list.yaml"
}

async function resolveWebtoonsList(source: WebtoonsListSource): Promise<string[]> {
  if (source.uri.startsWith("file://")) {
    const path = source.uri.replace(/^file:\/\//, "")
    return parseListFromText(await fs.readFile(path, "utf-8"))
  }
  if (source.uri.startsWith("https://") || source.uri.startsWith("http://")) {
    const res = await fetch(source.uri)
    if (!res.ok) throw new Error(...)
    return parseListFromText(await res.text())
  }
  throw new Error("Unsupported scheme")
}
```

Parse format: one URL per line, ignore blank lines and lines starting with `#`. (Match whatever format the original `webtoonUrisString.ts` used — read it before this worker starts to confirm.)

### Change 3: Add HA-trigger inbound endpoint

New route `POST /jobs/sync-webtoons`:
- Reads `WEBTOONS_LIST_SOURCE`, resolves list, kicks off sync, returns 202 + jobId.
- Status reported via the **outbound webhook** to HA (existing `webhookReporter.ts` already does this for errors; extend for success/completion).
- Auth: shared secret header `X-HA-Token` matched against `HA_TRIGGER_TOKEN` env var (or similar). If absent or mismatched, return 401.

Similar new route `POST /jobs/sync-manga` (mirror semantics).

### Change 4: Remove `mediaToolsApi.ts`

The file (at `packages/sync-anime-and-manga/src/mediaToolsApi.ts`, renamed to `muxMagicApi.ts` by worker 1b) is now obsolete because Gallery-Downloader no longer calls Mux-Magic. Delete it and any callers. HA orchestrates by calling Mux-Magic separately.

### Change 5: Update `webhookReporter.ts`

Currently reports only errors to HA. Extend to also report:
- Job started (`POST {webhook}/job-started` with `{ jobId, type: "sync-webtoons" }`)
- Job completed (`POST {webhook}/job-completed` with `{ jobId, type, summary }`)
- Job failed (existing behavior preserved)

### Commit chunks

1. `feat(routes): add /jobs/sync-webtoons and /jobs/sync-manga HA-trigger endpoints`
2. `feat(env): add WEBTOONS_LIST_SOURCE resolver (file:// and https://)`
3. `feat(webhooks): extend webhookReporter for start/complete/fail events`
4. `chore(remove): delete scheduler (4-daily cron) and webtoonUrisString.ts`
5. `chore(remove): delete muxMagicApi.ts (no more Mux-Magic calls from Gallery-Downloader)`

## Files (in Gallery-Downloader repo)

- `D:\Projects\Personal\media-sync\packages\sync-scheduler\src\schedule.ts` — delete
- `D:\Projects\Personal\media-sync\packages\sync-scheduler\src\webtoonUrisString.ts` — delete (or replace with the env-var resolver)
- `D:\Projects\Personal\media-sync\packages\sync-anime-and-manga\src\muxMagicApi.ts` (post-1b rename) — delete
- `D:\Projects\Personal\media-sync\packages\sync-scheduler\src\webhookReporter.ts` — extend
- New: `D:\Projects\Personal\media-sync\packages\<server>\src\routes\jobRoutes.ts` (HA-trigger endpoints — find the appropriate server package)
- New: `D:\Projects\Personal\media-sync\packages\<server>\src\tools\webtoonsListSource.ts`

## Verification checklist

- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] All 5 commit chunks landed
- [ ] Scheduler removed; server no longer fires on boot
- [ ] HA-trigger endpoints respond to POST + token auth
- [ ] WEBTOONS_LIST_SOURCE resolves both file:// and https://
- [ ] Webhook reporter sends start/complete/fail events
- [ ] No `mediaToolsApi.ts` or `muxMagicApi.ts` references remain (grep clean)
- [ ] Gallery-Downloader's `yarn lint`, `yarn typecheck`, `yarn test` all pass
- [ ] PR opened in Gallery-Downloader repo
- [ ] Manifest row → `done`

## Out of scope

- The actual download logic (preserved as-is)
- Mux-Magic-side webhook receiver (worker `1e` does the Mux-Magic outbound side)
- Mux-Magic anime/manga commands that the new HA orchestration will eventually call (worker `1f`)
- Consuming `@mux-magic/tools` (worker `1d`)
- Renaming directories on disk (user's manual action)
