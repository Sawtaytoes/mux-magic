# Worker 75 — cue-sheet-split-to-flac

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/75-cue-sheet-split-to-flac`
**Worktree:** `.claude/worktrees/75_cue-sheet-split-to-flac/`
**Phase:** 5
**Depends on:** 01 (done — rebrand)
**Parallel with:** any Phase 5 worker that doesn't touch [packages/api/src/api/schemas.ts](../../packages/api/src/api/schemas.ts), [packages/api/src/api/routes/commandRoutes.ts](../../packages/api/src/api/routes/commandRoutes.ts), [packages/web/src/commands/commands.ts](../../packages/web/src/commands/commands.ts), or [packages/web/src/jobs/commandLabels.ts](../../packages/web/src/jobs/commandLabels.ts).

> **Path note for this worker:** Older worker docs (50, 66, etc.) reference `packages/server/src/app-commands/...`. That path is **stale** — the server package was split in worker 2d. Domain logic now lives in **`packages/core/`** and the HTTP surface lives in **`packages/api/`**. Use the current paths everywhere in this worker.

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Context

There are programs out there (foobar2000, EAC, shntool, etc.) that take a single big lossless album rip + a CUE sheet and split it into one FLAC file per track. The user wants that capability inside mux-magic so it composes with the rest of their music-library automation. After splitting, the user runs MusicBrainz Picard manually for tagging and deletes leftover CUE files manually — both are explicitly **out of scope** for this command.

Real-world quirks the command must handle:

1. **Encoding chaos.** CUE files in the wild are a mix of UTF-8, Windows-1252, and Shift_JIS (Japanese CDs). A naive UTF-8 read on a Shift_JIS CUE produces mojibake that propagates into output filenames.
2. **Stale `FILE` entries.** When someone renamed the big audio file but left the CUE alone, `FILE "Album.wav" WAVE` no longer resolves. If exactly one lossless audio file lives in the same folder, prefer that.
3. **Sample-accurate splits.** CUE INDEX frames are 1/75 s ≈ 588 samples at 44.1 kHz. The split must land on the right sample so Picard's AcoustID matcher doesn't drift.

User's exact ask (in conversation): *"There are programs out there that read CUE files and extract them into separate FLAC files. I'd like to set that up in Mux-Magic. Some CUE files don't point at the right file or are Windows 1252 vs UTF-8. It's something we should be aware of by looking for mojibake, and ensure that you can point this at a directory, and it'll make a new top-level directory with all the new FLAC files inside. I can run them through picard myself and delete any CUE files left over."*

## Your Mission

Add a `splitCueSheet` app-command that:

1. Walks `sourcePath` recursively for folders containing a `*.cue` file.
2. For each CUE, reads with encoding fallback (UTF-8 strict → `chardet` → `iconv-lite`).
3. Parses tracks (`TRACK NN AUDIO` + `TITLE` + `PERFORMER` + `INDEX 01 MM:SS:FF`).
4. Resolves the audio source: CUE's `FILE` line first; if missing, glob the CUE's folder for `*.flac`/`*.wav`/`*.ape`/`*.wv`/`*.tta`/`*.tak` and use it only when **exactly one** matches.
5. Computes per-track `[start, end]` second ranges from INDEX timestamps. The final track's `end` comes from ffprobe-reported audio duration.
6. Spawns one `runFfmpeg` per track with `-i AUDIO -ss START -to END -c:a flac -map_metadata 0 OUT`, where:

   ```
   OUT = <sourcePath>/CUE-SPLITS/<albumFolderName>/NN - Title.flac
   ```

   (`<albumFolderName>` = the basename of the directory the CUE was found in, sanitized for filesystem safety; `NN` = zero-padded two-digit track number; `Title` = parsed CUE TITLE, sanitized.)
7. Emits per-track `{ source: cuePath, destination: outPath, trackNumber, title }` records.

### Why a single top-level `CUE-SPLITS/` at `sourcePath`, not per-album

The next step in the user's workflow is **MusicBrainz Picard**, which is a Windows GUI app we cannot automate. The user wants to point Picard at **one** Add-Folder target and have it ingest every freshly-split album in one go. So we co-locate all album outputs under one `CUE-SPLITS/` directory directly under the input root:

```
<sourcePath>/                 ← what the user pointed the command at
├── ArtistA/
│   ├── Album1/
│   │   ├── Album1.cue
│   │   └── Album1.flac
│   └── Album2/
│       ├── Album2.cue
│       └── Album2.wav
└── CUE-SPLITS/               ← NEW; created by this command
    ├── Album1/
    │   ├── 01 - Track One.flac
    │   ├── 02 - Track Two.flac
    │   └── ...
    └── Album2/
        ├── 01 - Opening.flac
        └── ...
