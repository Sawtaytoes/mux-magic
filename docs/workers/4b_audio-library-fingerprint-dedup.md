# Worker 4b — audio-library-fingerprint-dedup

**Model:** Opus · **Thinking:** ON · **Effort:** High
**Branch:** `feat/mux-magic-revamp/4b-audio-library-fingerprint-dedup`
**Worktree:** `.claude/worktrees/4b_audio-library-fingerprint-dedup/`
**Phase:** 5
**Depends on:** 11 (per-job thread-budget scheduler — the fingerprint pass must claim from it instead of bare-spawning)
**Parallel with:** any Phase 5 worker that doesn't touch [packages/server/src/cli-spawn-operations/](../../packages/server/src/cli-spawn-operations/), [packages/server/src/app-commands/hasDuplicateMusicFiles.ts](../../packages/server/src/app-commands/hasDuplicateMusicFiles.ts), or [packages/server/src/api/schemas.ts](../../packages/server/src/api/schemas.ts).

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Context

The existing [packages/server/src/app-commands/hasDuplicateMusicFiles.ts](../../packages/server/src/app-commands/hasDuplicateMusicFiles.ts) groups audio files by filename/size and reports near-collisions. That's enough to catch obvious duplicates from the same source, but it cannot catch the real-world case the user actually hits constantly:

- A CD-rip in the library is tagged `Artist - Track 03.flac` with full metadata.
- A second copy exists somewhere — typically an unnamed `mw_battle1.mp3` extracted from a game disc, downloaded from a fan archive, or pulled out of an old backup. Same audio, different filename, different container, different bit depth, no tags.

Filename-only / size-only dedup is structurally blind to this. The audio engineering answer is **acoustic fingerprinting** — Chromaprint's `fpcalc` produces a compact perceptual hash that's invariant under format/bitrate/silence-trim and tolerant of small encoding differences. AcoustID uses the same fingerprints to back its public database; we just need the local-similarity half of that.

This worker adds a new `audioFingerprint` library-scoped command that:

1. Walks a **reference directory** (the tagged/canonical library) and builds a fingerprint index.
2. Walks a **candidate directory** (the suspect/unknown pile) and streams candidates through the index via `mergeMap`, claiming worker-budget slots from the new per-job scheduler.
3. Emits a structured report listing each candidate's nearest reference match plus its similarity score, with a configurable `minSimilarity` cutoff.

The command is dry-run-first: it produces a report, not deletions. Acting on the report (move-into-`_duplicates/`, delete originals, etc.) is downstream — out of scope here.

## Your Mission

### 1. New external-tool prerequisite — `fpcalc`

