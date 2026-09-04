import { z } from "@hono/zod-openapi"

import { subtitleTypeExtensions } from "@mux-magic/core/src/tools/subtitleTypes.js"
import { languageSelectionSchema } from "./languageSelection.js"

// Shared response schemas
export const createJobResponseSchema = (
  outputFolderNameSchema: z.ZodTypeAny = z.null(),
) =>
  z.object({
    jobId: z
      .string()
      .openapi({
        example: "123e4567-e89b-12d3-a456-426614174000",
      })
      .describe("Unique job identifier"),
    logsUrl: z
      .string()
      .openapi({
        example:
          "/jobs/123e4567-e89b-12d3-a456-426614174000/logs",
      })
      .describe("URL to stream job logs via SSE"),
    outputFolderName: outputFolderNameSchema.describe(
      "Output folder name where files are written, or null for in-place operations",
    ),
  })

export const validationErrorSchema = z
  .object({
    error: z.string().describe("Error message"),
  })
  .openapi("ValidationError")

export const JOB_NOT_FOUND = "Job not found" as const
export const jobNotFoundSchema = z
  .object({
    error: z
      .literal(JOB_NOT_FOUND)
      .describe("Job not found error"),
  })
  .openapi("JobNotFound")

// Command request schemas
export const makeDirectoryRequestSchema = z.object({
  sourcePath: z
    .string()
    .describe(
      "Directory path to create, or a file path whose parent directory should be created",
    ),
})

export const exitIfEmptyRequestSchema = z.object({
  sourcePath: z
    .string()
    .describe(
      "Directory path whose emptiness gates whether the sequence continues. The step emits `isExiting: true` (causing the umbrella sequence job to end with status `exited`) when the path either does not exist or exists but contains zero entries. Otherwise emits `isExiting: false` and the sequence continues.",
    ),
})

// Regex `flags` constraint — the JS `RegExp` constructor accepts any
// subset of g/i/m/s/u/y. We deliberately reject `d` (hasIndices) since
// the engine surfaces capture-group offsets the live-preview UI doesn't
// use, and rejecting unknown chars at schema-validation time gives the
// user a clearer error than the deep `SyntaxError` that `new RegExp`
// would otherwise throw mid-job.
const regexFlagsPattern = /^[gimsuy]*$/

// New canonical shape for `fileFilterRegex` / `folderFilterRegex`. The
// optional `flags` plumbs into `new RegExp(pattern, flags)`, and the
// optional `sample` is documentation persisted from the UI's live tester
// — the runtime ignores it.
const regexFilterValueSchema = z.object({
  pattern: z
    .string()
    .describe("Regular expression pattern."),
  flags: z
    .string()
    .regex(
      regexFlagsPattern,
      "Flags must be a subset of g/i/m/s/u/y",
    )
    .optional()
    .describe(
      'Optional regex flags (e.g. "i" for case-insensitive).',
    ),
  sample: z
    .string()
    .optional()
    .describe(
      "Optional sample filename used by the UI's live-match preview. Persisted in the template as documentation; ignored at runtime.",
    ),
})

// String-form (legacy worker 63 wire format) is accepted and promoted to
// the object form before validation. Lets existing YAML / `?seqJson=`
// templates keep parsing without modification.
const regexFilterFieldSchema = z.preprocess(
  (raw) =>
    typeof raw === "string" ? { pattern: raw } : raw,
  regexFilterValueSchema,
)

// Same shape as `regexFilterValueSchema` plus `replacement`. The legacy
// 2-key `{ pattern, replacement }` form already satisfies this schema
// because `flags` and `sample` are optional — no preprocessing needed.
// Worker 6e broadened `renameRegexSchema` to accept either the bare
// single-rule object (back-compat — every existing template still
// validates unchanged) or a non-empty ordered array of rules applied
// left-to-right. An empty array is rejected via `.min(1)` — a field
// that's present but applies nothing is a template authoring error.
const renameRegexRuleSchema = regexFilterValueSchema.extend(
  {
    replacement: z
      .string()
      .describe(
        "Replacement string. Capture groups from `pattern` are available as $1, $2, etc.",
      ),
  },
)

export const renameRegexSchema = z
  .union([
    renameRegexRuleSchema,
    z.array(renameRegexRuleSchema).min(1),
  ])
  .describe(
    "Regex-based rename applied to each entry's name. Accepts a single rule object (back-compat) or an ordered array of rules applied left-to-right. For copy/move commands the result is the destination filename; for renameFiles it replaces the on-disk name in place.",
  )

export const copyFilesRequestSchema = z.object({
  sourcePath: z
    .string()
    .describe("Directory to copy files from."),
  destinationPath: z
    .string()
    .default("")
    .describe(
      "Directory to copy files into. Created if it does not already exist.",
    ),
  fileFilterRegex: regexFilterFieldSchema
    .optional()
    .describe(
      "If set, only files whose names match this regular expression are copied. Bare strings are accepted for back-compat with pre-flags templates.",
    ),
  folderFilterRegex: regexFilterFieldSchema
    .optional()
    .describe(
      "If set (and includeFolders is true), only folders whose names match this regular expression are copied. Bare strings are accepted for back-compat with pre-flags templates.",
    ),
  includeFolders: z
    .boolean()
    .default(false)
    .describe(
      "When true, top-level subdirectories matching folderFilterRegex are copied as units (recursively). Files are only copied if fileFilterRegex is also set.",
    ),
  renameRegex: renameRegexSchema.optional(),
  allowOverwrite: z
    .boolean()
    .default(false)
    .describe(
      "When true, existing destination files are overwritten. Default false: the command refuses to clobber and fails fast with an EEXIST-shaped error naming the colliding path. Opt in for mirror-sync / idempotent re-run flows.",
    ),
})

export const analyseDiscBackupRequestSchema = z.object({
  sourcePath: z
    .string()
    .describe(
      "A `[BACKUP]` folder produced by rip-deck (e.g. `/media/Disc-Rips/[BACKUP] Desk Set - Blu-ray`). Read directly as a BDMV tree — no disc needed. Nothing in it is modified.",
    ),
  disabledRuleNames: z
    .array(z.string())
    .default([])
    .describe(
      "Heuristic rules to switch off by name (e.g. `isChapterlessLongTitle`). Studio patterns are conventions, not standards, so a rule that turns out to be wrong for a release can be disabled without unpicking the analyser.",
    ),
  minimumTitleLengthSeconds: z
    .number()
    .default(10)
    .describe(
      "MakeMKV's minimum title length. Defaults to 10, the floor that drops sub-ten-second BDMV fragments without dropping content — it takes Desk Set from 61 titles to 10, and it keeps the 12-second image gallery, 0:58 featurette and 0:30 promos that a 60-second floor silently hid. Pass 0 to see every fragment anyway.",
    ),
})

export const extractDiscTitlesRequestSchema = z.object({
  sourcePath: z
    .string()
    .describe(
      "A `[BACKUP]` folder produced by rip-deck (e.g. `/media/Disc-Rips/[BACKUP] Desk Set - Blu-ray`). The backup itself is only read.",
    ),
  destinationPath: z
    .string()
    .optional()
    .describe(
      "Where the ripped `.mkv` files land. Defaults to `EXTRACTED-TITLES/` inside the backup, beside `DISC-ANALYSIS/`, so the files travel with the proposal that produced them.",
    ),
  disabledRuleNames: z
    .array(z.string())
    .default([])
    .describe(
      "Heuristic rules to switch off by name (e.g. `isChapterlessLongTitle`). Same list the analysis takes — the rules decide which titles are `keep`, and `keep` is what gets ripped.",
    ),
  minimumTitleLengthSeconds: z
    .number()
    .default(10)
    .describe(
      "MakeMKV's minimum title length. MUST match the analysis pass: makemkvcon assigns title indexes AFTER applying this filter, so the same disc read at 0 and at 10 numbers its titles differently and an index from the wrong pass rips the wrong title.",
    ),
  titleIndexes: z
    .array(z.number())
    .optional()
    .describe(
      "Explicit title indexes to rip, overriding the dispositions. Omit to rip every title the analysis proposed keeping — `merge` and `inspect` titles are not ripped automatically unless `isRippingTrackSupersets` covers them.",
    ),
  isRippingTrackSupersets: z
    .boolean()
    .default(false)
    .describe(
      "Also rip the one title in a cluster that carries every track its siblings expose, grafting the chapter marks it lacks from the richest sibling playlist's `.mpls`. Replaces ripping three 65.5 GB playlists of the same film with one pass. Off by default because the superset is the very title `isChapterlessTwin` proposes discarding, so taking it is the caller's decision.",
    ),
})

export const flattenOutputRequestSchema = z.object({
  sourcePath: z
    .string()
    .describe(
      "Output folder produced by a previous step (e.g. /work/SUBTITLED). Its contents are copied up one level into its parent.",
    ),
  deleteSourceFolder: z
    .boolean()
    .default(false)
    .describe(
      "Delete the source folder after copying. By default the source is preserved (debug-friendly).",
    ),
})

export const moveFilesIntoNamedFoldersRequestSchema =
  z.object({
    sourcePath: z
      .string()
      .describe(
        "Folder whose files are each moved into a same-named subdirectory (file extension stripped from the folder name). Casper.mkv → Casper/Casper.mkv. Pre-existing subdirectories are untouched.",
      ),
  })

export const distributeFolderToSiblingsRequestSchema =
  z.object({
    sourceFolderPath: z
      .string()
      .describe(
        "Folder to copy into every sibling directory of its parent. Canonical use case is an `attachments` folder beside per-episode dirs.",
      ),
    deleteSourceFolderAfterDistributing: z
      .boolean()
      .default(false)
      .describe(
        "Delete the source folder after all copies succeed. Default false: source is preserved so the destructive step is explicit and opt-in.",
      ),
  })

export const flattenChildFoldersRequestSchema = z.object({
  parentPath: z
    .string()
    .describe(
      "Folder whose immediate child directories should each have their files moved up to this folder. Files already at the parent level are untouched.",
    ),
  deleteEmptyChildFoldersAfterFlattening: z
    .boolean()
    .default(false)
    .describe(
      "Delete the now-empty child directories after the moves complete. Default false: the empties are preserved for inspection (matches flattenOutput's default).",
    ),
})

export const moveFilesRequestSchema = z.object({
  sourcePath: z
    .string()
    .describe(
      "Directory to move files from. Deleted after all files are copied.",
    ),
  destinationPath: z
    .string()
    .default("")
    .describe(
      "Directory to move files into. Created if it does not already exist.",
    ),
  fileFilterRegex: regexFilterFieldSchema
    .optional()
    .describe(
      "If set, only files whose names match this regular expression are moved. Bare strings are accepted for back-compat with pre-flags templates.",
    ),
  renameRegex: renameRegexSchema.optional(),
  allowOverwrite: z
    .boolean()
    .default(false)
    .describe(
      "When true, existing destination files are overwritten. Default false: the command refuses to clobber and fails fast with an EEXIST-shaped error naming the colliding path. Opt in for mirror-sync / idempotent re-run flows.",
    ),
})

export const renameFilesRequestSchema = z.object({
  sourcePath: z
    .string()
    .describe("Directory containing files to rename."),
  isRecursive: z
    .boolean()
    .default(false)
    .describe(
      "Recursively descend into subdirectories. Default false.",
    ),
  recursiveDepth: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe(
      "Maximum recursion depth when --isRecursive is set (0 = default depth of 1; mirrors deleteFilesByExtension).",
    ),
  fileFilterRegex: regexFilterFieldSchema
    .optional()
    .describe(
      "If set, only files whose names match this regular expression are renamed. Bare strings are accepted for back-compat with pre-flags templates.",
    ),
  renameRegex: renameRegexSchema.describe(
    "Required. Applied to each matched filename (including extension) via String.replace.",
  ),
})

