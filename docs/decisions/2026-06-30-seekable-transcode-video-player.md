# Seekable transcode video player: MSE client + audio-only re-encode, video copied

- **Status:** Accepted
- **Date decided:** 2026-06-30
- **Area:** web / core / api
- **Worker:** [7e](../workers/7e_seekable-transcode-video-player.md)
- **Related:** fix-handoff item **L** ([2026-06-30-fix-handoff.md](../audits/2026-06-30-fix-handoff.md)); supersedes the "gate it off and walk away" holding pattern behind `EXPERIMENTAL_FFMPEG_TRANSCODING`.

## Context

The in-browser video player (file-explorer preview + PromptModal "▶ Play") must, for any source the user opens:

1. Show the **correct total duration** on the seek bar immediately.
2. **Play from the start** with **video *and* audio**.
3. **Seek** to an arbitrary point (e.g. 2:00) and resume with **video *and* audio**.
4. Do (3) on **long files** (movies), seeking anywhere.

The server endpoint (`/transcode/audio`) was already built to support this — `HEAD` returns `X-Duration` + `X-Video-Codec`, `?start=<seconds>` does input-side `-ss`, output is fragmented fMP4. The **client regressed** during the vanilla-JS→React migration: the React `FileVideoPlayer` was simplified to a plain `<video src={transcodeUrl}>`, which points the element at a *live, non-seekable* ffmpeg stream — no duration, no seeking. The fully-debugged MSE pipeline that v1 shipped (in `public/builder/js/components/file-explorer-modal.js`, final form at commit `6f089724`) was never ported.

This decision records **how** the player works and — more importantly — the **scope boundaries** so a future agent doesn't "fix" the parts that are intentionally out of scope or re-introduce the bugs the v1 fix-chain already solved.

## Decision

**Port v1's MediaSource Extensions (MSE) pipeline into the React `FileVideoPlayer`, and broaden the route-to-transcode decision so the player actually plays the common disc-rip case.**

The transcode is **audio-only**: `-c:v copy` (video is never re-encoded — zero CPU beyond muxing), audio re-encoded to browser-safe Opus (stereo downmix), muxed to fragmented MP4. The MSE client:

- Reads `X-Duration` from a `HEAD` request → sets `mediaSource.duration` so the seek bar shows the real length **before** any media arrives.
- Builds the SourceBuffer mime from `X-Video-Codec` (RFC 6381 string, e.g. `video/mp4; codecs="avc1.640029,opus"`); if `MediaSource.isTypeSupported` is false, falls back to direct `<video src>`.
- On seek: aborts the in-flight fetch, re-requests `?start=<t>`, and resets the SourceBuffer with the **exact ordering** the v1 fix-chain converged on (see "rejected" below).

**Routing broadened (the goal-1 fix):** transcode when the **container is not natively playable** (`.mkv`/`.avi`/`.ts`/`.m2ts`/`.wmv`/`.flv` — browsers cannot demux Matroska/etc. in `<video>` *regardless of codec*) **OR** the audio codec is browser-unsupported. The old logic keyed on audio codec alone, so an `.mkv` with browser-safe AAC+H.264 silently routed to `/files/stream` and failed to play at all.

## What we rejected — DO NOT revert to this

- **DO NOT** revert the MSE client back to a plain `<video src={transcodeUrl}>`. A live ffmpeg pipe has no length and no byte-range support, so the seek bar is dead and duration is `Infinity`. This is the exact regression this worker fixes.
- **DO NOT** route to transcode on **audio codec alone.** Container matters: an MKV with compatible codecs still won't play natively. Most disc rips are MKV — keying on audio alone leaves goal #1 broken for the AAC/FLAC-in-MKV case.
- **DO NOT** "simplify" the seek reset. The v1 chain landed on a precise sequence after four separate bug fixes; reverting any step re-introduces a named, reproduced bug:
  - `sb.abort()` **before** setting `timestampOffset` — resets Chrome's append state out of `PARSING_MEDIA_SEGMENT` (commit `ab68c2cd`). Skipping it throws `InvalidStateError`.
  - set `timestampOffset = startSeconds` **before** `sb.remove(...)` (commit `44c6a438`) — avoids a `PARSING_MEDIA_SEGMENT` error.
  - **`sb.remove(0, Infinity)` + a fresh ffmpeg `moov`** to reset the decoders — **NOT** `changeType()` (silently drops the video track, audio-only result) and **NOT** `removeSourceBuffer`+`addSourceBuffer` (Chrome re-fires `seeking`, infinite re-fetch loop) (commit `8ab37dfe`).
  - when `mediaSource.readyState !== "open"` (after `endOfStream`), **rebuild the MediaSource from scratch** (commit `072661fc`) — `abort`/`remove`/`timestampOffset` all require an open MediaSource.
  - guard every async step with a **monotonic version counter** so rapid seeks can't interleave and corrupt SourceBuffer state.
