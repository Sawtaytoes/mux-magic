// ─── Command definitions ──────────────────────────────────────────────────────
//
// Each entry describes one API command the sequence builder can wire up.
// `tag` groups commands in the picker; `fields` lists the parameters the
// command accepts; `outputFolderName` is the subfolder suffix this command
// writes its output into (null = writes in-place or caller supplies path).
//
// Migration in progress: command entries are gradually being rewritten to
// pull `name`, `description`, `default`, and `required` from their Zod
// request schemas via `fieldBuilder`. This makes field-name typos a
// compile error and stops server-side `.default(...)` values from
// drifting away from the UI's hard-coded defaults. UI-only attributes
// (type, label, lookupType, visibleWhen, …) stay on the override object.
// Commands not yet migrated keep their plain literal `fields` arrays.

import {
  addSubtitlesRequestSchema,
  changeTrackLanguagesRequestSchema,
  copyFilesRequestSchema,
  copyOutSubtitlesRequestSchema,
  deleteFilesByExtensionRequestSchema,
  deleteFolderRequestSchema,
  extractSubtitlesRequestSchema,
  fixIncorrectDefaultTracksRequestSchema,
  flattenOutputRequestSchema,
  getAudioOffsetsRequestSchema,
  hasBetterAudioRequestSchema,
  hasBetterVersionRequestSchema,
  hasDuplicateMusicFilesRequestSchema,
  hasImaxEnhancedAudioRequestSchema,
  hasManyAudioTracksRequestSchema,
  hasSurroundSoundRequestSchema,
  hasWrongDefaultTrackRequestSchema,
  isMissingSubtitlesRequestSchema,
  keepLanguagesRequestSchema,
  makeDirectoryRequestSchema,
  mergeTracksRequestSchema,
  modifySubtitleMetadataRequestSchema,
  moveFilesRequestSchema,
  nameAnimeEpisodesAniDBRequestSchema,
  nameAnimeEpisodesRequestSchema,
  nameMovieCutsDvdCompareTmdbRequestSchema,
  nameSpecialFeaturesDvdCompareTmdbRequestSchema,
  nameTvShowEpisodesRequestSchema,
  remuxToMkvRequestSchema,
  renameDemosRequestSchema,
  renameFilesRequestSchema,
  renameMovieClipDownloadsRequestSchema,
  reorderTracksRequestSchema,
  replaceAttachmentsRequestSchema,
  replaceFlacWithPcmAudioRequestSchema,
  replaceTracksRequestSchema,
  setDisplayWidthRequestSchema,
  splitChaptersRequestSchema,
  storeAspectRatioDataRequestSchema,
} from "@mux-magic/server/api-schemas"
import type { Commands } from "../commands/types"
import { fieldBuilder } from "./buildFields"

