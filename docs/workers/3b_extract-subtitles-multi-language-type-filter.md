# Worker 3b — extract-subtitles-multi-language-type-filter

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/3b-extract-subtitles-multi-lang`
**Worktree:** `.claude/worktrees/3b_extract-subtitles-multi-language-type-filter/`
**Phase:** 4 (server infrastructure)
**Depends on:** 20 (CLI extract — `extractSubtitlesCommand.ts` moves to `packages/cli/`)
**Parallel with:** Other Phase 4 workers that don't touch `runMkvExtract` / `extractSubtitleTrack` / `extractSubtitles` (29, 2a, 2b, 2d). NOT parallel with 2c (pure-functions-sweep) — coordinate if it rewrites the same app-command.

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Tests must cover the change scope. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Your Mission

The **Extract Subtitles** command today accepts a single optional `subtitlesLanguage`, runs one `mkvextract` spawn per track, and silently drops image-codec tracks (`S_HDMV/PGS`, `S_HDMV/TEXTST`, `S_VOBSUB`) via a hardcoded set in [extractSubtitles.ts:27-31](../../packages/server/src/app-commands/extractSubtitles.ts#L27-L31). The single-language limit is a UI/schema choice — mkvextract itself can pull many tracks in one invocation.

Deliver three improvements:

1. **Multiple languages** — `subtitlesLanguages: string[]` replaces the singular `subtitlesLanguage`.
2. **Subtitle type filter** — tri-state `typesMode: "none" | "include" | "exclude"` + single `subtitleTypes: string[]` list. The hardcoded image-codec auto-skip is **removed** in favor of this explicit filter.
3. **Batched mkvextract per file** — one `mkvextract tracks file.mkv 0:a.ass 2:b.srt …` invocation per source file instead of one spawn per track.

## Background — current shape

- App command: [packages/server/src/app-commands/extractSubtitles.ts](../../packages/server/src/app-commands/extractSubtitles.ts) — filters tracks by single language, hardcoded image-codec skip, `concatMap` over each track calling the per-track extractor.
- Per-track extractor: [packages/server/src/cli-spawn-operations/extractSubtitleTrack.ts](../../packages/server/src/cli-spawn-operations/extractSubtitleTrack.ts) — builds output path, calls `runMkvExtract` once for one `trackId:path` pair. Local `subtitleCodecExtension` record maps `S_TEXT/ASS → .ass`, `S_TEXT/UTF8 → .srt`, `S_HDMV/PGS → .sup`.
- mkvextract wrapper: [packages/server/src/cli-spawn-operations/runMkvExtract.ts](../../packages/server/src/cli-spawn-operations/runMkvExtract.ts) — takes `args: string[]` + `outputFilePath: string`, spawns mkvextract, tracks progress against one file.
- Schema: [packages/server/src/api/schemas.ts:143-167](../../packages/server/src/api/schemas.ts#L143-L167) — `extractSubtitlesRequestSchema` with single `subtitlesLanguage` enum. `copyOutSubtitlesRequestSchema` is a deprecated alias of the same schema; preserve it.
- CLI command: `packages/cli/src/cli-commands/extractSubtitlesCommand.ts` (post-worker-20 location; was at `packages/server/src/cli-commands/extractSubtitlesCommand.ts` pre-Phase-2).
- Web command config: [packages/web/src/commands/commands.ts:551-580](../../packages/web/src/commands/commands.ts#L551-L580).
- Parity fixture: [packages/web/tests/fixtures/parity/extractSubtitles.yaml](../../packages/web/tests/fixtures/parity/extractSubtitles.yaml) and `.input.json`.

## Implementation plan

### 1. Schema — `packages/server/src/api/schemas.ts`

Replace the single language with an array, add `typesMode` + `subtitleTypes`:

```ts
export const subtitleTypeExtensions = [
  "ass", "srt", "sup", "sub",
] as const

