# Worker 50 — lossless-to-flac-convert (originally wav-to-flac-convert)

**Model:** Haiku · **Thinking:** OFF · **Effort:** Low
**Branch:** `worker-50-wav-to-flac-convert`
**Worktree:** `.claude/worktrees/50_wav-to-flac-convert/`
**Phase:** 5
**Depends on:** 01
**Parallel with:** any Phase 5 worker that doesn't touch [packages/api/src/api/schemas.ts](../../packages/api/src/api/schemas.ts), [packages/api/src/api/routes/commandRoutes.ts](../../packages/api/src/api/routes/commandRoutes.ts), [packages/web/src/commands/commands.ts](../../packages/web/src/commands/commands.ts), or [packages/web/src/jobs/commandLabels.ts](../../packages/web/src/jobs/commandLabels.ts).

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Your Mission

Add a new app-command — `convertLosslessToFlac` — that walks a music directory for lossless audio files (`.wav` / `.wave` / `.aif` / `.aiff` / `.m4a` / `.m4b`) and encodes each one to FLAC via `ffmpeg -c:a flac`, **strictly lossless** (channels, bit depth, sample rate, and metadata are preserved). The FLAC is written **in-place** alongside the source (same directory, same basename, `.flac` extension), and the source is optionally deleted on success via an opt-in `isSourceDeleted` flag.

The original scope of this worker was WAV-only (`convertWavToFlac`); the broader extension set landed as a follow-up rename in the same PR so the command name doesn't have to change again the next time we add an input format. Container-with-video inputs (`.mkv`, `.mp4`, `.m4v`, `.mov`, `.webm`, `.avi`) are deliberately **not** accepted by this command — they need MediaInfo probing to know whether a video track is present, which is the job of a separate worker (see the MKV-aware sibling spec).

Closest existing references (for shape and wiring conventions — not pipeline shape, see "Pipeline shape" below):

- [packages/core/src/app-commands/replaceFlacWithPcmAudio.ts](../../packages/core/src/app-commands/replaceFlacWithPcmAudio.ts) — wiring template (props shape, `logAndRethrowPipelineError` placement, `withFileProgress`).
- [packages/core/src/cli-spawn-operations/convertFlacToPcmAudio.ts](../../packages/core/src/cli-spawn-operations/convertFlacToPcmAudio.ts) — spawn-op template (`runFfmpeg` invocation pattern).
- [packages/core/src/cli-spawn-operations/runFfmpeg.ts](../../packages/core/src/cli-spawn-operations/runFfmpeg.ts) — never spawn `ffmpeg` directly.

Read all three first.

### Why "strictly lossless" matters

FFmpeg's FLAC encoder preserves the input's channel layout, sample rate, and bit depth **by default**. A 24-bit / 96 kHz / 5.1 input becomes a 24-bit / 96 kHz / 5.1 FLAC with no resampling and no downmix. ALAC inside an `.m4a` is decoded by ffmpeg and re-encoded to FLAC at the same bit depth (since both are lossless integer-PCM containers, the round-trip is bit-exact). The way to *keep* it lossless is to deliberately **not** add any of the following ffmpeg flags:

- `-ar <rate>` — would resample.
- `-ac <channels>` — would remix.
- `-sample_fmt <fmt>` — would change bit depth.

The spawn args this worker uses are therefore **only** `["-c:a", "flac", "-map_metadata", "0"]` — no rate/channel/sample-format coercion. The lossless property is enforced by the **absence** of those flags. A unit test asserts that the spawn-arg array does not contain `"-ar"`, `"-ac"`, or `"-sample_fmt"` so a future refactor can't accidentally regress this.

### Why in-place (not a sibling `flac-converted/` folder)

`convertFlacToPcmAudio` writes to `AUDIO-CONVERTED/` because the FLAC and the new PCM-track-MKV are different *containers* and must coexist. This command produces a strictly-better replacement for the source file; if the user opts into `isSourceDeleted`, a sibling-folder layout would leave the FLAC orphaned in a child directory while the original directory empties out. In-place output also means downstream commands (a future "delete copied originals" sweep, a "round-trip back" workflow) operate on the same path the user already has open.

### Pipeline shape

Note: `replaceFlacWithPcmAudio` iterates *video* files and probes their inner *audio tracks* via `getMediaInfo` to locate FLAC tracks inside MKV containers. That probe is **not needed** here — our inputs are standalone audio files, and FFmpeg auto-detects the source format from its header. Skip `getMediaInfo` entirely; rely on the file extension as a hint about which files to attempt at all (the lossless-extension filter), then trust ffmpeg to do the right thing with the actual bytes.

