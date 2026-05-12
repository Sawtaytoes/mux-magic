// ─── Command definitions ──────────────────────────────────────────────────────
//
// Each entry describes one API command the sequence builder can wire up.
// `tag` groups commands in the picker; `fields` lists the parameters the
// command accepts; `outputFolderName` is the subfolder suffix this command
// writes its output into (null = writes in-place or caller supplies path).

import type { Commands } from "../commands/types"

export const COMMANDS: Commands = {
  // File Operations
  makeDirectory: {
    summary:
      "Create a directory (or the parent directory of a file path)",
    tag: "File Operations",
    outputFolderName: null,
    fields: [
      {
        name: "filePath",
        type: "path",
        label: "Directory Path",
        description:
          "Directory path to create, or a file path whose parent directory should be created",
        required: true,
      },
    ],
  },
  copyFiles: {
    summary: "Copy files from source to destination",
    tag: "File Operations",
    outputFolderName: null,
    fields: [
      {
        name: "sourcePath",
        type: "path",
        label: "Source Path",
        description: "Directory to copy files from.",
        required: true,
      },
      {
        name: "destinationPath",
        type: "path",
        label: "Destination Path",
        description:
          "Directory to copy files into. Created if it does not already exist.",
        required: true,
      },
    ],
  },
  flattenOutput: {
    summary:
      "Flatten a chained step's output (copies files up one level; source folder kept by default)",
    tag: "File Operations",
    outputFolderName: null,
    // Files land in dirname(sourcePath), so the folder a downstream step
    // should chain off is the parent of the source — not the source itself.
    outputComputation: "parentOfSource",
    fields: [
      {
        name: "sourcePath",
        type: "path",
        label: "Output Folder to Flatten",
        description:
          "Output folder produced by a previous step (e.g. /work/SUBTITLED). Its contents are copied up one level into its parent.",
        required: true,
      },
      {
        name: "deleteSourceFolder",
        type: "boolean",
        label:
          "Also delete the source folder after copying",
        description:
          "Delete the source folder after copying. By default the source is preserved (debug-friendly).",
        default: false,
      },
    ],
  },
  moveFiles: {
    summary: "Move files from source to destination",
    tag: "File Operations",
    outputFolderName: null,
    fields: [
      {
        name: "sourcePath",
        type: "path",
        label: "Source Path",
        description:
          "Directory to move files from. Deleted after all files are copied.",
        required: true,
      },
      {
        name: "destinationPath",
        type: "path",
        label: "Destination Path",
        description:
          "Directory to move files into. Created if it does not already exist.",
        required: true,
      },
    ],
  },
  replaceAttachments: {
    summary: "Replace attachments in media files",
    tag: "File Operations",
    outputFolderName: "REPLACED-ATTACHMENTS",
    fields: [
      {
        name: "sourceFilesPath",
        type: "path",
        label: "Source Files Path",
        description:
          "Directory with media files with attachments you want to copy.",
        required: true,
      },
      {
        name: "destinationFilesPath",
        type: "path",
        label: "Destination Files Path",
        description:
          "Directory containing media files with attachments you want replaced.",
        required: true,
      },
    ],
  },
  deleteFilesByExtension: {
    summary: "Delete files matching extensions",
    tag: "File Operations",
    outputFolderName: null,
    fields: [
      {
        name: "sourcePath",
        type: "path",
        label: "Source Path",
        description:
          "Directory to search for files to delete.",
        required: true,
      },
      {
        name: "extensions",
        type: "stringArray",
        label: "Extensions",
        description:
          "List of file extensions to delete (with or without leading dot), e.g. ['.srt', 'idx'].",
        required: true,
        placeholder: ".srt, .idx",
      },
      {
        name: "isRecursive",
        type: "boolean",
        label: "Recursive",
        description:
          "Recursively search subdirectories for matching files.",
        default: false,
      },
      {
        name: "recursiveDepth",
        type: "number",
        label: "Depth",
        description:
          "Maximum recursion depth when Recursive is set (0 = default depth of 2).",
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
  deleteFolder: {
    summary:
      "Recursively delete a folder and all its contents (DESTRUCTIVE — requires Confirm)",
    tag: "File Operations",
    outputFolderName: null,
    fields: [
      {
        name: "folderPath",
        type: "path",
        label: "Folder to Delete",
        description: "Folder to delete (recursively).",
        required: true,
      },
      {
        name: "confirm",
        type: "boolean",
        label:
          "Confirm: I understand this will recursively delete the folder",
        description:
          "Required: check this to acknowledge this is destructive. Without it the command refuses to run.",
        required: true,
      },
    ],
  },
  splitChapters: {
    summary: "Split media files by chapter markers",
    tag: "File Operations",
    outputFolderName: "SPLITS",
    fields: [
      {
        name: "sourcePath",
        type: "path",
        label: "Source Path",
        description:
          "Directory where video files are located.",
        required: true,
      },
      {
        name: "chapterSplits",
        type: "stringArray",
        label: "Chapter Splits",
        description:
          "Space-separated list of comma-separated chapter markers. Splits occur at the beginning of the chapter.",
        required: true,
        placeholder: "ch1, ch2",
      },
    ],
  },
  remuxToMkv: {
    summary:
      "Pass-through container remux into .mkv siblings (no track changes)",
    tag: "File Operations",
    outputFolderName: null,
    fields: [
      {
        name: "sourcePath",
        type: "path",
        label: "Source Path",
        description: "Directory containing files to remux.",
        required: true,
      },
      {
        name: "extensions",
        type: "stringArray",
        label: "Extensions",
        description:
          "List of file extensions to remux (with or without leading dot), e.g. ['.ts', '.m2ts'].",
        required: true,
        placeholder: ".ts, .m2ts",
      },
      {
        name: "isRecursive",
        type: "boolean",
        label: "Recursive",
        description: "Recursively scan subdirectories.",
        default: false,
      },
      {
        name: "recursiveDepth",
        type: "number",
        label: "Depth",
        description:
          "Maximum recursion depth when Recursive is set (0 = default depth of 2).",
        default: 1,
        min: 1,
        visibleWhen: {
          fieldName: "isRecursive",
          value: true,
        },
      },
      {
        name: "isSourceDeletedOnSuccess",
        type: "boolean",
        label: "Delete source on per-file success",
        description:
          "Delete each source file after its remux completes successfully.",
        default: false,
      },
    ],
    groups: [
      {
        fields: ["isRecursive", "recursiveDepth"],
        layout: "field-group-check-fill",
      },
    ],
  },
  // Audio Operations
  getAudioOffsets: {
    summary: "Calculate audio sync offsets between files",
    tag: "Audio Operations",
    outputFolderName: "AUDIO-OFFSETS",
    fields: [
      {
        name: "sourceFilesPath",
        type: "path",
        label: "Source Files Path",
        description:
          "Directory with media files with tracks you want to copy.",
        required: true,
      },
      {
        name: "destinationFilesPath",
        type: "path",
        label: "Destination Files Path",
        description:
          "Directory containing media files with tracks you want replaced.",
        required: true,
      },
    ],
  },
  replaceFlacWithPcmAudio: {
    summary: "Replace FLAC audio with PCM audio",
    tag: "Audio Operations",
    outputFolderName: "AUDIO-CONVERTED",
    fields: [
      {
        name: "sourcePath",
        type: "path",
        label: "Source Path",
        description:
          "Directory containing media files or containing other directories of media files.",
        required: true,
      },
      {
        name: "isRecursive",
        type: "boolean",
        label: "Recursive",
        description:
          "Recursively looks in folders for media files.",
        default: false,
      },
    ],
  },
  // Track Operations
  changeTrackLanguages: {
    summary: "Change language tags for media tracks",
    tag: "Track Operations",
    outputFolderName: null,
    fields: [
      {
        name: "sourcePath",
        type: "path",
        label: "Source Path",
        description:
          "Directory with media files whose tracks need language metadata corrections.",
        required: true,
      },
      {
        name: "isRecursive",
        type: "boolean",
        label: "Recursive",
        description:
          "Recursively looks in folders for media files.",
        default: false,
      },
      {
        name: "audioLanguage",
        type: "languageCode",
        label: "Audio Language",
        description:
          "A 3-letter ISO-6392 language code for audio tracks. All tracks will be labeled with this language.",
      },
      {
        name: "subtitlesLanguage",
        type: "languageCode",
        label: "Subtitles Language",
        description:
          "A 3-letter ISO-6392 language code for subtitles tracks. All tracks will be labeled with this language.",
      },
      {
        name: "videoLanguage",
        type: "languageCode",
        label: "Video Language",
        description:
          "A 3-letter ISO-6392 language code for video tracks. All tracks will be labeled with this language.",
      },
    ],
  },
  fixIncorrectDefaultTracks: {
    summary: "Fix incorrect default track designations",
    tag: "Track Operations",
    outputFolderName: null,
    fields: [
      {
        name: "sourcePath",
        type: "path",
        label: "Source Path",
        description:
          "Directory containing media files or containing other directories of media files.",
        required: true,
      },
      {
        name: "isRecursive",
        type: "boolean",
        label: "Recursive",
        description:
          "Recursively looks in folders for media files.",
        default: false,
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
        description:
          "Directory where media files are located.",
        required: true,
      },
      {
        name: "isRecursive",
        type: "boolean",
        label: "Recursive",
        description:
          "Recursively looks in folders for media files.",
        default: false,
      },
      {
        name: "audioLanguages",
        type: "languageCodes",
        label: "Audio Languages",
        description:
          "A 3-letter ISO-6392 language code for audio tracks to keep. All others will be removed.",
        placeholder: "eng, jpn",
      },
      {
        name: "subtitlesLanguages",
        type: "languageCodes",
        label: "Subtitles Languages",
        description:
          "A 3-letter ISO-6392 language code for subtitles tracks to keep. All others will be removed.",
        placeholder: "eng",
      },
      {
        name: "useFirstAudioLanguage",
        type: "boolean",
        label: "First Audio Only",
        description:
          "The language of the first audio track is the only language kept for audio tracks.",
        default: false,
      },
      {
        name: "useFirstSubtitlesLanguage",
        type: "boolean",
        label: "First Subtitles Only",
        description:
          "The language of the first subtitles track is the only language kept for subtitles tracks.",
        default: false,
      },
    ],
    groups: [
      {
        fields: ["audioLanguages", "useFirstAudioLanguage"],
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
        description:
          "Directory with media files that need subtitles.",
        required: true,
      },
      {
        name: "subtitlesPath",
        type: "path",
        label: "Subtitles Path",
        description:
          "Directory containing subdirectories with subtitle files and attachments/ that match the name of the media files in mediaFilesPath.",
        required: true,
      },
      {
        name: "hasChapterSyncOffset",
        type: "boolean",
        label: "Chapter-Sync Offset",
        description:
          "Compute the audio sync offset by aligning chapter 1 between the destination media file's Menu track and a chapters.xml inside the subtitles path. Falls back to globalOffset (or per-file offsets) when no chapters.xml is found.",
        default: false,
      },
      {
        name: "globalOffset",
        type: "number",
        label: "Global Offset (ms)",
        description:
          "The offset in milliseconds to apply to all audio being transferred.",
        default: 0,
      },
      {
        name: "includeChapters",
        type: "boolean",
        label: "Include Chapters",
        description:
          "Adds chapters along with other tracks.",
        default: false,
      },
      {
        name: "offsets",
        type: "numberArray",
        label: "Per-file Offsets (ms)",
        description:
          "Space-separated list of time-alignment offsets to set for each individual file in milliseconds.",
        placeholder: "0, -200, 150",
      },
    ],
  },
  reorderTracks: {
    summary: "Reorder media tracks",
    tag: "Track Operations",
    outputFolderName: "REORDERED-TRACKS",
    fields: [
      {
        name: "sourcePath",
        type: "path",
        label: "Source Path",
        description:
          "Directory with media files whose tracks need reordering.",
        required: true,
      },
      {
        name: "isRecursive",
        type: "boolean",
        label: "Recursive",
        description:
          "Recursively looks in folders for media files.",
        default: false,
      },
      {
        name: "videoTrackIndexes",
        type: "numberArray",
        label: "Video Track Indexes",
        description:
          "The order of all video tracks that will appear in the resulting file by their index. Indexes start at 0. If you leave out any track indexes, they will not appear in the resulting file.",
        placeholder: "0",
      },
      {
        name: "audioTrackIndexes",
        type: "numberArray",
        label: "Audio Track Indexes",
        description:
          "The order of all audio tracks that will appear in the resulting file by their index. Indexes start at 0. If you leave out any track indexes, they will not appear in the resulting file.",
        placeholder: "0, 1",
      },
      {
        name: "subtitlesTrackIndexes",
        type: "numberArray",
        label: "Subtitles Track Indexes",
        description:
          "The order of all subtitles tracks that will appear in the resulting file by their index. Indexes start at 0. If you leave out any track indexes, they will not appear in the resulting file.",
        placeholder: "0",
      },
    ],
  },
  replaceTracks: {
    summary: "Replace media tracks in destination files",
    tag: "Track Operations",
    outputFolderName: "REPLACED-TRACKS",
    fields: [
      {
        name: "sourceFilesPath",
        type: "path",
        label: "Source Files Path",
        description:
          "Directory with media files with tracks you want to copy.",
        required: true,
      },
      {
        name: "destinationFilesPath",
        type: "path",
        label: "Destination Files Path",
        description:
          "Directory containing media files with tracks you want replaced.",
        required: true,
      },
      {
        name: "hasChapterSyncOffset",
        type: "boolean",
        label: "Chapter-Sync Offset",
        description:
          "Compute the audio sync offset by aligning chapter 1 between the destination media file's Menu track and a chapters.xml inside the source files path. Falls back to globalOffset (or per-file offsets) when false or when no chapters.xml is found.",
        default: false,
      },
      {
        name: "globalOffset",
        type: "number",
        label: "Global Offset (ms)",
        description:
          "The offset in milliseconds to apply to all audio being transferred.",
        default: 0,
      },
      {
        name: "includeChapters",
        type: "boolean",
        label: "Include Chapters",
        description:
          "Adds chapters along with other tracks.",
        default: false,
      },
      {
        name: "audioLanguages",
        type: "languageCodes",
        label: "Audio Languages",
        description:
          "A 3-letter ISO-6392 language code for audio tracks to keep. All others will be removed.",
        placeholder: "eng, jpn",
      },
      {
        name: "subtitlesLanguages",
        type: "languageCodes",
        label: "Subtitles Languages",
        description:
          "A 3-letter ISO-6392 language code for subtitles tracks to keep. All others will be removed.",
        placeholder: "eng",
      },
      {
        name: "videoLanguages",
        type: "languageCodes",
        label: "Video Languages",
        description:
          "A 3-letter ISO-6392 language code for video tracks to keep. All others will be removed.",
      },
      {
        name: "offsets",
        type: "numberArray",
        label: "Per-file Offsets (ms)",
        description:
          "Space-separated list of time-alignment offsets to set for each individual file in milliseconds.",
      },
    ],
  },
  // Subtitle Operations
  extractSubtitles: {
    summary:
      "Extract subtitle tracks into separate files alongside each video file",
    tag: "Subtitle Operations",
    outputFolderName: "EXTRACTED-SUBTITLES",
    fields: [
      {
        name: "sourcePath",
        type: "path",
        label: "Source Path",
        description:
          "Directory containing media files or containing other directories of media files.",
        required: true,
      },
      {
        name: "isRecursive",
        type: "boolean",
        label: "Recursive",
        description:
          "Recursively looks in folders for media files.",
        default: false,
      },
      {
        name: "subtitlesLanguage",
        type: "languageCode",
        label: "Subtitles Language",
        description:
          "A 3-letter ISO-6392 language code for subtitles tracks to keep. All others will be removed.",
      },
    ],
  },
  copyOutSubtitles: {
    summary:
      "[DEPRECATED — use extractSubtitles] Extract subtitle tracks into separate files alongside each video file",
    note: "DEPRECATED: this command was renamed to 'extractSubtitles'. Update your saved sequences — the old name will be removed in a future release.",
    tag: "Subtitle Operations",
    outputFolderName: "EXTRACTED-SUBTITLES",
    fields: [
      {
        name: "sourcePath",
        type: "path",
        label: "Source Path",
        description:
          "Directory containing media files or containing other directories of media files.",
        required: true,
      },
      {
        name: "isRecursive",
        type: "boolean",
        label: "Recursive",
        description:
          "Recursively looks in folders for media files.",
        default: false,
      },
      {
        name: "subtitlesLanguage",
        type: "languageCode",
        label: "Subtitles Language",
        description:
          "A 3-letter ISO-6392 language code for subtitles tracks to keep. All others will be removed.",
      },
    ],
  },
  isMissingSubtitles: {
    summary: "Identify media files missing subtitle tracks",
    tag: "Subtitle Operations",
    outputFolderName: null,
    fields: [
      {
        name: "sourcePath",
        type: "path",
        label: "Source Path",
        description:
          "Directory containing media files or containing other directories of media files.",
        required: true,
      },
      {
        name: "isRecursive",
        type: "boolean",
        label: "Recursive",
        description:
          "Recursively looks in folders for media files.",
        default: false,
      },
    ],
  },
  modifySubtitleMetadata: {
    summary:
      "Apply DSL-driven modifications to ASS subtitle metadata. Toggle hasDefaultRules to prepend the in-tree heuristic rules.",
    tag: "Subtitle Operations",
    outputFolderName: null,
    fields: [
      {
        name: "sourcePath",
        type: "path",
        label: "Source Path",
        description:
          "Directory containing .ass subtitle files to modify.",
        required: true,
      },
      {
        name: "isRecursive",
        type: "boolean",
        label: "Recursive",
        description:
          "Recursively search subdirectories for .ass files.",
        default: false,
      },
      {
        name: "recursiveDepth",
        type: "number",
        label: "Depth",
        description:
          "Maximum recursion depth when Recursive is set (0 = default depth of 2).",
        default: 1,
        min: 1,
        visibleWhen: {
          fieldName: "isRecursive",
          value: true,
        },
      },
      // `predicates` and `hasDefaultRules` ride alongside `rules` and are
      // edited together inside the structured `subtitleRules` editor below.
      // Listing them as `hidden` keeps buildParams emitting them into YAML
      // without the step renderer trying to show a separate input row.
      { name: "predicates", type: "hidden" },
      {
        name: "hasDefaultRules",
        type: "hidden",
        default: false,
      },
      // `subtitleRules` is the structured form-builder for the
      // modifySubtitleMetadata DSL — see
      // public/builder/js/components/dsl-rules-builder.js. It renders
      // its own dispatcher in renderFields. NOT `linkable` — the only
      // command that emitted a `rules` output (computeDefaultSubtitleRules)
      // was dropped in W26b in favor of the `hasDefaultRules` toggle, so
      // there's nothing upstream to wire into. Strip the link picker
      // until/unless a new rules-emitting command appears.
      {
        name: "rules",
        type: "subtitleRules",
        label: "Rules",
        description:
          "Ordered list of DSL modification rules to apply to each .ass file. Empty when only relying on the Default Rules toggle for the rule set.",
        required: false,
      },
    ],
    groups: [
      {
        fields: ["isRecursive", "recursiveDepth"],
        layout: "field-group-check-fill",
      },
    ],
  },
  // Analysis
  hasBetterAudio: {
    summary:
      "Analyze and compare audio quality across files",
    tag: "Analysis",
    outputFolderName: null,
    fields: [
      {
        name: "sourcePath",
        type: "path",
        label: "Source Path",
        description:
          "Directory containing media files or containing other directories of media files.",
        required: true,
      },
      {
        name: "isRecursive",
        type: "boolean",
        label: "Recursive",
        description:
          "Recursively looks in folders for media files.",
        default: false,
      },
      {
        name: "recursiveDepth",
        type: "number",
        label: "Depth",
        description:
          "How many deep of child directories to follow (2 or 3) when using Recursive.",
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
  hasBetterVersion: {
    summary: "Check if better version of media exists",
    tag: "Analysis",
    outputFolderName: null,
    fields: [
      {
        name: "sourcePath",
        type: "path",
        label: "Source Path",
        description:
          "Directory containing media files or containing other directories of media files.",
        required: true,
      },
      {
        name: "isRecursive",
        type: "boolean",
        label: "Recursive",
        description:
          "Recursively looks in folders for media files.",
        default: false,
      },
      {
        name: "recursiveDepth",
        type: "number",
        label: "Depth",
        description:
          "How many deep of child directories to follow (2 or 3) when using Recursive.",
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
  hasDuplicateMusicFiles: {
    summary: "Identify duplicate music files",
    tag: "Analysis",
    outputFolderName: null,
    fields: [
      {
        name: "sourcePath",
        type: "path",
        label: "Source Path",
        description:
          "Directory containing music files or containing other directories of music files.",
        required: true,
      },
      {
        name: "isRecursive",
        type: "boolean",
        label: "Recursive",
        description:
          "Recursively looks in folders for music files.",
        default: false,
      },
      {
        name: "recursiveDepth",
        type: "number",
        label: "Depth",
        description:
          "How many deep of child directories to follow (2 or 3) when using Recursive.",
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
  hasImaxEnhancedAudio: {
    summary: "Check for IMAX enhanced audio tracks",
    tag: "Analysis",
    outputFolderName: null,
    fields: [
      {
        name: "sourcePath",
        type: "path",
        label: "Source Path",
        description:
          "Directory containing media files or containing other directories of media files.",
        required: true,
      },
      {
        name: "isRecursive",
        type: "boolean",
        label: "Recursive",
        description:
          "Recursively looks in folders for media files.",
        default: false,
      },
    ],
  },
  hasManyAudioTracks: {
    summary: "Identify files with many audio tracks",
    tag: "Analysis",
    outputFolderName: null,
    fields: [
      {
        name: "sourcePath",
        type: "path",
        label: "Source Path",
        description:
          "Directory containing media files or containing other directories of media files.",
        required: true,
      },
      {
        name: "isRecursive",
        type: "boolean",
        label: "Recursive",
        description:
          "Recursively looks in folders for media files.",
        default: false,
      },
    ],
  },
  hasSurroundSound: {
    summary: "Check for surround sound audio tracks",
    tag: "Analysis",
    outputFolderName: null,
    fields: [
      {
        name: "sourcePath",
        type: "path",
        label: "Source Path",
        description:
          "Directory containing media files or containing other directories of media files.",
        required: true,
      },
      {
        name: "isRecursive",
        type: "boolean",
        label: "Recursive",
        description:
          "Recursively looks in folders for media files.",
        default: false,
      },
      {
        name: "recursiveDepth",
        type: "number",
        label: "Depth",
        description:
          "How many deep of child directories to follow (2 or 3) when using Recursive.",
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
  hasWrongDefaultTrack: {
    summary:
      "Find files with incorrect default track selection",
    tag: "Analysis",
    outputFolderName: null,
    fields: [
      {
        name: "sourcePath",
        type: "path",
        label: "Source Path",
        description:
          "Directory containing media files or containing other directories of media files.",
        required: true,
      },
      {
        name: "isRecursive",
        type: "boolean",
        label: "Recursive",
        description:
          "Recursively looks in folders for media files.",
        default: false,
      },
    ],
  },
  // Naming Operations
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
        description:
          "Directory where all episodes are located.",
        required: true,
      },
      {
        name: "malId",
        type: "numberWithLookup",
        lookupType: "mal",
        label: "MAL ID",
        description:
          "MyAnimeList ID — when provided, skips the interactive search and uses this ID directly.",
        placeholder: "39534",
        required: true,
        companionNameField: "malName",
      },
      {
        name: "seasonNumber",
        type: "number",
        label: "Season Number",
        description:
          "The season number to output when renaming, useful for TVDB which has separate season numbers. For AniDB, use the default value 1.",
        default: 1,
      },
    ],
  },
  nameAnimeEpisodesAniDB: {
    summary:
      "Rename anime episode files using AniDB metadata (better OVA/special coverage than MAL)",
    note: "Specials / Credits / Trailers / Parodies each run an interactive length-matched per-file picker — answer the prompts in the job log. Space skips the current file; Esc cancels the loop and applies any matches confirmed so far. Regular and Others are index-paired with a duration sanity-check warning when the file and AniDB lengths diverge by >2m. If AniDB lists both a 'Complete' and 'Part N' form, you'll be asked which one your files match. Episode-range selection is still planned — see README §AniDB command notes.",
    tag: "Naming Operations",
    outputFolderName: null,
    fields: [
      {
        name: "sourcePath",
        type: "path",
        label: "Source Path",
        description:
          "Directory where all episodes are located.",
        required: true,
      },
      {
        name: "anidbId",
        type: "numberWithLookup",
        lookupType: "anidb",
        label: "AniDB Anime ID",
        description:
          "AniDB anime id (aid). When provided, skips the interactive search.",
        placeholder: "8160",
        required: true,
        companionNameField: "anidbName",
      },
      {
        name: "seasonNumber",
        type: "number",
        label: "Season Number",
        description:
          "Season number for the output filename (Plex-style sNNeNN). Ignored when Episode Type is set to Specials.",
        default: 1,
      },
      {
        name: "episodeType",
        type: "enum",
        label: "Episode Type",
        description:
          "Which AniDB episode types to rename. Each non-regular sub-type is run separately: specials (S), credits (C, OP/ED), trailers (T), parodies (P) all run the length-matched per-file picker and emit Plex's s00eNN. Others (type=6 alts) and regular are index-paired with a duration sanity-check warning.",
        default: "regular",
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
      },
    ],
  },
  nameSpecialFeatures: {
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
      {
        name: "sourcePath",
        type: "path",
        label: "Source Path",
        description:
          "Directory where special features are located.",
        required: true,
      },
      {
        name: "dvdCompareId",
        type: "numberWithLookup",
        lookupType: "dvdcompare",
        label: "DVDCompare Film ID",
        description:
          "DVDCompare film ID — when provided, constructs URL directly and bypasses search.",
        placeholder: "74759",
        required: true,
        companionNameField: "dvdCompareName",
      },
      {
        name: "dvdCompareReleaseHash",
        type: "number",
        label: "Release Hash",
        description:
          "The hash (URL fragment #) from the DVDCompare release page denoting which release variant is selected for that film. Defaults to 1 (the first release option).",
        default: 1,
        companionNameField: "dvdCompareReleaseLabel",
      },
      {
        name: "fixedOffset",
        type: "number",
        label: "Fixed Offset (ms)",
        description:
          "Timecodes are pushed positively or negatively by this amount (in milliseconds).",
        default: 0,
      },
      {
        name: "timecodePadding",
        type: "number",
        label: "Timecode Padding",
        description:
          "Seconds that timecodes may be off. Defaults to 2, matching typical DVDCompare-vs-rip drift. Pass 0 for exact-match-only.",
        default: 2,
      },
      // Defaults to false in the Builder so the Phase-B "which file is
      // which?" pick modal becomes the interactive UX. The schema /
      // sequence-runner default remains true so non-interactive callers
      // (sequence YAML / direct API) keep today's deterministic
      // (2)/(3)/… behavior unless they opt in explicitly.
      {
        name: "autoNameDuplicates",
        type: "boolean",
        label: "Auto-name duplicates",
        description:
          "When two-or-more files match the same target name within a single run, auto-disambiguate them with (2)/(3)/… suffixes deterministically. Pass false to instead emit a duplicate-pick prompt for each ambiguous group.",
        default: false,
      },
    ],
    // Group small numeric fields side-by-side on wider cards, using
    // container queries so they adapt to card width (when 2 cards display
    // side-by-side), not just the viewport.
    groups: [
      {
        fields: ["fixedOffset", "timecodePadding"],
        layout: "field-group-two-col",
      },
    ],
  },
  nameTvShowEpisodes: {
    summary:
      "Rename TV show episode files based on metadata",
    tag: "Naming Operations",
    outputFolderName: null,
    fields: [
      {
        name: "sourcePath",
        type: "path",
        label: "Source Path",
        description:
          "Directory where all episodes for that season are located.",
        required: true,
      },
      {
        name: "tvdbId",
        type: "numberWithLookup",
        lookupType: "tvdb",
        label: "TVDB ID",
        description:
          "TVDB ID — when provided, skips the interactive search and uses this ID directly.",
        placeholder: "76703",
        required: true,
        companionNameField: "tvdbName",
      },
      {
        name: "seasonNumber",
        type: "number",
        label: "Season Number",
        description:
          "The season number to lookup when renaming.",
        required: true,
      },
    ],
  },
  renameDemos: {
    summary: "Rename demo files based on content analysis",
    tag: "Naming Operations",
    outputFolderName: null,
    fields: [
      {
        name: "sourcePath",
        type: "path",
        label: "Source Path",
        description:
          "Directory where demo files are located.",
        required: true,
      },
      {
        name: "isRecursive",
        type: "boolean",
        label: "Recursive",
        description:
          "Recursively looks in folders for media files.",
        default: false,
      },
    ],
  },
  renameMovieClipDownloads: {
    summary: "Rename downloaded movie clip files",
    tag: "Naming Operations",
    outputFolderName: null,
    fields: [
      {
        name: "sourcePath",
        type: "path",
        label: "Source Path",
        description:
          "Directory where downloaded movie demos are located.",
        required: true,
      },
    ],
  },
  // Video Operations
  setDisplayWidth: {
    summary: "Set display width for video tracks",
    tag: "Video Operations",
    outputFolderName: null,
    fields: [
      {
        name: "sourcePath",
        type: "path",
        label: "Source Path",
        description:
          "Directory where video files are located.",
        required: true,
      },
      {
        name: "displayWidth",
        type: "number",
        label: "Display Width (px)",
        description:
          "Display width of the video file. For DVDs, they're all 3:2, but you can set them to the proper 4:3 or 16:9 aspect ratio with anamorphic (non-square) pixels using this value.",
        default: 853,
      },
      {
        name: "isRecursive",
        type: "boolean",
        label: "Recursive",
        description:
          "Recursively looks in folders for media files.",
        default: false,
      },
      {
        name: "recursiveDepth",
        type: "number",
        label: "Depth",
        description:
          "How many deep of child directories to follow (2 or 3) when using Recursive.",
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
  // Metadata Operations
  storeAspectRatioData: {
    summary: "Analyze and store aspect ratio metadata",
    tag: "Metadata Operations",
    outputFolderName: null,
    fields: [
      {
        name: "sourcePath",
        type: "path",
        label: "Source Path",
        description:
          "Directory containing media files or containing other directories of media files.",
        required: true,
      },
      {
        name: "isRecursive",
        type: "boolean",
        label: "Recursive",
        description:
          "Recursively look in folders for media files. Defaults to true since Plex-style libraries are nested (Movies/<title>/<file>); uncheck to scan only the source path.",
        default: false,
      },
      {
        name: "recursiveDepth",
        type: "number",
        label: "Depth",
        description:
          "How many directory levels deep to scan, counting sourcePath as level 1. Default 3 covers Plex's edition layout. Only used with Recursive.",
        default: 1,
        min: 1,
        visibleWhen: {
          fieldName: "isRecursive",
          value: true,
        },
      },
      {
        name: "outputPath",
        type: "path",
        label: "Output Path",
        description:
          "Location of the resulting JSON file. If using append mode, it will search here for the JSON file. By default, this uses the sourcePath.",
      },
      {
        name: "rootPath",
        type: "string",
        label: "Root Path",
        description:
          "Path your media player (Plex, Jellyfin, Emby) sees for your library — written into the output JSON's file paths so the player can match its catalog. The path does not have to exist on this machine.",
      },
      {
        name: "folders",
        type: "folderMultiSelect",
        label: "Folders",
        description:
          "List of folder names relative to the sourcePath to include. If you're searching a root path with lots of media, this can reduce the list to only those in Plex. Ensure these folder names match the ones in Plex.",
        sourceField: "sourcePath",
      },
      {
        name: "force",
        type: "boolean",
        label: "Force Overwrite",
        description:
          "Instead of appending the current JSON file, it will rescan every file.",
        default: false,
      },
    ],
    groups: [
      {
        fields: ["isRecursive", "recursiveDepth"],
        layout: "field-group-check-fill",
      },
    ],
  },
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