[Chromaprint](https://acoustid.org/chromaprint) ships `fpcalc` as the canonical CLI. Document it alongside `mkvmerge` and `ffmpeg`:

- Add `fpcalc` to the prerequisites section of [README.md](../../README.md) (use the same install-instructions section that already covers `mkvmerge` / `ffmpeg`).
- Add an `fpcalcPath` entry to [packages/server/src/tools/appPaths.ts](../../packages/server/src/tools/appPaths.ts) mirroring the existing `ffmpegPath` / `mkvmergePath` exports (env-var override + sensible default; on Windows users typically have it on PATH).
- The `fpcalc` binary itself is not vendored — it's a user-installed prerequisite, same as `mkvmerge` and `ffmpeg`. Document a clear error message when it's missing.

### 2. New `cli-spawn-op` — `runFpcalc`

New file: `packages/server/src/cli-spawn-operations/runFpcalc.ts`. Pattern mirrors [packages/server/src/cli-spawn-operations/runFfmpeg.ts](../../packages/server/src/cli-spawn-operations/runFfmpeg.ts) and [packages/server/src/cli-spawn-operations/runMkvPropEdit.ts](../../packages/server/src/cli-spawn-operations/runMkvPropEdit.ts):

- Spawn `fpcalc -json -length 120 <file>` (120s window is the AcoustID default — covers the meaningful melodic content of typical tracks without blowing fingerprint cost on full-length files).
- Parse the JSON output to `{ duration: number, fingerprint: string }`.
- Wrap as an Observable; `treeKillOnUnsubscribe` for cancellation parity with sibling spawn ops.
- Surface non-zero exits with a structured error that mentions the input path.
- Pull `fpcalcPath` from `appPaths.ts` so the env-var override works.

### 3. New `audioFingerprint` tool — fingerprint index + similarity

New file: `packages/server/src/tools/audioFingerprint.ts`. Pure-ish helpers (the spawn happens at the edges via `runFpcalc`):

- `buildFingerprintIndex(files$)` — observable in, observable out; produces a `Map<filePath, FingerprintRecord>` keyed by absolute path.
- `compareFingerprints(a, b): number` — returns a similarity score in `[0, 1]`. Chromaprint fingerprints are base64-encoded 32-bit integer streams; compute Hamming distance per aligned position, normalize by total bits compared. Standard Chromaprint approach; do not invent a new scoring metric.
- `findNearestMatch(candidate, index, minSimilarity)` — linear scan over the index; returns the best match plus its score, or `null` if nothing clears the threshold.

The index is held in memory for the duration of the job — these are 1-2 KiB strings per file, not large.

### 4. New app-command — `audioFingerprint`

New file: `packages/server/src/app-commands/audioFingerprint.ts`. Shape mirrors [hasDuplicateMusicFiles.ts](../../packages/server/src/app-commands/hasDuplicateMusicFiles.ts) (which this worker should re-read end-to-end as a structural reference, including its `filterIsAudioFile` use, `getFilesAtDepth` discovery, and `logAndRethrowPipelineError` placement). Inputs:

| Field | Type | Default | Notes |
|---|---|---|---|
| `referencePath` | path | required | The tagged/canonical library (built into the index). |
| `sourcePath` | path | required | The candidate pile to scan against the index. Reuses the canonical `sourcePath` field per the worker 24 convention. |
| `isReferenceRecursive` | boolean | `true` | Walk the reference dir recursively. |
| `isSourceRecursive` | boolean | `true` | Walk the candidate dir recursively. |
| `recursiveDepth` | number | `0` (unlimited) | Mirrors the existing convention. |
| `minSimilarity` | number | `0.85` | Hits below this aren't reported. `0.85` is the Chromaprint-community heuristic for "almost certainly same recording". |

Two-pass pipeline:

1. **Pass 1 — index build:** `getFilesAtDepth({ sourcePath: referencePath, ... })` → `filterIsAudioFile()` → `mergeMap(runFpcalc, concurrency)` → reduce into `Map`. Concurrency comes from the worker 11 scheduler claim (see §5).
2. **Pass 2 — candidate scan:** `getFilesAtDepth({ sourcePath, ... })` → `filterIsAudioFile()` → `mergeMap(runFpcalc, concurrency)` → `map(findNearestMatch(_, index, minSimilarity))` → `filter(Boolean)` → emit one structured log line per hit (`candidate → reference @ score`).

No mutating array methods (this repo bans `.push` outright). Compose with `concat` / `toArray` / `reduce` per the existing app-command style.

### 5. Scheduler claim — worker 11 integration

The worker 11 thread-budget scheduler is the load-bearing dependency. `fpcalc` is CPU-bound (decoding + fingerprinting at audio sample rate); running 64 in parallel on a 64-track music library will saturate the box and starve every other job. This command MUST claim from the per-job budget in [packages/server/src/api/jobRunner.ts](../../packages/server/src/api/jobRunner.ts) / scheduler infra and use the claimed value as the `mergeMap` concurrency parameter for both passes. Re-read worker 11's prompt and the merged scheduler code before wiring this up — do not pick a hard-coded concurrency.

### 6. Schema + web registration

- Add `audioFingerprintRequestSchema` to [packages/server/src/api/schemas.ts](../../packages/server/src/api/schemas.ts) (Zod). Validate `minSimilarity` is in `[0, 1]`; reject `referencePath === sourcePath` (no point scanning a library against itself this way — direct the user to `hasDuplicateMusicFiles` for the in-library case).
- Register the command in [packages/server/src/api/routes/commandRoutes.ts](../../packages/server/src/api/routes/commandRoutes.ts) and the OpenAPI surface.
- Add the command to [packages/web/src/commands/commands.ts](../../packages/web/src/commands/commands.ts) with a `summary` and `tag: "Audio Operations"` (or whichever existing tag groups `hasDuplicateMusicFiles`).
- Add a CLI subcommand at `packages/cli/src/cli-commands/audioFingerprintCommand.ts` mirroring `hasDuplicateMusicFilesCommand.ts`.

## Tests / TDD

Two-commit pattern: failing red commit, then green implementation commit.

1. **`runFpcalc` spawn op** — mock `spawn`; assert it invokes `fpcalc -json -length 120 <input>`; parses successful JSON to `{ duration, fingerprint }`; surfaces a structured error on exit code != 0 including the input path; unsubscribe triggers `treeKill`.
2. **`compareFingerprints`** — identical fingerprints score `1.0`; one bit flip in a known position scores just below 1.0; completely random fingerprints score near 0.5 (uniform Hamming baseline). Reject mis-shaped inputs.
3. **`findNearestMatch`** — empty index returns `null`; index of three with one above-threshold hit returns it; if two are above threshold, returns the higher-scoring one; below-threshold matches return `null`.
4. **`buildFingerprintIndex`** — given a mock `runFpcalc` that yields canned fingerprints for three input paths, the resulting map has three entries keyed by path.
5. **`audioFingerprint` app-command (integration)** — seed a tmp dir with three "reference" audio fixtures and three "candidate" fixtures where candidate-2 is structurally a duplicate of reference-1 (use a fixed-fingerprint stub for `runFpcalc` so the test doesn't depend on a real `fpcalc` binary). Run the command with `minSimilarity: 0.85`; assert exactly one hit is reported (`candidate-2 → reference-1`); assert no hit is reported when `minSimilarity: 0.99`.
6. **Scheduler claim** — run the command under a budget-of-2 scheduler stub; observe that the `runFpcalc` mock is never called with more than 2 in flight at once across both passes.
7. **Schema validation** — `audioFingerprintRequestSchema` rejects `minSimilarity: 1.5`, rejects `referencePath === sourcePath`, accepts the happy path.

## Files

### New

- [packages/server/src/cli-spawn-operations/runFpcalc.ts](../../packages/server/src/cli-spawn-operations/runFpcalc.ts)
- [packages/server/src/cli-spawn-operations/runFpcalc.test.ts](../../packages/server/src/cli-spawn-operations/runFpcalc.test.ts)
- [packages/server/src/tools/audioFingerprint.ts](../../packages/server/src/tools/audioFingerprint.ts)
- [packages/server/src/tools/audioFingerprint.test.ts](../../packages/server/src/tools/audioFingerprint.test.ts)
- [packages/server/src/app-commands/audioFingerprint.ts](../../packages/server/src/app-commands/audioFingerprint.ts)
- [packages/server/src/app-commands/audioFingerprint.test.ts](../../packages/server/src/app-commands/audioFingerprint.test.ts)
- [packages/cli/src/cli-commands/audioFingerprintCommand.ts](../../packages/cli/src/cli-commands/audioFingerprintCommand.ts)
- [packages/web/tests/fixtures/parity/audioFingerprint.input.json](../../packages/web/tests/fixtures/parity/audioFingerprint.input.json)
- [packages/web/tests/fixtures/parity/audioFingerprint.yaml](../../packages/web/tests/fixtures/parity/audioFingerprint.yaml)

### Modified

- [packages/server/src/tools/appPaths.ts](../../packages/server/src/tools/appPaths.ts) — `fpcalcPath` export
- [packages/server/src/api/schemas.ts](../../packages/server/src/api/schemas.ts) — `audioFingerprintRequestSchema`
- [packages/server/src/api/routes/commandRoutes.ts](../../packages/server/src/api/routes/commandRoutes.ts) — register command + OpenAPI summary/tag
- [packages/web/src/commands/commands.ts](../../packages/web/src/commands/commands.ts) — UI registration
- [packages/web/src/jobs/commandLabels.ts](../../packages/web/src/jobs/commandLabels.ts) — display label
- [packages/cli/src/cli.ts](../../packages/cli/src/cli.ts) — wire the new CLI subcommand
- [README.md](../../README.md) — add `fpcalc` to the external-tool prerequisites section alongside `mkvmerge` / `ffmpeg`

### Reuse — do not reinvent

- File discovery: `getFilesAtDepth` + `filterIsAudioFile` from [packages/server/src/tools/filterIsAudioFile.ts](../../packages/server/src/tools/filterIsAudioFile.ts).
- Spawn shape: copy from [runFfmpeg.ts](../../packages/server/src/cli-spawn-operations/runFfmpeg.ts) / [runMkvPropEdit.ts](../../packages/server/src/cli-spawn-operations/runMkvPropEdit.ts).
- Cancellation: `treeKillOnUnsubscribe` from [packages/server/src/cli-spawn-operations/treeKillChild.ts](../../packages/server/src/cli-spawn-operations/treeKillChild.ts).
- Scheduler budget: worker 11's claim API in the merged jobRunner — do not invent a parallel concurrency knob.

## Verification

- [ ] Standard gates clean: `yarn lint → yarn typecheck → yarn test → yarn test:e2e → yarn lint`
- [ ] All TDD tests pass (red commit visible in `git log` before the green commit)
- [ ] Failing-test commit landed before the implementation commit
- [ ] Manual smoke: point `referencePath` at a small tagged FLAC folder and `sourcePath` at a folder containing one renamed/transcoded copy of a tracked file; verify the report flags exactly that file
- [ ] README's external-tool prerequisites section lists `fpcalc` with install guidance parallel to `mkvmerge` / `ffmpeg`
- [ ] `chore(manifest):` commit flips [docs/workers/MANIFEST.md](MANIFEST.md) row 4b to `done` after merge (separate commit — never bundled with code)
- [ ] PR opened against `feat/mux-magic-revamp`

## Out of scope

- **Acting on the report.** This command produces structured findings, not deletions or moves. Acting on duplicates is a separate downstream worker.
- **AcoustID online lookup.** `fpcalc` can submit fingerprints to the public AcoustID database for canonical track identification; this worker is local-only. Network-side lookup is a future enhancement.
- **Cross-format perceptual hashing beyond Chromaprint.** No MFCC / spectrogram-cosine alternatives — `fpcalc` is the chosen primitive.
- **Tuning `hasDuplicateMusicFiles`.** That command's filename/size heuristic stays unchanged; this is a new sibling command, not a replacement.
- **Streaming dedup decisions.** Worker 4a handles the scheduler audit of `hasDuplicateMusicFiles`; do not re-litigate its `toArray` / streaming question here.