```

The album-folder name comes from the album's source directory basename (not the parent artist folder). If two source albums happen to share the same basename, **error before splitting** the second one — same halt-and-list approach worker 66 used for filename collisions.

### Splitter choice: ffmpeg, sample-accurate

Use `runFfmpeg` ([packages/core/src/cli-spawn-operations/runFfmpeg.ts](../../packages/core/src/cli-spawn-operations/runFfmpeg.ts)). One invocation per track. Arg order matters for sample accuracy:

```
ffmpeg -i SRC -ss <start_sec> -to <end_sec> -c:a flac -map_metadata 0 OUT
```

**Critical rules** (the test must guard these):

- `-ss` and `-to` come **AFTER** `-i` (output seek mode). Input seek (`-ss` BEFORE `-i`) seeks by keyframe and is NOT sample-accurate.
- Use `-c:a flac` (re-encode), **not** `-c copy`. Copy mode also seeks to the nearest keyframe.
- Keep `-map_metadata 0` so any stream-level metadata on the source survives the cut (Picard rewrites anyway, but it's correct hygiene).

For redbook 16/44.1 sources these flags produce sample-accurate splits; the gap vs `shntool` is effectively zero. `shntool`/`cuetools` is listed under Out of scope as a future swap-in if anyone reports drift.

### Encoding fallback: UTF-8 → chardet → iconv-lite

Two new npm deps in `packages/core/package.json`:

- `chardet` — buffer → ranked encoding guesses
- `iconv-lite` — decode buffer using a specific encoding (UTF-8, Windows-1252, Shift_JIS, Big5, EUC-JP all supported)

Algorithm in `readCueWithEncodingFallback.ts`:

```ts
const buf = await fs.readFile(cuePath)

// Strict UTF-8 first — covers ~95% of modern CUE files.
try {
  const decoder = new TextDecoder("utf-8", { fatal: true })
  return decoder.decode(buf)
} catch {
  // Fall through.
}

// Statistical detection. Take chardet's top guess unconditionally
// (no confidence thresholding in v1 — add only if a misdetection is reported).
const guess = chardet.detect(buf) ?? "windows-1252"
logInfo(`CUE decoded as ${guess}`, cuePath)
return iconv.decode(buf, guess)
```

The strict UTF-8 attempt is what catches the SHIFT_JIS / Windows-1252 distinction reliably — both encodings contain byte sequences that a permissive UTF-8 decoder would substitute with U+FFFD instead of throwing, so we have to use `fatal: true`.

### Inputs

```ts
type SplitCueSheetRequiredProps = {
  sourcePath: string
}

type SplitCueSheetOptionalProps = {
  outputFolderName?: string  // defaults to CUE_SPLITS_FOLDER_NAME
  isRecursive?: boolean      // defaults to true
}

export type SplitCueSheetProps =
  SplitCueSheetRequiredProps & SplitCueSheetOptionalProps
