import { z } from "@hono/zod-openapi"

import { iso6392LanguageCodes } from "../tools/iso6392LanguageCodes.js"

// Shared response schemas
export const createJobResponseSchema = (
  outputFolderNameSchema: z.ZodTypeAny = z.null(),
) => (
  z.object({
    jobId: z.string().openapi({ example: "123e4567-e89b-12d3-a456-426614174000" }).describe("Unique job identifier"),
    logsUrl: z.string().openapi({ example: "/jobs/123e4567-e89b-12d3-a456-426614174000/logs" }).describe("URL to stream job logs via SSE"),
    outputFolderName: outputFolderNameSchema.describe("Output folder name where files are written, or null for in-place operations"),
  })
)

export const validationErrorSchema = z.object({
  error: z.string().describe("Error message"),
}).openapi("ValidationError")

export const JOB_NOT_FOUND = "Job not found" as const
export const jobNotFoundSchema = z.object({
  error: z.literal(JOB_NOT_FOUND).describe("Job not found error"),
}).openapi("JobNotFound")

// Command request schemas
export const makeDirectoryRequestSchema = z.object({
  filePath: z.string().describe("Directory path to create, or a file path whose parent directory should be created"),
})

export const copyFilesRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path"),
  destinationPath: z.string().describe("Destination directory path"),
})

export const flattenOutputRequestSchema = z.object({
  sourcePath: z.string().describe("Output folder produced by a previous step (e.g. /work/SUBTITLED). Its contents are copied up one level, overwriting same-named originals."),
  deleteSourceFolder: z.boolean().default(false).describe("If true, delete sourcePath after copying. Default false: source is preserved so you can inspect intermediate state during a long sequence; clean up later with deleteFolder."),
})

export const moveFilesRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path"),
  destinationPath: z.string().describe("Destination directory path"),
})

export const extractSubtitlesRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path"),
  isRecursive: z.boolean().default(false).describe("Search recursively in subdirectories"),
  subtitlesLanguage: z.enum(iso6392LanguageCodes).optional().describe("Filter subtitles by language"),
})

/** @deprecated Renamed to {@link extractSubtitlesRequestSchema}. Kept as an alias so existing callers don't break. */
export const copyOutSubtitlesRequestSchema = extractSubtitlesRequestSchema

export const getAudioOffsetsRequestSchema = z.object({
  sourceFilesPath: z.string().describe("Path to source audio files"),
  destinationFilesPath: z.string().describe("Path to destination audio files"),
})

export const changeTrackLanguagesRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path"),
  isRecursive: z.boolean().default(false).describe("Search recursively in subdirectories"),
  audioLanguage: z.enum(iso6392LanguageCodes).optional().describe("Audio track language code"),
  subtitlesLanguage: z.enum(iso6392LanguageCodes).optional().describe("Subtitle track language code"),
  videoLanguage: z.enum(iso6392LanguageCodes).optional().describe("Video track language code"),
})

export const fixIncorrectDefaultTracksRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path"),
  isRecursive: z.boolean().default(false).describe("Search recursively in subdirectories"),
})

export const hasBetterAudioRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path"),
  isRecursive: z.boolean().default(false).describe("Search recursively in subdirectories"),
  recursiveDepth: z.number().default(0).describe("Maximum recursion depth"),
})

export const hasBetterVersionRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path"),
  isRecursive: z.boolean().default(false).describe("Search recursively in subdirectories"),
  recursiveDepth: z.number().default(0).describe("Maximum recursion depth"),
})

export const hasDuplicateMusicFilesRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path"),
  isRecursive: z.boolean().default(false).describe("Search recursively in subdirectories"),
  recursiveDepth: z.number().default(0).describe("Maximum recursion depth"),
})

export const hasImaxEnhancedAudioRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path"),
  isRecursive: z.boolean().default(false).describe("Search recursively in subdirectories"),
})

export const hasManyAudioTracksRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path"),
  isRecursive: z.boolean().default(false).describe("Search recursively in subdirectories"),
})

