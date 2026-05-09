# MSE Transcode Player

## Overview

The video modal can play files whose audio track is not browser-decodable
(TrueHD, DTS, raw PCM, etc.) by streaming a server-side ffmpeg transcode
through the browser's [MediaSource Extensions (MSE) API](https://www.w3.org/TR/media-source-2/).

This path is **disabled by default** while seek stability bugs are resolved.
Enable it with an env var (see below).

## Feature Flag

Add to `.env`:

```
EXPERIMENTAL_FFMPEG_TRANSCODING=true
```

When the flag is absent or `false`, all files fall back to direct `<video src>`
streaming. Files with browser-safe audio (AAC, Opus, MP3) play normally either
way. Files with incompatible audio (TrueHD, DTS, etc.) will still load but
audio may not play without the flag enabled.

## Architecture

```
Browser                              Server
──────                               ──────
openVideoModal(path)
  → GET /files/audio-codec           → probe audio stream with ffprobe
  ← { audioFormat }
  → build playbackUrl
      if incompatible audio:
        playbackUrl = /transcode/audio?path=…
      else:
        playbackUrl = /files/stream?path=…
  → GET /features                    → read EXPERIMENTAL_FFMPEG_TRANSCODING
  ← { experimentalFfmpegTranscoding }

  if incompatible AND flag enabled:
    → HEAD /transcode/audio          → ffprobe for duration + video codec tag
    ← X-Duration, X-Video-Codec
    setupMsePlayer()
      → GET /transcode/audio?start=T → spawn ffmpeg -ss T -i … -c:v copy -c:a libopus
      ← chunked fMP4 stream
      appendBuffer() loop (MSE pump)
  else:
    player.src = playbackUrl
    player.play()
```

## MSE Pump

`setupMsePlayer` in [file-explorer-modal.js](../public/builder/js/components/file-explorer-modal.js)
manages the full MSE lifecycle:

- **SourceBuffer**: single combined video+audio buffer using `video/mp4; codecs="avc1…,opus"`
- **Look-ahead throttle**: pauses the pump when > 30 s is buffered ahead of
  `currentTime`, keeping memory below Chrome's ~150 MB MSE quota
- **QuotaExceededError retry**: evicts played content (`remove(0, currentTime-5)`)
  and retries the same chunk
- **Seek handling** (`seeking` event):
  - If seek target is already buffered → no-op (browser resolves it)
  - If `ms.readyState === 'open'`: `sb.abort()` (resets Chrome's
    `appendState` from `PARSING_MEDIA_SEGMENT` → `WAITING_FOR_SEGMENT`),
    set `timestampOffset`, clear buffer, start new ffmpeg stream from seek point
  - If `ms.readyState === 'ended'` (stream ran to completion): rebuild
    `MediaSource` + `SourceBuffer` from scratch, then stream from seek point
- **Stale-version protection**: `activeVersion` counter ensures rapid seeks
  don't interleave concurrent `appendBuffer` / `remove` calls

## Known Issues

These issues exist in the current implementation and are why the flag defaults
to off:

| Symptom | Root cause | Status |
|---|---|---|
| Infinite loading spinner on seek | `abort()` throws when `ms.readyState !== 'open'` | Fixed (rebuild path) |
| Audio-only after seek | `changeType()` silently dropped video track; `remove()` not clearing on seek-to-0 | Fixed |
| `InvalidStateError` on `timestampOffset` | Chrome keeps `appendState=PARSING_MEDIA_SEGMENT` after `updateend` | Fixed via `sb.abort()` |
| Slow playback on high-bitrate files | MSE quota (~150 MB) hit within ~30 s of 35 Mbps+ content; eviction loop | Open |
| Long seek startup on large files | ffmpeg probe + open time for 50+ GB files | Open (server-side) |

## ffmpeg Output Format

```
ffmpeg -ss {startSeconds} -i {inputFile}
  -map 0:v:0 -c:v copy
  -map 0:a:{audioStreamIndex}
  -c:a libopus -b:a 128k -ac 2
  -movflags frag_keyframe+empty_moov+default_base_moof
  -f mp4 pipe:1
```

Key points:
- `-ss` before `-i` → fast container-level seek (resets output PTS to 0)
- `timestampOffset` on the SourceBuffer compensates for the PTS reset
- `frag_keyframe` → each fragment starts on a keyframe; required for MSE
- `empty_moov` → init segment arrives before any media data
- Output piped to stdout → HTTP chunked response

## Playwright Tests

`e2e/video-seek.spec.ts` covers:

1. Initial playback without MSE errors
2. Single seek to 5 s
3. Rapid seeks (10 s → 20 s → 5 s) exercising stale-version protection

Tests generate a synthetic 60 s fMP4 (H.264 High@L4.1 + Opus, 320×240) via
`ffmpeg-static` and mock both `/files/audio-codec` and `/transcode/audio`
routes so no real media files are required.
