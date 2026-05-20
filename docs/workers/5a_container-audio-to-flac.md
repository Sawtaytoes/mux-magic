# Worker 5a — container-audio-to-flac

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `worker-5a-container-audio-to-flac`
**Worktree:** `.claude/worktrees/5a_container-audio-to-flac/`
**Phase:** 5
**Depends on:** 01, 50 (the convertLosslessToFlac spawn-op pattern is the reference template)
**Parallel with:** any Phase 5 worker that doesn't touch [packages/api/src/api/schemas.ts](../../packages/api/src/api/schemas.ts), [packages/api/src/api/routes/commandRoutes.ts](../../packages/api/src/api/routes/commandRoutes.ts), [packages/web/src/commands/commands.ts](../../packages/web/src/commands/commands.ts), or [packages/web/src/jobs/commandLabels.ts](../../packages/web/src/jobs/commandLabels.ts).

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Background — why this exists

User's stated workflow:

> "I have some songs that I added as MKV and wanna change to FLAC because MKV doesn't work right with ID3 tags in Picard. It'd be easier just to convert them outright (even losing the video or image track) because neither Music Assistant nor Plex supports it. If I want to play them back with video, I'll need to include them as part of my video library instead."

> "I might be good to add a command to identify these [files], so I don't accidentally delete them. Maybe another command or an option that tells the user which directories contain MKVs or MP4s or others with video and doesn't delete them but still provides the rename. This is a safety measure."

The shape this implies:

1. The user has a music library. It contains some files in *container-with-video* formats (`.mkv`, `.mp4`, etc.) — sometimes audio-with-cover-art, sometimes audio-with-actual-video, sometimes just oddities (an album rip that included a bonus video).
2. They want to convert *those* containers to standalone `.flac` audio files so Picard / Music Assistant / Plex's music side can tag and play them properly.
3. They explicitly accept that converting an audio-with-video file to FLAC **drops the video stream**. They are NOT OK with this happening silently — the safety requirement is "tell me which files have a video track BEFORE you destroy it."

Worker 50 (`convertLosslessToFlac`) deliberately rejects these container-with-video extensions for exactly this reason: extension alone is ambiguous (a `.mkv` could be a 4K movie someone misfiled into the music folder), and silently dropping a video track on `unlink` would be data loss. This worker is the answer to that gap.

## Your Mission

Add two new app-commands that compose:

1. **`findContainerAudioFiles`** — pure read. Walks a directory for container-with-video extensions (`.mkv`, `.mp4`, `.m4v`, `.mov`, `.webm`, `.avi`), probes each with MediaInfo, and emits a structured report listing — per file — the audio track count, video track count, audio codec, and a `hasVideoTrack` boolean. No filesystem mutation. Composable: another command or a sequence step can `linkedTo` its output.

