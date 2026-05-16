# Worker 50 — wav-to-flac-convert

**Model:** Haiku · **Thinking:** OFF · **Effort:** Low
**Branch:** `feat/mux-magic-revamp/50-wav-to-flac-convert`
**Worktree:** `.claude/worktrees/50_wav-to-flac-convert/`
**Phase:** 5
**Depends on:** 01
**Parallel with:** any Phase 5 worker that doesn't touch [packages/server/src/api/schemas.ts](../../packages/server/src/api/schemas.ts), [packages/server/src/api/routes/commandRoutes.ts](../../packages/server/src/api/routes/commandRoutes.ts), [packages/web/src/commands/commands.ts](../../packages/web/src/commands/commands.ts), or [packages/web/src/jobs/commandLabels.ts](../../packages/web/src/jobs/commandLabels.ts).

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Your Mission

Add a new app-command — `convertWavToFlac` — that walks a music directory for `.wav` files and converts each to FLAC via `ffmpeg -c:a flac`, preserving metadata where possible. This is a direct clone-and-reverse of the existing FLAC-to-PCM pair:

- [packages/server/src/app-commands/replaceFlacWithPcmAudio.ts](../../packages/server/src/app-commands/replaceFlacWithPcmAudio.ts)
- [packages/server/src/cli-spawn-operations/convertFlacToPcmAudio.ts](../../packages/server/src/cli-spawn-operations/convertFlacToPcmAudio.ts)

Read both of those first; this worker is essentially "the same thing, but in the other direction, on standalone audio files instead of MKV audio tracks".

### Algorithm

