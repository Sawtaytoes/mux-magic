# 2023-10-22 — Mux/merge tracks with mkvmerge, not ffmpeg

- **Status:** Accepted
- **Date decided:** 2023-10-22 (pre-rename, original media-tools era)
- **Area:** core
- **Source:** commit `aa9841e9`

## Decision

All MKV track muxing — merging subtitles, replacing tracks, reordering tracks, splitting — uses the **mkvmerge** CLI (MkvToolNix), not ffmpeg. The modules are suffixed `*MkvMerge` to signal the CLI tool: `mergeSubtitlesMkvMerge.ts`, `replaceTracksMkvMerge.ts`, `reorderTracksMkvMerge.ts`, `runMkvMerge.ts`, etc. ffmpeg is reserved for transcode / IVTC / upscale paths only.

## What we rejected — DO NOT revert to this

Do not rewrite muxing onto ffmpeg "for consistency" or "to drop a dependency." ffmpeg-based merging was explicitly tried and reversed: it **dropped audio tracks** and lacked needed features, and mkvmerge unified offset-timing handling. Muxing and transcoding are different jobs with different tools here.

## Why it must not be re-litigated

This was a deliberate reversal away from ffmpeg muxing after it caused track loss. An agent unfamiliar with that history will see ffmpeg as the universal A/V tool and try to consolidate — which silently drops audio tracks again. Keep mux on mkvmerge.