export const extractSubtitlesRequestSchema = z.object({
  sourcePath: z.string()...,
  isRecursive: z.boolean().default(false)...,
  subtitlesLanguages: z.array(z.enum(iso6392LanguageCodes)).default([])
    .describe("ISO-639-2 codes of subtitle tracks to extract. Empty = all languages."),
  typesMode: z.enum(["none", "include", "exclude"]).default("none")
    .describe("How to apply subtitleTypes: 'none' ignores the list (all types extracted), 'include' keeps only listed types, 'exclude' skips listed types."),
  subtitleTypes: z.array(z.enum(subtitleTypeExtensions)).default([])
    .describe("File extensions of subtitle formats (ass/srt/sup/sub). Ignored when typesMode is 'none'. 'sup' covers both PGS and TextST codecs."),
  folders: z.array(z.string()).optional(),
}).refine(
  (val) => val.typesMode === "none" || val.subtitleTypes.length > 0,
  { message: "subtitleTypes must be non-empty when typesMode is 'include' or 'exclude'." },
)
```

Keep `copyOutSubtitlesRequestSchema = extractSubtitlesRequestSchema` alias.

### 2. New module — `packages/server/src/tools/subtitleTypes.ts`

Single source of truth for codec ↔ extension mapping. Replaces the local `subtitleCodecExtension` record in `extractSubtitleTrack.ts`:

```ts
export const subtitleExtensionByCodec = {
  "S_TEXT/ASS":    "ass",
  "S_TEXT/UTF8":   "srt",
  "S_HDMV/PGS":    "sup",
  "S_HDMV/TEXTST": "sup",
  "S_VOBSUB":      "sub",
} as const
```

`sup` is ambiguous on the **input** side (covers both PGS and TextST) — that's intentional. The include/exclude filter treats both as `sup`, matching what a user filtering by file format would expect.

### 3. App-command rewrite — `extractSubtitles.ts`

- **Delete** `IMAGE_SUBTITLE_CODECS` and the `.pipe(filter(...))` that uses it.
- Rebuild the per-file flow to:
  1. Filter `tracks` to subtitles by language (`subtitlesLanguages` empty = all; otherwise must be in list) AND by type: resolve `codec_id → ext` via `subtitleExtensionByCodec`. Then:
     - `typesMode === "include"` → ext MUST be in `subtitleTypes`
     - `typesMode === "exclude"` → ext MUST NOT be in `subtitleTypes`
     - `typesMode === "none"` → accept all known codecs
  2. Unknown codec IDs (not in the map) are kept only when `typesMode === "none"` and logged with `"SKIPPING UNKNOWN CODEC"` line + the codec id, so users can grep for them.
  3. Preserve the existing `NO SUBTITLES` log when 0 tracks remain.
  4. Build `{trackId, outputFilePath, codecId, language}[]` for the file.
  5. Call the new batched extractor (§4) **once** per file.

### 4. Batched extractor — rename `extractSubtitleTrack.ts` → `extractSubtitleTracks.ts`

New signature: takes `{filePath, outputFolderName, tracks: Array<{trackId, codec_id, languageCode}>}`. Builds output paths the same way (`addFolderNameBeforeFilename` + `replaceFileExtension`) for each track, then issues one mkvextract call:

```
mkvextract tracks file.mkv 0:/out/track0.eng.ass 2:/out/track2.jpn.srt 5:/out/track5.eng.sup
```

Update default-props export name (`extractSubtitleTracksDefaultProps`) and adjust the `extractSubtitles.ts` import.

### 5. Widen `runMkvExtract` — `outputFilePath: string` → `outputFilePaths: string[]`

- Progress emitter: pick `outputFilePaths[0]` as the "primary" tracker target (preserves today's one-file-one-bar granularity — the spawn is still per source file).
- On user-cancel (`code === null`), `unlink` each path, swallowing missing-file errors.
- Update the only other caller [extractFlacAudio.ts](../../packages/server/src/cli-spawn-operations/extractFlacAudio.ts) to pass `[outputFilePath]` — mechanical.

### 6. CLI command — `packages/cli/src/cli-commands/extractSubtitlesCommand.ts`

Replace the single `subtitlesLanguage` option (`alias: subs-lang`) with `subtitlesLanguages` (`array` type, `choices: iso6392LanguageCodes`), and add:
- `typesMode` — single choice from `none | include | exclude`, default `none`.
- `subtitleTypes` — `array` type, `choices: subtitleTypeExtensions`, default `[]`.

Update the yargs example to demo the new shape:

```
$0 extractSubtitles "~/anime/Zegapain" -r --subtitlesLanguages eng jpn --typesMode exclude --subtitleTypes sup
```

### 7. Web UI — `packages/web/src/commands/commands.ts`

In the `extractSubtitles` field list:
- `subtitlesLanguage` → `subtitlesLanguages` with `type: "languageCodes"` (existing [LanguageCodesField](../../packages/web/src/components/LanguageCodesField/LanguageCodesField.tsx)).
- Add `typesMode` with `type: "enum"` showing `None / Include / Exclude` (existing [EnumField](../../packages/web/src/components/EnumField/EnumField.tsx)).
- Add `subtitleTypes` with `type: "subtitleTypes"` — new chip-picker (§7a). Place a hint string under the field indicating it's ignored when `typesMode === "none"`; the server's `.refine()` backstops invalid combos. **Don't** add cross-field conditional rendering in `FieldDispatcher.tsx` — keep it pure type-dispatch.

### 7a. New `SubtitleTypesField` component

Path: `packages/web/src/components/SubtitleTypesField/SubtitleTypesField.tsx`. Copy structure from [LanguageCodesField.tsx](../../packages/web/src/components/LanguageCodesField/LanguageCodesField.tsx) (96 lines) and swap the data source.

Options array (in-tree):

```ts
export const SUBTITLE_TYPE_OPTIONS = [
  { value: "ass", codec: "S_TEXT/ASS",     description: "ASS/SSA — styled text" },
  { value: "srt", codec: "S_TEXT/UTF8",    description: "SubRip — plain text" },
  { value: "sup", codec: "S_HDMV/PGS",     description: "PGS — bitmap" },
  { value: "sup", codec: "S_HDMV/TEXTST",  description: "TextST — bitmap+text" },
  { value: "sub", codec: "S_VOBSUB",       description: "VobSub — DVD bitmap" },
] as const
```

- **Tag chip** shows just the extension (`ass`, `srt`, `sup`, `sub`).
- **Dropdown row** renders extension on line 1, codec ID on line 2 with `font-mono text-slate-400` styling (matches [LanguageCodeField.tsx:54-58](../../packages/web/src/components/LanguageCodeField/LanguageCodeField.tsx#L54-L58)).
- **Filter:** `filterText` matches `value` OR `codec` OR `description`, all case-insensitive substring. Inline — no external helper.

Wire into [FieldDispatcher.tsx](../../packages/web/src/components/RenderFields/FieldDispatcher.tsx) with a `case "subtitleTypes":` arm. Add `"subtitleTypes"` to the `CommandField.type` union in [packages/web/src/commands/types.ts](../../packages/web/src/commands/types.ts).

Add a Storybook story and a vitest spec next to the component, mirroring `LanguageCodesField.stories.tsx` / `.test.tsx`.

### 8. Parity fixture — `extractSubtitles.yaml` / `.input.json`

Update to exercise the new shape:

```yaml
- id: step-fixture
  command: extractSubtitles
  params:
    sourcePath: '@basePath'
    isRecursive: true
    subtitlesLanguages: [eng, jpn]
    typesMode: exclude
    subtitleTypes: [sup]