export const hasSurroundSoundRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path"),
  isRecursive: z.boolean().default(false).describe("Search recursively in subdirectories"),
  recursiveDepth: z.number().default(0).describe("Maximum recursion depth"),
})

export const hasWrongDefaultTrackRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path"),
  isRecursive: z.boolean().default(false).describe("Search recursively in subdirectories"),
})

export const isMissingSubtitlesRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path"),
  isRecursive: z.boolean().default(false).describe("Search recursively in subdirectories"),
})

export const deleteFilesByExtensionRequestSchema = z.object({
  sourcePath: z.string().describe("Directory path to search for files to delete"),
  isRecursive: z.boolean().default(false).describe("Search recursively in subdirectories"),
  recursiveDepth: z.number().default(0).describe("Maximum recursion depth (0 = default depth of 2)"),
  extensions: z.array(z.string()).min(1).describe("List of file extensions to delete (with or without leading dot), e.g. ['.srt', 'idx']").openapi({ example: [".srt", "idx"] }),
})

export const deleteFolderRequestSchema = z.object({
  folderPath: z.string().describe("Folder path to delete recursively"),
  confirm: z.literal(true).describe("Required safety guard: must be the literal value true. Without it the request is rejected so a misclick can't nuke a directory."),
})

export const computeDefaultSubtitleRulesRequestSchema = z.object({
  sourcePath: z.string().describe("Directory containing .ass subtitle files."),
  isRecursive: z.boolean().default(false).describe("Recursively scan subdirectories."),
  recursiveDepth: z.number().default(0).describe("Maximum recursion depth (0 = default depth of 2)."),
})

export const remuxToMkvRequestSchema = z.object({
  sourcePath: z.string().describe("Directory containing files to remux."),
  extensions: z.array(z.string()).min(1).describe("List of file extensions to remux (with or without leading dot), e.g. ['.ts', '.m2ts']").openapi({ example: [".ts"] }),
  isRecursive: z.boolean().default(false).describe("Recursively scan subdirectories."),
  recursiveDepth: z.number().default(0).describe("Maximum recursion depth when isRecursive is set (0 = default depth of 2)."),
  isSourceDeletedOnSuccess: z.boolean().default(false).describe("Delete each source file after its remux completes successfully."),
})

const setScriptInfoRuleSchema = z.object({
  type: z.literal("setScriptInfo"),
  key: z.string()
    .describe("Key name in the [Script Info] section of the ASS file (e.g. 'YCbCr Matrix', 'ScriptType', 'PlayResX'). The key is matched case-sensitively. If the key does not already exist it is appended after the last existing property."),
  value: z.string()
    .describe("New value to assign to the key (e.g. 'TV.709', 'v4.00+', '1920')."),
}).openapi({
  description: "Sets or adds a single key-value pair in the [Script Info] section of an ASS subtitle file. Use this to correct metadata fields such as YCbCr Matrix, ScriptType, or resolution values.",
})

const scaleResolutionRuleSchema = z.object({
  type: z.literal("scaleResolution"),
  from: z.object({
    width: z.number().describe("Expected current PlayResX value in the file. The rule is skipped if the file does not match this width."),
    height: z.number().describe("Expected current PlayResY value in the file. The rule is skipped if the file does not match this height."),
  }).optional().describe("Optional guard: if provided and the file's current PlayResX/Y do not match, the rule is skipped entirely. Omit to apply unconditionally regardless of current resolution.").openapi({ example: { width: 640, height: 480 } }),
  to: z.object({
    width: z.number().describe("Target PlayResX value to write (e.g. 1920)."),
    height: z.number().describe("Target PlayResY value to write (e.g. 1080)."),
  }).describe("The resolution to scale the file to.").openapi({ example: { width: 1920, height: 1080 } }),
  hasLayoutRes: z.boolean().default(false).describe("When true, creates LayoutResX and LayoutResY even if they are not already present. Only takes effect when isLayoutResSynced is also true. Defaults to false."),
  hasScaledBorderAndShadow: z.boolean().default(true).describe("When true, sets 'ScaledBorderAndShadow: yes' in [Script Info] after scaling, which ensures borders and shadows scale proportionally at the new resolution. Defaults to true."),
  isLayoutResSynced: z.boolean().default(true).describe("When true, updates LayoutResX and LayoutResY if they already exist in the file. Keys that are absent are left alone unless hasLayoutRes is also true. Defaults to true."),
}).openapi({
  description: "Updates PlayResX/PlayResY in the [Script Info] section to rescale the subtitle canvas. 'from' is an optional guard — if provided and the file's current resolution does not match, the rule is skipped; omit to apply unconditionally. isLayoutResSynced updates LayoutResX/Y only if they already exist; pair it with hasLayoutRes:true to also create them when absent.",
})