export const deleteCopiedOriginalsRequestSchema = z.object({
  pathsToDelete: z
    .array(z.string())
    .describe(
      "List of file or folder paths to delete. Typically provided via linkedTo from a prior copyFiles step's copiedSourcePaths output. Is a no-op when the list is empty.",
    ),
})

export const extractSubtitlesRequestSchema = z.object({
  sourcePath: z
    .string()
    .describe(
      "Directory containing media files or containing other directories of media files.",
    ),
  isRecursive: z
    .boolean()
    .default(false)
    .describe(
      "Recursively looks in folders for media files.",
    ),
  subtitlesLanguages: z
    // Accept both a bare ISO-639-2 code ("eng") and the builder's
    // { code, ietf? } object shape, normalizing to { code }. Matches
    // keepLanguages; without this the web LanguageCodesField (which always
    // emits objects) produces requests the enum-only schema rejected.
    .array(languageSelectionSchema)
    .default([])
    .describe(
      "ISO-639-2 codes of subtitle tracks to extract (bare code or { code, ietf? } object). Leave empty to extract every language.",
    ),
  typesMode: z
    .enum(["none", "include", "exclude"])
    .default("none")
    .describe(
      "How to apply subtitleTypes: 'none' ignores the list (all types extracted), 'include' keeps only listed types, 'exclude' skips listed types. With 'include' and an empty subtitleTypes list, no tracks match — the command extracts nothing.",
    ),
  subtitleTypes: z
    .array(z.enum(subtitleTypeExtensions))
    .default([])
    .describe(
      "File extensions of subtitle formats to filter on (ass/srt/sup/sub). Ignored when typesMode is 'none'. 'sup' covers both PGS and TextST codecs.",
    ),
  folders: z
    .array(z.string())
    .optional()
    .describe(
      "Folder names to extract subtitles into. Each extracted subtitle file is placed inside the named sub-folder relative to the source file location. Leave empty to use the default output folder.",
    ),
})

export const convertSrtToAssRequestSchema = z.object({
  sourcePath: z
    .string()
    .min(1)
    .describe("Directory containing SRT subtitle files."),
  isRecursive: z
    .boolean()
    .default(false)
    .describe(
      "Recursively scan subdirectories for SRT files. Default false.",
    ),
  recursiveDepth: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe(
      "Maximum recursion depth when recursive scanning is enabled. Zero uses one level.",
    ),
})

/** @deprecated Renamed to {@link extractSubtitlesRequestSchema}. Kept as an alias so existing callers don't break. */
export const copyOutSubtitlesRequestSchema =
  extractSubtitlesRequestSchema

export const getAudioOffsetsRequestSchema = z.object({
  sourcePath: z
    .string()
    .describe(
      "Directory with media files with tracks you want to copy.",
    ),
  destinationFilesPath: z
    .string()
    .describe(
      "Directory containing media files with tracks you want replaced.",
    ),
  isOverwritingExtractedAudio: z
    .boolean()
    .default(false)
    .describe(
      "Force re-extraction of the source/destination WAV files even when a previous extraction is already present alongside the AUDIO-OFFSETS folder. When false (default), an existing WAV whose mediaInfo duration matches its input within 1 second is reused so the slow ffmpeg PCM decode is skipped on re-runs.",
    ),
})

export const convertLosslessToFlacRequestSchema = z.object({
  sourcePath: z
    .string()
    .min(1)
    .describe(
      "Directory containing lossless audio files (.wav / .wave / .aif / .aiff / .m4a / .m4b) to encode to FLAC, or a directory of directories of those files when used with isRecursive.",
    ),
  isRecursive: z
    .boolean()
    .default(false)
    .describe(
      "Recursively descends into subdirectories looking for accepted lossless audio files. Depth is controlled by recursiveDepth (default 1 when isRecursive is true).",
    ),
  recursiveDepth: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe(
      "Maximum recursion depth when isRecursive is set (0 = default depth of 1; mirrors deleteFilesByExtension). Pass 3 to descend three levels of subdirectories.",
    ),
  isSourceDeleted: z
    .boolean()
    .default(false)
    .describe(
      "When true, deletes the source file after a successful FLAC encode. Defaults to false; the original is kept by default.",
    ),
  isAuditOnly: z
    .boolean()
    .default(false)
    .describe(
      "Dry-run: probe each file with mediainfo and report what would be converted vs. skipped (and why), but do not invoke ffmpeg or write any FLAC files. Source files are never touched. Useful for scanning a whole music library before committing to the encode.",
    ),
})

export const findContainerAudioFilesRequestSchema =
  z.object({
    sourcePath: z
      .string()
      .min(1)
      .describe(
        "Directory containing container-with-video files (.mkv / .mp4 / .m4v / .mov / .webm / .avi) to probe with MediaInfo. Returns a per-file track summary (audio count, video count, audio codec, hasVideoTrack). Pure read — no filesystem mutation.",
      ),
    isRecursive: z
      .boolean()
      .default(false)
      .describe(
        "Recursively descends one level into subdirectories looking for container-with-video files. Default false.",
      ),
  })

export const convertContainerAudioToFlacRequestSchema =
  z.object({
    sourcePath: z
      .string()
      .min(1)
      .describe(
        "Directory containing container-with-video files (.mkv / .mp4 / .m4v / .mov / .webm / .avi) whose audio tracks should be encoded to FLAC in-place.",
      ),
    isRecursive: z
      .boolean()
      .default(false)
      .describe(
        "Recursively descends one level into subdirectories. Default false.",
      ),
    isSourceDeleted: z
      .boolean()
      .default(false)
      .describe(
        "When true, deletes each source container file after its FLAC encode succeeds. Defaults to false; the original is kept by default.",
      ),
    isVideoDropAcknowledged: z
      .boolean()
      .default(false)
      .describe(
        "When false (the default), files that contain a video track are skipped with a warning — use findContainerAudioFiles first to review. Set to true to acknowledge that the video track will be dropped during conversion.",
      ),
  })

export const changeTrackLanguagesRequestSchema = z.object({
  sourcePath: z
    .string()
    .describe(
      "Directory with media files whose tracks need language metadata corrections.",
    ),
  isRecursive: z
    .boolean()
    .default(false)
    .describe(
      "Recursively looks in folders for media files.",
    ),
  audioLanguage: languageSelectionSchema
    .optional()
    .describe(
      "Language for audio tracks. Accepts a 3-letter ISO-639-2 code (e.g. 'chi') or an object with code + optional BCP 47 ietf tag (e.g. { code: 'chi', ietf: 'zh-Hant-HK' }). All tracks will be labeled with this language.",
    ),
  subtitlesLanguage: languageSelectionSchema
    .optional()
    .describe(
      "Language for subtitle tracks. Accepts a 3-letter ISO-639-2 code or an object with code + optional BCP 47 ietf tag.",
    ),
  videoLanguage: languageSelectionSchema
    .optional()
    .describe(
      "Language for video tracks. Accepts a 3-letter ISO-639-2 code or an object with code + optional BCP 47 ietf tag.",
    ),
})

export const fixIncorrectDefaultTracksRequestSchema =
  z.object({
    sourcePath: z
      .string()
      .describe(
        "Directory containing media files or containing other directories of media files.",
      ),
    isRecursive: z
      .boolean()
      .default(false)
      .describe(
        "Recursively looks in folders for media files.",
      ),
  })

export const renumberChaptersRequestSchema = z.object({
  sourcePath: z
    .string()
    .min(1)
    .describe(
      "Directory containing media files or containing other directories of media files.",
    ),
  isRecursive: z
    .boolean()
    .default(false)
    .describe(
      "Recursively looks in folders for media files.",
    ),
  isPaddingChapterNumbers: z
    .boolean()
    .default(true)
    .describe(
      "Zero-pad chapter numbers (default true) — produces `Chapter 01..N` (width ≥ 2). Set false for `Chapter 1..N`.",
    ),
})

export const hasBetterAudioRequestSchema = z.object({
  sourcePath: z
    .string()
    .describe(
      "Directory containing media files or containing other directories of media files.",
    ),
  isRecursive: z
    .boolean()
    .default(false)
    .describe(
      "Recursively looks in folders for media files.",
    ),
  recursiveDepth: z
    .number()
    .default(0)
    .describe(
      "How many levels of child directories to follow when using isRecursive (0 = use default depth of 1).",
    ),
})

export const hasBetterVersionRequestSchema = z.object({
  sourcePath: z
    .string()
    .describe(
      "Directory containing media files or containing other directories of media files.",
    ),
  isRecursive: z
    .boolean()
    .default(false)
    .describe(
      "Recursively looks in folders for media files.",
    ),
  recursiveDepth: z
    .number()
    .default(0)
    .describe(
      "How many levels of child directories to follow when using isRecursive (0 = use default depth of 1).",
    ),
})

export const hasDuplicateMusicFilesRequestSchema = z.object(
  {
    sourcePath: z
      .string()
      .describe(
        "Directory containing music files or containing other directories of music files.",
      ),
    isRecursive: z
      .boolean()
      .default(false)
      .describe(
        "Recursively looks in folders for music files.",
      ),
    recursiveDepth: z
      .number()
      .default(0)
      .describe(
        "How many levels of child directories to follow when using isRecursive (0 = use default depth of 1).",
      ),
  },
)

export const hasImaxEnhancedAudioRequestSchema = z.object({
  sourcePath: z
    .string()
    .describe(
      "Directory containing media files or containing other directories of media files.",
    ),
  isRecursive: z
    .boolean()
    .default(false)
    .describe(
      "Recursively looks in folders for media files.",
    ),
})

export const hasManyAudioTracksRequestSchema = z.object({
  sourcePath: z
    .string()
    .describe(
      "Directory containing media files or containing other directories of media files.",
    ),
  isRecursive: z
    .boolean()
    .default(false)
    .describe(
      "Recursively looks in folders for media files.",
    ),
})

export const hasSurroundSoundRequestSchema = z.object({
  sourcePath: z
    .string()
    .describe(
      "Directory containing media files or containing other directories of media files.",
    ),
  isRecursive: z
    .boolean()
    .default(false)
    .describe(
      "Recursively looks in folders for media files.",
    ),
  recursiveDepth: z
    .number()
    .default(0)
    .describe(
      "How many levels of child directories to follow when using isRecursive (0 = use default depth of 1).",
    ),
})

export const hasWrongDefaultTrackRequestSchema = z.object({
  sourcePath: z
    .string()
    .describe(
      "Directory containing media files or containing other directories of media files.",
    ),
  isRecursive: z
    .boolean()
    .default(false)
    .describe(
      "Recursively looks in folders for media files.",
    ),
})

export const isMissingSubtitlesRequestSchema = z.object({
  sourcePath: z
    .string()
    .describe(
      "Directory containing media files or containing other directories of media files.",
    ),
  isRecursive: z
    .boolean()
    .default(false)
    .describe(
      "Recursively looks in folders for media files.",
    ),
})

export const deleteFilesByExtensionRequestSchema = z.object(
  {
    sourcePath: z
      .string()
      .describe("Directory to search for files to delete."),
    isRecursive: z
      .boolean()
      .default(false)
      .describe(
        "Recursively search subdirectories for matching files.",
      ),
    recursiveDepth: z
      .number()
      .default(0)
      .describe(
        "Maximum recursion depth when --isRecursive is set (0 = default depth of 1).",
      ),
    extensions: z
      .array(z.string())
      .min(1)
      .describe(
        "List of file extensions to delete (with or without leading dot), e.g. ['.srt', 'idx'].",
      )
      .openapi({ example: [".srt", "idx"] }),
  },
)