```

## Backwards compatibility

Saved sequences using the old `subtitlesLanguage` field will fail zod validation (422 from the route). That's intentional — surface the breaking change explicitly rather than silently dropping the value. Add a one-line migration tip to the CLI `--help` for `extractSubtitles`.

## TDD steps

1. **Schema test** — `extractSubtitlesRequestSchema.parse(...)` rejects `typesMode: "include"` with empty `subtitleTypes` (assert error message).
2. **App-command test** (`packages/server/src/app-commands/extractSubtitles.test.ts`, new file alongside [keepLanguages.test.ts](../../packages/server/src/app-commands/keepLanguages.test.ts)) — cover the matrix:
   - `typesMode: none`, `subtitlesLanguages: []` → all subs extracted.
   - `typesMode: include`, `subtitleTypes: [ass]` → only ASS.
   - `typesMode: exclude`, `subtitleTypes: [sup]` → PGS + TextST dropped.
   - `subtitlesLanguages: [eng, jpn]` → both languages kept.
   - Unknown codec ID + `typesMode: "include"` → skipped silently; with `typesMode: "none"` → logged + extracted.
   - One `mkvextract` invocation per source file, args contain N `trackId:path` pairs.
3. **`runMkvExtract` test** — `outputFilePaths.length > 1`: progress tracks first path; cancel unlinks all paths.
4. **Web `SubtitleTypesField` test** — filter by extension matches; filter by codec matches; adding a tag persists to step params as the extension string.
5. **Parity test** — round-trip the updated fixture through YAML codec and back.

## Verification checklist

- [ ] `yarn lint`, `yarn typecheck`, `yarn test` clean across `tools`, `server`, `cli`, `web`.
- [ ] `yarn e2e` passes on assigned PORT/WEB_PORT.
- [ ] Storybook: open `extractSubtitles` step in the builder, confirm `LanguageCodesField` chips render, `SubtitleTypesField` two-line rows render, YAML preview reflects all three arrays.
- [ ] Manual smoke: pick a real multi-sub `.mkv` containing `eng` ASS + `eng` PGS. Run:
  - `--subtitlesLanguages eng --typesMode exclude --subtitleTypes sup` → only `.ass` lands.
  - `--subtitlesLanguages eng --typesMode include --subtitleTypes sup` → only `.sup` lands.
  - Server logs show exactly one `mkvextract` spawn per file with all `trackId:path` pairs on one command line.
- [ ] PR opened against `feat/mux-magic-revamp`; description calls out the breaking change to saved sequences using the old `subtitlesLanguage` field name.
- [ ] [docs/workers/README.md](README.md) row updated to `done`.

## Files

### Server
- [packages/server/src/api/schemas.ts](../../packages/server/src/api/schemas.ts) — schema swap (§1)
- [packages/server/src/tools/subtitleTypes.ts](../../packages/server/src/tools/subtitleTypes.ts) — **new** (§2)
- [packages/server/src/app-commands/extractSubtitles.ts](../../packages/server/src/app-commands/extractSubtitles.ts) — filter logic + batched call (§3)
- [packages/server/src/app-commands/extractSubtitles.test.ts](../../packages/server/src/app-commands/extractSubtitles.test.ts) — **new** (TDD)
- `packages/server/src/cli-spawn-operations/extractSubtitleTracks.ts` — **renamed** from `extractSubtitleTrack.ts` (§4)
- [packages/server/src/cli-spawn-operations/runMkvExtract.ts](../../packages/server/src/cli-spawn-operations/runMkvExtract.ts) — `outputFilePaths: string[]` (§5)
- [packages/server/src/cli-spawn-operations/extractFlacAudio.ts](../../packages/server/src/cli-spawn-operations/extractFlacAudio.ts) — wrap arg in array (§5)

### CLI
- `packages/cli/src/cli-commands/extractSubtitlesCommand.ts` — yargs options (§6)

### Web
- [packages/web/src/commands/commands.ts](../../packages/web/src/commands/commands.ts) — field config (§7)
- [packages/web/src/commands/types.ts](../../packages/web/src/commands/types.ts) — add `"subtitleTypes"` to the union (§7a)
- [packages/web/src/components/RenderFields/FieldDispatcher.tsx](../../packages/web/src/components/RenderFields/FieldDispatcher.tsx) — new switch arm (§7a)
- `packages/web/src/components/SubtitleTypesField/SubtitleTypesField.tsx` — **new** (§7a)
- `packages/web/src/components/SubtitleTypesField/SubtitleTypesField.stories.tsx` — **new**
- `packages/web/src/components/SubtitleTypesField/SubtitleTypesField.test.tsx` — **new**
- [packages/web/tests/fixtures/parity/extractSubtitles.yaml](../../packages/web/tests/fixtures/parity/extractSubtitles.yaml) and `.input.json` — fixture (§8)