const setStyleFieldsRuleSchema = z.object({
  type: z.literal("setStyleFields"),
  fields: z.record(z.string(), z.string())
  .describe("Map of ASS style field names to their new string values. Field names must use the exact ASS column names from the Format line (e.g. 'MarginL', 'MarginR', 'MarginV', 'Fontsize', 'PrimaryColour'). Only the listed fields are changed; all other style fields are left untouched."),
  ignoredStyleNamesRegexString: z.string().optional()
    .describe("Optional case-insensitive regular expression matched against each style's Name field. Styles whose name matches are left unchanged. Use this to protect sign/song styles from being overwritten — e.g. 'signs?|op|ed|opening|ending'."),
}).openapi({
  description: "Overwrites specific fields on every style entry in the [V4+ Styles] section of an ASS file. Optionally skips styles whose Name matches a regex (e.g. sign or song styles). Use this to bulk-update margins, font sizes, or colors across all dialogue styles.",
})

export const assModificationRuleSchema = z.discriminatedUnion("type", [
  setScriptInfoRuleSchema,
  scaleResolutionRuleSchema,
  setStyleFieldsRuleSchema,
])

export const modifySubtitleMetadataRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path containing .ass files"),
  isRecursive: z.boolean().default(false).describe("Search recursively in subdirectories"),
  recursiveDepth: z.number().default(0).describe("Maximum recursion depth (0 = default depth of 2)"),
  rules: z.preprocess(
    (value) => {
      if (typeof value === "string") {
        try {
          return JSON.parse(value)
        }
        catch {
          return value
        }
      }

      return value
    },
    z.array(assModificationRuleSchema),
  ).describe("Ordered list of DSL modification rules to apply to each .ass file"),
})

export const keepLanguagesRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path"),
  isRecursive: z.boolean().default(false).describe("Search recursively in subdirectories"),
  audioLanguages: z.array(z.enum(iso6392LanguageCodes)).default([]).describe("Audio languages to keep"),
  subtitlesLanguages: z.array(z.enum(iso6392LanguageCodes)).default([]).describe("Subtitle languages to keep"),
  useFirstAudioLanguage: z.boolean().default(false).describe("Keep first audio language only"),
  useFirstSubtitlesLanguage: z.boolean().default(false).describe("Keep first subtitle language only"),
})

export const mergeTracksRequestSchema = z.object({
  mediaFilesPath: z.string().describe("Path to media files"),
  subtitlesPath: z.string().describe("Path to subtitle files"),
  hasChapterSyncOffset: z.boolean().default(false).describe("Compute the audio sync offset by aligning chapter 1 between the destination media file's Menu track and a `chapters.xml` inside `subtitlesPath`. Use when the source release the subtitles came from and your destination differ in intro padding — the chapter-1 timestamp diff is shipped to mkvmerge as `--sync -1:<ms>`. Falls back to `globalOffset` (or per-file `offsets[index]`) when false or when no `chapters.xml` is found."),
  globalOffset: z.number().default(0).describe("Global audio offset in milliseconds"),
  includeChapters: z.boolean().default(false).describe("Include chapter markers"),
  offsets: z.array(z.number()).default([]).describe("Per-file audio offsets in milliseconds"),
})

export const nameAnimeEpisodesRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path"),
  searchTerm: z.string().optional().describe("Anime title to search for (CLI fallback when no malId)"),
  seasonNumber: z.number().default(1).describe("Season number"),
  malId: z.number().optional().describe("MyAnimeList ID — when provided, skips the interactive search and uses this ID directly"),
})

export const nameAnimeEpisodesAniDBRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path"),
  searchTerm: z.string().optional().describe("Anime title to search for via the manami-project anime-offline-database (used when no anidbId is provided; CLI falls back to interactive picker)"),
  seasonNumber: z.number().default(1).describe("Season number for the Plex-style sNNeNN output filename. Ignored when episodeType is \"specials\" (Plex's specials live in season 0)."),
  anidbId: z.number().optional().describe("AniDB anime id (aid) — when provided, skips the search and uses this aid directly"),
  episodeType: z.enum(["regular", "specials", "credits", "trailers", "parodies", "others"]).default("regular").describe("Which AniDB episode types to rename. Each non-regular sub-type is its own category so users can run them separately:\n  - \"regular\"  type=1 — index-paired with a duration sanity-check warning when files and AniDB episodes diverge by >2m.\n  - \"specials\" type=2 (S) — length-matched per-file picker, Plex s00eNN.\n  - \"credits\"  type=3 (C, OP/ED) — length-matched per-file picker, Plex s00eNN.\n  - \"trailers\" type=4 (T) — length-matched per-file picker, Plex s00eNN.\n  - \"parodies\" type=5 (P) — length-matched per-file picker, Plex s00eNN.\n  - \"others\"   type=6 (O, director's-cut alts) — index-paired like regular."),
}).describe("Rename anime episodes using AniDB metadata. Supports six episode-type categories (regular, specials, credits, trailers, parodies, others) via the episodeType field. Episode-range selection is planned — see README §AniDB command notes.")

export const nameSpecialFeaturesRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path"),
  url: z.string().optional().describe("Direct DVDCompare.net URL (overrides dvdCompareId and searchTerm)"),
  dvdCompareId: z.number().optional().describe("DVDCompare film ID — constructs URL directly, bypasses search"),
  dvdCompareReleaseHash: z.number().optional().describe("Release package hash (URL fragment, defaults to 1)"),
  searchTerm: z.string().optional().describe("Title to search on DVDCompare.net (used when no url or dvdCompareId)"),
  fixedOffset: z.number().default(0).describe("Fixed timecode offset in milliseconds"),
  timecodePadding: z.number().default(2).describe("Timecode padding amount (in seconds) — DVDCompare runtimes routinely drift 1–2s from rip metadata, so 2 matches typical real-world cases. Set to 0 for an exact-match-only run."),
})

export const nameTvShowEpisodesRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path"),
  searchTerm: z.string().optional().describe("TV show title to search for (CLI fallback when no tvdbId)"),
  seasonNumber: z.number().default(1).describe("Season number"),
  tvdbId: z.number().optional().describe("TVDB ID — when provided, skips the interactive search and uses this ID directly"),
})

export const renameDemosRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path"),
  isRecursive: z.boolean().default(false).describe("Search recursively in subdirectories"),
})

export const renameMovieClipDownloadsRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path"),
})

export const reorderTracksRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path"),
  isRecursive: z.boolean().default(false).describe("Search recursively in subdirectories"),
  videoTrackIndexes: z.array(z.number()).default([]).describe("Video track order indices"),
  audioTrackIndexes: z.array(z.number()).default([]).describe("Audio track order indices"),
  subtitlesTrackIndexes: z.array(z.number()).default([]).describe("Subtitle track order indices"),
})

export const replaceAttachmentsRequestSchema = z.object({
  sourceFilesPath: z.string().describe("Path to source files with attachments"),
  destinationFilesPath: z.string().describe("Path to destination files"),
})

export const replaceFlacWithPcmAudioRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path"),
  isRecursive: z.boolean().default(false).describe("Search recursively in subdirectories"),
})

