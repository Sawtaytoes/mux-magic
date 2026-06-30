# 2023-07-29 — Probe media with the MediaInfo CLI, not ffprobe

- **Status:** Accepted
- **Date decided:** 2023-07-29 (pre-rename, original media-tools era)
- **Area:** core
- **Source:** commit `a63adf89`

## Decision

Track / format / resolution / duration metadata is read via the **MediaInfo CLI** (versioned binaries bundled in-repo), through `getMediaInfo`. It feeds demo-naming, resolution helpers, and the "better audio" / "better version" / lossless-compatibility detectors (`hasBetterAudio.ts`, `hasImaxEnhancedAudio.ts`, `getDemoName.ts`, `resolutionHelpers.ts`, `convertLosslessToFlac.ts`).

## What we rejected — DO NOT revert to this

Do not swap probing to **ffprobe**. The project standardized on MediaInfo's field model and output shape at inception; the detectors parse MediaInfo's specific fields (e.g. `Format_Settings_Floating_Point`, channel counts, format names). Switching to ffprobe rewrites every probe call site against a different schema for no gain, and would break the float/DSD and better-audio heuristics that key off MediaInfo field names.

## Why it must not be re-litigated

ffprobe is the reflexive "read media metadata" tool an agent reaches for, but every detector here is written against MediaInfo's output. The bundled binaries also make it dependency-stable across the Docker image. Keep probing on MediaInfo.
