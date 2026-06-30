# 2026-05-19 — `convertLosslessToFlac` rejects video containers

- **Status:** Accepted
- **Date decided:** 2026-05-19
- **Area:** core
- **Source:** workers 50 / 77, commits `fff384c6` (rename + scope), `8e0e5d9b` (result records + float guard)

## Decision

`convertWavToFlac` was renamed `convertLosslessToFlac` and accepts lossless **audio** inputs by extension convention: `.wav` / `.wave` / `.aif` / `.aiff` / `.m4a` / `.m4b` (`.m4a` assumed ALAC in a music context, not MediaInfo-probed). Container-with-video extensions (`.mkv` / `.mp4` / `.m4v` / `.mov` / `.webm` / `.avi`) are **deliberately rejected**. A separate safety worker owns probing a container for a video track. The command also short-circuits 32-bit-float WAV and DSD sources (probe via `getMediaInfo`) rather than silently downconverting.

## What we rejected — DO NOT revert to this

Do not "helpfully" widen the accepted extensions to include `.mkv` / `.mp4` / other video containers so it can "convert their audio too." This command can delete the source after a successful encode (`isSourceDeleted`); accepting a video container risks encoding only the audio track and then **destroying the video**. The rejection guard has dedicated tests — keep them, don't relax them.

## Why it must not be re-litigated

The whole point of the rename + scope was to make "lossless audio" the contract and keep video containers out of a command that can unlink originals. Widening the input set re-introduces a data-loss path.