export const deleteFolderRequestSchema = z.object({
  sourcePath: z
    .string()
    .describe("Folder to delete (recursively)."),
  confirm: z
    .literal(true)
    .describe(
      "Required: pass --confirm to acknowledge this is destructive. Without it the command refuses to run.",
    ),
})

export const remuxToMkvRequestSchema = z.object({
  sourcePath: z
    .string()
    .describe("Directory containing files to remux."),
  extensions: z
    .array(z.string())
    .min(1)
    .describe(
      "List of file extensions to remux (with or without leading dot), e.g. ['.ts', '.m2ts'].",
    )
    .openapi({ example: [".ts"] }),
  isRecursive: z
    .boolean()
    .default(false)
    .describe("Recursively scan subdirectories."),
  recursiveDepth: z
    .number()
    .default(0)
    .describe(
      "Maximum recursion depth when --isRecursive is set (0 = default depth of 1).",
    ),
  isSourceDeletedOnSuccess: z
    .boolean()
    .default(false)
    .describe(
      "Delete each source file after its remux completes successfully.",
    ),
})

// A predicate body is either a flat key→value equality map (literal form)
// or a `{ $ref: <name> }` reference into the request's top-level
// `predicates:` map. Used by `when:` clauses' matches/excludes blocks.
export const predicateBodySchema = z
  .union([
    z
      .object({ $ref: z.string() })
      .describe(
        "Reference to a named predicate defined in the top-level `predicates:` map.",
      ),
    z
      .record(z.string(), z.string())
      .describe(
        "Flat key→value equality map (e.g. { 'YCbCr Matrix': 'TV.601', PlayResX: '640' }).",
      ),
  ])
  .describe(
    "Predicate body — either an inline literal key→value map or a `{ $ref: <name> }` pointer at a named predicate.",
  )

// A single clause inside a `when:` block. The shorthand form is a bare
// key→value map (sugar for `matches:` only). The explicit form lets you
// combine `matches:` AND `excludes:`. Per-file the clause matches if
// matches passes AND excludes does not.
const whenPredicateClauseSchema = z
  .union([
    z
      .object({
        matches: predicateBodySchema.optional(),
        excludes: predicateBodySchema.optional(),
      })
      .describe(
        "Explicit form: combine matches: + excludes: blocks. Per-file the clause matches if `matches` passes AND `excludes` does NOT.",
      ),
    z
      .record(z.string(), z.string())
      .describe(
        "Shorthand form: bare key→value map equivalent to `matches: { …keys… }` only.",
      ),
  ])
  .describe(
    "A single `when:` clause. Bare keys are sugar for `matches:` only; the explicit form supports `excludes:` for negation.",
  )

// Top-level `when:` predicate block. All listed clauses are ANDed.
export const whenPredicateSchema = z
  .object({
    anyScriptInfo: whenPredicateClauseSchema
      .optional()
      .describe(
        "True when at least one .ass file's [Script Info] satisfies the per-file clause.",
      ),
    allScriptInfo: whenPredicateClauseSchema
      .optional()
      .describe(
        "True when every .ass file's [Script Info] satisfies the per-file clause.",
      ),
    noneScriptInfo: whenPredicateClauseSchema
      .optional()
      .describe(
        "True when no .ass file's [Script Info] satisfies the per-file clause.",
      ),
    notAllScriptInfo: whenPredicateClauseSchema
      .optional()
      .describe(
        "True when at least one .ass file's [Script Info] does NOT satisfy the per-file clause.",
      ),
    anyStyle: whenPredicateClauseSchema
      .optional()
      .describe(
        "True when at least one [V4+ Styles] row across all files satisfies the per-style clause.",
      ),
    allStyle: whenPredicateClauseSchema
      .optional()
      .describe(
        "True when every [V4+ Styles] row across all files satisfies the per-style clause.",
      ),
    noneStyle: whenPredicateClauseSchema
      .optional()
      .describe(
        "True when no [V4+ Styles] row in any file satisfies the per-style clause.",
      ),
  })
  .describe(
    "Aggregate-batch gate applied to the rule. All present clauses are ANDed. When omitted, the rule always fires. See docs/dsl/subtitle-rules.md `when:` predicates section.",
  )

// Comparator vocabulary for `applyIf`. Each entry maps a per-style field
// name to either a string-equality value OR one of these comparators
// against the numeric coercion of the style field's value.
export const comparatorSchema = z
  .object({
    eq: z
      .number()
      .optional()
      .describe(
        "Strictly equal to the style field's numeric value.",
      ),
    lt: z
      .number()
      .optional()
      .describe(
        "Strictly less than the style field's numeric value.",
      ),
    gt: z
      .number()
      .optional()
      .describe(
        "Strictly greater than the style field's numeric value.",
      ),
    lte: z
      .number()
      .optional()
      .describe(
        "Less than or equal to the style field's numeric value.",
      ),
    gte: z
      .number()
      .optional()
      .describe(
        "Greater than or equal to the style field's numeric value.",
      ),
  })
  .refine(
    (value) =>
      Object.values(value).some(
        (operand) => typeof operand === "number",
      ),
    {
      message:
        "Comparator must specify at least one of eq/lt/gt/lte/gte.",
    },
  )
  .describe(
    "Comparator block — one of eq/lt/gt/lte/gte applied against the per-style field's number-coerced value.",
  )

const applyIfFieldMatchSchema = z.union([
  z
    .string()
    .describe(
      "Equality match — the style field must equal this string.",
    ),
  comparatorSchema,
])

const applyIfStyleClauseSchema = z
  .record(z.string(), applyIfFieldMatchSchema)
  .describe(
    "Per-style field map — each entry is a string equality OR a comparator block.",
  )

// Per-file/per-style applicability filter on `setStyleFields`. Distinct
// from `when:`, which decides whether the rule emits at all.
export const applyIfPredicateSchema = z
  .object({
    anyStyleMatches: applyIfStyleClauseSchema
      .optional()
      .describe(
        "Apply the rule's `fields` only when at least one [V4+ Styles] row in the file matches every entry in this clause.",
      ),
    allStyleMatches: applyIfStyleClauseSchema
      .optional()
      .describe(
        "Apply only when every non-ignored style in the file matches every entry in this clause.",
      ),
    noneStyleMatches: applyIfStyleClauseSchema
      .optional()
      .describe(
        "Apply only when no style row matches every entry in this clause.",
      ),
  })
  .describe(
    "Per-file applicability gate. Files with no style row that satisfies the predicate are left untouched for this rule. Distinct from `when:`, which gates emission across the whole batch.",
  )

// One math op for `computeFrom.ops` — either an operand-bearing
// `{ verb: number }` OR a bare-string no-arg op.
const computeFromOpSchema = z
  .union([
    z.object({ add: z.number() }).strict(),
    z.object({ subtract: z.number() }).strict(),
    z.object({ multiply: z.number() }).strict(),
    z
      .object({
        divide: z.number().refine((value) => value !== 0, {
          message:
            "divide: 0 is rejected — division by zero.",
        }),
      })
      .strict(),
    z.object({ min: z.number() }).strict(),
    z.object({ max: z.number() }).strict(),
    z.literal("round"),
    z.literal("floor"),
    z.literal("ceil"),
    z.literal("abs"),
  ])
  .describe(
    "A single math op. Numeric ops carry an operand; bare-string ops (round/floor/ceil/abs) take no argument.",
  )

export const computeFromSchema = z
  .object({
    computeFrom: z.object({
      property: z
        .string()
        .describe(
          "Source metadata key — `[Script Info]` key name when scope is 'scriptInfo', `[V4+ Styles]` field name when scope is 'style'.",
        ),
      scope: z
        .enum(["scriptInfo", "style"])
        .describe(
          "Where to read the source value from. 'scriptInfo' reads the file's [Script Info] map; 'style' reads the per-row [V4+ Styles] field.",
        ),
      ops: z
        .array(computeFromOpSchema)
        .describe(
          "Ordered list of math ops applied left-to-right to the number-coerced source value. Final accumulator is `Number.toString()`'d into the field.",
        ),
    }),
  })
  .describe(
    "Computed style-field value: read a metadata property, apply ops left-to-right, write the resulting number as a string. See docs/dsl/subtitle-rules.md Computed values.",
  )

const styleFieldValueSchema = z.union([
  z
    .string()
    .describe("Literal string value for the style field."),
  computeFromSchema,
])

const setScriptInfoRuleSchema = z
  .object({
    type: z.literal("setScriptInfo"),
    key: z
      .string()
      .describe(
        "Key name in the [Script Info] section of the ASS file (e.g. 'YCbCr Matrix', 'ScriptType', 'PlayResX'). The key is matched case-sensitively. If the key does not already exist it is appended after the last existing property.",
      ),
    value: z
      .string()
      .describe(
        "New value to assign to the key (e.g. 'TV.709', 'v4.00+', '1920').",
      ),
    when: whenPredicateSchema
      .optional()
      .describe(
        "Optional aggregate-batch gate. When present, the rule is skipped entirely if the predicate fails across the batch.",
      ),
  })
  .openapi({
    description:
      "Sets or adds a single key-value pair in the [Script Info] section of an ASS subtitle file. Use this to correct metadata fields such as YCbCr Matrix, ScriptType, or resolution values.",
  })

const scaleResolutionRuleSchema = z
  .object({
    type: z.literal("scaleResolution"),
    from: z
      .object({
        width: z
          .number()
          .describe(
            "Expected current PlayResX value in the file. The rule is skipped if the file does not match this width.",
          ),
        height: z
          .number()
          .describe(
            "Expected current PlayResY value in the file. The rule is skipped if the file does not match this height.",
          ),
      })
      .optional()
      .describe(
        "Optional guard: if provided and the file's current PlayResX/Y do not match, the rule is skipped entirely. Omit to apply unconditionally regardless of current resolution.",
      )
      .openapi({ example: { width: 640, height: 480 } }),
    to: z
      .object({
        width: z
          .number()
          .describe(
            "Target PlayResX value to write (e.g. 1920).",
          ),
        height: z
          .number()
          .describe(
            "Target PlayResY value to write (e.g. 1080).",
          ),
      })
      .describe("The resolution to scale the file to.")
      .openapi({ example: { width: 1920, height: 1080 } }),
    hasLayoutRes: z
      .boolean()
      .default(false)
      .describe(
        "When true, creates LayoutResX and LayoutResY even if they are not already present. Only takes effect when isLayoutResSynced is also true. Defaults to false.",
      ),
    hasScaledBorderAndShadow: z
      .boolean()
      .default(true)
      .describe(
        "When true, sets 'ScaledBorderAndShadow: yes' in [Script Info] after scaling, which ensures borders and shadows scale proportionally at the new resolution. Defaults to true.",
      ),
    isLayoutResSynced: z
      .boolean()
      .default(true)
      .describe(
        "When true, updates LayoutResX and LayoutResY if they already exist in the file. Keys that are absent are left alone unless hasLayoutRes is also true. Defaults to true.",
      ),
    when: whenPredicateSchema
      .optional()
      .describe(
        "Optional aggregate-batch gate. Distinct from the per-file `from:` guard — `when:` decides whether the rule emits at all across the batch, while `from:` is a per-file no-op when the file's resolution doesn't match.",
      ),
  })
  .openapi({
    description:
      "Updates PlayResX/PlayResY in the [Script Info] section to rescale the subtitle canvas. 'from' is an optional guard — if provided and the file's current resolution does not match, the rule is skipped; omit to apply unconditionally. isLayoutResSynced updates LayoutResX/Y only if they already exist; pair it with hasLayoutRes:true to also create them when absent.",
  })