export const replaceTracksRequestSchema = z.object({
  sourceFilesPath: z.string().describe("Path to source files"),
  destinationFilesPath: z.string().describe("Path to destination files"),
  hasChapterSyncOffset: z.boolean().default(false).describe("Compute the audio sync offset by aligning chapter 1 between the destination media file's Menu track and a `chapters.xml` inside `sourceFilesPath`. Use when source and destination releases differ in intro padding — the chapter-1 timestamp diff is shipped to mkvmerge as `--sync -1:<ms>`. Falls back to `globalOffset` (or per-file `offsets[index]`) when false or when no `chapters.xml` is found."),
  globalOffset: z.number().default(0).describe("Global audio offset in milliseconds"),
  includeChapters: z.boolean().default(false).describe("Include chapter markers"),
  audioLanguages: z.array(z.enum(iso6392LanguageCodes)).default([]).describe("Audio languages to include"),
  subtitlesLanguages: z.array(z.enum(iso6392LanguageCodes)).default([]).describe("Subtitle languages to include"),
  videoLanguages: z.array(z.enum(iso6392LanguageCodes)).default([]).describe("Video languages to include"),
  offsets: z.array(z.number()).default([]).describe("Per-file audio offsets in milliseconds"),
})

export const setDisplayWidthRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path"),
  isRecursive: z.boolean().default(false).describe("Search recursively in subdirectories"),
  recursiveDepth: z.number().default(0).describe("Maximum recursion depth"),
  displayWidth: z.number().default(853).describe("Display width in pixels"),
})

export const splitChaptersRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path"),
  chapterSplits: z.array(z.string()).describe("Chapter split definitions"),
})

export const storeAspectRatioDataRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path"),
  isRecursive: z.boolean().default(false).describe("Search recursively in subdirectories"),
  recursiveDepth: z.number().default(0).describe("Maximum recursion depth"),
  outputPath: z.string().optional().describe("Output path for aspect ratio data"),
  rootPath: z.string().optional().describe("Root path for relative paths"),
  folders: z.array(z.string()).default([]).describe("Specific folders to process"),
  force: z.boolean().default(false).describe("Force overwrite existing data"),
})

export const getSubtitleMetadataRequestSchema = z.object({
  sourcePath: z.string().describe("Directory containing .ass subtitle files to inspect"),
  isRecursive: z.boolean().default(false).describe("Search recursively in subdirectories"),
  recursiveDepth: z.number().default(0).describe("Maximum recursion depth (0 = default depth of 2)"),
})

export const subtitleFileMetadataSchema = z.object({
  filePath: z.string().describe("Absolute path to the .ass file"),
  scriptInfo: z.record(z.string(), z.string()).describe("Key-value properties from the [Script Info] section (e.g. PlayResX, PlayResY, YCbCr Matrix, ScriptType, LayoutResX, LayoutResY)"),
  styles: z.array(z.record(z.string(), z.string())).describe("Style entries from [V4+ Styles], each as a map of ASS field name to value (e.g. Name, Alignment, MarginL, MarginR, MarginV, Fontsize). Events are excluded."),
})

export const getSubtitleMetadataResponseSchema = z.object({
  subtitlesMetadata: z.array(subtitleFileMetadataSchema).describe("Metadata for each .ass file found"),
})

// Design-time lookup query schemas
export const searchTermRequestSchema = z.object({
  searchTerm: z.string().describe("Title to search for"),
})

export const searchMalResultSchema = z.object({
  airDate: z.string().optional().describe("Air date string from MAL"),
  imageUrl: z.string().optional().describe("Thumbnail URL"),
  malId: z.number().describe("MyAnimeList ID"),
  mediaType: z.string().optional().describe("Media type (TV, Movie, OVA, etc.)"),
  name: z.string().describe("Anime title"),
})

export const searchMalResponseSchema = z.object({
  results: z.array(searchMalResultSchema).describe("MAL search results"),
  error: z.string().nullable().optional().describe("Error message if the search failed (e.g. network/server error). When present, results is empty."),
})

export const searchAnidbResultSchema = z.object({
  aid: z.number().describe("AniDB anime id"),
  name: z.string().describe("Primary title from manami-project dataset"),
  type: z.string().optional().describe("Format type: TV, MOVIE, OVA, ONA, SPECIAL, etc."),
  episodes: z.number().optional().describe("Total episode count"),
})

export const searchAnidbResponseSchema = z.object({
  results: z.array(searchAnidbResultSchema).describe("AniDB search results (sourced from manami-project dataset)"),
  error: z.string().nullable().optional().describe("Error message if the search failed. When present, results is empty."),
})