```

Schema in [packages/api/src/api/schemas.ts](../../packages/api/src/api/schemas.ts):

```ts
export const splitCueSheetRequestSchema = z.object({
  sourcePath: z.string().describe("Music library root containing albums with CUE sheets."),
  isRecursive: z.boolean().default(true).describe(
    "Recursively descend into subdirectories looking for CUE files. Default true.",
  ),
  outputFolderName: z.string().default("CUE-SPLITS").describe(
    "Folder name created under sourcePath that holds all per-album subfolders.",
  ),
})
```

## Files

### New

- [packages/core/src/app-commands/splitCueSheet.ts](../../packages/core/src/app-commands/splitCueSheet.ts) — rxjs pipeline handler.
- [packages/core/src/app-commands/splitCueSheet.test.ts](../../packages/core/src/app-commands/splitCueSheet.test.ts) — golden path + encoding fallback + missing-FILE fallback + collision detection.
- [packages/core/src/cli-spawn-operations/splitCueSheetFfmpeg.ts](../../packages/core/src/cli-spawn-operations/splitCueSheetFfmpeg.ts) — builds `-i/-ss/-to/-c:a flac` args per track, delegates to `runFfmpeg`.
- [packages/core/src/tools/parseCueSheet.ts](../../packages/core/src/tools/parseCueSheet.ts) — pure parser: `(text) => { audioFileHint, tracks: Array<{ number, title, performer?, startFrame }> }`. Returns a discriminated error union for multi-FILE CUE / missing INDEX 01 / empty CUE.
- [packages/core/src/tools/parseCueSheet.test.ts](../../packages/core/src/tools/parseCueSheet.test.ts) — fixtures: vanilla CD CUE, CUE with `INDEX 00` pregap, CUE with multiple `FILE` entries (error), CUE missing `INDEX 01` (error).
- [packages/core/src/tools/readCueWithEncodingFallback.ts](../../packages/core/src/tools/readCueWithEncodingFallback.ts) — buffer → string with UTF-8 strict → chardet → iconv-lite fallback.
- [packages/core/src/tools/readCueWithEncodingFallback.test.ts](../../packages/core/src/tools/readCueWithEncodingFallback.test.ts) — UTF-8 fixture, Windows-1252 fixture with `é`, Shift_JIS fixture with Japanese kana, mixed/garbage buffer.
- [packages/core/src/tools/resolveCueAudioFile.ts](../../packages/core/src/tools/resolveCueAudioFile.ts) — pure: `({ cuePath, audioFileHint, dirEntries }) => { kind: "ok", path: string } | { kind: "error", reason: string }`.
- [packages/core/src/tools/resolveCueAudioFile.test.ts](../../packages/core/src/tools/resolveCueAudioFile.test.ts).
- [packages/core/src/tools/cueTrackToOutputFilename.ts](../../packages/core/src/tools/cueTrackToOutputFilename.ts) — pure: `(trackNumber: number, title: string) => string` returning `"NN - Sanitized Title.flac"`. Sanitization strips reserved Windows chars `<>:"/\|?*` and collapses repeated whitespace.
- [packages/core/src/tools/cueTrackToOutputFilename.test.ts](../../packages/core/src/tools/cueTrackToOutputFilename.test.ts).
- [packages/cli/src/cli-commands/splitCueSheetCommand.ts](../../packages/cli/src/cli-commands/splitCueSheetCommand.ts) — yargs wrapper.
- [packages/core/src/fake-data/scenarios/splitCueSheet.ts](../../packages/core/src/fake-data/scenarios/splitCueSheet.ts).
- [packages/web/tests/fixtures/parity/splitCueSheet.input.json](../../packages/web/tests/fixtures/parity/splitCueSheet.input.json) + [.yaml](../../packages/web/tests/fixtures/parity/splitCueSheet.yaml).

### Modified

- [packages/core/src/tools/outputFolderNames.ts](../../packages/core/src/tools/outputFolderNames.ts) — add `export const CUE_SPLITS_FOLDER_NAME = "CUE-SPLITS"`.
- [packages/api/src/api/schemas.ts](../../packages/api/src/api/schemas.ts) — add `splitCueSheetRequestSchema`.
- [packages/api/src/api/routes/commandRoutes.ts](../../packages/api/src/api/routes/commandRoutes.ts) — register `splitCueSheet` in `commandNames` (keep alphabetical) and `commandConfigs` under the `Audio Operations` tag.
- [packages/web/src/commands/commands.ts](../../packages/web/src/commands/commands.ts) — add `splitCueSheet` field-builder entry (`sourcePath` path, `isRecursive` boolean, `outputFolderName` string).
- [packages/web/src/jobs/commandLabels.ts](../../packages/web/src/jobs/commandLabels.ts) → `splitCueSheet: "Split CUE Sheet to FLAC"`.
- [packages/web/public/command-descriptions.js](../../packages/web/public/command-descriptions.js) — short description: "Split lossless album rips into per-track FLACs using their CUE sheets. Handles UTF-8, Windows-1252, and Shift_JIS CUE files."
- [packages/cli/src/cli.ts](../../packages/cli/src/cli.ts) — register `splitCueSheetCommand`.
- [packages/core/src/fake-data/index.ts](../../packages/core/src/fake-data/index.ts) — register the scenario.
- [packages/core/package.json](../../packages/core/package.json) — add `chardet` + `iconv-lite` to `dependencies`.
- [docs/workers/MANIFEST.md](MANIFEST.md) — flip row 75 to `in-progress` at start, `done` after merge.