const setStyleFieldsRuleSchema = z
  .object({
    type: z.literal("setStyleFields"),
    fields: z
      .record(z.string(), styleFieldValueSchema)
      .describe(
        "Map of ASS style field names to their new values. Each value is either a string literal (e.g. 'MarginV: \"90\"') or a `computeFrom` block that derives the value from a metadata property. Field names must use the exact ASS column names from the Format line (e.g. 'MarginL', 'MarginR', 'MarginV', 'Fontsize', 'PrimaryColour'). Only the listed fields are changed; all other style fields are left untouched.",
      ),
    ignoredStyleNamesRegexString: z
      .string()
      .optional()
      .describe(
        "Optional case-insensitive regular expression matched against each style's Name field. Styles whose name matches are left unchanged. Use this to protect sign/song styles from being overwritten — e.g. 'signs?|op|ed|opening|ending'.",
      ),
    applyIf: applyIfPredicateSchema
      .optional()
      .describe(
        "Per-file applicability filter (e.g. `{ anyStyleMatches: { MarginL: { lt: 50 } } }`). When omitted, all non-ignored styles get the fields. Files with no style row that satisfies the predicate are left untouched for this rule.",
      ),
    when: whenPredicateSchema
      .optional()
      .describe(
        "Optional aggregate-batch gate. When present, the rule is skipped entirely if the predicate fails across the batch.",
      ),
  })
  .openapi({
    description:
      "Overwrites specific fields on every style entry in the [V4+ Styles] section of an ASS file. Optionally skips styles whose Name matches a regex (e.g. sign or song styles). Use this to bulk-update margins, font sizes, or colors across all dialogue styles. Field values can be literal strings or `computeFrom` blocks that derive from metadata.",
  })

export const assModificationRuleSchema =
  z.discriminatedUnion("type", [
    setScriptInfoRuleSchema,
    scaleResolutionRuleSchema,
    setStyleFieldsRuleSchema,
  ])

export const modifySubtitleMetadataRequestSchema = z.object(
  {
    sourcePath: z
      .string()
      .describe(
        "Directory containing .ass subtitle files to modify.",
      ),
    isRecursive: z
      .boolean()
      .default(false)
      .describe(
        "Recursively search subdirectories for .ass files.",
      ),
    recursiveDepth: z
      .number()
      .default(0)
      .describe(
        "Maximum recursion depth when --isRecursive is set (0 = default depth of 1).",
      ),
    hasDefaultRules: z
      .boolean()
      .default(false)
      .describe(
        'When true, the command runs the in-tree default-rules heuristic (`buildDefaultSubtitleModificationRules`) against the .ass files at `sourcePath` and PREPENDS the computed rules to `rules`. Defaults run first, user rules run after, so user rules can override. The heuristic emits: `setScriptInfo ScriptType=v4.00+`, `setScriptInfo YCbCr Matrix=TV.709` (when any file has TV.601 outside SD-DVD 640x480), `setStyleFields MarginV=round(PlayResY/1080*90)`, optional `MarginL/R=round(200/1920*PlayResX)` when narrow margins are detected on non-ignored styles, with `ignoredStyleNamesRegexString="signs?|op|ed|opening|ending"`. See docs/dsl/subtitle-rules.md `Default rules toggle` for the full table.',
      ),
    predicates: z
      .record(z.string(), z.record(z.string(), z.string()))
      .optional()
      .describe(
        "Optional named-predicate map. Keys are predicate names; values are flat string-equality key→value maps. Referenced from rule `when:` clauses via `{ $ref: <name> }` inside `matches:` or `excludes:`. See docs/dsl/subtitle-rules.md Named predicates.",
      ),
    rules: z
      .preprocess((value) => {
        if (typeof value === "string") {
          try {
            return JSON.parse(value)
          } catch {
            return value
          }
        }

        return value
      }, z.array(assModificationRuleSchema))
      .default([])
      .describe(
        "Ordered list of DSL modification rules to apply to each .ass file. Empty when only relying on `hasDefaultRules: true` for the rule set.",
      ),
  },
)

export const keepLanguagesRequestSchema = z.object({
  sourcePath: z
    .string()
    .describe("Directory where media files are located."),
  isRecursive: z
    .boolean()
    .default(false)
    .describe(
      "Recursively looks in folders for media files.",
    ),
  audioLanguages: z
    .array(languageSelectionSchema)
    .default([])
    .describe(
      "Language selections for audio tracks to keep. Each entry is a 3-letter ISO-639-2 code or an object with code + optional BCP 47 ietf tag. All others will be removed.",
    ),
  subtitlesLanguages: z
    .array(languageSelectionSchema)
    .default([])
    .describe(
      "Language selections for subtitles tracks to keep. Each entry is a 3-letter ISO-639-2 code or an object with code + optional BCP 47 ietf tag. All others will be removed.",
    ),
  useFirstAudioLanguage: z
    .boolean()
    .default(false)
    .describe(
      "The language of the first audio track is the only language kept for audio tracks.",
    ),
  useFirstSubtitlesLanguage: z
    .boolean()
    .default(false)
    .describe(
      "The language of the first subtitles track is the only language kept for subtitles tracks.",
    ),
})

export const addSubtitlesRequestSchema = z.object({
  sourcePath: z
    .string()
    .describe(
      "Directory with media files that need subtitles.",
    ),
  subtitlesPath: z
    .string()
    .describe(
      "Directory containing subdirectories with subtitle files and attachments/ that match the name of the media files in sourcePath.",
    ),
  hasChapterSyncOffset: z
    .boolean()
    .default(false)
    .describe(
      "Compute the audio sync offset by aligning chapter 1 between the destination media file's Menu track and a chapters.xml inside the subtitles path. Falls back to globalOffset (or per-file offsets) when no chapters.xml is found.",
    ),
  globalOffset: z
    .number()
    .default(0)
    .describe(
      "The offset in milliseconds to apply to all audio being transferred.",
    ),
  includeChapters: z
    .boolean()
    .default(false)
    .describe("Adds chapters along with other tracks."),
  offsets: z
    .array(z.number())
    .default([])
    .describe(
      "Offsets (milliseconds, one per episode). Provide one offset per source file. The order must match the order of episodes selected above. Negative values shift the subtitle earlier; positive values shift it later. This field is only useful for manual runs; sequences and schedules should rely on auto-aligned tracks.",
    ),
})

/** @deprecated Renamed to {@link addSubtitlesRequestSchema}. Kept as an alias so existing callers don't break. */
export const mergeTracksRequestSchema =
  addSubtitlesRequestSchema

export const nameAnimeEpisodesRequestSchema = z.object({
  sourcePath: z
    .string()
    .describe("Directory where all episodes are located."),
  searchTerm: z
    .string()
    .optional()
    .describe(
      "Name of the anime for searching MyAnimeList.com.",
    ),
  seasonNumber: z
    .number()
    .default(1)
    .describe(
      "The season number to output when renaming useful for TVDB which has separate season number. For aniDB, use the default value 1.",
    ),
  malId: z
    .number()
    .optional()
    .describe(
      "MyAnimeList ID — when provided, skips the interactive search and uses this ID directly.",
    ),
})

export const nameAnimeEpisodesAniDBRequestSchema = z
  .object({
    sourcePath: z
      .string()
      .describe(
        "Directory where all episodes are located.",
      ),
    searchTerm: z
      .string()
      .optional()
      .describe(
        "Anime name for searching AniDB (via DuckDuckGo).",
      ),
    seasonNumber: z
      .number()
      .default(1)
      .describe(
        "Season number for the output filename (Plex-style sNNeNN). Ignored when --episodeType=specials.",
      ),
    anidbId: z
      .number()
      .optional()
      .describe(
        "AniDB anime id (aid). When provided, skips the interactive search.",
      ),
    episodeType: z
      .enum([
        "regular",
        "specials",
        "credits",
        "trailers",
        "parodies",
        "others",
      ])
      .default("regular")
      .describe(
        "Which AniDB episode types to rename. Each non-regular sub-type is run separately: specials (S), credits (C, OP/ED), trailers (T), parodies (P) all run the length-matched per-file picker and emit Plex's s00eNN. Others (type=6 alts) and regular are index-paired with a duration sanity-check warning.",
      ),
    filenameRegex: z
      .string()
      .optional()
      .describe(
        'Regex with a named capture group (?<episodeNumber>…) used to pair each file to the AniDB episode whose number matches the captured value (e.g. "S\\\\d+E(?<episodeNumber>\\\\d+)"). Matched case-insensitively. Fixes mis-pairing on partial, non-contiguous, or out-of-order sets. Files that don\'t match fall back to index pairing (see startEpisodeNumber). Applies to the index-paired regular/others types only.',
      ),
    startEpisodeNumber: z
      .number()
      .optional()
      .describe(
        "First episode number when pairing a partial set by natural-sort index (e.g. 5 names the files s01e05, s01e06, …). Ignored for files matched by filenameRegex. Defaults to 1. Applies to the index-paired regular/others types only.",
      ),
    seriesName: z
      .string()
      .optional()
      .describe(
        "Overrides AniDB's auto-picked series title in output filenames and the seriesFolderName output. Used verbatim (backticks, apostrophes and all) — pick a candidate with the AniDB title-picker then character-clean it. When omitted, AniDB's title is used.",
      ),
  })
  .describe(
    'Rename anime episodes using AniDB metadata. Supports six episode-type categories (regular, specials, credits, trailers, parodies, others) via the episodeType field. Partial or non-contiguous sets can be paired by extracted episode number (filenameRegex) or by a natural-sort index offset (startEpisodeNumber). Emits a seriesFolderName output ("<name> [anidb-<id>]") for downstream copy/move steps.',
  )

export const fetchThemeMusicRequestSchema = z
  .object({
    sourcePath: z
      .string()
      .describe(
        "Anime library root, or one [anidb-#####] show folder.",
      ),
    isApplied: z
      .boolean()
      .default(false)
      .describe(
        "Write theme.mp3 files. The default only writes the review manifest.",
      ),
    isOverwrite: z
      .boolean()
      .default(true)
      .describe(
        "Replace an existing theme.mp3 only after AnimeThemes resolves a replacement.",
      ),
    manifestPath: z
      .string()
      .optional()
      .describe(
        "JSON manifest path. Defaults to theme-music-manifest.json in the source directory.",
      ),
  })
  .describe(
    "Resolve AniDB-tagged Anime folders through AnimeThemes. The default creates a manifest and does not change theme.mp3 files.",
  )

export const nameSpecialFeaturesDvdCompareTmdbRequestSchema =
  z.object({
    sourcePath: z
      .string()
      .describe(
        "Directory where special features are located.",
      ),
    url: z
      .string()
      .optional()
      .describe(
        "DVDCompare.net URL including the chosen release's hash tag.",
      ),
    dvdCompareId: z
      .number()
      .optional()
      .describe(
        "DVDCompare film ID — when provided, constructs URL directly and bypasses search.",
      ),
    dvdCompareReleaseHash: z
      .number()
      .default(1)
      .describe(
        "The hash (URL fragment #) from the DVDCompare release page denoting which release variant is selected for that film. Defaults to 1 (the first release option).",
      ),
    searchTerm: z
      .string()
      .optional()
      .describe(
        "Title to search on DVDCompare.net (used when no url or dvdCompareId).",
      ),
    fixedOffset: z
      .number()
      .default(0)
      .describe(
        "Timecodes are pushed positively or negatively by this amount (in seconds).",
      ),
    timecodePadding: z
      .number()
      .default(2)
      .describe(
        "Seconds that timecodes may be off. Defaults to 2, matching typical DVDCompare-vs-rip drift. Pass 0 for exact-match-only.",
      ),
    moveToEditionFolders: z
      .boolean()
      .default(false)
      .describe(
        "After renaming, move main-feature files that carry a {edition-…} tag into a nested folder: <sourceParent>/<Title (Year)>/<Title (Year) {edition-…}>/<file>. Special-feature files are not moved.",
      ),
    nonInteractive: z
      .boolean()
      .default(false)
      .describe(
        "When a rename target already exists on disk, automatically append (2), (3), … instead of emitting a review-needed collision event. Use this in scripts or when running without a UI that can display the collision prompt.",
      ),
    autoNameDuplicates: z
      .boolean()
      .default(false)
      .describe(
        "When two-or-more files match the same target name within a single run, auto-disambiguate them with (2)/(3)/… suffixes deterministically. Pass false to instead emit a duplicate-pick prompt for each ambiguous group. Defaults to false so interactive runs prompt the user.",
      ),
  })