export const searchTvdbResultSchema = z.object({
  imageUrl: z.string().optional().describe("Series image URL"),
  name: z.string().describe("Series name"),
  status: z.string().optional().describe("Status (e.g. Continuing, Ended)"),
  tvdbId: z.number().describe("TVDB ID"),
  year: z.string().optional().describe("Year of first air"),
})

export const searchTvdbResponseSchema = z.object({
  results: z.array(searchTvdbResultSchema).describe("TVDB search results"),
  error: z.string().nullable().optional().describe("Error message if the search failed (e.g. network/server error). When present, results is empty."),
})

export const searchMovieDbRequestSchema = z.object({
  searchTerm: z.string().describe("Title to search for"),
  year: z.string().optional().describe("Release year to narrow results (4-digit yyyy). Disambiguates same-titled films across eras."),
})

export const searchMovieDbResultSchema = z.object({
  imageUrl: z.string().optional().describe("Poster image URL"),
  movieDbId: z.number().describe("TMDB movie ID"),
  overview: z.string().optional().describe("Plot summary, when TMDB has one on file"),
  title: z.string().describe("Movie title"),
  year: z.string().describe("Release year (4-digit yyyy, or empty when TMDB has no release date)"),
})

export const searchMovieDbResponseSchema = z.object({
  results: z.array(searchMovieDbResultSchema).describe("TMDB search results"),
  error: z.string().nullable().optional().describe("Error message if the search failed (e.g. network/server error). When present, results is empty."),
})

export const searchDvdCompareResultSchema = z.object({
  baseTitle: z.string().describe("Movie title without variant or year suffix"),
  id: z.number().describe("DVDCompare film ID"),
  variant: z.enum(["DVD", "Blu-ray", "Blu-ray 4K"]).describe("Media format variant"),
  year: z.string().describe("Release year"),
})

export const searchDvdCompareResponseSchema = z.object({
  results: z.array(searchDvdCompareResultSchema).describe("DVDCompare search results"),
  error: z.string().nullable().optional().describe("Error message if the search failed (e.g. network/server error). When present, results is empty."),
})

export const listDvdCompareReleasesRequestSchema = z.object({
  dvdCompareId: z.number().describe("DVDCompare film ID"),
})

export const dvdCompareReleaseSchema = z.object({
  hash: z.string().describe("Release package URL hash (form checkbox name attribute)"),
  label: z.string().describe("Release package description"),
})

export const dvdCompareReleasesDebugSchema = z.object({
  checkboxCount: z.number().describe("Total <input type=\"checkbox\"> elements on the fetched page (regardless of name attribute)"),
  htmlLength: z.number().describe("Byte length of the response body"),
  httpStatus: z.number().describe("HTTP status of the page fetch"),
  pageTitle: z.string().describe("Text content of the <title> tag"),
  snippet: z.string().describe("Up to 800 chars of HTML around the release form (or the start of the page)"),
  url: z.string().describe("URL we fetched"),
})