- **DO NOT** add subtitle muxing to `/transcode/audio` (design decision §12-3): bitmap subs won't render in `<video>` and bloat the stream; text subs are a separate side-channel.
- **DO NOT** re-add the `-hwaccel`/empty-`PATH` hardening that the W22b design doc proposed — it broke ffmpeg lookup in Docker. Input is passed positionally as a validated absolute path; `cwd` is `os.tmpdir()`; `env` is inherited so PATH resolves `ffmpeg` in the container.

## Known limitations / out of scope (the "am I missing anything" boundary)

These are **deliberately not solved** by this worker. Documented so they're a *decision*, not an oversight.

1. **Unsupported VIDEO codec (HEVC/H.265, AV1) on a browser that can't decode it.** `-c:v copy` only remuxes — it does not make an undecodable codec decodable. When `isTypeSupported` is false, the player degrades to direct `<video src>` (which also fails for that codec → audio-only or nothing). Truly universal playback for HEVC/AV1 needs **server-side video re-encode to H.264** — that is the heavier, GPU-accelerated path tracked by **worker 2f** (`ffmpeg-gpu-reencode-endpoint`), intentionally separate because it costs real CPU/GPU and has a "looks right, doesn't actually decode" failure mode. Chrome/Edge on Windows (with the HEVC extension) and Safari *can* decode HEVC, so this gap is browser-dependent.
2. **Seeks snap to the nearest preceding keyframe (GOP granularity), not frame-accurate.** Input-side `-ss` + `-c:v copy` starts output at the keyframe at/just-before the requested second. For "click 2:00" UX this is correct and fast; frame-accurate seek would require decode-from-zero or output-side `-ss` (slow) — not worth it.
3. **First audio track only.** The endpoint accepts `audioStream=<n>` but the UI always sends track 0. Multi-track sources (commentary, dub/sub languages) play only the first audio track. Track-picker UI is a future worker.
4. **No subtitles in the transcode path** (see rejected list). Sidecar/burned-in subs are not rendered.
5. **Safari + Opus-in-MP4.** Safari historically rejects Opus in MP4 (`isTypeSupported` false → fallback). For Safari, the endpoint's `codec=aac` path should be selected. The client currently requests `opus`; AAC-for-Safari selection is a small follow-up, not handled here.
6. **ffmpeg binary differs by environment.** Local dev resolves `apps.downloaded/ffmpeg/bin/ffmpeg.exe` (Windows only, via [appPaths.ts](../../packages/core/src/tools/appPaths.ts)); Docker/Linux falls back to `ffmpeg` on `PATH` (apt-installed at `/usr/bin/ffmpeg`). The code path is the same; behavior can differ (ffmpeg build/version). **Local Playwright verification does not certify the container** — re-verify with Playwright MCP against the deployed image after deploy.
7. **Rapid scrubbing pressure.** Each seek spawns a fresh ffmpeg and kills the prior one; the server's `MAX_TRANSCODE_CONCURRENCY` gate (default 4) could briefly queue if kills lag. Acceptable; revisit only if scrubbing stalls in practice.

## Flag retirement

`EXPERIMENTAL_FFMPEG_TRANSCODING` existed only because the client was broken. Once this worker's player is verified (local + container), the flag is **retired** (default the transcode path on, delete the gate in `featuresRoutes.ts` + the `/features` probe in `FileVideoPlayer`), per fix-handoff item L's "OR formally retire the flag." Retirement happens **after** verification, not before.