// Non-movie variant of nameSpecialFeaturesDvdCompareTmdb. No TMDB lookup,
// no edition-folder organization — just timecode matching + Plex-suffix
// rename. Suited for concerts, documentaries, miniseries extras, and other
// workflows where TMDB has no entry or returns garbage matches.
// At least one of `dvdCompareId`, `url`, or `searchTerm` is required at
// runtime (enforced by the app-command's schema refinement). The API schema
// here keeps them all optional because the at-least-one constraint is a
// cross-field refinement that can't be expressed in JSON Schema / OpenAPI —
// it is enforced by the app-command before any I/O fires.
export const onlyNameSpecialFeaturesDvdCompareRequestSchema =
  z.object({
    sourcePath: z
      .string()
      .describe(
        "Directory containing special-features files.",
      ),
    dvdCompareId: z
      .number()
      .optional()
      .describe(
        "DVDCompare film ID — when provided, constructs URL directly and bypasses search.",
      ),
    dvdCompareReleaseHash: z
      .number()
      .default(1)
      .describe(
        "The hash (URL fragment #) from the DVDCompare release page denoting which release variant is selected for that film. Defaults to 1 (the first release option).",
      ),
    url: z
      .string()
      .optional()
      .describe(
        "DVDCompare.net URL including the chosen release's hash tag.",
      ),
    searchTerm: z
      .string()
      .optional()
      .describe(
        "Title to search on DVDCompare.net (used when no url or dvdCompareId).",
      ),
    timecodePadding: z
      .number()
      .default(2)
      .describe(
        "Seconds that timecodes may be off. Defaults to 2, matching typical DVDCompare-vs-rip drift. Pass 0 for exact-match-only.",
      ),
    fixedOffset: z
      .number()
      .default(0)
      .describe(
        "Timecodes are pushed positively or negatively by this amount (in seconds).",
      ),
    autoNameDuplicates: z
      .boolean()
      .default(false)
      .describe(
        "When two-or-more files match the same target name within a single run, auto-disambiguate them with (2)/(3)/… suffixes deterministically. Pass false to instead emit a duplicate-pick prompt for each ambiguous group. Defaults to false so interactive runs prompt the user.",
      ),
  })

// Movie-cuts sibling of nameSpecialFeaturesDvdCompareTmdb. Intentionally
// narrower — no special-features, no unnamed-file fallback, no duplicate
// or on-disk-collision flags. The default `timecodePadding` is 15 (the
// same floor `findMatchingCut` enforces internally) so the schema matches
// the runtime behavior at face value; the existing NSF command keeps a
// default of 2 because its extras matcher uses a tighter window.
export const nameMovieCutsDvdCompareTmdbRequestSchema =
  z.object({
    sourcePath: z
      .string()
      .describe(
        "Directory containing movie cut files (e.g. Movie.mkv, Movie.Directors.Cut.mkv).",
      ),
    url: z
      .string()
      .optional()
      .describe(
        "DVDCompare.net URL including the chosen release's hash tag.",
      ),
    dvdCompareId: z
      .number()
      .optional()
      .describe(
        "DVDCompare film ID — when provided, constructs URL directly and bypasses search.",
      ),
    dvdCompareReleaseHash: z
      .number()
      .default(1)
      .describe(
        "Release hash (URL fragment #) on the DVDCompare page. Defaults to 1 (the first release option).",
      ),
    searchTerm: z
      .string()
      .optional()
      .describe(
        "Title to search on DVDCompare.net (used when no url or dvdCompareId).",
      ),
    fixedOffset: z
      .number()
      .default(0)
      .describe(
        "Constant offset (in seconds) subtracted from each file's duration before matching.",
      ),
    timecodePadding: z
      .number()
      .default(15)
      .describe(
        "Seconds of slack when matching a file's duration against a cut's listed timecode. Defaults to 15 — the floor used by the cut matcher to accommodate typical rip-vs-DVDCompare drift on main features.",
      ),
  })

export const nameTvShowEpisodesRequestSchema = z.object({
  sourcePath: z
    .string()
    .describe(
      "Directory where all episodes for that season are located.",
    ),
  searchTerm: z
    .string()
    .optional()
    .describe(
      "Name of the TV show for searching TVDB.com.",
    ),
  seasonNumber: z
    .number()
    .default(1)
    .describe("The season number to lookup when renaming."),
  tvdbId: z
    .number()
    .optional()
    .describe(
      "TVDB ID — when provided, skips the interactive search and uses this ID directly.",
    ),
})

export const renameDemosRequestSchema = z.object({
  sourcePath: z
    .string()
    .describe("Directory where demo files are located."),
  isRecursive: z
    .boolean()
    .default(false)
    .describe(
      "Recursively looks in folders for media files.",
    ),
})

export const renameMovieClipDownloadsRequestSchema =
  z.object({
    sourcePath: z
      .string()
      .describe(
        "Directory where downloaded movie demos are located.",
      ),
  })

export const reorderTracksRequestSchema = z.object({
  sourcePath: z
    .string()
    .describe(
      "Directory with media files whose tracks need reordering.",
    ),
  isRecursive: z
    .boolean()
    .default(false)
    .describe(
      "Recursively looks in folders for media files.",
    ),
  videoTrackIndexes: z
    .array(z.number())
    .default([])
    .describe(
      "The order of all video tracks that will appear in the resulting file by their index. Indexes start at 0. If you leave out any track indexes, they will not appear in the resulting file.",
    ),
  audioTrackIndexes: z
    .array(z.number())
    .default([])
    .describe(
      "The order of all audio tracks that will appear in the resulting file by their index. Indexes start at 0. If you leave out any track indexes, they will not appear in the resulting file.",
    ),
  subtitlesTrackIndexes: z
    .array(z.number())
    .default([])
    .describe(
      "The order of all subtitles tracks that will appear in the resulting file by their index. Indexes start at 0. If you leave out any track indexes, they will not appear in the resulting file.",
    ),
  isSkipOnTrackMisalignment: z
    .boolean()
    .default(false)
    .describe(
      "When enabled, files whose track count does not match the supplied indexes are skipped with a warning instead of causing an error. Tracks should align if the command was added correctly.",
    ),
})

export const replaceAttachmentsRequestSchema = z.object({
  sourcePath: z
    .string()
    .describe(
      "Directory with media files with attachments you want to copy.",
    ),
  destinationFilesPath: z
    .string()
    .describe(
      "Directory containing media files with attachments you want replaced.",
    ),
})

export const replaceFlacWithPcmAudioRequestSchema =
  z.object({
    sourcePath: z
      .string()
      .describe(
        "Directory containing media files or containing other directories of media files.",
      ),
    isRecursive: z
      .boolean()
      .default(false)
      .describe(
        "Recursively looks in folders for media files.",
      ),
  })

export const replaceTracksRequestSchema = z.object({
  sourcePath: z
    .string()
    .describe(
      "Directory with media files with tracks you want to copy.",
    ),
  destinationFilesPath: z
    .string()
    .describe(
      "Directory containing media files with tracks you want replaced.",
    ),
  hasAudioSyncOffset: z
    .boolean()
    .default(false)
    .describe(
      "Per-file automatic audio sync: extract both source and destination audio to WAV via ffmpeg and run audio-offset-finder to compute the delay, then use that per-file offset when remuxing. Falls back to globalOffset (or per-file offsets) when disabled.",
    ),
  globalOffset: z
    .number()
    .default(0)
    .describe(
      "The offset in milliseconds to apply to all audio being transferred.",
    ),
  includeChapters: z
    .boolean()
    .default(false)
    .describe("Adds chapters along with other tracks."),
  isOverwritingExtractedAudio: z
    .boolean()
    .default(false)
    .describe(
      "Force re-extraction of the source/destination WAV files used for per-file audio-sync offset detection. Only applies when hasAudioSyncOffset is true. When false (default), an existing WAV whose mediaInfo duration matches its input within 1 second is reused so ffmpeg doesn't re-decode the audio on every run.",
    ),
  audioLanguages: z
    .array(languageSelectionSchema)
    .default([])
    .describe(
      "Language selections for audio tracks to keep. Each entry is a 3-letter ISO-639-2 code or an object with code + optional BCP 47 ietf tag. All others will be removed.",
    ),
  subtitlesLanguages: z
    .array(languageSelectionSchema)
    .default([])
    .describe(
      "Language selections for subtitles tracks to keep. Each entry is a 3-letter ISO-639-2 code or an object with code + optional BCP 47 ietf tag. All others will be removed.",
    ),
  videoLanguages: z
    .array(languageSelectionSchema)
    .default([])
    .describe(
      "Language selections for video tracks to keep. Each entry is a 3-letter ISO-639-2 code or an object with code + optional BCP 47 ietf tag. All others will be removed.",
    ),
  offsets: z
    .array(z.number())
    .default([])
    .describe(
      "Space-separated list of time-alignment offsets to set for each individual file in milliseconds.",
    ),
})

export const setDisplayWidthRequestSchema = z.object({
  sourcePath: z
    .string()
    .describe("Directory where video files are located."),
  isRecursive: z
    .boolean()
    .default(false)
    .describe(
      "Recursively looks in folders for media files.",
    ),
  recursiveDepth: z
    .number()
    .default(0)
    .describe(
      "How many levels of child directories to follow when using isRecursive (0 = use default depth of 1).",
    ),
  displayWidth: z
    .number()
    .default(853)
    .describe(
      "Display width of the video file. For DVDs, they're all 3:2, but you can set them to the proper 4:3 or 16:9 aspect ratio with anamorphic (non-square) pixels using this value.",
    ),
})

export const splitChaptersRequestSchema = z.object({
  sourcePath: z
    .string()
    .describe("Directory where video files are located."),
  chapterSplits: z
    .array(z.string())
    .describe(
      "Space-separated list of comma-separated chapter markers. Splits occur at the beginning of the chapter.",
    ),
  isRenumberingChapters: z
    .boolean()
    .default(true)
    .describe(
      "Renumber each split file's `Chapter NN` names so they start at 1 (default true). A split part inherits the play-all file's numbering, so part 2 opens on `Chapter 04` without this. Parts with custom chapter names (`Opening`, `Eyecatch`) are left alone.",
    ),
  isPaddingChapterNumbers: z
    .boolean()
    .default(true)
    .describe(
      "Zero-pad the renumbered chapter names (default true) — produces `Chapter 01..N` (width ≥ 2). Set false for `Chapter 1..N`. Ignored when chapter renumbering is off.",
    ),
})

export const splitCueSheetRequestSchema = z.object({
  sourcePath: z
    .string()
    .describe(
      "Music library root containing albums with CUE sheets.",
    ),
  isRecursive: z
    .boolean()
    .default(true)
    .describe(
      "Recursively descend into subdirectories looking for CUE files. Default true.",
    ),
  outputFolderName: z
    .string()
    .default("CUE-SPLITS")
    .describe(
      "Folder name created under sourcePath that holds all per-album subfolders.",
    ),
})