1. `getFilesAtDepth({ depth: isRecursive ? 1 : 0, sourcePath })` (match `replaceFlacWithPcmAudio`'s depth pattern).
2. Filter to `.wav` files. Reuse or extend the existing extension filter under [packages/server/src/tools/](../../packages/server/src/tools/) (`filterIsAudioFile.ts` exists — if it doesn't already specialize to `.wav`, add a small `filterIsWavFile.ts` sibling).
3. For each WAV, compute the destination path: same directory + same basename + `.flac` extension. Use the `addFolderNameBeforeFilename` helper from `@mux-magic/tools` if you want to write into a sibling `flac-converted/` subdirectory (same pattern as `AUDIO_CONVERTED_FOLDER_NAME` in [packages/server/src/tools/outputFolderNames.ts](../../packages/server/src/tools/outputFolderNames.ts)).
4. Invoke `runFfmpeg` ([packages/server/src/cli-spawn-operations/runFfmpeg.ts](../../packages/server/src/cli-spawn-operations/runFfmpeg.ts)) with args `["-c:a", "flac", "-map_metadata", "0"]` plus the standard input/output file plumbing. Do **not** shell out to `ffmpeg` directly — `runFfmpeg` handles tty affordances and tree-kill.
5. Wrap with `logAndRethrowPipelineError(convertWavToFlac)`.

### Inputs

```ts
type ConvertWavToFlacProps = {
  isRecursive: boolean
  sourcePath: string
  outputFolderName?: string  // defaults to AUDIO_CONVERTED_FOLDER_NAME
}
```

Export `convertWavToFlacDefaultProps` alongside the cli-spawn-op (same pattern as `convertFlacToPcmAudioDefaultProps`).

### Wiring

Six surfaces, same as every other app-command. Read [replaceFlacWithPcmAudio.ts](../../packages/server/src/app-commands/replaceFlacWithPcmAudio.ts) and copy its wiring beat-for-beat, then flip the direction. Files to touch:

1. **App-command:** [packages/server/src/app-commands/convertWavToFlac.ts](../../packages/server/src/app-commands/convertWavToFlac.ts) — new file.
2. **Cli-spawn-op:** [packages/server/src/cli-spawn-operations/convertWavToFlac.ts](../../packages/server/src/cli-spawn-operations/convertWavToFlac.ts) — clone of `convertFlacToPcmAudio.ts`.
3. **Schema:** [packages/server/src/api/schemas.ts](../../packages/server/src/api/schemas.ts) — `convertWavToFlacRequestSchema` (`sourcePath` path, `isRecursive` boolean, `outputFolderName` optional string).
4. **Route:** [packages/server/src/api/routes/commandRoutes.ts](../../packages/server/src/api/routes/commandRoutes.ts) — registration under `Audio Operations`.
5. **Web command list:** [packages/web/src/commands/commands.ts](../../packages/web/src/commands/commands.ts).
6. **Label:** [packages/web/src/jobs/commandLabels.ts](../../packages/web/src/jobs/commandLabels.ts) → `Convert WAV to FLAC`.
7. **CLI wrapper:** [packages/cli/src/cli-commands/convertWavToFlacCommand.ts](../../packages/cli/src/cli-commands/convertWavToFlacCommand.ts) — mirror [replaceFlacWithPcmAudioCommand.ts](../../packages/cli/src/cli-commands/replaceFlacWithPcmAudioCommand.ts).
8. **Fake-data scenario:** [packages/server/src/fake-data/scenarios/convertWavToFlac.ts](../../packages/server/src/fake-data/scenarios/convertWavToFlac.ts) — clone of `replaceFlacWithPcmAudio.ts` scenario but with `.wav → .flac` extensions; register in [packages/server/src/fake-data/index.ts](../../packages/server/src/fake-data/index.ts).

## TDD steps

1. **Failing unit test** — `convertWavToFlac.test.ts` with `runFfmpeg` mocked. Cover:
   - One `.wav` in `sourcePath` → one `runFfmpeg` call with `-c:a flac` and an output ending `.flac`.
   - `.mp3` siblings are ignored.
   - `isRecursive: true` descends one level.
2. **Failing schema test** — round-trip defaults, reject empty `sourcePath`.
3. Implement until green. Two commits (red, then green).
4. **Parity fixture** — `packages/web/tests/fixtures/parity/convertWavToFlac.input.json` + `.yaml`.
5. Standard gate: `yarn lint → typecheck → test → e2e → lint`.

## Files

### New

- [packages/server/src/app-commands/convertWavToFlac.ts](../../packages/server/src/app-commands/convertWavToFlac.ts)
- [packages/server/src/app-commands/convertWavToFlac.test.ts](../../packages/server/src/app-commands/convertWavToFlac.test.ts)
- [packages/server/src/cli-spawn-operations/convertWavToFlac.ts](../../packages/server/src/cli-spawn-operations/convertWavToFlac.ts)
- [packages/server/src/fake-data/scenarios/convertWavToFlac.ts](../../packages/server/src/fake-data/scenarios/convertWavToFlac.ts)
- [packages/cli/src/cli-commands/convertWavToFlacCommand.ts](../../packages/cli/src/cli-commands/convertWavToFlacCommand.ts)
- [packages/web/tests/fixtures/parity/convertWavToFlac.input.json](../../packages/web/tests/fixtures/parity/convertWavToFlac.input.json)
- [packages/web/tests/fixtures/parity/convertWavToFlac.yaml](../../packages/web/tests/fixtures/parity/convertWavToFlac.yaml)

### Extend

- [packages/server/src/api/schemas.ts](../../packages/server/src/api/schemas.ts) — `convertWavToFlacRequestSchema`
- [packages/server/src/api/routes/commandRoutes.ts](../../packages/server/src/api/routes/commandRoutes.ts) — route registration
- [packages/server/src/fake-data/index.ts](../../packages/server/src/fake-data/index.ts) — scenario registration
- [packages/web/src/commands/commands.ts](../../packages/web/src/commands/commands.ts) — field builder + command list
- [packages/web/src/jobs/commandLabels.ts](../../packages/web/src/jobs/commandLabels.ts) — display label
- CLI command index (grep for sibling command registrations)

### Reuse — do not reinvent

- [replaceFlacWithPcmAudio.ts](../../packages/server/src/app-commands/replaceFlacWithPcmAudio.ts) — pipeline shape.
- [convertFlacToPcmAudio.ts](../../packages/server/src/cli-spawn-operations/convertFlacToPcmAudio.ts) — direct template for the new cli-spawn-op.
- [runFfmpeg.ts](../../packages/server/src/cli-spawn-operations/runFfmpeg.ts) — never spawn `ffmpeg` directly.

## Verification checklist

- [ ] Worktree created at `.claude/worktrees/50_wav-to-flac-convert/`
- [ ] Manifest row → `in-progress` in its own `chore(manifest):` commit
- [ ] Failing-test commit precedes green-implementation commit
- [ ] `ffmpeg` is invoked only through `runFfmpeg`
- [ ] `-c:a flac` and `-map_metadata 0` present in the spawn args
- [ ] Source `.wav` files are not deleted (this command writes alongside, doesn't replace — same convention as `replaceFlacWithPcmAudio` which writes to a sibling folder)
- [ ] Parity fixture round-trips
- [ ] Fake-data scenario registered
- [ ] Standard gate clean (`yarn lint → typecheck → test → e2e → lint`)
- [ ] [docs/workers/MANIFEST.md](MANIFEST.md) row updated to `done`
- [ ] PR opened against `feat/mux-magic-revamp`

## Out of scope

- **Deleting the original `.wav` files** after conversion. A separate `deleteCopiedOriginals`-style command handles cleanup if the user wants it.
- **Other lossless re-encodes** (FLAC→ALAC, WAV→ALAC, etc.). One direction per worker.
- **Re-tagging or normalizing metadata.** `-map_metadata 0` preserves what's there; no MusicBrainz / AcoustID enrichment.
- **Bit-depth or sample-rate conversion.** FLAC supports the same bit depths as PCM WAV; pass through unchanged.