### Patterns to mirror — do not reinvent

- App-command pipeline shape → [packages/core/src/app-commands/splitChapters.ts](../../packages/core/src/app-commands/splitChapters.ts) (the folder walk + per-file fan-out + ffmpeg pipeline is the right shape; just substitute "CUE file" for "video file" and "per-track range" for "per-chapter").
- Cli-spawn-op shape → [packages/core/src/cli-spawn-operations/runFfmpeg.ts](../../packages/core/src/cli-spawn-operations/runFfmpeg.ts) is the runtime helper; [packages/core/src/cli-spawn-operations/convertFlacToPcmAudio.ts](../../packages/core/src/cli-spawn-operations/convertFlacToPcmAudio.ts) is the template for a thin per-track wrapper.
- Output-folder constant pattern → existing entries in [packages/core/src/tools/outputFolderNames.ts](../../packages/core/src/tools/outputFolderNames.ts).
- New-command wiring (six surfaces: app-command, cli-spawn-op, schema, route, web command list, label, CLI wrapper, fake-data, parity fixture) → [docs/workers/50_wav-to-flac-convert.md](50_wav-to-flac-convert.md) is the closest precedent; clone its wiring deltas.
- Halt-and-list collision detection → [docs/workers/66_rename-files-standalone-command.md](66_rename-files-standalone-command.md) (pre-flight pass, error with the full list before any side-effect).

## TDD steps