export const storeAspectRatioDataRequestSchema = z.object({
  sourcePath: z
    .string()
    .describe(
      "Directory containing media files or containing other directories of media files.",
    ),
  isRecursive: z
    .boolean()
    .default(true)
    .describe(
      "Recursively look in folders for media files. Defaults to true since Plex-style libraries are nested (Movies/<title>/<file>); pass --no-isRecursive to scan only sourcePath.",
    ),
  recursiveDepth: z
    .number()
    .default(3)
    .describe(
      "How many directory levels deep to scan, counting sourcePath as level 1. Default 3 covers Plex's edition layout (e.g. Movies/Soldier (1998)/Soldier (1998) {edition-Director's Cut}/file.mkv — 4 segments long, 3 levels of descent from Movies). Non-editioned Movies/<title>/<file> only needs 2, but over-recursing is safer than missing files. Only used with --isRecursive.",
    ),
  outputPath: z
    .string()
    .optional()
    .describe(
      "Location of the resulting JSON file. If using append mode, it will search here for the JSON file. By default, this uses the sourcePath.",
    ),
  rootPath: z
    .string()
    .optional()
    .describe(
      "Path your media player (Plex, Jellyfin, Emby) sees for your library — written into the output JSON's file paths so the player can match its catalog. The path does not have to exist on this machine and is not validated; in many setups it won't (e.g. Plex sees /media/Movies but you're scanning G:\\Movies — pass /media/Movies here). Path separator is auto-converted to match the format you provide.",
    ),
  folders: z
    .array(z.string())
    .default([])
    .describe(
      "List of folder names relative to the sourcePath that you want to look through. If you're searching a root path with lots of media files, but only some are in Plex, this can reduce the list down to only those provided to Plex. Ensure these folder names match the ones in Plex.",
    ),
  force: z
    .boolean()
    .default(false)
    .describe(
      "Instead of appending the current JSON file, it will rescan every file.",
    ),
})

export const getSubtitleMetadataRequestSchema = z.object({
  sourcePath: z
    .string()
    .describe(
      "Directory containing .ass subtitle files to inspect.",
    ),
  isRecursive: z
    .boolean()
    .default(false)
    .describe(
      "Recursively search subdirectories for .ass files.",
    ),
  recursiveDepth: z
    .number()
    .default(0)
    .describe(
      "Maximum recursion depth when --isRecursive is set (0 = default depth of 1).",
    ),
})

export const subtitleFileMetadataSchema = z.object({
  filePath: z
    .string()
    .describe("Absolute path to the .ass file"),
  scriptInfo: z
    .record(z.string(), z.string())
    .describe(
      "Key-value properties from the [Script Info] section (e.g. PlayResX, PlayResY, YCbCr Matrix, ScriptType, LayoutResX, LayoutResY)",
    ),
  styles: z
    .array(z.record(z.string(), z.string()))
    .describe(
      "Style entries from [V4+ Styles], each as a map of ASS field name to value (e.g. Name, Alignment, MarginL, MarginR, MarginV, Fontsize). Events are excluded.",
    ),
})

export const getSubtitleMetadataResponseSchema = z.object({
  subtitlesMetadata: z
    .array(subtitleFileMetadataSchema)
    .describe("Metadata for each .ass file found"),
})

// Design-time lookup query schemas
export const searchTermRequestSchema = z.object({
  searchTerm: z.string().describe("Title to search for"),
})

export const searchMalResultSchema = z.object({
  airDate: z
    .string()
    .optional()
    .describe("Air date string from MAL"),
  imageUrl: z.string().optional().describe("Thumbnail URL"),
  malId: z.number().describe("MyAnimeList ID"),
  mediaType: z
    .string()
    .optional()
    .describe("Media type (TV, Movie, OVA, etc.)"),
  name: z.string().describe("Anime title"),
})

export const searchMalResponseSchema = z.object({
  results: z
    .array(searchMalResultSchema)
    .describe("MAL search results"),
  error: z
    .string()
    .nullable()
    .optional()
    .describe(
      "Error message if the search failed (e.g. network/server error). When present, results is empty.",
    ),
})

export const searchAnidbResultSchema = z.object({
  aid: z.number().describe("AniDB anime id"),
  name: z
    .string()
    .describe(
      "Display title (English-preferred via manami synonyms heuristic, falling back to romaji title)",
    ),
  nameJapanese: z
    .string()
    .optional()
    .describe(
      "Romaji title — surfaced as a subtitle in the picker when the primary name is an English synonym",
    ),
  type: z
    .string()
    .optional()
    .describe(
      "Format type: TV, MOVIE, OVA, ONA, SPECIAL, etc.",
    ),
  episodes: z
    .number()
    .optional()
    .describe("Total episode count"),
  year: z
    .string()
    .optional()
    .describe(
      "Release year (4-digit, sourced from manami's animeSeason.year)",
    ),
})

export const searchAnidbResponseSchema = z.object({
  results: z
    .array(searchAnidbResultSchema)
    .describe(
      "AniDB search results (sourced from manami-project dataset)",
    ),
  error: z
    .string()
    .nullable()
    .optional()
    .describe(
      "Error message if the search failed. When present, results is empty.",
    ),
})

export const searchTvdbResultSchema = z.object({
  imageUrl: z
    .string()
    .optional()
    .describe("Series image URL"),
  name: z.string().describe("Series name"),
  status: z
    .string()
    .optional()
    .describe("Status (e.g. Continuing, Ended)"),
  tvdbId: z.number().describe("TVDB ID"),
  year: z.string().optional().describe("Year of first air"),
})

export const searchTvdbResponseSchema = z.object({
  results: z
    .array(searchTvdbResultSchema)
    .describe("TVDB search results"),
  error: z
    .string()
    .nullable()
    .optional()
    .describe(
      "Error message if the search failed (e.g. network/server error). When present, results is empty.",
    ),
})

export const searchMovieDbRequestSchema = z.object({
  searchTerm: z.string().describe("Title to search for"),
  year: z
    .string()
    .optional()
    .describe(
      "Release year to narrow results (4-digit yyyy). Disambiguates same-titled films across eras.",
    ),
})

export const searchMovieDbResultSchema = z.object({
  imageUrl: z
    .string()
    .optional()
    .describe("Poster image URL"),
  movieDbId: z.number().describe("TMDB movie ID"),
  overview: z
    .string()
    .optional()
    .describe("Plot summary, when TMDB has one on file"),
  title: z.string().describe("Movie title"),
  year: z
    .string()
    .describe(
      "Release year (4-digit yyyy, or empty when TMDB has no release date)",
    ),
})

export const searchMovieDbResponseSchema = z.object({
  results: z
    .array(searchMovieDbResultSchema)
    .describe("TMDB search results"),
  error: z
    .string()
    .nullable()
    .optional()
    .describe(
      "Error message if the search failed (e.g. network/server error). When present, results is empty.",
    ),
})

export const searchMusicBrainzReleaseResultSchema =
  z.object({
    artistName: z
      .string()
      .describe("The release artist credit"),
    country: z
      .string()
      .optional()
      .describe("The release country code"),
    format: z
      .string()
      .optional()
      .describe("The media formats on this release"),
    label: z
      .string()
      .optional()
      .describe("The release label"),
    releaseId: z
      .string()
      .describe("MusicBrainz release UUID"),
    releaseTitle: z.string().describe("Album title"),
    trackCount: z.number().describe("Total track count"),
    year: z.string().optional().describe("Release year"),
  })

export const searchMusicBrainzReleaseResponseSchema =
  z.object({
    results: z
      .array(searchMusicBrainzReleaseResultSchema)
      .describe("MusicBrainz release search results"),
    error: z
      .string()
      .nullable()
      .optional()
      .describe(
        "Error message if the search failed. When present, results is empty.",
      ),
  })

export const searchDvdCompareResultSchema = z.object({
  baseTitle: z
    .string()
    .describe("Movie title without variant or year suffix"),
  id: z.number().describe("DVDCompare film ID"),
  variant: z
    .enum(["DVD", "Blu-ray", "Blu-ray 4K"])
    .describe("Media format variant"),
  year: z.string().describe("Release year"),
})

export const searchDvdCompareResponseSchema = z.object({
  isDirectListing: z
    .boolean()
    .optional()
    .describe(
      "True when DVDCompare's search redirected straight to a film page instead of returning a list of candidates. When true the single entry in results was auto-selected — callers should skip the movie-picker step and prompt for a Release Hash directly.",
    ),
  results: z
    .array(searchDvdCompareResultSchema)
    .describe("DVDCompare search results"),
  error: z
    .string()
    .nullable()
    .optional()
    .describe(
      "Error message if the search failed (e.g. network/server error). When present, results is empty.",
    ),
})

export const listDvdCompareReleasesRequestSchema = z.object(
  {
    dvdCompareId: z.number().describe("DVDCompare film ID"),
  },
)

export const dvdCompareReleaseSchema = z.object({
  hash: z
    .string()
    .describe(
      "Release package URL hash (form checkbox name attribute)",
    ),
  label: z.string().describe("Release package description"),
})

export const dvdCompareReleasesDebugSchema = z.object({
  checkboxCount: z
    .number()
    .describe(
      'Total <input type="checkbox"> elements on the fetched page (regardless of name attribute)',
    ),
  htmlLength: z
    .number()
    .describe("Byte length of the response body"),
  httpStatus: z
    .number()
    .describe("HTTP status of the page fetch"),
  pageTitle: z
    .string()
    .describe("Text content of the <title> tag"),
  snippet: z
    .string()
    .describe(
      "Up to 800 chars of HTML around the release form (or the start of the page)",
    ),
  url: z.string().describe("URL we fetched"),
})

export const listDvdCompareReleasesResponseSchema =
  z.object({
    debug: dvdCompareReleasesDebugSchema
      .optional()
      .describe(
        "Diagnostic info for empty-result debugging",
      ),
    releases: z
      .array(dvdCompareReleaseSchema)
      .describe("Release packages available for the film"),
    error: z
      .string()
      .nullable()
      .optional()
      .describe(
        "Error message if the fetch failed (e.g. network/server error). When present, releases is empty.",
      ),
  })

// Reverse-lookup schemas (manual ID edit → name)
export const lookupMalRequestSchema = z.object({
  malId: z.number().describe("MyAnimeList ID"),
})

export const lookupAnidbRequestSchema = z.object({
  anidbId: z.number().describe("AniDB anime id (aid)"),
})

export const lookupTvdbRequestSchema = z.object({
  tvdbId: z.number().describe("TVDB ID"),
})

export const lookupDvdCompareRequestSchema = z.object({
  dvdCompareId: z.number().describe("DVDCompare film ID"),
})

export const lookupMovieDbRequestSchema = z.object({
  movieDbId: z.number().describe("TMDB movie ID"),
})

export const lookupDvdCompareReleaseRequestSchema =
  z.object({
    dvdCompareId: z.number().describe("DVDCompare film ID"),
    hash: z.string().describe("Release package hash"),
  })

export const nameLookupResponseSchema = z.object({
  name: z
    .string()
    .nullable()
    .describe("Display name, or null if not found"),
})

export const anidbTitleSchema = z.object({
  lang: z
    .string()
    .describe("Language tag (e.g. en, x-jat, ja)"),
  type: z
    .string()
    .describe(
      "AniDB title type (main, official, synonym, short)",
    ),
  value: z
    .string()
    .describe("The title text, verbatim from AniDB"),
})

export const lookupAnidbTitlesResponseSchema = z.object({
  titles: z
    .array(anidbTitleSchema)
    .describe(
      "Candidate titles for the anime (AniDB's synthetic (aXXXXX) reference form filtered out).",
    ),
  error: z
    .string()
    .nullable()
    .describe(
      "Error message if the fetch failed; titles is empty when present.",
    ),
})

export const labelLookupResponseSchema = z.object({
  label: z
    .string()
    .nullable()
    .describe("Release label, or null if not found"),
})

// Path-field typeahead
export const listDirectoryEntriesRequestSchema = z.object({
  path: z
    .string()
    .describe(
      "Directory path to list. If the path is a file, the parent directory is listed instead.",
    ),
})