```ts
getFilesAtDepth({ depth: isRecursive ? 1 : 0, sourcePath })
  .pipe(
    filterIsLosslessAudioFile(),        // new sibling of filterIsAudioFile: .wav/.wave/.aif/.aiff/.m4a/.m4b
    withFileProgress((fileInfo) =>
      convertLosslessToFlac({
        filePath: fileInfo.fullPath,
        isSourceDeleted,
      }).pipe(
        tap(() => logInfo("CREATED FLAC FILE", outputFilePath)),
        filter(Boolean),
      )
    ),
    toArray(),
    logAndRethrowPipelineError(convertLosslessToFlac),
  )
```

### Algorithm (spawn-op level)

1. Compute destination as `<sourceDir>/<sourceBasename>.flac` (no folder prefix). `basename(path, extname(path))` strips whichever lossless extension is on the source.
2. Invoke `runFfmpeg` with args `["-c:a", "flac", "-map_metadata", "0"]`, `inputFilePaths: [filePath]`, `outputFilePath`. No `mkdir` needed since the parent directory already exists (we're writing to the source's own directory).
3. On a successful emit from `runFfmpeg` (i.e. ffmpeg exited 0 and the FLAC exists), **only then**, if `isSourceDeleted` is true, `unlink(filePath)`. The unlink runs inside a `concatMap` after the ffmpeg emit so a non-zero ffmpeg exit (which terminates the inner observable without emitting) skips the delete entirely. Use `fs/promises.unlink`, wrapped in `from(...)` to fold back into the rxjs pipeline.

### Inputs

```ts
type ConvertWavToFlacProps = {
  isRecursive: boolean
  isSourceDeleted?: boolean      // default false; deletes the source file after a successful encode
  sourcePath: string
}
```

Export `convertLosslessToFlacDefaultProps` alongside the cli-spawn-op (same pattern as `convertFlacToPcmAudioDefaultProps`): `{ isSourceDeleted: false }`.

### Wiring (six surfaces)

1. **App-command:** [packages/core/src/app-commands/convertLosslessToFlac.ts](../../packages/core/src/app-commands/convertLosslessToFlac.ts) — new file.
2. **Cli-spawn-op:** [packages/core/src/cli-spawn-operations/convertLosslessToFlac.ts](../../packages/core/src/cli-spawn-operations/convertLosslessToFlac.ts) — clones the structure of `convertFlacToPcmAudio.ts` but writes in-place and (optionally) unlinks the source.
3. **WAV filter:** [packages/core/src/tools/filterIsLosslessAudioFile.ts](../../packages/core/src/tools/filterIsLosslessAudioFile.ts) — sibling of `filterIsAudioFile.ts`; the existing helper is too broad (matches `.mp3`, `.mkv`, etc).
4. **Schema:** [packages/api/src/api/schemas.ts](../../packages/api/src/api/schemas.ts) — `convertLosslessToFlacRequestSchema` (`sourcePath` path, `isRecursive` boolean, `isSourceDeleted` optional boolean).
5. **Route:** [packages/api/src/api/routes/commandRoutes.ts](../../packages/api/src/api/routes/commandRoutes.ts) — registration under `Audio Operations`.
6. **Web command list:** [packages/web/src/commands/commands.ts](../../packages/web/src/commands/commands.ts).
7. **Label:** [packages/web/src/jobs/commandLabels.ts](../../packages/web/src/jobs/commandLabels.ts) → `Convert WAV to FLAC`.
8. **CLI wrapper:** [packages/cli/src/cli-commands/convertLosslessToFlacCommand.ts](../../packages/cli/src/cli-commands/convertLosslessToFlacCommand.ts) — mirrors [replaceFlacWithPcmAudioCommand.ts](../../packages/cli/src/cli-commands/replaceFlacWithPcmAudioCommand.ts).
9. **Fake-data scenario:** [packages/api/src/fake-data/scenarios/convertLosslessToFlac.ts](../../packages/api/src/fake-data/scenarios/convertLosslessToFlac.ts) — clone of `replaceFlacWithPcmAudio.ts` scenario but emits a mix of `.wav` / `.aif` / `.aiff` / `.m4a` inputs all converging on `.flac`; register in [packages/api/src/fake-data/index.ts](../../packages/api/src/fake-data/index.ts).

## TDD steps

1. **Failing unit test** — `convertLosslessToFlac.test.ts` (app-command) with `runFfmpeg` and `unlink` mocked. Cover:
   - One accepted lossless input in `sourcePath` → one `runFfmpeg` call.
   - All accepted lossless extensions (`.wav` / `.wave` / `.aif` / `.aiff` / `.m4a` / `.m4b`) trigger an encode; `.flac`, `.mp3`, `.mp4`, `.mkv`, and arbitrary non-audio files are skipped.
   - The spawn args contain `-c:a flac` and `-map_metadata 0`.
   - The spawn args **do not** contain `-ar`, `-ac`, or `-sample_fmt` (lossless guard).
   - The output path equals the input path with its lossless extension swapped to `.flac` (in-place, same dir).
   - `.mp3` and `.mkv` siblings are ignored.
   - `isRecursive: true` descends one level.
   - `isSourceDeleted: false` (or omitted) → `unlink` is **not** called.
   - `isSourceDeleted: true` + successful ffmpeg → `unlink` called once with the original source path.
   - `isSourceDeleted: true` + ffmpeg failure → `unlink` is **not** called.