export const listDvdCompareReleasesResponseSchema = z.object({
  debug: dvdCompareReleasesDebugSchema.optional().describe("Diagnostic info for empty-result debugging"),
  releases: z.array(dvdCompareReleaseSchema).describe("Release packages available for the film"),
  error: z.string().nullable().optional().describe("Error message if the fetch failed (e.g. network/server error). When present, releases is empty."),
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

export const lookupDvdCompareReleaseRequestSchema = z.object({
  dvdCompareId: z.number().describe("DVDCompare film ID"),
  hash: z.string().describe("Release package hash"),
})

export const nameLookupResponseSchema = z.object({
  name: z.string().nullable().describe("Display name, or null if not found"),
})

export const labelLookupResponseSchema = z.object({
  label: z.string().nullable().describe("Release label, or null if not found"),
})

// Path-field typeahead
export const listDirectoryEntriesRequestSchema = z.object({
  path: z.string().describe("Directory path to list. If the path is a file, the parent directory is listed instead."),
})

export const directoryEntrySchema = z.object({
  isDirectory: z.boolean().describe("True if this entry is a directory"),
  name: z.string().describe("Basename of the entry (no path prefix)"),
})

export const listDirectoryEntriesResponseSchema = z.object({
  entries: z.array(directoryEntrySchema).describe("Entries in the directory"),
  separator: z.string().describe("OS-native path separator ('\\\\' on Windows, '/' on Linux/macOS). Use this when joining new path segments client-side."),
  error: z.string().nullable().optional().describe("Error message if the listing failed (e.g. missing path, permission denied). When present, entries is empty."),
})

// File-explorer modal — default path, listing, delete-mode, bulk delete
export const defaultPathResponseSchema = z.object({
  path: z.string().describe("Absolute path the file-explorer should open at when the calling field is empty (currently the OS user's home directory)."),
})

export const listFilesRequestSchema = z.object({
  path: z.string().describe("Absolute directory path to list. Must be absolute and traversal-free."),
  includeDuration: z.string().optional().describe("Pass '1' / 'true' to compute video runtime per file via mediainfo. Adds ~50-200ms per file (concurrent up to 8). Off by default."),
})

export const fileExplorerEntrySchema = z.object({
  name: z.string().describe("Basename of the entry"),
  isFile: z.boolean().describe("True for regular files (not directories or symlinks)"),
  isDirectory: z.boolean().describe("True for directories"),
  size: z.number().describe("File size in bytes; 0 for directories"),
  mtime: z.string().nullable().describe("Last-modified ISO timestamp; null when the per-entry stat() failed"),
  duration: z.string().nullable().describe("Video runtime as 'M:SS' / 'H:MM:SS' (DVDCompare format). null when not requested, not a video extension, or mediainfo failed."),
})

export const listFilesResponseSchema = z.object({
  entries: z.array(fileExplorerEntrySchema).describe("Entries in the directory, sorted directories-first then alphabetically"),
  separator: z.string().describe("OS-native path separator"),
  error: z.string().nullable().describe("Error message when the listing failed; null on success"),
})

export const deleteModeRequestSchema = z.object({
  path: z.string().optional().describe("Optional folder path. When supplied, the response reflects the EFFECTIVE mode for that path — e.g. 'trash' downgrades to 'permanent' on Windows network drives where the Recycle Bin can't service the file. Without a path, the response carries the global DELETE_TO_TRASH setting."),
})

export const deleteModeResponseSchema = z.object({
  mode: z.enum(["trash", "permanent"]).describe("'trash' = files go to the OS Recycle Bin (default). 'permanent' = files are unlinked outright. Controlled via the DELETE_TO_TRASH env var; downgraded automatically for Windows network drives."),
  reason: z.string().nullable().describe("Explains why mode is 'permanent' when the global setting is 'trash' — typically network-drive detection. Null when mode matches the global setting."),
})

export const deleteFilesRequestSchema = z.object({
  paths: z.array(z.string()).min(1).describe("Absolute paths to delete. Each is independently validated for absolute-path / no-traversal safety."),
})

export const deleteFilesResultSchema = z.object({
  path: z.string().describe("The path the API attempted to delete"),
  ok: z.boolean().describe("True when the delete succeeded"),
  mode: z.enum(["trash", "permanent"]).describe("Strategy actually used for this path — may be 'permanent' even when the global setting is 'trash' (network-drive paths)"),
  error: z.string().nullable().describe("Error message on failure; null on success"),
})

export const deleteFilesResponseSchema = z.object({
  results: z.array(deleteFilesResultSchema).describe("Per-path outcome — partial successes are surfaced rather than rolled back"),
})

export const openExternalRequestSchema = z.object({
  path: z.string().describe("Absolute path to hand off to the OS shell. The default application for the file's extension opens it (VLC for .mkv, Preview for .pdf, etc.)."),
})

export const openExternalResponseSchema = z.object({
  ok: z.boolean().describe("True when the launcher process spawned. The launcher is detached/unref'd so this only reports the spawn — actual app launch may still fail asynchronously."),
  error: z.string().nullable().describe("Error message when validation or spawn failed; null on success"),
})
