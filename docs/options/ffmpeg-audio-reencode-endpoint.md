# FFmpeg audio-only re-encode endpoint — options

## Status

**Pending — handed off.** Planning doc for an agent to pick up. The implementation is gated on picking a Range-handling strategy (section 5) and answering the open questions (section 11).

## 1. Goal

The Builder UI's file-explorer modal already streams local media files into an in-browser `<video>` tag through [`GET /files/stream`](../../src/api/routes/fileRoutes.ts) (see the `/files/stream` handler — supports HTTP Range, advertises `video/x-matroska` for `.mkv`, etc.). For most files the video decodes fine but the **audio track is silent**: the source uses a codec the browser refuses to decode (DTS, TrueHD, AC-3 outside of Edge, sometimes EAC-3). The user is OK with the existing video path as-is — they don't want video re-encoded — but want a sibling endpoint that re-muxes the file with **only the audio re-encoded** to a browser-friendly codec, served as a streamable response the existing `<video>` tag can consume.

## 2. Browser audio-codec compatibility

Reference: [MDN — Audio codecs used on the web](https://developer.mozilla.org/en-US/docs/Web/Media/Formats/Audio_codecs).

| Codec | Chrome | Firefox | Safari | Edge | Notes |
| --- | --- | --- | --- | --- | --- |
| **AAC** (LC) | yes | yes | yes | yes | Universal in MP4 / M4A. Safest default. |
| **Opus** | yes | yes | yes 14.1+ | yes | Best quality-per-bit; native fit for WebM, also legal in fMP4. |
| MP3 | yes | yes | yes | yes | Fine but worse quality at the same bitrate. |
| FLAC | yes | yes | yes | yes (mostly) | Inconsistent inside MKV/MP4 across versions; OK as a fallback. |
| AC-3 (Dolby Digital) | no | no | no | yes (Windows) | The big breakage source — works *only* in Edge on Windows. |
| EAC-3 | no | no | yes (Apple HW) | yes | Same story; not portable. |
| DTS / DTS-HD | no | no | no | no | Never decodes in-browser. |
| TrueHD / Atmos | no | no | no | no | Never decodes in-browser. |
| PCM (raw) | container-dependent | container-dependent | container-dependent | container-dependent | Sometimes works, but the file sizes are huge. |

**Take-away:** if the source audio is anything in the bottom four rows the browser will play silent video. Re-encode to **Opus** (preferred for quality) or **AAC** (preferred for compatibility) and the audio will play everywhere modern.

## 3. Proposed endpoint shape

A new `GET /transcode/audio` route registered next to the existing `/files/stream` handler in [`src/api/routes/fileRoutes.ts`](../../src/api/routes/fileRoutes.ts) (or split into a sibling `transcodeRoutes.ts` if it ends up with helper code).

### Query parameters

| Name | Type | Default | Notes |
| --- | --- | --- | --- |
| `path` | string (URI-encoded absolute path) | — required | Validated via [`validateReadablePath`](../../src/tools/pathSafety.ts); rejected on `..` or non-absolute. |
| `codec` | `"opus"` \| `"aac"` | `"aac"` | Picks output container + audio encoder. See section 4. |
| `bitrate` | string (e.g. `192k`) | `192k` for Opus, `256k` for AAC | Optional. Capped server-side (e.g. ≤ `512k`) to stop a hostile client from running the encoder at extreme settings. |
| `audioStream` | integer | `0` (first audio stream) | Lets the caller pick a specific audio stream when the source has multiple (e.g. English vs. director-commentary). Maps to `-map 0:a:<n>`. |

### Response

- Status: `200 OK` (no Range support — see section 5 for why and the alternatives).
- `Content-Type`:
  - `codec=aac` → `video/mp4` (fragmented MP4 / fMP4).
  - `codec=opus` → `video/webm` (WebM with Matroska's segment headers; Opus-in-fMP4 also exists but WebM has wider browser support).
- `Content-Disposition: inline` so it plays in the browser, not a Save-As prompt.
- `Cache-Control: no-store` — re-running ffmpeg per request is expensive; we don't want intermediate caches storing partial fMP4 fragments under the same URL.
- `X-Accel-Buffering: no` (helps when an nginx-style reverse proxy sits in front; without it the proxy buffers the entire response before forwarding).
- Body: streaming bytes piped from `ffmpeg`'s `stdout`.

### `HEAD /transcode/audio?path=…&codec=…`

Mirrors the GET but returns headers only. Lets the UI's `<video preload="metadata">` cheaply check whether the endpoint *would* work without paying the cost of the first transcoded fragment.

### FFmpeg command

```
ffmpeg \
  -hide_banner -loglevel warning -nostats \
  -i <validated path> \
  -map 0:v:0 -c:v copy \
  -map 0:a:<audioStream> -c:a libopus -b:a 192k \
  -map 0:s? -c:s copy           # subtitles passthrough — see open question
  -movflags frag_keyframe+empty_moov+default_base_moof \
  -f mp4 pipe:1
```

For Opus → WebM swap the trailing two flags:

```
  -c:a libopus -b:a 192k \
  -f webm pipe:1
```

Key flag notes:

- `-c:v copy` — the whole point. Cheap, no GPU touched, no quality loss.
- `frag_keyframe+empty_moov+default_base_moof` — fragmented MP4. Without this, MP4's `moov` atom (which holds the seek index) is written *last*, so a piped MP4 isn't playable until the encoder finishes the entire file. fMP4 emits fragments with their own headers and an empty leading `moov`, so the browser's MSE / `<video>` can start playing as soon as the first fragment lands.
- `-map 0:s?` (optional `?`) — keep subtitle streams when present. Browsers won't render bitmap subs (PGS / VobSub) inside `<video>` directly, but text subs (SRT / WebVTT) are fine; see open questions.

## 4. CUDA / NVENC / NVDEC relevance

[NVIDIA's FFmpeg-with-NVIDIA-GPU guide](https://docs.nvidia.com/video-technologies/video-codec-sdk/12.1/ffmpeg-with-nvidia-gpu/) covers two GPU code paths:

- **NVDEC** — hardware video *decode* (`-hwaccel cuda -hwaccel_output_format cuda` on the input).
- **NVENC** — hardware video *encode* (`-c:v h264_nvenc` / `hevc_nvenc` on the output).

Both are **video** technologies. Audio encoders (`libopus`, `aac`) run on the CPU and a 4060 contributes nothing. A single audio re-encode at 192 kbit/s is negligible on a modern CPU — easily 50× real-time on one core — so even with `-c:v copy` (zero video work) the box can comfortably serve many concurrent audio-only transcodes.

**Therefore: do not add `-hwaccel cuda` to this endpoint.** It would add startup cost (NVDEC context init) for no benefit, and on a `-c:v copy` path the input frames don't get decoded anyway.

If the user *later* wants a parallel "fully transcode video too" endpoint (e.g. for an HEVC source no browser decodes), that's where CUDA earns its keep. Sketch for a future `/transcode/video`:

```
ffmpeg \
  -hwaccel cuda -hwaccel_output_format cuda \
  -i <path> \
  -map 0:v:0 -c:v h264_nvenc -preset p4 -tune ll -b:v 6M \
  -map 0:a:0 -c:a libopus -b:a 192k \
  -movflags frag_keyframe+empty_moov+default_base_moof \
  -f mp4 pipe:1
```

That's a separate route, separate concurrency gate (NVENC has a session limit per GPU — historically two on consumer cards, lifted on RTX 40-series with the patched driver), and separate doc.

## 5. Range-request handling — three options

`<video>` makes a first GET, then on user scrub or the browser's own buffering policy issues `Range: bytes=START-END` requests. fMP4 piped from a live `ffmpeg` doesn't seek — bytes only flow forward — so we have to choose how to reconcile that with how `<video>` expects the resource to behave.

### Option A — Stream-only, ignore Range, no seek

Each request runs `ffmpeg` start-to-end and pipes its stdout to the response. The endpoint advertises `Accept-Ranges: none` (or omits it) and returns `200 OK` even if the client sent a `Range:` header.

| Pros | Cons |
| --- | --- |
| Trivial to implement (one helper). | Browser **scrubbing breaks** — clicking a position in the timeline either falls back to "wait until ffmpeg has produced that byte offset" (long stall) or fails outright. |
| No disk usage, no temp-file cleanup story. | A reload mid-playback restarts the encode from byte 0. |
| Cancellation is clean — disconnect kills ffmpeg. | High back-pressure: a paused `<video>` that stops draining the response stalls ffmpeg's stdout, which pauses the encode (good for CPU) but holds the process / pipe / file descriptors indefinitely. |

Best for: a "play it once linearly" UX. Wrong default if the user expects to scrub.

### Option B — Transcode to a temp file, then serve with Range support

First request triggers a full transcode into a temp file under `os.tmpdir()` keyed by `(path, codec, bitrate, audioStream)`. The endpoint waits for the file to complete (or for enough fragments to be present, see "progressive serve" below) and then serves it via the *same* Range-handling code path the existing `/files/stream` already implements. Temp files are evicted by an LRU keyed on last-access time + a configurable max total size (default 4 GB, env-var overridable).

| Pros | Cons |
| --- | --- |
| Scrubbing works perfectly — once the temp file is fully written it behaves like any local file. | First request blocks for the full transcode duration. For an audio-only re-encode of a 90-min movie that's ~30 s on a modern CPU, but it's *not* zero. |
| Subsequent requests for the same file are free (just stream from disk). | Disk-space management. Need an LRU eviction loop + a size cap, plus careful temp-dir choice on Windows where `os.tmpdir()` can be on the system SSD with limited free space. |
| Reload / scrub / cross-tab playback all work. | Temp files outlive the request, so cancellation has to *not* delete a file that another concurrent request is happily streaming. |
| Plays nicely with the existing `validateReadablePath` + Range code in [`fileRoutes.ts`](../../src/api/routes/fileRoutes.ts). | Adds a "temp store" concept the codebase doesn't have today. |

Progressive-serve refinement: once the encoder has emitted the fMP4 init segment + at least one moof+mdat fragment, the partial temp file is already playable. Browsers tolerate `Content-Length` being absent in this case as long as `Transfer-Encoding: chunked` is set and the bytes keep coming. You'd serve the file by streaming the on-disk write tail (similar to `tail -f`), only returning a finite-length response once the encoder has finished. This blurs into option C territory and adds a fair bit of code; recommend treating it as a phase-2 follow-up.

### Option C — Per-Range ffmpeg with `-ss <start>`

Each Range request spawns a fresh `ffmpeg` with `-ss <start_seconds> -i …` and pipes that. Translation between "byte START in the requested Range" and "second `<start>` to seek to" comes from a one-time probe (`ffprobe`) of the source's duration + the predicted bitrate of the output, which is approximate.

| Pros | Cons |
| --- | --- |
| Works with seeking. | **Spawns ffmpeg per Range request.** Browsers send 5-20 Range requests during a typical playback session (re-buffering, scrub events). On a movie that's a *lot* of cold-start ffmpeg invocations. |
| No disk usage. | Byte-to-time mapping is approximate — fMP4 fragment boundaries don't line up with byte offsets cleanly, so `Content-Length` is a lie and seek-to-X may land at X±1s. |
| | Each per-range encode loses the encoder's prior state, so audio cuts at fragment boundaries occasionally pop. |

Worth knowing this exists; not recommended.

## 6. Cancellation + cleanup

Re-use the existing teardown contract from [`runFfmpeg.ts`](../../src/cli-spawn-operations/runFfmpeg.ts) and [`treeKillChild.ts`](../../src/cli-spawn-operations/treeKillChild.ts):

- The route handler creates an `AbortSignal` from the request (`context.req.raw.signal`) and registers a listener that calls the same `treeKillOnUnsubscribe(child)` function. This ensures Windows' `taskkill /T /F` is used for the GPU helper-process tree (matters even more if the future video-transcode endpoint ships).
- For option B (temp file), the temp-store helper holds a refcount per `(path, codec, bitrate)` key. Disconnect decrements the refcount but does **not** delete the file unless the encoder hadn't yet written the init segment (i.e. the file is unplayable garbage). Otherwise the LRU evictor handles deletion.
- A `process.on("exit")` / `beforeExit` hook deletes the temp directory on clean server shutdown so a `Ctrl+C` in dev doesn't leave gigabytes of orphaned `.mp4` shards.

## 7. Concurrency limits

Audio re-encode at `-c:v copy` is CPU-light, but `ffmpeg` startup + fragment muxing still costs ~100 ms and ~30 MB of RSS per process. A small RxJS-based gate keyed on the `(path, codec, bitrate, audioStream)` tuple prevents:

- Two requests for the *same* output racing each other into the same temp file (option B). Coalesce them onto one running encoder; both clients tail the same on-disk file.
- A burst of distinct requests hammering the box. Cap concurrent *distinct* encodes at `os.cpus().length / 2` or an `MAX_TRANSCODE_CONCURRENCY` env var (default `4`); queue the rest.

Sketch (RxJS, mirroring patterns elsewhere in the codebase):

```ts
const transcodeGate$ = new Subject<TranscodeJob>()
const transcodeResults$ = transcodeGate$.pipe(
  mergeMap((job) => runFfmpegTranscode(job), MAX_TRANSCODE_CONCURRENCY),
  shareReplay({ bufferSize: 1, refCount: true }),
)
```

(Coalescing on the cache key is a thin wrapper around this — keep one running observable per key in a `Map`, drop the entry when it completes.)

## 8. Security — path validation + media-root allowlist

Today `/files/stream` validates the path with [`validateReadablePath`](../../src/tools/pathSafety.ts), which rejects relative paths and `..` traversal, but does **not** restrict to a whitelist of media roots. That's defensible for the file-explorer modal because the user is the one navigating, but giving an HTTP endpoint the ability to spawn `ffmpeg -i <any-readable-path>` is a step up in risk:

- A path like `C:\Users\satur\AppData\Local\…\sensitive.json` would be `validateReadablePath`-clean, and ffmpeg cheerfully reads it (and emits an error stderr the client can probably observe). The risk isn't transcoding a JSON file — it's that ffmpeg will follow `concat:` / file:// pseudo-protocols if you let it; with a single positional `-i <path>` we're safer, but worth pinning down.

Recommendation:

1. Add a `MEDIA_ROOTS` env var (semicolon-separated absolute paths) parsed at startup. A new helper `validateMediaPath(path)` calls `validateReadablePath` *and* asserts the normalized result starts with one of the configured roots.
2. The new transcode endpoint uses `validateMediaPath`. The existing `/files/stream` migrates to it in a separate PR (behavior change for that endpoint — out of scope for this doc).
3. Defence-in-depth: the spawned ffmpeg gets an empty `PATH` and `cwd: os.tmpdir()`; the input is passed via a positional argument and the output is `pipe:1`, so there's no way for the client to slip in a `concat:` URL or trigger a relative-path resolution inside ffmpeg.

## 9. Recommendation

Ship **option B (transcode-to-temp + Range)** as the default. Reasoning:

- The user's stated UX is "play it in the browser." That implies the browser's `<video>` tag, which expects scrub-to-work. Option A breaks that.
- The first-request latency cost (~30 s for a 2-hour movie's audio re-encode) is annoying once per file but acceptable; subsequent plays are instant. Option B stores its work, options A and C throw it away every time.
- The temp-store complexity is real but bounded — one LRU helper + a refcount Map. Cancellation cleanup re-uses `treeKillOnUnsubscribe`.
- It composes with the existing `/files/stream` Range handler — that code can be lifted into a `serveFileWithRange(path)` helper and shared.

Stretch goal once option B ships: progressive-serve (start streaming the temp file before ffmpeg finishes). Worth it only if the first-request latency turns out to bother people in practice.

## 10. Implementation footprint (for W22b)

One new route file and a couple of helpers:

- `src/api/routes/transcodeRoutes.ts` — registers `GET /transcode/audio` and `HEAD /transcode/audio`. Mounted from `src/api/server.ts` (or wherever route trees are composed today — needs a glance during pickup).
- `src/cli-spawn-operations/runFfmpegAudioTranscode.ts` — sibling to `runFfmpeg.ts`, but pipes stdout to a `Writable` (a temp `WriteStream` for option B, or `ServerResponse` directly for option A) instead of writing to a file path. Exports an Observable matching the existing pattern; teardown calls `treeKillOnUnsubscribe`.
- `src/tools/transcodeTempStore.ts` — keyed Map of `(absPath, codec, bitrate, audioStream) → { tempPath, refCount, lastAccess }`. LRU eviction + total-size cap. Uses `os.tmpdir()` plus a `media-tools-transcode-cache/` subdirectory.
- `src/tools/pathSafety.ts` — extend with `validateMediaPath` (path-safety + MEDIA_ROOTS allowlist).
- Test fixtures: a tiny known-bad-audio MKV (DTS or AC-3) checked in or generated in test setup via `ffmpeg -lavfi sine=…` so CI doesn't depend on a binary blob in git.
- API integration tests in `src/api/routes/transcodeRoutes.test.ts`: no Range, with Range, HEAD, traversal-rejection, codec-validation, concurrency gate behavior.

## 11. Open questions

1. **Auto-detect or opt-in?** Should the file-explorer modal call [`MediaSource.isTypeSupported(...)`](https://developer.mozilla.org/en-US/docs/Web/API/MediaSource/isTypeSupported_static) on the source's audio codec (we already pull codecs via `getMediaInfo`) and silently swap the `<video>`'s `src` from `/files/stream?path=…` to `/transcode/audio?path=…&codec=…` when needed? Or expose a manual "Re-encode audio" toggle in the modal so the user opts in? The auto-swap is the friendlier UX but bypasses the user's stated wish to leave the existing path "as-is" by default. **Pick one before W22b starts.**
2. **Default codec — Opus or AAC?** Opus has better quality at 192 kbit/s and is supported everywhere recent. AAC has the most-broadly-compatible tooling and works inside MP4 with fewer browser quirks. The doc proposes AAC as the default; happy to flip.
3. **Subtitle passthrough.** Should we copy subtitle streams (`-map 0:s? -c:s copy`)? Bitmap subs (PGS / VobSub) won't render in `<video>`, and copying them inflates the output. Probably safer to drop subs and rely on the in-progress subtitles-side-channel work to surface them separately.
4. **Multi-audio-track sources.** When the source has English + a director's commentary, we default to `0:a:0`. Does the UI need a selector? If so, the modal needs a small pre-flight `getMediaInfo` call to enumerate tracks before constructing the URL.
5. **MEDIA_ROOTS migration.** The existing `/files/stream` doesn't enforce media-root allowlisting. Migrating it is a separate behavior change — what's the rollout plan (warn-only mode for one release? hard-fail from day one)?
6. **Temp-store location on Docker.** When the API runs inside the Docker image, `os.tmpdir()` is the container's `/tmp` — ephemeral, sometimes tmpfs-backed, sometimes size-capped. Should there be an explicit `TRANSCODE_CACHE_DIR` env var so operators can mount a real volume?