2. **Failing schema test** — round-trip defaults, reject empty `sourcePath`, accept missing `isSourceDeleted`.
3. Implement until green. Two commits (red, then green).
4. **Parity fixture** — `packages/web/tests/fixtures/parity/convertLosslessToFlac.input.json` + `.yaml`.
5. Standard gate: `yarn lint → typecheck → test → e2e → lint`.

## Files

### New

- [packages/core/src/app-commands/convertLosslessToFlac.ts](../../packages/core/src/app-commands/convertLosslessToFlac.ts)
- [packages/core/src/app-commands/convertLosslessToFlac.test.ts](../../packages/core/src/app-commands/convertLosslessToFlac.test.ts)
- [packages/core/src/cli-spawn-operations/convertLosslessToFlac.ts](../../packages/core/src/cli-spawn-operations/convertLosslessToFlac.ts)
- [packages/core/src/tools/filterIsLosslessAudioFile.ts](../../packages/core/src/tools/filterIsLosslessAudioFile.ts)
- [packages/api/src/fake-data/scenarios/convertLosslessToFlac.ts](../../packages/api/src/fake-data/scenarios/convertLosslessToFlac.ts)
- [packages/cli/src/cli-commands/convertLosslessToFlacCommand.ts](../../packages/cli/src/cli-commands/convertLosslessToFlacCommand.ts)
- [packages/web/tests/fixtures/parity/convertLosslessToFlac.input.json](../../packages/web/tests/fixtures/parity/convertLosslessToFlac.input.json)
- [packages/web/tests/fixtures/parity/convertLosslessToFlac.yaml](../../packages/web/tests/fixtures/parity/convertLosslessToFlac.yaml)

### Extend

- [packages/api/src/api/schemas.ts](../../packages/api/src/api/schemas.ts) — `convertLosslessToFlacRequestSchema`
- [packages/api/src/api/routes/commandRoutes.ts](../../packages/api/src/api/routes/commandRoutes.ts) — route registration
- [packages/api/src/fake-data/index.ts](../../packages/api/src/fake-data/index.ts) — scenario registration
- [packages/web/src/commands/commands.ts](../../packages/web/src/commands/commands.ts) — field builder + command list
- [packages/web/src/jobs/commandLabels.ts](../../packages/web/src/jobs/commandLabels.ts) — display label
- CLI command index (grep for sibling command registrations)

### Reuse — do not reinvent

- [replaceFlacWithPcmAudio.ts](../../packages/core/src/app-commands/replaceFlacWithPcmAudio.ts) — wiring conventions only; the inner pipeline is simpler (no `getMediaInfo`).
- [convertFlacToPcmAudio.ts](../../packages/core/src/cli-spawn-operations/convertFlacToPcmAudio.ts) — spawn-op skeleton.
- [runFfmpeg.ts](../../packages/core/src/cli-spawn-operations/runFfmpeg.ts) — never spawn `ffmpeg` directly.

## Verification checklist

- [ ] Worktree created at `.claude/worktrees/50_wav-to-flac-convert/`
- [ ] Manifest row → `in-progress` in its own `chore(manifest):` commit
- [ ] Failing-test commit precedes green-implementation commit
- [ ] `ffmpeg` is invoked only through `runFfmpeg`
- [ ] `-c:a flac` and `-map_metadata 0` present in the spawn args
- [ ] No `-ar`, `-ac`, or `-sample_fmt` in the spawn args (lossless guard, unit-tested)
- [ ] FLAC is written in-place (same directory, same basename, `.flac` ext)
- [ ] `isSourceDeleted` defaults to `false`; when `true`, unlink runs only after a successful ffmpeg emit
- [ ] Parity fixture round-trips
- [ ] Fake-data scenario registered
- [ ] Standard gate clean (`yarn lint → typecheck → test → e2e → lint`)
- [ ] [docs/workers/MANIFEST.md](MANIFEST.md) row updated to `done`
- [ ] PR opened against `feat/mux-magic-revamp`

## Out of scope

- **Other lossless re-encodes** (FLAC→ALAC, WAV→ALAC, etc.). One direction per worker.
- **Re-tagging or normalizing metadata.** `-map_metadata 0` preserves what's there; no MusicBrainz / AcoustID enrichment.
- **Bit-depth or sample-rate conversion.** This worker is *explicitly* lossless; downsampling is the opposite of the stated mission. A separate worker can add a configurable "transcode + downsample" command if that's ever wanted.
- **Multi-channel layout remapping** (e.g. forcing a 5.1 WAV down to stereo). Same reasoning.