2. **`convertContainerAudioToFlac`** — the destructive converter. For each container-with-video file in the source directory:
   - Probe MediaInfo. Require at least one audio track; refuse if none.
   - If the audio track is already FLAC, use `ffmpeg -vn -c:a copy -map_metadata 0` (lossless demux, no re-encode).
   - Otherwise use `ffmpeg -vn -c:a flac -map_metadata 0` (lossless re-encode to FLAC).
   - The output is `<basename>.flac` in the same directory (in-place, matching worker 50's pattern).
   - **Safety gate:** if the file has a video track AND `isVideoDropAcknowledged` is `false` (the default), **skip the file** with a `WARN` log line and surface it in the result set so the UI can show it. The file is NOT converted and the source is NOT deleted.
   - When `isVideoDropAcknowledged: true`, the video is dropped (`-vn`) and the conversion proceeds.
   - When `isSourceDeleted: true` AND the encode succeeds, `unlink` the source. Same emit-then-unlink-via-concatMap pattern as worker 50.

The detector is genuinely the safety measure: a user can run `findContainerAudioFiles` first, eyeball the report, then run the converter with `isVideoDropAcknowledged: true` for the files they've vetted. Or they can run the converter once with the ack flag *off* to get the same report PLUS dry-run of which files would convert cleanly.

### Why two commands instead of "the converter has a dry-run mode"

The detector is reusable: someone might want to find video-in-music-dir files for other workflows (move them out, flag for manual review, build an audit dashboard). Bolting that into the converter's dry-run mode loses composition. They share a `getMediaTrackSummary` helper underneath; the surface separation is cheap.

### Why `findContainerAudioFiles` (not `findVideoTracksInMusicDir`)

The detector doesn't know whether it's looking at a "music dir" — that's user-supplied context. It just reports what it finds. The user is the one applying the "this should be music-only" assertion.

## Lossless guarantee carries over

Both subcommands inherit worker 50's negative-assertion rule: no `-ar`, `-ac`, or `-sample_fmt` in any spawn-arg list. The lossless property is enforced by absence. Add the same unit-test guard to the new spawn-ops.

Two new ffmpeg arg arrays:

```ts
const FLAC_REENCODE_ARGS = [
  "-vn",
  "-c:a", "flac",
  "-map_metadata", "0",
] as const

const FLAC_DEMUX_ARGS = [
  "-vn",
  "-c:a", "copy",
  "-map_metadata", "0",
] as const
```

`-vn` is "no video" — drops every video track from the output. `-c:a copy` for the already-FLAC case so we don't decode/re-encode FLAC for no reason (still lossless, just wasted CPU otherwise).

## Pipeline shape

For `findContainerAudioFiles`:

```ts
getFilesAtDepth({ depth: isRecursive ? 1 : 0, sourcePath })
  .pipe(
    filterIsContainerWithVideoFile(),
    withFileProgress((fileInfo) =>
      getMediaInfo(fileInfo.fullPath).pipe(
        map((mediaInfo) => buildTrackSummary(fileInfo, mediaInfo)),
      )
    ),
    toArray(),
    logAndRethrowPipelineError(findContainerAudioFiles),
  )
```

For `convertContainerAudioToFlac`:

```ts
getFilesAtDepth({ depth: isRecursive ? 1 : 0, sourcePath })
  .pipe(
    filterIsContainerWithVideoFile(),
    withFileProgress((fileInfo) =>
      getMediaInfo(fileInfo.fullPath).pipe(
        concatMap((mediaInfo) => {
          const summary = buildTrackSummary(fileInfo, mediaInfo)
          if (summary.audioTrackCount === 0) {
            logWarning("NO AUDIO TRACK", fileInfo.fullPath)
            return EMPTY
          }
          if (summary.hasVideoTrack && !isVideoDropAcknowledged) {
            logWarning("VIDEO PRESENT — skipping (set isVideoDropAcknowledged)", fileInfo.fullPath)
            return EMPTY
          }
          return convertContainerAudioFileToFlac({
            filePath: fileInfo.fullPath,
            isSourceDeleted,
            audioCodec: summary.audioCodec,
          })
        }),
      )
    ),
    toArray(),
    logAndRethrowPipelineError(convertContainerAudioToFlac),
  )
```

### Inputs

```ts
// findContainerAudioFiles
type FindContainerAudioFilesProps = {
  isRecursive: boolean
  sourcePath: string
}

// convertContainerAudioToFlac
type ConvertContainerAudioToFlacProps = {
  isRecursive: boolean
  isSourceDeleted?: boolean              // default false; only kicks in on a successful encode
  isVideoDropAcknowledged?: boolean      // default false; required true to convert files with video tracks
  sourcePath: string
}
```

## Wiring (per command — eight surfaces each)

For each of `findContainerAudioFiles` and `convertContainerAudioToFlac`:

1. **App-command:** [packages/core/src/app-commands/&lt;name&gt;.ts](../../packages/core/src/app-commands/)
2. **App-command test:** sibling `.test.ts` (memfs + MediaInfo mocked)
3. **Cli-spawn-op (converter only):** [packages/core/src/cli-spawn-operations/convertContainerAudioFileToFlac.ts](../../packages/core/src/cli-spawn-operations/)
4. **Shared filter:** [packages/core/src/tools/filterIsContainerWithVideoFile.ts](../../packages/core/src/tools/) — new sibling of `filterIsLosslessAudioFile.ts` covering `.mkv` / `.mp4` / `.m4v` / `.mov` / `.webm` / `.avi`
5. **Shared probe helper:** [packages/core/src/tools/getMediaTrackSummary.ts](../../packages/core/src/tools/) — wraps `getMediaInfo` and returns `{ hasVideoTrack, audioTrackCount, videoTrackCount, audioCodec }`. Both commands consume it. Unit-tested separately.
6. **Schema:** [packages/api/src/api/schemas.ts](../../packages/api/src/api/schemas.ts) — `findContainerAudioFilesRequestSchema` + `convertContainerAudioToFlacRequestSchema`
7. **Route:** [packages/api/src/api/routes/commandRoutes.ts](../../packages/api/src/api/routes/commandRoutes.ts) — registration under `Audio Operations`
8. **Web command list + label:** [packages/web/src/commands/commands.ts](../../packages/web/src/commands/commands.ts) + [packages/web/src/jobs/commandLabels.ts](../../packages/web/src/jobs/commandLabels.ts)
9. **CLI wrappers:** [packages/cli/src/cli-commands/findContainerAudioFilesCommand.ts](../../packages/cli/src/cli-commands/) + `convertContainerAudioToFlacCommand.ts`
10. **Fake-data scenarios:** [packages/api/src/fake-data/scenarios/](../../packages/api/src/fake-data/scenarios/)
11. **Parity fixtures:** [packages/web/tests/fixtures/parity/](../../packages/web/tests/fixtures/parity/)

## TDD steps

1. **Failing tests** — at minimum:
   - `findContainerAudioFiles`: 4+ tests covering accept set, MediaInfo summary shape, recursion, empty-directory case.
   - `convertContainerAudioToFlac`: ≥10 tests covering ffmpeg arg shape (`-vn` present, `-c:a flac`, `-map_metadata 0`, none of `-ar`/`-ac`/`-sample_fmt`), `-c:a copy` path when audio is already FLAC, video-skip-when-not-acknowledged, conversion-proceeds-when-acknowledged, no-audio-track refusal, isSourceDeleted gating, isRecursive descent, parity fixture round-trip.
   - `filterIsContainerWithVideoFile`: per-extension accept/reject pairs.
   - `getMediaTrackSummary`: track-count parsing, codec extraction, empty-track-list case.
2. **Failing schema tests** — both schemas: round-trip defaults, reject empty `sourcePath`, accept missing booleans.
3. Implement until green. At least two commits per command (red, then green).
4. Standard gate.

## Files

### New

- [packages/core/src/app-commands/findContainerAudioFiles.{ts,test.ts}](../../packages/core/src/app-commands/)
- [packages/core/src/app-commands/convertContainerAudioToFlac.{ts,test.ts}](../../packages/core/src/app-commands/)
- [packages/core/src/cli-spawn-operations/convertContainerAudioFileToFlac.ts](../../packages/core/src/cli-spawn-operations/)
- [packages/core/src/tools/filterIsContainerWithVideoFile.{ts,test.ts}](../../packages/core/src/tools/)
- [packages/core/src/tools/getMediaTrackSummary.{ts,test.ts}](../../packages/core/src/tools/)
- [packages/api/src/fake-data/scenarios/findContainerAudioFiles.ts](../../packages/api/src/fake-data/scenarios/)
- [packages/api/src/fake-data/scenarios/convertContainerAudioToFlac.ts](../../packages/api/src/fake-data/scenarios/)
- [packages/cli/src/cli-commands/findContainerAudioFilesCommand.ts](../../packages/cli/src/cli-commands/)
- [packages/cli/src/cli-commands/convertContainerAudioToFlacCommand.ts](../../packages/cli/src/cli-commands/)
- [packages/web/tests/fixtures/parity/findContainerAudioFiles.{input.json,yaml}](../../packages/web/tests/fixtures/parity/)
- [packages/web/tests/fixtures/parity/convertContainerAudioToFlac.{input.json,yaml}](../../packages/web/tests/fixtures/parity/)

### Extend

- [packages/api/src/api/schemas.ts](../../packages/api/src/api/schemas.ts) — two new request schemas
- [packages/api/src/api/routes/commandRoutes.ts](../../packages/api/src/api/routes/commandRoutes.ts) — two route registrations
- [packages/api/src/fake-data/index.ts](../../packages/api/src/fake-data/index.ts) — two scenario registrations
- [packages/web/src/commands/commands.ts](../../packages/web/src/commands/commands.ts) — two field builders
- [packages/web/src/jobs/commandLabels.ts](../../packages/web/src/jobs/commandLabels.ts) — `Find Audio-in-Container Files` and `Convert Audio-in-Container to FLAC`
- [packages/cli/src/cli.ts](../../packages/cli/src/cli.ts) — two `.command()` registrations

### Reuse — do not reinvent

- [packages/core/src/app-commands/convertLosslessToFlac.ts](../../packages/core/src/app-commands/convertLosslessToFlac.ts) — pipeline shape and the lossless-guard test pattern. Mirror it.
- [packages/core/src/cli-spawn-operations/convertLosslessFileToFlac.ts](../../packages/core/src/cli-spawn-operations/convertLosslessFileToFlac.ts) — spawn-op pattern (in-place output, optional unlink after success).
- [packages/core/src/tools/getMediaInfo.ts](../../packages/core/src/tools/getMediaInfo.ts) — the underlying MediaInfo probe.
- [packages/core/src/tools/filterIsLosslessAudioFile.ts](../../packages/core/src/tools/filterIsLosslessAudioFile.ts) — extension-filter shape.
- [packages/core/src/cli-spawn-operations/runFfmpeg.ts](../../packages/core/src/cli-spawn-operations/runFfmpeg.ts) — never spawn `ffmpeg` directly.

## Verification checklist

- [ ] Worktree created at `.claude/worktrees/5a_container-audio-to-flac/`
- [ ] Manifest row → `in-progress` in its own `chore(manifest):` commit
- [ ] Failing-test commits precede green-implementation commits (for both commands)
- [ ] `ffmpeg` is invoked only through `runFfmpeg`
- [ ] Converter spawn args include `-vn`, `-c:a flac` or `-c:a copy`, and `-map_metadata 0`
- [ ] No `-ar`, `-ac`, or `-sample_fmt` in any spawn args (lossless guard, unit-tested)
- [ ] `convertContainerAudioToFlac` refuses to drop a video track unless `isVideoDropAcknowledged: true`, and emits a structured warning per skipped file
- [ ] Files with no audio track are skipped with a clear log line, never converted
- [ ] FLAC is written in-place (same dir, same basename, `.flac` ext)
- [ ] `isSourceDeleted` honored — unlink runs only after a successful ffmpeg emit
- [ ] Parity fixtures round-trip for both commands
- [ ] Fake-data scenarios registered for both commands
- [ ] Standard gate clean (`yarn lint → typecheck → test → e2e → lint`)
- [ ] [docs/workers/MANIFEST.md](MANIFEST.md) row updated to `done`
- [ ] PR opened against `feat/mux-magic-revamp`

## Out of scope

- **Video-only files.** A file with a video track but no audio track is reported by the detector and refused by the converter. No "extract audio if any" heuristic — if it's not audio, this isn't the right command.
- **Multi-audio-track containers.** First audio track wins. A future worker can add an `audioTrackSelector` if real libraries hit it.
- **Album art tracks.** MP4 cover art and MKV attachments are not promoted to FLAC `METADATA_BLOCK_PICTURE`; `-map_metadata 0` carries the metadata blocks ffmpeg recognizes, and that's sufficient for the user's stated Picard workflow.
- **Non-lossless audio codecs inside containers.** A `.mp4` with AAC audio will round-trip to FLAC, but the AAC bytes were already lossy — wrapping them in FLAC doesn't undo that. The converter still proceeds (it produces a real FLAC that downstream tools can tag) but it logs an `INFO` line surfacing the lossy origin. We do NOT refuse — the user explicitly wants the conversion to land regardless, since their downstream tooling won't accept the container at all.
- **Subtitle tracks inside containers.** Dropped with the video via `-vn` (and ffmpeg's default subtitle behavior). If the user has subtitled music videos, they're already in the wrong library.