export const COMMANDS: Commands = {
  // File Operations
  makeDirectory: (() => {
    const field = fieldBuilder(makeDirectoryRequestSchema)
    return {
      summary:
        "Create a directory (or the parent directory of a file path)",
      tag: "File Operations",
      outputFolderName: null,
      fields: [
        field("sourcePath", {
          type: "path",
          label: "Source Path",
        }),
      ],
    }
  })(),
  copyFiles: (() => {
    const field = fieldBuilder(copyFilesRequestSchema)
    return {
      summary: "Copy files from source to destination",
      tag: "File Operations",
      outputFolderName: null,
      fields: [
        field("sourcePath", {
          type: "path",
          label: "Source Path",
        }),
        field("destinationPath", {
          type: "path",
          label: "Destination Path",
        }),
        field("fileFilterRegex", {
          type: "string",
          label: "File Filter Regex",
          placeholder: "\\.mkv$",
        }),
        field("includeFolders", {
          type: "boolean",
          label: "Include Folders",
        }),
        // Mirrors the server-side opt-in: folderFilterRegex is only
        // honored when includeFolders is true (see copyFiles.ts:80-81),
        // so the UI hides the input until the toggle is flipped.
        field("folderFilterRegex", {
          type: "string",
          label: "Folder Filter Regex",
          placeholder: "^Season\\s\\d+",
          visibleWhen: {
            fieldName: "includeFolders",
            value: true,
          },
        }),
        field("renameRegex", {
          type: "renameRegex",
          label: "Rename Regex",
          isRequired: false,
        }),
      ],
    }
  })(),
  flattenOutput: (() => {
    const field = fieldBuilder(flattenOutputRequestSchema)
    return {
      summary:
        "Flatten a chained step's output (copies files up one level; source folder kept by default)",
      tag: "File Operations",
      outputFolderName: null,
      // Files land in dirname(sourcePath), so the folder a downstream step
      // should chain off is the parent of the source — not the source itself.
      outputComputation: "parentOfSource",
      fields: [
        field("sourcePath", {
          type: "path",
          label: "Output Folder to Flatten",
        }),
        field("deleteSourceFolder", {
          type: "boolean",
          label:
            "Also delete the source folder after copying",
        }),
      ],
    }
  })(),
  renameFiles: (() => {
    const field = fieldBuilder(renameFilesRequestSchema)
    return {
      summary:
        "Rename files in place via regex (no copy, no move).",
      tag: "File Operations",
      outputFolderName: null,
      fields: [
        field("sourcePath", {
          type: "path",
          label: "Source Path",
        }),
        field("isRecursive", {
          type: "boolean",
          label: "Recursive",
        }),
        field("recursiveDepth", {
          type: "number",
          label: "Depth",
          visibleWhen: {
            fieldName: "isRecursive",
            value: true,
          },
        }),
        field("fileFilterRegex", {
          type: "string",
          label: "File Filter Regex",
          placeholder: "\\.mkv$",
        }),
        field("renameRegex", {
          type: "renameRegex",
          label: "Rename Regex",
        }),
      ],
    }
  })(),
  moveFiles: (() => {
    const field = fieldBuilder(moveFilesRequestSchema)
    return {
      summary: "Move files from source to destination",
      tag: "File Operations",
      outputFolderName: null,
      fields: [
        field("sourcePath", {
          type: "path",
          label: "Source Path",
        }),
        field("destinationPath", {
          type: "path",
          label: "Destination Path",
        }),
        field("fileFilterRegex", {
          type: "string",
          label: "File Filter Regex",
          placeholder: "\\.mkv$",
        }),
        field("renameRegex", {
          type: "renameRegex",
          label: "Rename Regex",
          isRequired: false,
        }),
      ],
    }
  })(),
  replaceAttachments: (() => {
    const field = fieldBuilder(
      replaceAttachmentsRequestSchema,
    )
    return {
      summary: "Replace attachments in media files",
      tag: "File Operations",
      outputFolderName: "REPLACED-ATTACHMENTS",
      fields: [
        field("sourcePath", {
          type: "path",
          label: "Source Path",
        }),
        field("destinationFilesPath", {
          type: "path",
          label: "Destination Files Path",
        }),
      ],
    }
  })(),
  deleteFilesByExtension: (() => {
    const field = fieldBuilder(
      deleteFilesByExtensionRequestSchema,
    )
    return {
      summary: "Delete files matching extensions",
      tag: "File Operations",
      outputFolderName: null,
      fields: [
        field("sourcePath", {
          type: "path",
          label: "Source Path",
        }),
        // Drift: `.openapi({ example })` on this field appears to strip the
        // schema's `.describe()` text, so the helper can't pick it up. Pass
        // the description explicitly until the schema chain is reordered.
        field("extensions", {
          type: "stringArray",
          label: "Extensions",
          placeholder: ".srt, .idx",
          description:
            "List of file extensions to delete (with or without leading dot), e.g. ['.srt', 'idx'].",
        }),
        field("isRecursive", {
          type: "boolean",
          label: "Recursive",
        }),
        // Schema default is 0 (sentinel for "fall back to server default
        // of 1"). UI overrides to 1 so the depth input shows a useful
        // value the moment the user checks isRecursive.
        field("recursiveDepth", {
          type: "number",
          label: "Depth",
          default: 1,
          min: 1,
          visibleWhen: {
            fieldName: "isRecursive",
            value: true,
          },
        }),
      ],
      groups: [
        {
          fields: ["isRecursive", "recursiveDepth"],
          layout: "field-group-check-fill",
        },
      ],
    }
  })(),
  deleteFolder: (() => {
    const field = fieldBuilder(deleteFolderRequestSchema)
    return {
      summary:
        "Recursively delete a folder and all its contents (DESTRUCTIVE — requires Confirm)",
      tag: "File Operations",
      outputFolderName: null,
      fields: [
        field("sourcePath", {
          type: "path",
          label: "Source Path",
        }),
        field("confirm", {
          type: "boolean",
          label:
            "Confirm: I understand this will recursively delete the folder",
          description:
            "Required: check this to acknowledge this is destructive. Without it the command refuses to run.",
        }),
      ],
    }
  })(),
  splitChapters: (() => {
    const field = fieldBuilder(splitChaptersRequestSchema)
    return {
      summary: "Split media files by chapter markers",
      tag: "File Operations",
      outputFolderName: "SPLITS",
      fields: [
        field("sourcePath", {
          type: "path",
          label: "Source Path",
        }),
        field("chapterSplits", {
          type: "stringArray",
          label: "Chapter Splits",
          placeholder: "ch1, ch2",
        }),
      ],
    }
  })(),
  remuxToMkv: (() => {
    const field = fieldBuilder(remuxToMkvRequestSchema)
    return {
      summary:
        "Pass-through container remux into .mkv siblings (no track changes)",
      tag: "File Operations",
      outputFolderName: null,
      fields: [
        field("sourcePath", {
          type: "path",
          label: "Source Path",
        }),
        // Drift: `.openapi({ example })` on this field strips the schema's
        // `.describe()` text. Pass the description explicitly until the
        // schema chain is reordered.
        field("extensions", {
          type: "stringArray",
          label: "Extensions",
          placeholder: ".ts, .m2ts",
          description:
            "List of file extensions to remux (with or without leading dot), e.g. ['.ts', '.m2ts'].",
        }),
        field("isRecursive", {
          type: "boolean",
          label: "Recursive",
        }),
        // Schema default is 0 (sentinel for server default of 1); UI
        // overrides to 1 so the depth input shows a useful value the
        // moment the user checks isRecursive.
        field("recursiveDepth", {
          type: "number",
          label: "Depth",
          default: 1,
          min: 1,
          visibleWhen: {
            fieldName: "isRecursive",
            value: true,
          },
        }),
        field("isSourceDeletedOnSuccess", {
          type: "boolean",
          label: "Delete source on per-file success",
        }),
      ],
      groups: [
        {
          fields: ["isRecursive", "recursiveDepth"],
          layout: "field-group-check-fill",
        },
      ],
    }
  })(),
  // Audio Operations
  getAudioOffsets: (() => {
    const field = fieldBuilder(getAudioOffsetsRequestSchema)
    return {
      summary: "Calculate audio sync offsets between files",
      tag: "Audio Operations",
      outputFolderName: "AUDIO-OFFSETS",
      fields: [
        field("sourcePath", {
          type: "path",
          label: "Source Path",
        }),
        field("destinationFilesPath", {
          type: "path",
          label: "Destination Files Path",
        }),
      ],
    }
  })(),
  replaceFlacWithPcmAudio: (() => {
    const field = fieldBuilder(
      replaceFlacWithPcmAudioRequestSchema,
    )
    return {
      summary: "Replace FLAC audio with PCM audio",
      tag: "Audio Operations",
      outputFolderName: "AUDIO-CONVERTED",
      fields: [
        field("sourcePath", {
          type: "path",
          label: "Source Path",
        }),
        field("isRecursive", {
          type: "boolean",
          label: "Recursive",
        }),
      ],
    }
  })(),
  // Track Operations
  changeTrackLanguages: (() => {
    const field = fieldBuilder(
      changeTrackLanguagesRequestSchema,
    )
    return {
      summary: "Change language tags for media tracks",
      tag: "Track Operations",
      outputFolderName: null,
      fields: [
        field("sourcePath", {
          type: "path",
          label: "Source Path",
        }),
        field("isRecursive", {
          type: "boolean",
          label: "Recursive",
        }),
        field("audioLanguage", {
          type: "languageCode",
          label: "Audio Language",
        }),
        field("subtitlesLanguage", {
          type: "languageCode",
          label: "Subtitles Language",
        }),
        field("videoLanguage", {
          type: "languageCode",
          label: "Video Language",
        }),
      ],
    }
  })(),
  fixIncorrectDefaultTracks: (() => {
    const field = fieldBuilder(
      fixIncorrectDefaultTracksRequestSchema,
    )
    return {
      summary: "Fix incorrect default track designations",
      tag: "Track Operations",
      outputFolderName: null,
      fields: [
        field("sourcePath", {
          type: "path",
          label: "Source Path",
        }),
        field("isRecursive", {
          type: "boolean",
          label: "Recursive",
        }),
      ],
    }
  })(),
  keepLanguages: (() => {
    const field = fieldBuilder(keepLanguagesRequestSchema)
    return {
      summary: "Filter media tracks by language",
      tag: "Track Operations",
      outputFolderName: "LANGUAGE-TRIMMED",
      fields: [
        field("sourcePath", {
          type: "path",
          label: "Source Path",
        }),
        field("isRecursive", {
          type: "boolean",
          label: "Recursive",
        }),
        field("audioLanguages", {
          type: "languageCodes",
          label: "Audio Languages",
          placeholder: "eng, jpn",
        }),
        field("subtitlesLanguages", {
          type: "languageCodes",
          label: "Subtitles Languages",
          placeholder: "eng",
        }),
        field("useFirstAudioLanguage", {
          type: "boolean",
          label: "First Audio Only",
        }),
        field("useFirstSubtitlesLanguage", {
          type: "boolean",
          label: "First Subtitles Only",
        }),
      ],
      groups: [
        {
          fields: [
            "audioLanguages",
            "useFirstAudioLanguage",
          ],
          layout: "field-group-two-col",
        },
        {
          fields: [
            "subtitlesLanguages",
            "useFirstSubtitlesLanguage",
          ],
          layout: "field-group-two-col",
        },
      ],
    }
  })(),
  addSubtitles: (() => {
    const field = fieldBuilder(addSubtitlesRequestSchema)
    return {
      summary:
        "Mux a folder of per-file subtitle directories into matching media files (preserves attachments and optional chapters.xml)",
      tag: "Subtitle Operations",
      outputFolderName: "SUBTITLED",
      fields: [
        field("sourcePath", {
          type: "path",
          label: "Source Path",
        }),
        field("subtitlesPath", {
          type: "path",
          label: "Subtitles Path",
        }),
        field("hasChapterSyncOffset", {
          type: "boolean",
          label: "Chapter-Sync Offset",
        }),
        field("globalOffset", {
          type: "number",
          label: "Global Offset (ms)",
        }),
        field("includeChapters", {
          type: "boolean",
          label: "Include Chapters",
        }),
        field("offsets", {
          type: "numberArray",
          label: "Offsets (milliseconds, one per episode)",
          placeholder: "0, -200, 150",
        }),
      ],
    }
  })(),
  mergeTracks: (() => {
    const field = fieldBuilder(mergeTracksRequestSchema)
    return {
      summary:
        "[DEPRECATED — use addSubtitles] Merge subtitle tracks into media files",
      note: "DEPRECATED: this command was renamed to 'addSubtitles'. Update your saved sequences — the old name will be removed in a future release.",
      tag: "Track Operations",
      outputFolderName: "SUBTITLED",
      fields: [
        field("sourcePath", {
          type: "path",
          label: "Source Path",
        }),
        field("subtitlesPath", {
          type: "path",
          label: "Subtitles Path",
        }),
        field("hasChapterSyncOffset", {
          type: "boolean",
          label: "Chapter-Sync Offset",
        }),
        field("globalOffset", {
          type: "number",
          label: "Global Offset (ms)",
        }),
        field("includeChapters", {
          type: "boolean",
          label: "Include Chapters",
        }),
        field("offsets", {
          type: "numberArray",
          label: "Offsets (milliseconds, one per episode)",
          placeholder: "0, -200, 150",
        }),
      ],
    }
  })(),
  reorderTracks: (() => {
    const field = fieldBuilder(reorderTracksRequestSchema)
    return {
      summary: "Reorder media tracks",
      tag: "Track Operations",
      outputFolderName: "REORDERED-TRACKS",
      fields: [
        field("sourcePath", {
          type: "path",
          label: "Source Path",
        }),
        field("isRecursive", {
          type: "boolean",
          label: "Recursive",
        }),
        field("videoTrackIndexes", {
          type: "numberArray",
          label: "Video Track Indexes",
          placeholder: "0",
        }),
        field("audioTrackIndexes", {
          type: "numberArray",
          label: "Audio Track Indexes",
          placeholder: "0, 1",
        }),
        field("subtitlesTrackIndexes", {
          type: "numberArray",
          label: "Subtitles Track Indexes",
          placeholder: "0",
        }),
      ],
    }
  })(),
  replaceTracks: (() => {
    const field = fieldBuilder(replaceTracksRequestSchema)
    return {
      summary: "Replace media tracks in destination files",
      tag: "Track Operations",
      outputFolderName: "REPLACED-TRACKS",
      fields: [
        field("sourcePath", {
          type: "path",
          label: "Source Path",
        }),
        field("destinationFilesPath", {
          type: "path",
          label: "Destination Files Path",
        }),
        field("hasChapterSyncOffset", {
          type: "boolean",
          label: "Chapter-Sync Offset",
        }),
        field("globalOffset", {
          type: "number",
          label: "Global Offset (ms)",
        }),
        field("includeChapters", {
          type: "boolean",
          label: "Include Chapters",
        }),
        field("audioLanguages", {
          type: "languageCodes",
          label: "Audio Languages",
          placeholder: "eng, jpn",
        }),
        field("subtitlesLanguages", {
          type: "languageCodes",
          label: "Subtitles Languages",
          placeholder: "eng",
        }),
        field("videoLanguages", {
          type: "languageCodes",
          label: "Video Languages",
        }),
        field("offsets", {
          type: "numberArray",
          label: "Per-file Offsets (ms)",
        }),
      ],
    }
  })(),
  // Subtitle Operations
  extractSubtitles: (() => {
    const field = fieldBuilder(
      extractSubtitlesRequestSchema,
    )
    return {
      summary:
        "Extract subtitle tracks into separate files alongside each video file",
      tag: "Subtitle Operations",
      outputFolderName: "EXTRACTED-SUBTITLES",
      fields: [
        field("sourcePath", {
          type: "path",
          label: "Source Path",
        }),
        field("isRecursive", {
          type: "boolean",
          label: "Recursive",
        }),
        field("subtitlesLanguage", {
          type: "languageCode",
          label: "Subtitles Language",
        }),
      ],
    }
  })(),
  copyOutSubtitles: (() => {
    const field = fieldBuilder(
      copyOutSubtitlesRequestSchema,
    )
    return {
      summary:
        "[DEPRECATED — use extractSubtitles] Extract subtitle tracks into separate files alongside each video file",
      note: "DEPRECATED: this command was renamed to 'extractSubtitles'. Update your saved sequences — the old name will be removed in a future release.",
      tag: "Subtitle Operations",
      outputFolderName: "EXTRACTED-SUBTITLES",
      fields: [
        field("sourcePath", {
          type: "path",
          label: "Source Path",
        }),
        field("isRecursive", {
          type: "boolean",
          label: "Recursive",
        }),
        field("subtitlesLanguage", {
          type: "languageCode",
          label: "Subtitles Language",
        }),
      ],
    }
  })(),
  isMissingSubtitles: (() => {
    const field = fieldBuilder(
      isMissingSubtitlesRequestSchema,
    )
    return {
      summary:
        "Identify media files missing subtitle tracks",
      tag: "Subtitle Operations",
      outputFolderName: null,
      fields: [
        field("sourcePath", {
          type: "path",
          label: "Source Path",
        }),
        field("isRecursive", {
          type: "boolean",
          label: "Recursive",
        }),
      ],
    }
  })(),
  modifySubtitleMetadata: (() => {
    const field = fieldBuilder(
      modifySubtitleMetadataRequestSchema,
    )
    return {
      summary:
        "Apply DSL-driven modifications to ASS subtitle metadata. Toggle hasDefaultRules to prepend the in-tree heuristic rules.",
      tag: "Subtitle Operations",
      outputFolderName: null,
      fields: [
        field("sourcePath", {
          type: "path",
          label: "Source Path",
        }),
        field("isRecursive", {
          type: "boolean",
          label: "Recursive",
        }),
        // Schema default is 0 (sentinel for server default of 1); UI
        // overrides to 1 so the depth input shows a useful value the
        // moment the user checks isRecursive.
        field("recursiveDepth", {
          type: "number",
          label: "Depth",
          default: 1,
          min: 1,
          visibleWhen: {
            fieldName: "isRecursive",
            value: true,
          },
        }),
        // `predicates` and `hasDefaultRules` ride alongside `rules` and are
        // edited together inside the structured `subtitleRules` editor below.
        // Listing them as `hidden` keeps buildParams emitting them into YAML
        // without the step renderer trying to show a separate input row.
        field("predicates", { type: "hidden" }),
        field("hasDefaultRules", { type: "hidden" }),
        // `subtitleRules` is the structured form-builder for the
        // modifySubtitleMetadata DSL — see
        // public/builder/js/components/dsl-rules-builder.js. It renders
        // its own dispatcher in renderFields. NOT `linkable` — the only
        // command that emitted a `rules` output (computeDefaultSubtitleRules)
        // was dropped in W26b in favor of the `hasDefaultRules` toggle, so
        // there's nothing upstream to wire into. Strip the link picker
        // until/unless a new rules-emitting command appears.
        // Schema has `.default([])` which would derive required:true, but
        // the structured rules editor explicitly supports an empty list
        // (the Default Rules toggle alone covers most cases).
        field("rules", {
          type: "subtitleRules",
          label: "Rules",
          isRequired: false,
        }),
      ],
      groups: [
        {
          fields: ["isRecursive", "recursiveDepth"],
          layout: "field-group-check-fill",
        },
      ],
    }
  })(),
  // Analysis
  hasBetterAudio: (() => {
    const field = fieldBuilder(hasBetterAudioRequestSchema)
    return {
      summary:
        "Analyze and compare audio quality across files",
      tag: "Analysis",
      outputFolderName: null,
      fields: [
        field("sourcePath", {
          type: "path",
          label: "Source Path",
        }),
        field("isRecursive", {
          type: "boolean",
          label: "Recursive",
        }),
        // Schema default is 0 (sentinel for server default of 1); UI
        // overrides to 1 so the depth input shows a useful value the
        // moment the user checks isRecursive.
        field("recursiveDepth", {
          type: "number",
          label: "Depth",
          default: 1,
          min: 1,
          visibleWhen: {
            fieldName: "isRecursive",
            value: true,
          },
        }),
      ],
      groups: [
        {
          fields: ["isRecursive", "recursiveDepth"],
          layout: "field-group-check-fill",
        },
      ],
    }
  })(),
  hasBetterVersion: (() => {
    const field = fieldBuilder(
      hasBetterVersionRequestSchema,
    )
    return {
      summary: "Check if better version of media exists",
      tag: "Analysis",
      outputFolderName: null,
      fields: [
        field("sourcePath", {
          type: "path",
          label: "Source Path",
        }),
        field("isRecursive", {
          type: "boolean",
          label: "Recursive",
        }),
        // Schema default is 0 (sentinel for server default of 1); UI
        // overrides to 1 so the depth input shows a useful value the
        // moment the user checks isRecursive.
        field("recursiveDepth", {
          type: "number",
          label: "Depth",
          default: 1,
          min: 1,
          visibleWhen: {
            fieldName: "isRecursive",
            value: true,
          },
        }),
      ],
      groups: [
        {
          fields: ["isRecursive", "recursiveDepth"],
          layout: "field-group-check-fill",
        },
      ],
    }
  })(),
  hasDuplicateMusicFiles: (() => {
    const field = fieldBuilder(
      hasDuplicateMusicFilesRequestSchema,
    )
    return {
      summary: "Identify duplicate music files",
      tag: "Analysis",
      outputFolderName: null,
      fields: [
        field("sourcePath", {
          type: "path",
          label: "Source Path",
        }),
        field("isRecursive", {
          type: "boolean",
          label: "Recursive",
        }),
        // Schema default is 0 (sentinel for server default of 1); UI
        // overrides to 1 so the depth input shows a useful value the
        // moment the user checks isRecursive.
        field("recursiveDepth", {
          type: "number",
          label: "Depth",
          default: 1,
          min: 1,
          visibleWhen: {
            fieldName: "isRecursive",
            value: true,
          },
        }),
      ],
      groups: [
        {
          fields: ["isRecursive", "recursiveDepth"],
          layout: "field-group-check-fill",
        },
      ],
    }
  })(),
  hasImaxEnhancedAudio: (() => {
    const field = fieldBuilder(
      hasImaxEnhancedAudioRequestSchema,
    )
    return {
      summary: "Check for IMAX enhanced audio tracks",
      tag: "Analysis",
      outputFolderName: null,
      fields: [
        field("sourcePath", {
          type: "path",
          label: "Source Path",
        }),
        field("isRecursive", {
          type: "boolean",
          label: "Recursive",
        }),
      ],
    }
  })(),
  hasManyAudioTracks: (() => {
    const field = fieldBuilder(
      hasManyAudioTracksRequestSchema,
    )
    return {
      summary: "Identify files with many audio tracks",
      tag: "Analysis",
      outputFolderName: null,
      fields: [
        field("sourcePath", {
          type: "path",
          label: "Source Path",
        }),
        field("isRecursive", {
          type: "boolean",
          label: "Recursive",
        }),
      ],
    }
  })(),
  hasSurroundSound: (() => {
    const field = fieldBuilder(
      hasSurroundSoundRequestSchema,
    )
    return {
      summary: "Check for surround sound audio tracks",
      tag: "Analysis",
      outputFolderName: null,
      fields: [
        field("sourcePath", {
          type: "path",
          label: "Source Path",
        }),
        field("isRecursive", {
          type: "boolean",
          label: "Recursive",
        }),
        // Schema default is 0 (sentinel for server default of 1); UI
        // overrides to 1 so the depth input shows a useful value the
        // moment the user checks isRecursive.
        field("recursiveDepth", {
          type: "number",
          label: "Depth",
          default: 1,
          min: 1,
          visibleWhen: {
            fieldName: "isRecursive",
            value: true,
          },
        }),
      ],
      groups: [
        {
          fields: ["isRecursive", "recursiveDepth"],
          layout: "field-group-check-fill",
        },
      ],
    }
  })(),
  hasWrongDefaultTrack: (() => {
    const field = fieldBuilder(
      hasWrongDefaultTrackRequestSchema,
    )
    return {
      summary:
        "Find files with incorrect default track selection",
      tag: "Analysis",
      outputFolderName: null,
      fields: [
        field("sourcePath", {
          type: "path",
          label: "Source Path",
        }),
        field("isRecursive", {
          type: "boolean",
          label: "Recursive",
        }),
      ],
    }
  })(),
  // Naming Operations
  nameAnimeEpisodes: (() => {
    const field = fieldBuilder(
      nameAnimeEpisodesRequestSchema,
    )
    return {
      summary:
        "Rename anime episode files using MyAnimeList metadata",
      tag: "Naming Operations",
      outputFolderName: null,
      fields: [
        field("sourcePath", {
          type: "path",
          label: "Source Path",
        }),
        // Schema marks malId optional (the CLI can take searchTerm instead),
        // but the builder form requires it — the lookup populates it before
        // submit. Override the helper's derivation.
        field("malId", {
          type: "numberWithLookup",
          lookupType: "mal",
          label: "MAL ID",
          placeholder: "39534",
          isRequired: true,
          companionNameField: "malName",
          hasIncrementButtons: false,
        }),
        field("seasonNumber", {
          type: "number",
          label: "Season Number",
          description:
            "The season number to output when renaming, useful for TVDB which has separate season numbers. For AniDB, use the default value 1.",
        }),
      ],
    }
  })(),
  nameAnimeEpisodesAniDB: (() => {
    const field = fieldBuilder(
      nameAnimeEpisodesAniDBRequestSchema,
    )
    return {
      summary:
        "Rename anime episode files using AniDB metadata (better OVA/special coverage than MAL). Specials / Credits / Trailers / Parodies prompt per-file in the job log (Space skips, Esc cancels). Regular and Others are index-paired and flag >2m duration mismatches.",
      tag: "Naming Operations",
      outputFolderName: null,
      fields: [
        field("sourcePath", {
          type: "path",
          label: "Source Path",
        }),
        // Schema marks anidbId optional (the CLI accepts searchTerm), but
        // the builder form requires it — the lookup populates it before
        // submit. Override the helper's derivation.
        field("anidbId", {
          type: "numberWithLookup",
          lookupType: "anidb",
          label: "AniDB Anime ID",
          placeholder: "8160",
          isRequired: true,
          companionNameField: "anidbName",
          hasIncrementButtons: false,
        }),
        field("seasonNumber", {
          type: "number",
          label: "Season Number",
          description:
            "Season number for the output filename (Plex-style sNNeNN). Ignored when Episode Type is set to Specials.",
        }),
        field("episodeType", {
          type: "enum",
          label: "Episode Type",
          options: [
            { value: "regular", label: "Regular (type=1)" },
            {
              value: "specials",
              label: "Specials (S, type=2)",
            },
            {
              value: "credits",
              label: "Credits / OP / ED (C, type=3)",
            },
            {
              value: "trailers",
              label: "Trailers (T, type=4)",
            },
            {
              value: "parodies",
              label: "Parodies (P, type=5)",
            },
            {
              value: "others",
              label: "Others (O, type=6, alt cuts)",
            },
          ],
        }),
      ],
    }
  })(),
  nameMovieCutsDvdCompareTmdb: (() => {
    const field = fieldBuilder(
      nameMovieCutsDvdCompareTmdbRequestSchema,
    )
    return {
      summary:
        "Rename main-feature movie cuts (Director's Cut, Theatrical, etc.) using DVDCompare timecodes and organize into Plex edition folders. Files with no matching cut are skipped — never renamed with a guess.",
      tag: "Naming Operations",
      outputFolderName: null,
      // Auto-resolved TMDB match (set by resolveTmdbForStep when the user
      // picks a DVDCompare release). Persisted in YAML so a shared seq
      // URL keeps pointing at the same matched film across reloads.
      persistedKeys: ["tmdbId", "tmdbName"],
      fields: [
        field("sourcePath", {
          type: "path",
          label: "Source Path",
        }),
        // Mirrors the existing NSF field — `numberWithLookup` +
        // `lookupType: "dvdcompare"` makes it linkable to a
        // `dvdCompareId` Variable from worker 35's registry.
        field("dvdCompareId", {
          type: "numberWithLookup",
          lookupType: "dvdcompare",
          label: "DVDCompare Film ID",
          placeholder: "12345",
          isRequired: true,
          companionNameField: "dvdCompareName",
          hasIncrementButtons: false,
        }),
        // Schema has no default for `dvdCompareReleaseHash`. UI defaults
        // to 1 (the first release option) — matches NSF.
        field("dvdCompareReleaseHash", {
          type: "number",
          label: "Release Hash",
          default: 1,
          companionNameField: "dvdCompareReleaseLabel",
        }),
        field("fixedOffset", {
          type: "number",
          label: "Fixed Offset (s)",
        }),
        field("timecodePadding", {
          type: "number",
          label: "Timecode Padding (s)",
        }),
      ],
      groups: [
        {
          fields: ["timecodePadding", "fixedOffset"],
          layout: "field-group-two-col",
        },
      ],
    }
  })(),
  nameSpecialFeaturesDvdCompareTmdb: (() => {
    const field = fieldBuilder(
      nameSpecialFeaturesDvdCompareTmdbRequestSchema,
    )
    return {
      summary:
        "Rename special features (and the main movie file) based on DVDCompare timecodes — title canonicalized via TMDB",
      tag: "Naming Operations",
      outputFolderName: null,
      // Auto-resolved TMDB match (set by resolveTmdbForStep when the user
      // picks a DVDCompare release). Not user-editable, but persisted in
      // YAML so a shared seq URL keeps pointing at the same matched film
      // across reloads. The app-command itself ignores these — they exist
      // purely so the input-area "↗ Title (year) on TMDB" link survives a
      // round-trip.
      persistedKeys: ["tmdbId", "tmdbName"],
      fields: [
        field("sourcePath", {
          type: "path",
          label: "Source Path",
        }),
        // Schema marks dvdCompareId optional (the CLI accepts searchTerm),
        // but the builder form requires it — the lookup populates it
        // before submit. Override the helper's derivation.
        field("dvdCompareId", {
          type: "numberWithLookup",
          lookupType: "dvdcompare",
          label: "DVDCompare Film ID",
          placeholder: "74759",
          isRequired: true,
          companionNameField: "dvdCompareName",
          hasIncrementButtons: false,
        }),
        // Drift: schema has no default for `dvdCompareReleaseHash`
        // (`.optional()` with no `.default()`), but the UI defaults to 1
        // (the first release option). Keep the override.
        field("dvdCompareReleaseHash", {
          type: "number",
          label: "Release Hash",
          default: 1,
          companionNameField: "dvdCompareReleaseLabel",
        }),
        field("fixedOffset", {
          type: "number",
          label: "Fixed Offset (s)",
        }),
        field("timecodePadding", {
          type: "number",
          label: "Timecode Padding (s)",
        }),
        // Defaults to false in the Builder so the Phase-B "which file is
        // which?" pick modal becomes the interactive UX. Schema also
        // defaults to false — matches the UI.
        field("autoNameDuplicates", {
          type: "boolean",
          label: "Auto-name duplicates",
          description:
            "When two-or-more files match the same target name within a single run, auto-disambiguate them with (2)/(3)/… suffixes deterministically. Pass false to instead emit a duplicate-pick prompt for each ambiguous group.",
        }),
      ],
      // Group small numeric fields side-by-side on wider cards, using
      // container queries so they adapt to card width (when 2 cards display
      // side-by-side), not just the viewport.
      groups: [
        {
          fields: ["timecodePadding", "fixedOffset"],
          layout: "field-group-two-col",
        },
      ],
    }
  })(),
  nameTvShowEpisodes: (() => {
    const field = fieldBuilder(
      nameTvShowEpisodesRequestSchema,
    )
    return {
      summary:
        "Rename TV show episode files based on metadata",
      tag: "Naming Operations",
      outputFolderName: null,
      fields: [
        field("sourcePath", {
          type: "path",
          label: "Source Path",
        }),
        // Schema marks tvdbId optional (the CLI accepts searchTerm), but
        // the builder form requires it — the lookup populates it before
        // submit. Override the helper's derivation.
        field("tvdbId", {
          type: "numberWithLookup",
          lookupType: "tvdb",
          label: "TVDB ID",
          placeholder: "76703",
          isRequired: true,
          companionNameField: "tvdbName",
          hasIncrementButtons: false,
        }),
        // Schema defaults seasonNumber to 1; surfacing that default in
        // the UI matches the other naming commands. Previously this was
        // required-without-default, which forced users to type "1".
        field("seasonNumber", {
          type: "number",
          label: "Season Number",
          description:
            "The season number to lookup when renaming.",
        }),
      ],
    }
  })(),
  renameDemos: (() => {
    const field = fieldBuilder(renameDemosRequestSchema)
    return {
      summary:
        "Rename demo files based on content analysis",
      tag: "Naming Operations",
      outputFolderName: null,
      fields: [
        field("sourcePath", {
          type: "path",
          label: "Source Path",
        }),
        field("isRecursive", {
          type: "boolean",
          label: "Recursive",
        }),
      ],
    }
  })(),
  renameMovieClipDownloads: (() => {
    const field = fieldBuilder(
      renameMovieClipDownloadsRequestSchema,
    )
    return {
      summary: "Rename downloaded movie clip files",
      tag: "Naming Operations",
      outputFolderName: null,
      fields: [
        field("sourcePath", {
          type: "path",
          label: "Source Path",
          description:
            "Directory where downloaded movie demos are located.",
        }),
      ],
    }
  })(),
  // Video Operations
  setDisplayWidth: (() => {
    const field = fieldBuilder(setDisplayWidthRequestSchema)
    return {
      summary: "Set display width for video tracks",
      tag: "Video Operations",
      outputFolderName: null,
      fields: [
        field("sourcePath", {
          type: "path",
          label: "Source Path",
        }),
        field("displayWidth", {
          type: "number",
          label: "Display Width (px)",
        }),
        field("isRecursive", {
          type: "boolean",
          label: "Recursive",
        }),
        // Schema default is 0 (sentinel for server default of 1); UI
        // overrides to 1 so the depth input shows a useful value the
        // moment the user checks isRecursive.
        field("recursiveDepth", {
          type: "number",
          label: "Depth",
          default: 1,
          min: 1,
          visibleWhen: {
            fieldName: "isRecursive",
            value: true,
          },
        }),
      ],
      groups: [
        {
          fields: ["isRecursive", "recursiveDepth"],
          layout: "field-group-check-fill",
        },
      ],
    }
  })(),
  // Metadata Operations
  storeAspectRatioData: (() => {
    const field = fieldBuilder(
      storeAspectRatioDataRequestSchema,
    )
    return {
      summary: "Analyze and store aspect ratio metadata",
      tag: "Metadata Operations",
      outputFolderName: null,
      fields: [
        field("sourcePath", {
          type: "path",
          label: "Source Path",
        }),
        field("isRecursive", {
          type: "boolean",
          label: "Recursive",
        }),
        field("recursiveDepth", {
          type: "number",
          label: "Depth",
          min: 1,
          visibleWhen: {
            fieldName: "isRecursive",
            value: true,
          },
        }),
        field("outputPath", {
          type: "path",
          label: "Output Path",
        }),
        field("rootPath", {
          type: "string",
          label: "Root Path",
          description:
            "Path your media player (Plex, Jellyfin, Emby) sees for your library — written into the output JSON's file paths so the player can match its catalog. The path does not have to exist on this machine.",
        }),
        field("folders", {
          type: "folderMultiSelect",
          label: "Folders",
          description:
            "List of folder names relative to the sourcePath to include. If you're searching a root path with lots of media, this can reduce the list to only those in Plex. Ensure these folder names match the ones in Plex.",
          sourceField: "sourcePath",
        }),
        field("force", {
          type: "boolean",
          label: "Force Overwrite",
        }),
      ],
      groups: [
        {
          fields: ["isRecursive", "recursiveDepth"],
          layout: "field-group-check-fill",
        },
      ],
    }
  })(),
}

export const TAG_ORDER = [
  "File Operations",
  "Audio Operations",
  "Track Operations",
  "Subtitle Operations",
  "Analysis",
  "Naming Operations",
  "Video Operations",
  "Metadata Operations",
]
