import { z } from "@hono/zod-openapi"

import { iso6392LanguageCodes } from "../tools/iso6392LanguageCodes.js"

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

export const renameRegexSchema = z
  .object({
    pattern: z
      .string()
      .describe(
        "Regular expression pattern applied to each filename (or folder name).",
      ),
    replacement: z
      .string()
      .describe(
        "Replacement string. Capture groups from `pattern` are available as $1, $2, etc.",
      ),
  })
  .describe(
    "Regex-based rename applied to each entry's name. For copy/move commands the result is the destination filename; for renameFiles it replaces the on-disk name in place.",
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
  fileFilterRegex: z
    .string()
    .optional()
    .describe(
      "If set, only files whose names match this regular expression are copied.",
    ),
  folderFilterRegex: z
    .string()
    .optional()
    .describe(
      "If set (and includeFolders is true), only folders whose names match this regular expression are copied.",
    ),
  includeFolders: z
    .boolean()
    .default(false)
    .describe(
      "When true, top-level subdirectories matching folderFilterRegex are copied as units (recursively). Files are only copied if fileFilterRegex is also set.",
    ),
  renameRegex: renameRegexSchema.optional(),
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
  fileFilterRegex: z
    .string()
    .optional()
    .describe(
      "If set, only files whose names match this regular expression are moved.",
    ),
  renameRegex: renameRegexSchema.optional(),
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
  fileFilterRegex: z
    .string()
    .optional()
    .describe(
      "If set, only files whose names match this regular expression are renamed.",
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
  subtitlesLanguage: z
    .enum(iso6392LanguageCodes)
    .optional()
    .describe(
      "A 3-letter ISO-6392 language code for subtitles tracks to keep. All others will be removed.",
    ),
  folders: z
    .array(z.string())
    .optional()
    .describe(
      "Folder names to extract subtitles into. Each extracted subtitle file is placed inside the named sub-folder relative to the source file location. Leave empty to use the default output folder.",
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
  audioLanguage: z
    .enum(iso6392LanguageCodes)
    .optional()
    .describe(
      "A 3-letter ISO-6392 language code for audio tracks. All tracks will be labeled with this language.",
    ),
  subtitlesLanguage: z
    .enum(iso6392LanguageCodes)
    .optional()
    .describe(
      "A 3-letter ISO-6392 language code for subtitles tracks. All tracks will be labeled with this language.",
    ),
  videoLanguage: z
    .enum(iso6392LanguageCodes)
    .optional()
    .describe(
      "A 3-letter ISO-6392 language code for video tracks. All tracks will be labeled with this language.",
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
    .array(z.enum(iso6392LanguageCodes))
    .default([])
    .describe(
      "A 3-letter ISO-6392 language code for audio tracks to keep. All others will be removed.",
    ),
  subtitlesLanguages: z
    .array(z.enum(iso6392LanguageCodes))
    .default([])
    .describe(
      "A 3-letter ISO-6392 language code for subtitles tracks to keep. All others will be removed.",
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
  })
  .describe(
    "Rename anime episodes using AniDB metadata. Supports six episode-type categories (regular, specials, credits, trailers, parodies, others) via the episodeType field. Episode-range selection is planned — see README §AniDB command notes.",
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
      .optional()
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
      .optional()
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
  hasChapterSyncOffset: z
    .boolean()
    .default(false)
    .describe(
      "Compute the audio sync offset by aligning chapter 1 between the destination media file's Menu track and a chapters.xml inside the source files path. Falls back to globalOffset (or per-file offsets) when false or when no chapters.xml is found.",
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
  audioLanguages: z
    .array(z.enum(iso6392LanguageCodes))
    .default([])
    .describe(
      "A 3-letter ISO-6392 language code for audio tracks to keep. All others will be removed.",
    ),
  subtitlesLanguages: z
    .array(z.enum(iso6392LanguageCodes))
    .default([])
    .describe(
      "A 3-letter ISO-6392 language code for subtitles tracks to keep. All others will be removed.",
    ),
  videoLanguages: z
    .array(z.enum(iso6392LanguageCodes))
    .default([])
    .describe(
      "A 3-letter ISO-6392 language code for video tracks to keep. All others will be removed.",
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
      "Optional folder path. When supplied, the response reflects the EFFECTIVE mode for that path — e.g. 'trash' downgrades to 'permanent' on Windows network drives where the Recycle Bin can't service the file. Without a path, the response carries the global DELETE_TO_TRASH setting.",
    ),
})

export const deleteModeResponseSchema = z.object({
  mode: z
    .enum(["trash", "permanent"])
    .describe(
      "'trash' = files go to the OS Recycle Bin (default). 'permanent' = files are unlinked outright. Controlled via the DELETE_TO_TRASH env var; downgraded automatically for Windows network drives.",
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
