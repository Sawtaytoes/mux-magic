# Worker 7e — Seekable transcode video player (MSE client port)

**Track:** web (+ small api/core) · **Model:** Opus · **Effort:** High · **Status:** in-progress

> Resolves fix-handoff item **L** ([docs/audits/2026-06-30-fix-handoff.md](../audits/2026-06-30-fix-handoff.md)). Design + scope boundaries are locked in [docs/decisions/2026-06-30-seekable-transcode-video-player.md](../decisions/2026-06-30-seekable-transcode-video-player.md) — read it first.

## Why

The browser video player (file-explorer preview + PromptModal "▶ Play", rendered by `VideoPreviewModal` → `FileVideoPlayer`) does not play many real sources correctly:

- **No duration / no seeking** for transcoded sources. The React `FileVideoPlayer` regressed to a plain `<video src={transcodeUrl}>` pointed at a *live* ffmpeg pipe (no length, no range). The fully-debugged v1 MSE pipeline (vanilla JS, final form at commit `6f089724`, file `public/builder/js/components/file-explorer-modal.js`) was never ported into React.
- **MKV-with-compatible-codecs won't play at all** — routing keys on audio codec alone, so a Matroska container with browser-safe AAC+H.264 routes to `/files/stream` and the browser can't demux it.

The server side (`/transcode/audio`, `runFfmpegAudioTranscode.ts`) is already built for this: `HEAD` → `X-Duration` + `X-Video-Codec`, `?start=<sec>` input-side `-ss`, fragmented fMP4, `-c:v copy` + Opus audio.

## Goal (user's acceptance criteria)

1. Open a video file → the player shows the **correct total time** immediately.
2. Press play → plays from the start with **video *and* audio**.
3. Click the seek bar at ~2:00 → resumes from 2:00 with **video *and* audio**.
4. On a long movie file → seek **anywhere**, video *and* audio.

## Scope

### A. Port the MSE pipeline into `FileVideoPlayer.tsx` (the heart)

Reconstruct the v1 `setupMsePlayer` inside the existing `mseCleanupRef`/`clearMse` scaffolding (already present, body never filled). The reference implementation (extracted from `6f089724`) is the source of truth for the **exact** seek-reset ordering — do not deviate. Required behaviors:

- `HEAD playbackUrl` → `mediaSource.duration = X-Duration`; mime from `X-Video-Codec` (RFC 6381) + `,opus`; `isTypeSupported` gate with direct-`src` fallback.
- `MediaSource` + object URL on `<video>`; append-pump from `fetch().body.getReader()` with a 30 s look-ahead throttle and `QuotaExceededError` eviction (keep last 5 s for backward scrub).
- Seek handler: skip re-fetch when the target is already buffered; otherwise `startStream(t)`.
- `startStream` reset order (LOAD-BEARING — see decision doc "rejected"): if `readyState !== "open"` rebuild MediaSource; else `await` any in-flight update → `sb.abort()` → `sb.timestampOffset = startSeconds` → `sb.remove(0, Infinity)`.
- Monotonic `activeVersion` guard + `AbortController` so rapid seeks can't interleave.
- `mseCleanup`: remove `seeking` listener, abort fetch, revoke object URL. Wire it into the component's existing unmount/path-change cleanup.

### B. Broaden the route-to-transcode decision (goal-1 fix)

Add a `BROWSER_UNSUPPORTED_CONTAINER` set (`.mkv`, `.avi`, `.ts`, `.m2ts`, `.wmv`, `.flv`, plus confirm `.mov`/`.webm` are native-OK) keyed off the file extension. Route to `/transcode/audio` when **container unsupported OR audio unsupported** (today: audio only). Keep `/files/stream` for natively-playable container + safe audio.

### C. Retire the experimental flag (AFTER verification)

Once A+B verify locally **and** in the container, delete `EXPERIMENTAL_FFMPEG_TRANSCODING` (the `/features` gate in `featuresRoutes.ts` and the probe in `FileVideoPlayer`) so the transcode path is the default. Do not retire before container verification.

## Out of scope (tracked in the decision doc)

HEVC/AV1 **video** re-encode for browsers that can't decode it (→ worker 2f `ffmpeg-gpu-reencode-endpoint`); frame-accurate (sub-GOP) seeking; multi-audio-track picker; subtitles; Safari Opus-in-MP4 → AAC selection.

## Tests

- Unit: routing decision table (container × audio-codec → stream vs transcode); RFC 6381 mime assembly + `isTypeSupported` fallback branch. Server transcode/HEAD behavior is already covered in `transcodeRoutes.test.ts` — extend if args change.
- e2e/manual: Playwright MCP drives the real player — load (duration shown), play (video+audio frames advance), seek to 2:00 (resumes with video+audio), seek in a long file. MSE/`<video>` decoding can't be asserted in jsdom, so this is the trust gate. **Local pass does not certify the container** — re-run Playwright MCP against the deployed image (ffmpeg path/version differs; see decision doc §6).

## Files

- `packages/web/src/components/FileVideoPlayer/FileVideoPlayer.tsx` (primary)
- `packages/api/src/api/routes/featuresRoutes.ts` + `FileVideoPlayer` `/features` probe (flag retirement, step C)
- Reference only (do not resurrect): v1 `setupMsePlayer` at git `6f089724:public/builder/js/components/file-explorer-modal.js`
