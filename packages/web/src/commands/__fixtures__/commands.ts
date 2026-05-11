// ─── Phase 2 test fixture — DO NOT MODIFY ────────────────────────────────────
// Stable subset of commands for W2A–W2D test files. One command per field type.
// Frozen after W1 commit 8 — import from here in all Wave B component tests.

import type { Commands } from "../../types"

// boolean, path, number — BooleanField / NumberField / StringField (W2A)
export const FIXTURE_COMMANDS_BUNDLE_A: Commands = {
  flattenOutput: {
    summary: "Flatten a chained step's output",
    tag: "File Operations",
    outputFolderName: null,
    fields: [
      {
        name: "sourcePath",
        type: "path",
        label: "Output Folder to Flatten",
        required: true,
      },
      {
        name: "deleteSourceFolder",
        type: "boolean",
        label:
          "Also delete the source folder after copying",
        default: false,
      },
    ],
  },
  setDisplayWidth: {
    summary: "Set display width for video tracks",
    tag: "Video Operations",
    outputFolderName: null,
    fields: [
      {
        name: "sourcePath",
        type: "path",
        label: "Source Path",
        required: true,
      },
      {
        name: "displayWidth",
        type: "number",
        label: "Display Width (px)",
        default: 853,
      },
      {
        name: "isRecursive",
        type: "boolean",
        label: "Recursive",
        default: false,
      },
      {
        name: "recursiveDepth",
        type: "number",
        label: "Depth",
        default: 1,
        min: 1,
        visibleWhen: {
          fieldName: "isRecursive",
          value: true,
        },
      },
    ],
    groups: [
      {
        fields: ["isRecursive", "recursiveDepth"],
        layout: "field-group-check-fill",
      },
    ],
  },
  storeAspectRatioData: {
    summary: "Analyze and store aspect ratio metadata",
    tag: "Metadata Operations",
    outputFolderName: null,
    fields: [
      {
        name: "sourcePath",
        type: "path",
        label: "Source Path",
        required: true,
      },
      {
        name: "rootPath",
        type: "string",
        label: "Root Path",
      },
    ],
  },
}

// enum, languageCode, languageCodes — EnumField / LanguageCodeField / LanguageCodesField (W2B)
export const FIXTURE_COMMANDS_BUNDLE_B: Commands = {
  nameAnimeEpisodesAniDB: {
    summary:
      "Rename anime episode files using AniDB metadata",
    tag: "Naming Operations",
    outputFolderName: null,
    fields: [
      {
        name: "sourcePath",
        type: "path",
        label: "Source Path",
        required: true,
      },
      {
        name: "anidbId",
        type: "numberWithLookup",
        lookupType: "anidb",
        label: "AniDB Anime ID",
        required: true,
        companionNameField: "anidbName",
      },
      {
        name: "episodeType",
        type: "enum",
        label: "Episode Type",
        default: "regular",
        options: [
          { value: "regular", label: "Regular (type=1)" },
          {
            value: "specials",
            label: "Specials (S, type=2)",
          },
        ],
      },
    ],
  },
  changeTrackLanguages: {
    summary: "Change language tags for media tracks",
    tag: "Track Operations",
    outputFolderName: null,
    fields: [
      {
        name: "sourcePath",
        type: "path",
        label: "Source Path",
        required: true,
      },
      {
        name: "audioLanguage",
        type: "languageCode",
        label: "Audio Language",
      },
    ],
  },
  keepLanguages: {
    summary: "Filter media tracks by language",
    tag: "Track Operations",
    outputFolderName: "LANGUAGE-TRIMMED",
    fields: [
      {
        name: "sourcePath",
        type: "path",
        label: "Source Path",
        required: true,
      },
      {
        name: "audioLanguages",
        type: "languageCodes",
        label: "Audio Languages",
        placeholder: "eng, jpn",
      },
    ],
  },
}

// stringArray, numberArray, json — StringArrayField / NumberArrayField / JsonField (W2C)
export const FIXTURE_COMMANDS_BUNDLE_C: Commands = {
  deleteFilesByExtension: {
    summary: "Delete files matching extensions",
    tag: "File Operations",
    outputFolderName: null,
    fields: [
      {
        name: "sourcePath",
        type: "path",
        label: "Source Path",
        required: true,
      },
      {
        name: "extensions",
        type: "stringArray",
        label: "Extensions",
        required: true,
        placeholder: ".srt, .idx",
      },
    ],
  },
  mergeTracks: {
    summary: "Merge subtitle tracks into media files",
    tag: "Track Operations",
    outputFolderName: "SUBTITLED",
    fields: [
      {
        name: "mediaFilesPath",
        type: "path",
        label: "Media Files Path",
        required: true,
      },
      {
        name: "offsets",
        type: "numberArray",
        label: "Per-file Offsets (ms)",
        placeholder: "0, -200, 150",
      },
    ],
  },
}

// path, numberWithLookup, folderMultiSelect, subtitleRules — PathField etc. (W2D)
export const FIXTURE_COMMANDS_BUNDLE_D: Commands = {
  makeDirectory: {
    summary: "Create a directory",
    tag: "File Operations",
    outputFolderName: null,
    fields: [
      {
        name: "filePath",
        type: "path",
        label: "Directory Path",
        required: true,
      },
    ],
  },
  nameAnimeEpisodes: {
    summary:
      "Rename anime episode files using MyAnimeList metadata",
    tag: "Naming Operations",
    outputFolderName: null,
    fields: [
      {
        name: "sourcePath",
        type: "path",
        label: "Source Path",
        required: true,
      },
      {
        name: "malId",
        type: "numberWithLookup",
        lookupType: "mal",
        label: "MAL ID",
        required: true,
        companionNameField: "malName",
      },
    ],
  },
  storeAspectRatioData: {
    summary: "Analyze and store aspect ratio metadata",
    tag: "Metadata Operations",
    outputFolderName: null,
    fields: [
      {
        name: "sourcePath",
        type: "path",
        label: "Source Path",
        required: true,
      },
      {
        name: "folders",
        type: "folderMultiSelect",
        label: "Folders",
        sourceField: "sourcePath",
      },
    ],
  },
  modifySubtitleMetadata: {
    summary:
      "Apply DSL-driven modifications to ASS subtitle metadata",
    tag: "Subtitle Operations",
    outputFolderName: null,
    fields: [
      {
        name: "sourcePath",
        type: "path",
        label: "Source Path",
        required: true,
      },
      {
        name: "rules",
        type: "subtitleRules",
        label: "Rules",
      },
    ],
  },
}

// Combined export for tests that need multiple bundles at once
export const FIXTURE_COMMANDS: Commands = {
  ...FIXTURE_COMMANDS_BUNDLE_A,
  ...FIXTURE_COMMANDS_BUNDLE_B,
  ...FIXTURE_COMMANDS_BUNDLE_C,
  ...FIXTURE_COMMANDS_BUNDLE_D,
}