export const directoryEntrySchema = z.object({
  isDirectory: z
    .boolean()
    .describe("True if this entry is a directory"),
  name: z
    .string()
    .describe("Basename of the entry (no path prefix)"),
})

export const listDirectoryEntriesResponseSchema = z.object({
  entries: z
    .array(directoryEntrySchema)
    .describe("Entries in the directory"),
  separator: z
    .string()
    .describe(
      "OS-native path separator ('\\\\' on Windows, '/' on Linux/macOS). Use this when joining new path segments client-side.",
    ),
  error: z
    .string()
    .nullable()
    .optional()
    .describe(
      "Error message if the listing failed (e.g. missing path, permission denied). When present, entries is empty.",
    ),
})

// File-explorer modal — default path, listing, delete-mode, bulk delete
export const defaultPathResponseSchema = z.object({
  path: z
    .string()
    .describe(
      "Absolute path the file-explorer should open at when the calling field is empty (currently the OS user's home directory).",
    ),
})

export const listFilesRequestSchema = z.object({
  path: z
    .string()
    .describe(
      "Absolute directory path to list. Must be absolute and traversal-free.",
    ),
  includeDuration: z
    .string()
    .optional()
    .describe(
      "Pass '1' / 'true' to compute video runtime per file via mediainfo. Adds ~50-200ms per file (concurrent up to 8). Off by default.",
    ),
})

export const fileExplorerEntrySchema = z.object({
  name: z.string().describe("Basename of the entry"),
  isFile: z
    .boolean()
    .describe(
      "True for regular files (not directories or symlinks)",
    ),
  isDirectory: z.boolean().describe("True for directories"),
  size: z
    .number()
    .describe("File size in bytes; 0 for directories"),
  mtime: z
    .string()
    .nullable()
    .describe(
      "Last-modified ISO timestamp; null when the per-entry stat() failed",
    ),
  duration: z
    .string()
    .nullable()
    .describe(
      "Video runtime as 'M:SS' / 'H:MM:SS' (DVDCompare format). null when not requested, not a video extension, or mediainfo failed.",
    ),
})

export const listFilesResponseSchema = z.object({
  entries: z
    .array(fileExplorerEntrySchema)
    .describe(
      "Entries in the directory, sorted directories-first then alphabetically",
    ),
  separator: z
    .string()
    .describe("OS-native path separator"),
  error: z
    .string()
    .nullable()
    .describe(
      "Error message when the listing failed; null on success",
    ),
})

export const deleteModeRequestSchema = z.object({
  path: z
    .string()
    .optional()
    .describe(
      "Optional folder path. When supplied, the response reflects the EFFECTIVE mode for that path — e.g. 'trash' downgrades to 'permanent' on Windows network drives where the Recycle Bin can't service the file. Without a path, the response carries the global DELETE_MODE setting.",
    ),
})

export const deleteModeResponseSchema = z.object({
  mode: z
    .enum(["trash", "permanent"])
    .describe(
      "'trash' = files go to the OS Recycle Bin (default). 'permanent' = files are unlinked outright. Controlled via the DELETE_MODE env var; downgraded automatically for Windows network drives.",
    ),
  reason: z
    .string()
    .nullable()
    .describe(
      "Explains why mode is 'permanent' when the global setting is 'trash' — typically network-drive detection. Null when mode matches the global setting.",
    ),
})

export const deleteFilesRequestSchema = z.object({
  paths: z
    .array(z.string())
    .min(1)
    .describe(
      "Absolute paths to delete. Each is independently validated for absolute-path / no-traversal safety.",
    ),
})

export const deleteFilesResultSchema = z.object({
  path: z
    .string()
    .describe("The path the API attempted to delete"),
  isOk: z
    .boolean()
    .describe("True when the delete succeeded"),
  mode: z
    .enum(["trash", "permanent"])
    .describe(
      "Strategy actually used for this path — may be 'permanent' even when the global setting is 'trash' (network-drive paths)",
    ),
  error: z
    .string()
    .nullable()
    .describe("Error message on failure; null on success"),
})

export const deleteFilesResponseSchema = z.object({
  results: z
    .array(deleteFilesResultSchema)
    .describe(
      "Per-path outcome — partial successes are surfaced rather than rolled back",
    ),
})

export const openExternalRequestSchema = z.object({
  path: z
    .string()
    .describe(
      "Absolute path to hand off to the OS shell. The default application for the file's extension opens it (VLC for .mkv, Preview for .pdf, etc.).",
    ),
})

export const openExternalResponseSchema = z.object({
  isOk: z
    .boolean()
    .describe(
      "True when the launcher process spawned. The launcher is detached/unref'd so this only reports the spawn — actual app launch may still fail asynchronously.",
    ),
  error: z
    .string()
    .nullable()
    .describe(
      "Error message when validation or spawn failed; null on success",
    ),
})

// Phase B — interactive renaming used by the nameSpecialFeaturesDvdCompareTmdb result
// card. Both paths are validated against pathSafety (absolute + no
// traversal). The endpoint reuses the existing renameFileOrFolder helper
// which already aborts when the destination already exists, so the API
// can't silently clobber a file. The validated newPath is echoed back
// so the UI can replace the row in-place without a refetch.
export const renameFileRequestSchema = z.object({
  oldPath: z
    .string()
    .describe(
      "Absolute path to the file currently on disk.",
    ),
  newPath: z
    .string()
    .describe(
      "Absolute destination path the file should be renamed to. Must already not exist on disk — the underlying helper aborts to avoid silent overwrites.",
    ),
})

export const renameFileResponseSchema = z.object({
  isOk: z
    .boolean()
    .describe(
      "True when the rename completed successfully.",
    ),
  newPath: z
    .string()
    .nullable()
    .describe(
      "The validated/normalized new absolute path on success; null on failure.",
    ),
  error: z
    .string()
    .nullable()
    .describe(
      "Error message on failure (path validation, target-already-exists, missing source, etc.); null on success.",
    ),
})

export const audioCodecRequestSchema = z.object({
  path: z
    .string()
    .describe(
      "Absolute path to a media file. Must be absolute and traversal-free.",
    ),
})

export const audioCodecResponseSchema = z.object({
  audioFormat: z
    .string()
    .nullable()
    .describe(
      "Raw mediainfo `Format` value of the first audio track (e.g. 'AC-3', 'DTS', 'AAC', 'MLP FBA', 'E-AC-3', 'Opus'). null when the file has no audio track or mediainfo failed.",
    ),
  error: z
    .string()
    .nullable()
    .describe(
      "Error message when validation or mediainfo failed; null on success.",
    ),
})

// ─── Music tagging ────────────────────────────────────────────────────────
//
// The Picard/MP3Tag replacement. `docs/music-tagging-plan.md` §5 is the
// command list and `docs/picard-parity.md` is the behaviour specification.
//
// Three commands here take the same folder-walk pair (`isRecursive` +
// `recursiveDepth`) as the rest of the app, so a music step chains off a
// copy or a move exactly like a video one.

const musicSourcePathSchema = z
  .string()
  .describe(
    "Folder to walk. Only audio files are read — .flac, .mp3, .m4a, .ogg, .opus, .wav, .aiff, .wv, .ape and .mka.",
  )

const musicIsRecursiveSchema = z
  .boolean()
  .default(false)
  .describe(
    "Walk child folders as well. An album usually lives in one folder, so this is off by default; turn it on to point a run at a whole inbox of albums at once.",
  )

const musicRecursiveDepthSchema = z
  .number()
  .default(1)
  .describe(
    "How many folder levels below the source to walk when `isRecursive` is on. 1 covers the normal `Inbox/<Album>/` layout.",
  )

export const scanAudioFilesRequestSchema = z.object({
  isRecursive: musicIsRecursiveSchema,
  recursiveDepth: musicRecursiveDepthSchema,
  sourcePath: musicSourcePathSchema,
})

export const findDuplicateAudioFilesRequestSchema =
  z.object({
    comparisonPath: z
      .string()
      .optional()
      .describe(
        "Optional library or other tree to compare with the source. Only duplicate groups that include a source file are reported.",
      ),
    comparisonRecursiveDepth: z
      .number()
      .default(3)
      .describe(
        "How many folder levels below the comparison path to scan. Three covers the normal Artist/Album/track library layout.",
      ),
    isFingerprintCompared: z
      .boolean()
      .default(false)
      .describe(
        "Also fingerprint every file so a FLAC and an MP3 of the same recording pair up. They can never hash-match, because the encoders produce different samples. Costs a two-minute decode per file.",
      ),
    isRecursive: musicIsRecursiveSchema,
    recursiveDepth: musicRecursiveDepthSchema,
    sourcePath: musicSourcePathSchema,
  })

export const compareMusicAssistantLibraryRequestSchema =
  z.object({
    isRecursive: musicIsRecursiveSchema,
    recursiveDepth: musicRecursiveDepthSchema,
    sourcePath: musicSourcePathSchema,
  })

export const fingerprintAudioFilesRequestSchema = z.object({
  isRecursive: musicIsRecursiveSchema,
  minimumScore: z
    .number()
    .default(0.5)
    .describe(
      "Lowest AcoustID score that counts as the same recording. Below about 0.5 AcoustID is reporting similar audio rather than the same audio — a different take, a different mix, or a cover.",
    ),
  recordingLimit: z
    .number()
    .default(5)
    .describe(
      "How many MusicBrainz recordings to offer per file. A well-known song accumulates dozens of linked recordings, and past the first few they are compilation re-issues of the same one.",
    ),
  recursiveDepth: musicRecursiveDepthSchema,
  sourcePath: musicSourcePathSchema,
})

export const matchMusicBrainzReleaseRequestSchema =
  z.object({
    candidateFetchLimit: z
      .number()
      .default(5)
      .describe(
        "How many ranked releases are fetched in full and offered per row. MusicBrainz allows one request per second, so each extra candidate costs about a second per album. Five covers the usual wrong-country or wrong-year correction.",
      ),
    isRecursive: musicIsRecursiveSchema,
    releaseId: z
      .string()
      .optional()
      .describe(
        "A selected MusicBrainz release UUID. When set, the matcher reads this release directly instead of searching by the current tags.",
      ),
    recursiveDepth: musicRecursiveDepthSchema,
    sourcePath: musicSourcePathSchema,
  })

export const matchMusicReleaseRequestSchema = z.object({
  isRecursive: musicIsRecursiveSchema,
  language: z
    .enum(["default", "en", "ja", "ja-Latn"])
    .default("default")
    .describe(
      "Which title language to ask VGMdb for. MusicBrainz and freedb ignore this field.",
    ),
  recursiveDepth: musicRecursiveDepthSchema,
  sourcePath: musicSourcePathSchema,
})

export const matchDiscogsReleaseRequestSchema = z.object({
  candidateFetchLimit: z
    .number()
    .default(5)
    .describe(
      "How many ranked Discogs releases are read in full and offered per row. Anonymous Discogs access permits 25 requests per minute, so each extra candidate costs about two and a half seconds.",
    ),
  isRecursive: musicIsRecursiveSchema,
  recursiveDepth: musicRecursiveDepthSchema,
  sourcePath: musicSourcePathSchema,
})

// The tag fields a bulk edit can set. Deliberately flat rather than a
// nested `tags` object: the builder renders one input per field, and a
// nested object would be an unusable blob in the step form and in the YAML.
export const matchFreedbReleaseRequestSchema = z.object({
  candidateLimit: z
    .number()
    .default(4)
    .describe(
      "How many matched freedb discs to read in full and offer per row.",
    ),
  isRecursive: musicIsRecursiveSchema,
  recursiveDepth: musicRecursiveDepthSchema,
  sourcePath: musicSourcePathSchema,
})

