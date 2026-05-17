# Sequence YAML — real-world examples

Concrete sequence payloads taken from media-sync's production pipelines. Each example is a self-contained YAML document that you can paste into the Sequence Builder's **Load YAML** panel or POST to `/sequences/run` directly. The shape and rules are documented in [MANIFEST.md → Sequence Runner](../MANIFEST.md#sequence-runner--multi-step-pipelines-as-yaml); this file is the gallery of "what real callers actually run."

## Index

1. [Anime subtitle pipeline](#1-anime-subtitle-pipeline) — the umbrella job media-sync's anime branch fires per series. Filter languages, extract subs, compute + apply default ASS rules, re-merge, and clean up.
2. [Anime subtitle pipeline + optional track reorder](#2-anime-subtitle-pipeline--optional-track-reorder) — same as #1, with a `reorderTracks` + `copyFiles` pair inserted for series whose subtitle tracks ship in the wrong order.
3. [Subtitle DSL — modify ASS metadata in place](#3-subtitle-dsl--modify-ass-metadata-in-place) — the DSL building block that #1 chains via `linkedTo: computeRules`, shown standalone with a literal `rules` array so the rule shape is visible.

Cross-reference: the rule object schema (style names, replacement fields, font scaling, etc.) lives in `src/tools/assTypes.ts` and is documented in detail in [`docs/dsl/subtitle-coverage.md`](./dsl/subtitle-coverage.md) — TODO: that doc is in flight (W16); link will resolve once it lands.

---

## 1. Anime subtitle pipeline

**Intent:** Take a folder of just-downloaded `.mkv` episodes, strip every audio/subtitle track that isn't in the requested languages, edit the surviving subtitle styles via auto-computed ASS rules, re-merge the modified subtitles back into the videos, move the final files up to the series folder, and delete the work directory. One umbrella job, one SSE stream, one cancel handle.

**Produces:** Cleaned `.mkv` files in `parentDir`. The work directory is removed at the end.

**Underlying commands (links to source):**

- `keepLanguages` — [`src/app-commands/keepLanguages.ts`](../src/app-commands/keepLanguages.ts)
- `copyFiles` — [`src/app-commands/copyFiles.ts`](../src/app-commands/copyFiles.ts)
- `copyOutSubtitles` — [`src/app-commands/copyOutSubtitles.ts`](../src/app-commands/copyOutSubtitles.ts)
- `deleteFilesByExtension` — [`src/app-commands/deleteFilesByExtension.ts`](../src/app-commands/deleteFilesByExtension.ts)
- `modifySubtitleMetadata` — [`src/app-commands/modifySubtitleMetadata.ts`](../src/app-commands/modifySubtitleMetadata.ts) (set `hasDefaultRules: true` to prepend the in-tree heuristic)
- `addSubtitles` — [`src/app-commands/addSubtitles.ts`](../src/app-commands/addSubtitles.ts)
- `deleteFolder` — [`src/app-commands/deleteFolder.ts`](../src/app-commands/deleteFolder.ts)

**Source in media-sync:** `packages/sync-anime-and-manga/src/processAnimeSubtitles.ts`. media-sync builds the body programmatically as `MediaToolsSequenceBody` and POSTs JSON; the YAML below is the equivalent pasted into the builder.

```yaml
paths:
  workDir:
    label: Work Directory
    value: 'D:\Anime\<series>\__work'
  parentDir:
    label: Parent Series Folder
    value: 'D:\Anime\<series>'

steps:
  - id: filterLangs
    alias: Filter to chosen audio + subtitle languages
    command: keepLanguages
    params:
      sourcePath: '@workDir'
      audioLanguages: [jpn]
      subtitlesLanguages: [eng]

  - id: copyBackFiltered
    alias: Stage filtered output back to work folder
    command: copyFiles
    params:
      sourcePath:
        linkedTo: filterLangs
        output: folder
      destinationPath: '@workDir'

  - id: extractSubs
    alias: Extract .ass subtitle files alongside videos
    command: copyOutSubtitles
    params:
      sourcePath: '@workDir'

  - id: cleanFormats
    alias: Drop non-ASS subtitle formats (idx/vob/srt)
    command: deleteFilesByExtension
    params:
      sourcePath:
        linkedTo: extractSubs
        output: folder
      isRecursive: true
      recursiveDepth: 0
      extensions: [idx, vob, srt]

  - id: applyRules
    alias: Apply default ASS modification rules to extracted subs
    command: modifySubtitleMetadata
    params:
      sourcePath:
        linkedTo: extractSubs
        output: folder
      isRecursive: true
      recursiveDepth: 0
      hasDefaultRules: true
      rules: []

  - id: mergeSubs
    alias: Mux modified subtitles back into MKVs
    command: addSubtitles
    params:
      sourcePath: '@workDir'
      # subtitlesPath references extractSubs's folder, NOT applyRules's:
      # modifySubtitleMetadata mutates .ass files in place and has no
      # synthesized folder output, so {linkedTo: applyRules, output: folder}
      # would resolve to undefined. The in-place edits are durable on
      # extractSubs's folder by the time this step runs.
      subtitlesPath:
        linkedTo: extractSubs
        output: folder

  - id: copyBackMerged
    alias: Move final MKVs into series folder
    command: copyFiles
    params:
      sourcePath:
        linkedTo: mergeSubs
        output: folder
      destinationPath: '@parentDir'

  - id: removeWorkFolder
    alias: Clean up the work folder
    command: deleteFolder
    params:
      folderPath: '@workDir'
      confirm: true
```

The cleanup `deleteFolder` runs *inside* the sequence as the last step rather than client-side after the await — running it server-side guarantees `copyBackMerged` is fully durable before the work folder is removed.

---

## 2. Anime subtitle pipeline + optional track reorder

**Intent:** Some anime releases ship subtitle tracks in the wrong order (e.g., signs/songs as track 0, full dialog as track 1). Insert a `reorderTracks` step + a `copyFiles` step that stages the reordered output back into the work folder, so the rest of the pipeline operates on correctly-ordered tracks.

**Produces:** Same as example 1, but with subtitle tracks reordered before extraction.

**Underlying commands (additional):**

- `reorderTracks` — [`src/app-commands/reorderTracks.ts`](../src/app-commands/reorderTracks.ts)

**Source in media-sync:** the `reorderSteps` array in `processAnimeSubtitles.ts` is conditionally spread into the main `steps` array when `subtitlesTrackIndexes.length > 0`. The decision lives in the caller — the YAML itself has no `if`/`when` predicate (see README's "Resolution rules"). To run with reordering, splice these two step entries (a fragment of the `steps:` list) in **between** `copyBackFiltered` and `extractSubs` in example 1:

```yaml
  - id: reorder
    alias: Reorder subtitle tracks by index
    command: reorderTracks
    params:
      sourcePath: '@workDir'
      subtitlesTrackIndexes: [1, 0]   # whatever order the series needs

  - id: copyBackReordered
    alias: Stage reordered output back to work folder
    command: copyFiles
    params:
      sourcePath:
        linkedTo: reorder
        output: folder
      destinationPath: '@workDir'
```

`reorderTracks` is a no-op when all index arrays are empty, but the trailing `copyFiles` still expects a `folder` output to copy from — add both, or neither. For a runnable single-file version, see [`examples/process-anime-subtitles.yaml`](../examples/process-anime-subtitles.yaml), whose top-of-file comment shows the same insertion pattern.

---

## 3. Subtitle DSL — modify ASS metadata in place

**Intent:** Apply a hand-written list of ASS modification rules to every `.ass` file in a folder. This is the standalone version of the rules step in example 1 — instead of relying on `hasDefaultRules: true`'s built-in heuristic, the rules are literal YAML so you can see what the DSL looks like. Both can be combined: when `hasDefaultRules: true` is set, the heuristic rules run FIRST and your literal rules run after, so you can override defaults selectively.

**Produces:** The `.ass` files in `subtitlesDir` are rewritten in place. No new files, no folder output; downstream steps that need to operate on these files reference `subtitlesDir` (or the upstream extraction step's folder) directly, not `{ linkedTo: applyRules, output: folder }` — `modifySubtitleMetadata` doesn't synthesize a folder.

**Underlying commands:**

- `modifySubtitleMetadata` — [`src/app-commands/modifySubtitleMetadata.ts`](../src/app-commands/modifySubtitleMetadata.ts) (no-ops on empty `rules`)
- Rule type definitions — `src/tools/assTypes.ts`
- See also [`docs/dsl/subtitle-coverage.md`](./dsl/subtitle-coverage.md) — TODO: pending W16

**Source in media-sync:** the production flow uses `modifySubtitleMetadata` with `hasDefaultRules: true` (see example 1) so the heuristic computes the standard fansub fixups in-process. The standalone literal-rules form below is the same call shape with the rules inlined for documentation. Set `hasDefaultRules: true` alongside literal rules to combine — defaults run first, your rules run after.

```yaml
paths:
  subtitlesDir:
    label: Extracted .ass folder
    value: 'D:\Anime\<series>\__work\SUBTITLES'

steps:
  - id: applyRules
    alias: Apply hand-written ASS rules to extracted subs
    command: modifySubtitleMetadata
    params:
      sourcePath: '@subtitlesDir'
      isRecursive: true
      recursiveDepth: 0
      rules:
        # Each entry is one AssModificationRule, discriminated by `type`.
        # Full shape lives in src/tools/assTypes.ts; see
        # docs/dsl/subtitle-coverage.md (TODO: pending W16) for the
        # reference. Three rule types exist today:
        #
        #   - setScriptInfo   — set/upsert a [Script Info] property
        #   - setStyleFields  — patch fields on every Style row (with
        #                       optional ignored-style-name regex)
        #   - scaleResolution — rescale styles + override tags from
        #                       one PlayRes to another
        - type: setScriptInfo
          key: ScaledBorderAndShadow
          value: 'yes'
        - type: setStyleFields
          ignoredStyleNamesRegexString: 'signs?|op|ed|opening|ending'
          fields:
            Fontname: Arial
            Fontsize: '72'
```

If `rules` is empty or missing, `modifySubtitleMetadata` logs a no-op and returns immediately — that's why the production pipeline can include it unconditionally and let the upstream rule-computation decide whether anything actually happens.

---

## Pointers

- Full sequence runner reference: [MANIFEST.md § Sequence Runner](../MANIFEST.md#sequence-runner--multi-step-pipelines-as-yaml).
- Companion runnable file for example 1: [`examples/process-anime-subtitles.yaml`](../examples/process-anime-subtitles.yaml) (includes a `curl` invocation in its top-of-file comment).
- Parallel-group example: [`examples/parallel-extract-and-info.yaml`](../examples/parallel-extract-and-info.yaml) — demonstrates `kind: group` + `isParallel: true`.
- Command catalogue: `GET /doc` on a running server returns the OpenAPI spec, which lists every command's request schema and any named outputs (used by `output: <name>` references).