1. **`parseCueSheet.test.ts` first.** Write failing tests for: vanilla 3-track UTF-8 CUE → correct track count + correct startFrame for each; pregap (`INDEX 00`) preserved as metadata but the start used for splitting is `INDEX 01`; multi-FILE CUE → returns error union; missing `INDEX 01` on any track → error union.
2. **`readCueWithEncodingFallback.test.ts`.** Three fixture buffers (committed under `packages/core/src/tools/__fixtures__/cue-encodings/`): one UTF-8, one Windows-1252 with `é` in a track title, one Shift_JIS with Japanese kana. Test that all three decode to the correct strings. Mixed-garbage buffer → falls through to chardet's guess and decodes without throwing.
3. **`resolveCueAudioFile.test.ts`.** hint resolves to a real file → ok; missing hint + lone `.flac` in dir entries → ok with substitution logged; missing hint + two audio files → error with both names listed; missing hint + zero audio → error.
4. **`cueTrackToOutputFilename.test.ts`.** `(1, "Hello") → "01 - Hello.flac"`; `(12, "AC/DC: Back in Black")` → reserved chars stripped/replaced; `(0, "")` → throws or returns a placeholder (decide explicitly).
5. **`splitCueSheet.test.ts` golden path.** `vol.fromJSON` with one folder containing `Album.cue` + `Album.flac`, mocked `runFfmpeg`. Expect 3 `runFfmpeg` invocations, each with `["-i", ".../Album.flac", "-ss", "<sec>", "-to", "<sec>", "-c:a", "flac", "-map_metadata", "0", "<sourcePath>/CUE-SPLITS/Album/NN - Title.flac"]`. Assert arg order: `-ss` is at index > the index of `-i` (sample-accuracy guard).
6. **Recursive walk test.** Two album folders under root → two album subfolders under `CUE-SPLITS/`, no cross-talk.
7. **Album-folder collision test.** Two source albums in different parents whose basenames both happen to be `Greatest Hits` → command errors before any split with both source paths listed; no `CUE-SPLITS/Greatest Hits/` is created.
8. **Encoding fallback end-to-end.** Shift_JIS CUE → output filename contains the kana characters intact.
9. **Missing-FILE fallback end-to-end.** CUE says `FILE "Renamed.wav" WAVE` but only `Album.flac` exists in the folder → command uses `Album.flac` and logs the substitution.
10. **Last-track end derivation.** Mock ffprobe to report a 1800.5s duration; last CUE INDEX 01 is at 1750.0s → expect `-to 1800.5` on the final track.
11. **AbortController.** Subscribe then immediately unsubscribe → no `runFfmpeg` calls completed (mirror [packages/core/src/app-commands/copyFiles.ts](../../packages/core/src/app-commands/copyFiles.ts) cancellation pattern).
12. **Route round-trip.** POST against the new route with the schema; defaults applied, empty `sourcePath` rejected.
13. **CLI smoke (manual).** `mux-magic splitCueSheet "C:\Music\test-rips"` against a throwaway dir with one CUE+FLAC pair works and writes to `C:\Music\test-rips\CUE-SPLITS\<album>\`.
14. **Parity fixture round-trips** between the JSON and YAML forms.
15. **Manual smoke (real CUE library).** Run against the user's actual music library on a small subset. Verify output filenames are correct for UTF-8 + Windows-1252 + (ideally) Shift_JIS sources. Drop the output folder into Picard, confirm it ingests cleanly and AcoustID matches each track.

## Verification checklist

- [ ] Worktree created at `.claude/worktrees/75_cue-sheet-split-to-flac/`
- [ ] Manifest row 75 → `in-progress` in its own `chore(manifest):` commit
- [ ] Failing-test commits precede green-implementation commits (TDD)
- [ ] `chardet` + `iconv-lite` added to `packages/core/package.json` (and `yarn.lock` committed)
- [ ] `ffmpeg` invoked only through `runFfmpeg` (never `spawn("ffmpeg")` directly)
- [ ] Per-track args order: `-i` before `-ss`/`-to` (output-seek mode); `-c:a flac` not `-c copy`
- [ ] `<sourcePath>/CUE-SPLITS/<album>/NN - Title.flac` layout produced (NOT a per-album sibling folder)
- [ ] Album-folder basename collision halts before any split, lists both sources
- [ ] Missing-`FILE`-line resolves to lone audio in folder when exactly one exists; errors otherwise
- [ ] Encoding fallback: UTF-8 strict → chardet/iconv-lite covers Windows-1252 + Shift_JIS in the committed fixtures
- [ ] Six-surface wiring done: app-command, cli-spawn-op, schema, route, web command list, web label, CLI adapter, fake-data scenario, parity fixture, command description
- [ ] Standard gate clean: `yarn lint → typecheck → test → e2e → lint`
- [ ] Manual smoke per TDD step 15 (real library subset → Picard ingest)
- [ ] PR opened against `feat/mux-magic-revamp`
- [ ] Manifest row 75 → `done`

## Out of scope

- **`shntool` / `cuetools` backend.** ffmpeg output-seek with `-c:a flac` is sample-accurate for redbook material. If a user later reports drift on a specific source, a follow-up worker can swap the cli-spawn-op without touching the handler.
- **Multi-`FILE` CUE sheets** (where each TRACK has its own FILE line, used for compilations with per-track WAVs). Rare in single-file album rips; error and skip with a clear message. Add support in a follow-up if a real case surfaces.
- **Non-44.1 kHz / non-16-bit sources** (24/96 vinyl rips, DSD). ffmpeg defaults preserve the source rate and bit depth; no resampling. Don't add a `-ar` / `-sample_fmt` flag.
- **Tag writing.** User runs Picard afterwards. Do not call `mkvpropedit`/`metaflac`/anything — `-map_metadata 0` is the only metadata flag.
- **CUE deletion / source cleanup.** User handles by hand. Do not delete CUEs or source audio.
- **Pregap (`INDEX 00`) handling as separate audio.** Parsed for completeness but discarded — split boundary is always `INDEX 01`.
- **HTOA (hidden track one audio)** — leading content before TRACK 01. Ignored.
- **Encoding-detection confidence thresholding.** chardet's top guess is used unconditionally. If a Shift_JIS misdetection surfaces, add thresholding then.
- **Output-folder collision overwrite policy.** If `<sourcePath>/CUE-SPLITS/<album>/` already exists from a prior run, **error** for that album and skip — same halt-and-list philosophy. Don't silently overwrite or auto-suffix `(1)`.
- **Per-file pipelining (worker 38).** That refactor isn't merged yet; this command uses the current folder-level `Observable` shape.
- **YAML round-trip back-compat.** First-class new command; no `legacyFieldRenames` entries needed.