export const matchVgmdbReleaseRequestSchema = z.object({
  candidateLimit: z
    .number()
    .default(4)
    .describe(
      "How many matched VGMdb albums to read in full and offer per row. The common case is the same album released in three regions, which two or three settles.",
    ),
  isRecursive: musicIsRecursiveSchema,
  language: z
    .enum(["default", "en", "ja", "ja-Latn"])
    .default("default")
    .describe(
      "Which title language to ask VGMdb for. It reverts to the default when an album carries no title in the language you asked for, so two settings can return the same text.",
    ),
  recursiveDepth: musicRecursiveDepthSchema,
  sourcePath: musicSourcePathSchema,
  vgmdbAlbumId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "A VGMdb album ID from an album URL. When set, the matcher keeps only the disc whose canonical VGMdb URL has this ID.",
    ),
})

export const writeAudioTagsRequestSchema = z.object({
  album: z
    .string()
    .optional()
    .describe(
      "Album title to set on every matched file. Leave empty to keep whatever each file already has.",
    ),
  albumArtist: z
    .string()
    .optional()
    .describe(
      "Album artist to set on every matched file. This is the field that decides the library folder, so it is the most common bulk edit.",
    ),
  artist: z
    .string()
    .optional()
    .describe(
      "Track artist to set on every matched file. On a compilation this differs per track, so set it here only when every file really does share one artist.",
    ),
  comment: z
    .string()
    .optional()
    .describe("Comment to set on every matched file."),
  composer: z
    .string()
    .optional()
    .describe("Composer to set on every matched file."),
  date: z
    .string()
    .optional()
    .describe(
      "Release date to set on every matched file. MusicBrainz style is `YYYY-MM-DD`, and a bare `YYYY` is accepted.",
    ),
  genres: z
    .array(z.string())
    .optional()
    .describe(
      "Genres to set on every matched file. Multi-value: the tag holds each entry separately, never one joined string.",
    ),
  isDryRun: z
    .boolean()
    .default(false)
    .describe(
      "Report which files would change, and which fields, without writing anything. Run this first — the report is the same shape as the real run.",
    ),
  isRecursive: musicIsRecursiveSchema,
  isTimestampPreserved: z
    .boolean()
    .default(true)
    .describe(
      "Restore each file's modified time after writing. On by default so a re-tag does not make every album look new to the library scanner.",
    ),
  recursiveDepth: musicRecursiveDepthSchema,
  sourcePath: musicSourcePathSchema,
  totalDiscs: z
    .number()
    .optional()
    .describe(
      "Total disc count to set on every matched file.",
    ),
})

export const renameAndMoveAudioFilesRequestSchema =
  z.object({
    isDryRun: z
      .boolean()
      .default(false)
      .describe(
        "Report the planned moves without touching a file. Run this first: the destination comes from each file's own tags, so a wrong tag becomes a wrong folder.",
      ),
    isOverwriteAllowed: z
      .boolean()
      .default(false)
      .describe(
        "Allow a move to replace an existing file at the destination. Off by default — a clash is reported and the file is left alone.",
      ),
    isRecursive: musicIsRecursiveSchema,
    libraryRoot: z
      .string()
      .describe(
        "Root of the destination library tree. The naming script builds every folder below it, so this is the only path the command is given.",
      ),
    namingScript: z
      .string()
      .optional()
      .describe(
        "Picard naming script to use instead of the default. The default is the owner's own script, verified byte-identical across two machines and eight years — override it only for a one-off.",
      ),
    recursiveDepth: musicRecursiveDepthSchema,
    sourcePath: musicSourcePathSchema,
  })

export const renameFilesAndFoldersRequestSchema = z.object({
  isDryRun: z
    .boolean()
    .default(false)
    .describe(
      "Report the planned renames without touching anything.",
    ),
  isRenamingFiles: z
    .boolean()
    .default(true)
    .describe("Apply the rename to files."),
  isRenamingFolders: z
    .boolean()
    .default(true)
    .describe(
      "Apply the rename to folders. Folders rename deepest-first so a parent rename cannot invalidate a child that has not been renamed yet.",
    ),
  nameFilterRegex: z
    .union([
      z.string(),
      z.object({
        pattern: z.string(),
        flags: z.string().optional(),
      }),
    ])
    .optional()
    .describe(
      "Only rename entries whose name matches this pattern. Omit to consider every entry.",
    ),
  recursiveDepth: z
    .number()
    .default(0)
    .describe(
      "How many folder levels below the source to walk. 0 renames only the direct children of the source folder.",
    ),
  renameRegex: z
    .union([
      z.object({
        pattern: z.string(),
        replacement: z.string(),
        flags: z.string().optional(),
        sample: z.string().optional(),
      }),
      z.array(
        z.object({
          pattern: z.string(),
          replacement: z.string(),
          flags: z.string().optional(),
          sample: z.string().optional(),
        }),
      ),
    ])
    .describe(
      "The rename itself: a pattern and its replacement, or an ordered list applied left to right. The extension is part of the name a file rule sees.",
    ),
  sourcePath: z
    .string()
    .describe(
      "Folder whose contents are renamed. The folder itself is never renamed.",
    ),
})

// The reviewed, per-file tag write behind the tag table's Apply button.
// One row, one request — so a per-row failure stays a per-row failure.
export const musicTagWriteRequestSchema = z.object({
  filePath: z
    .string()
    .describe(
      "Absolute path of the audio file to write. Must be absolute and traversal-free.",
    ),
  isDryRun: z
    .boolean()
    .default(false)
    .describe(
      "Report which fields would change without writing the file.",
    ),
  isTimestampPreserved: z
    .boolean()
    .default(true)
    .describe(
      "Restore the file's modified time after writing.",
    ),
  tags: z
    .object({
      album: z.string().optional(),
      albumArtist: z.string().optional(),
      artist: z.string().optional(),
      comment: z.string().optional(),
      composer: z.string().optional(),
      date: z.string().optional(),
      discNumber: z.number().optional(),
      genres: z.array(z.string()).optional(),
      isCompilation: z.boolean().optional(),
      musicBrainzAlbumArtistId: z.string().optional(),
      musicBrainzArtistId: z.string().optional(),
      musicBrainzRecordingId: z.string().optional(),
      musicBrainzReleaseGroupId: z.string().optional(),
      musicBrainzReleaseId: z.string().optional(),
      title: z.string().optional(),
      totalDiscs: z.number().optional(),
      totalTracks: z.number().optional(),
      trackNumber: z.number().optional(),
    })
    .describe(
      "The tag set to write. Only the fields present are compared and written; an absent field means leave whatever the file already has.",
    ),
})

export const musicTagWriteResponseSchema = z.object({
  changedFields: z
    .array(z.string())
    .describe(
      "Names of the fields that changed, or would change under `isDryRun`. Empty when the file already carried these values.",
    ),
  error: z
    .string()
    .nullable()
    .describe(
      "Why the write failed; null on success. The tag table renders this on the row.",
    ),
  isOk: z
    .boolean()
    .describe(
      "Whether the write succeeded. The tag table marks the row from this field.",
    ),
})

// The duplicate compare table's confirm action. It MOVES a redundant copy
// to a holding folder and never deletes it — the music library lives on a
// share with no Recycle Bin, where a delete is effectively permanent
// inside the hour and the only safety net is the hourly ZFS snapshot.
export const musicDuplicateResolveRequestSchema = z.object({
  filePath: z
    .string()
    .describe(
      "Absolute path of the redundant copy to move out of the library. Must be absolute and traversal-free.",
    ),
  holdingFolderPath: z
    .string()
    .describe(
      "Absolute path of the folder the copy is moved into. The copy's folder structure below the source root is recreated there, so two files with the same name never collide.",
    ),
  isDryRun: z
    .boolean()
    .default(false)
    .describe(
      "Report where the copy would go without moving it.",
    ),
  sourceRootPath: z
    .string()
    .describe(
      "The folder the duplicate scan walked. Used to work out the copy's path relative to the library so the holding folder mirrors it.",
    ),
})

export const musicDuplicateResolveResponseSchema = z.object(
  {
    destination: z
      .string()
      .nullable()
      .describe(
        "Where the copy was moved, or would be moved under `isDryRun`. Null when the move failed.",
      ),
    error: z
      .string()
      .nullable()
      .describe(
        "Why the move failed; null on success. The compare table renders this on the row.",
      ),
    isOk: z
      .boolean()
      .describe(
        "Whether the move succeeded. The compare table marks the row from this field.",
      ),
  },
)

// Phase 9 — writing back. Every one of these is an explicit, reviewed
// action. Nothing submits automatically: these are public database
// entries made under the owner's account, and a wrong one is visible to
// everybody and has to be undone by hand.
export const musicAcoustIdSubmitRequestSchema = z.object({
  isDryRun: z
    .boolean()
    .default(false)
    .describe(
      "Report what would be submitted without sending anything to AcoustID.",
    ),
  submissions: z
    .array(
      z.object({
        albumArtistName: z.string().optional(),
        albumName: z.string().optional(),
        artistName: z.string().optional(),
        durationSeconds: z
          .number()
          .describe(
            "Track length in seconds. AcoustID rounds it to a whole number and rejects a fractional one.",
          ),
        fingerprint: z
          .string()
          .describe(
            "The Chromaprint fingerprint from `fpcalc`, as produced by the fingerprintAudioFiles command.",
          ),
        musicBrainzRecordingId: z
          .string()
          .optional()
          .describe(
            "The recording this fingerprint belongs to. Without it the submission adds a fingerprint that is linked to nothing, which helps nobody.",
          ),
        title: z.string().optional(),
        trackNumber: z.number().optional(),
        year: z.number().optional(),
      }),
    )
    .describe(
      "The reviewed submissions. The whole batch goes in one request; AcoustID indexes each entry by position.",
    ),
})

export const musicAcoustIdSubmitResponseSchema = z.object({
  error: z
    .string()
    .nullable()
    .describe(
      "Why the submission failed; null on success.",
    ),
  isOk: z
    .boolean()
    .describe("Whether AcoustID accepted the batch."),
  submissions: z
    .array(
      z.object({
        status: z
          .string()
          .describe(
            "AcoustID's own status for the entry, normally `pending` — it queues submissions rather than applying them at once.",
          ),
        submissionId: z.number(),
      }),
    )
    .describe(
      "One entry per accepted submission, empty on failure or a dry run.",
    ),
})

// The half of writing back that is NOT an API. MusicBrainz cannot create
// a release over the web service, so a missing album is added through a
// seeded web form the owner completes in his own browser, logged in as
// himself.
export const musicSeedReleaseRequestSchema = z.object({
  albumArtistName: z.string(),
  artistMbid: z
    .string()
    .optional()
    .describe(
      "MusicBrainz artist id to link the credit to. Without it the release is created with an unlinked artist name.",
    ),
  countryCode: z
    .string()
    .optional()
    .describe(
      "Release country. Defaults to XW (Worldwide), which suits a digital release.",
    ),
  date: z
    .string()
    .optional()
    .describe("Release date, `YYYY-MM-DD` or `YYYY`."),
  editNote: z.string().optional(),
  label: z.string().optional(),
  mediumFormat: z.string().optional(),
  primaryType: z.string().optional(),
  releaseTitle: z.string(),
  secondaryTypes: z.array(z.string()).optional(),
  tracks: z
    .array(
      z.object({
        lengthMilliseconds: z
          .number()
          .describe(
            "Exact track length. The release editor wants milliseconds, and an approximate length is the most common reason a seeded release needs hand correction.",
          ),
        title: z.string(),
        trackNumber: z.number(),
      }),
    )
    .describe("The tracklist, in order."),
  url: z
    .string()
    .optional()
    .describe(
      "A relationship URL, normally the album's purchase page.",
    ),
})
