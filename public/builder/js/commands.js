// ─── Command definitions ──────────────────────────────────────────────────────
//
// Each entry describes one API command the sequence builder can wire up.
// `tag` groups commands in the picker; `fields` lists the parameters the
// command accepts; `outputFolderName` is the subfolder suffix this command
// writes its output into (null = writes in-place or caller supplies path).

export const COMMANDS = {
  // File Operations
  makeDirectory: {
    summary: "Create a directory (or the parent directory of a file path)",
    tag: "File Operations",
    outputFolderName: null,
    fields: [
      { name: "filePath", type: "path", label: "Directory Path", required: true },
    ]
  },
  copyFiles: {
    summary: "Copy files from source to destination",
    tag: "File Operations",
    outputFolderName: null,
    fields: [
      { name: "sourcePath", type: "path", label: "Source Path", required: true },
      { name: "destinationPath", type: "path", label: "Destination Path", required: true },
    ]
  },
  flattenOutput: {
    summary: "Flatten a chained step's output (copies files up one level; source folder kept by default)",
    tag: "File Operations",
    outputFolderName: null,
    // Files land in dirname(sourcePath), so the folder a downstream step
    // should chain off is the parent of the source — not the source itself.
    outputComputation: 'parentOfSource',
    fields: [
      { name: "sourcePath", type: "path", label: "Output Folder to Flatten", required: true },
      { name: "deleteSourceFolder", type: "boolean", label: "Also delete the source folder after copying", default: false },
    ]
  },
  moveFiles: {
    summary: "Move files from source to destination",
    tag: "File Operations",
    outputFolderName: null,
    fields: [
      { name: "sourcePath", type: "path", label: "Source Path", required: true },
      { name: "destinationPath", type: "path", label: "Destination Path", required: true },
    ]
  },
  replaceAttachments: {
    summary: "Replace attachments in media files",
    tag: "File Operations",
    outputFolderName: "REPLACED-ATTACHMENTS",
    fields: [
      { name: "sourceFilesPath", type: "path", label: "Source Files Path", required: true },
      { name: "destinationFilesPath", type: "path", label: "Destination Files Path", required: true },
    ]
  },
  deleteFilesByExtension: {
    summary: "Delete files matching extensions",
    tag: "File Operations",
    outputFolderName: null,
    fields: [
      { name: "sourcePath", type: "path", label: "Source Path", required: true },
      { name: "extensions", type: "stringArray", label: "Extensions", required: true, placeholder: ".srt, .idx" },
      { name: "isRecursive", type: "boolean", label: "Recursive", default: false },
      { name: "recursiveDepth", type: "number", label: "Recursive Depth", default: 0 },
    ]
  },
  deleteFolder: {
    summary: "Recursively delete a folder and all its contents (DESTRUCTIVE — requires Confirm)",
    tag: "File Operations",
    outputFolderName: null,
    fields: [
      { name: "folderPath", type: "path", label: "Folder to Delete", required: true },
      { name: "confirm", type: "boolean", label: "Confirm: I understand this will recursively delete the folder", required: true },
    ]
  },
  splitChapters: {
    summary: "Split media files by chapter markers",
    tag: "File Operations",
    outputFolderName: "SPLITS",
    fields: [
      { name: "sourcePath", type: "path", label: "Source Path", required: true },
      { name: "chapterSplits", type: "stringArray", label: "Chapter Splits", required: true, placeholder: "ch1, ch2" },
    ]
  },
  remuxToMkv: {
    summary: "Pass-through container remux into .mkv siblings (no track changes)",
    tag: "File Operations",
    outputFolderName: null,
    fields: [
      { name: "sourcePath", type: "path", label: "Source Path", required: true },
      { name: "extensions", type: "stringArray", label: "Extensions", required: true, placeholder: ".ts, .m2ts" },
      { name: "isRecursive", type: "boolean", label: "Recursive", default: false },
      { name: "recursiveDepth", type: "number", label: "Recursive Depth", default: 0 },
      { name: "isSourceDeletedOnSuccess", type: "boolean", label: "Delete source on per-file success", default: false },
    ]
  },
  // Audio Operations
  getAudioOffsets: {
    summary: "Calculate audio sync offsets between files",
    tag: "Audio Operations",
    outputFolderName: "AUDIO-OFFSETS",
    fields: [
      { name: "sourceFilesPath", type: "path", label: "Source Files Path", required: true },
      { name: "destinationFilesPath", type: "path", label: "Destination Files Path", required: true },
    ]
  },
  replaceFlacWithPcmAudio: {
    summary: "Replace FLAC audio with PCM audio",
    tag: "Audio Operations",
    outputFolderName: "AUDIO-CONVERTED",
    fields: [
      { name: "sourcePath", type: "path", label: "Source Path", required: true },
      { name: "isRecursive", type: "boolean", label: "Recursive", default: false },
    ]
  },
  // Track Operations
  changeTrackLanguages: {
    summary: "Change language tags for media tracks",
    tag: "Track Operations",
    outputFolderName: null,
    fields: [
      { name: "sourcePath", type: "path", label: "Source Path", required: true },
      { name: "isRecursive", type: "boolean", label: "Recursive", default: false },
      { name: "audioLanguage", type: "languageCode", label: "Audio Language" },
      { name: "subtitlesLanguage", type: "languageCode", label: "Subtitles Language" },
      { name: "videoLanguage", type: "languageCode", label: "Video Language" },
    ]
  },
  fixIncorrectDefaultTracks: {
    summary: "Fix incorrect default track designations",
    tag: "Track Operations",
    outputFolderName: null,
    fields: [
      { name: "sourcePath", type: "path", label: "Source Path", required: true },
      { name: "isRecursive", type: "boolean", label: "Recursive", default: false },
    ]
  },
  keepLanguages: {
    summary: "Filter media tracks by language",
    tag: "Track Operations",
    outputFolderName: "LANGUAGE-TRIMMED",
    fields: [
      { name: "sourcePath", type: "path", label: "Source Path", required: true },
      { name: "isRecursive", type: "boolean", label: "Recursive", default: false },
      { name: "audioLanguages", type: "languageCodes", label: "Audio Languages", placeholder: "eng, jpn" },
      { name: "subtitlesLanguages", type: "languageCodes", label: "Subtitles Languages", placeholder: "eng" },
      { name: "useFirstAudioLanguage", type: "boolean", label: "Use First Audio Language Only", default: false },
      { name: "useFirstSubtitlesLanguage", type: "boolean", label: "Use First Subtitles Language Only", default: false },
    ]
  },
  mergeTracks: {
    summary: "Merge subtitle tracks into media files",
    tag: "Track Operations",
    outputFolderName: "SUBTITLED",
    fields: [
      { name: "mediaFilesPath", type: "path", label: "Media Files Path", required: true },
      { name: "subtitlesPath", type: "path", label: "Subtitles Path", required: true },
      { name: "hasChapterSyncOffset", type: "boolean", label: "Chapter-Sync Offset", default: false },
      { name: "globalOffset", type: "number", label: "Global Offset (ms)", default: 0 },
      { name: "includeChapters", type: "boolean", label: "Include Chapters", default: false },
      { name: "offsets", type: "numberArray", label: "Per-file Offsets (ms)", placeholder: "0, -200, 150" },
    ]
  },
  reorderTracks: {
    summary: "Reorder media tracks",
    tag: "Track Operations",
    outputFolderName: "REORDERED-TRACKS",
    fields: [
      { name: "sourcePath", type: "path", label: "Source Path", required: true },
      { name: "isRecursive", type: "boolean", label: "Recursive", default: false },
      { name: "videoTrackIndexes", type: "numberArray", label: "Video Track Indexes", placeholder: "0" },
      { name: "audioTrackIndexes", type: "numberArray", label: "Audio Track Indexes", placeholder: "0, 1" },
      { name: "subtitlesTrackIndexes", type: "numberArray", label: "Subtitles Track Indexes", placeholder: "0" },
    ]
  },
  replaceTracks: {
    summary: "Replace media tracks in destination files",
    tag: "Track Operations",
    outputFolderName: "REPLACED-TRACKS",
    fields: [
      { name: "sourceFilesPath", type: "path", label: "Source Files Path", required: true },
      { name: "destinationFilesPath", type: "path", label: "Destination Files Path", required: true },
      { name: "hasChapterSyncOffset", type: "boolean", label: "Chapter-Sync Offset", default: false },
      { name: "globalOffset", type: "number", label: "Global Offset (ms)", default: 0 },
      { name: "includeChapters", type: "boolean", label: "Include Chapters", default: false },
      { name: "audioLanguages", type: "languageCodes", label: "Audio Languages", placeholder: "eng, jpn" },
      { name: "subtitlesLanguages", type: "languageCodes", label: "Subtitles Languages", placeholder: "eng" },
      { name: "videoLanguages", type: "languageCodes", label: "Video Languages" },
      { name: "offsets", type: "numberArray", label: "Per-file Offsets (ms)" },
    ]
  },
  // Subtitle Operations
  extractSubtitles: {
    summary: "Extract subtitle tracks into separate files alongside each video file",
    tag: "Subtitle Operations",
    outputFolderName: "EXTRACTED-SUBTITLES",
    fields: [
      { name: "sourcePath", type: "path", label: "Source Path", required: true },
      { name: "isRecursive", type: "boolean", label: "Recursive", default: false },
      { name: "subtitlesLanguage", type: "languageCode", label: "Subtitles Language" },
    ]
  },
  copyOutSubtitles: {
    summary: "[DEPRECATED — use extractSubtitles] Extract subtitle tracks into separate files alongside each video file",
    note: "DEPRECATED: this command was renamed to 'extractSubtitles'. Update your saved sequences — the old name will be removed in a future release.",
    tag: "Subtitle Operations",
    outputFolderName: "EXTRACTED-SUBTITLES",
    fields: [
      { name: "sourcePath", type: "path", label: "Source Path", required: true },
      { name: "isRecursive", type: "boolean", label: "Recursive", default: false },
      { name: "subtitlesLanguage", type: "languageCode", label: "Subtitles Language" },
    ]
  },
  isMissingSubtitles: {
    summary: "Identify media files missing subtitle tracks",
    tag: "Subtitle Operations",
    outputFolderName: null,
    fields: [
      { name: "sourcePath", type: "path", label: "Source Path", required: true },
      { name: "isRecursive", type: "boolean", label: "Recursive", default: false },
    ]
  },
  modifySubtitleMetadata: {
    summary: "Apply DSL-driven modifications to ASS subtitle metadata. Toggle hasDefaultRules to prepend the in-tree heuristic rules.",
    tag: "Subtitle Operations",
    outputFolderName: null,
    fields: [
      { name: "sourcePath", type: "path", label: "Source Path", required: true },
      { name: "isRecursive", type: "boolean", label: "Recursive", default: false },
      { name: "recursiveDepth", type: "number", label: "Recursive Depth", default: 0 },
      // `predicates` and `hasDefaultRules` ride alongside `rules` and are
      // edited together inside the structured `subtitleRules` editor below.
      // Listing them as `hidden` keeps buildParams emitting them into YAML
      // without the step renderer trying to show a separate input row.
      { name: "predicates", type: "hidden" },
      { name: "hasDefaultRules", type: "hidden", default: false },
      // `subtitleRules` is the structured form-builder for the
      // modifySubtitleMetadata DSL — see
      // public/builder/js/components/dsl-rules-builder.js. It renders
      // its own dispatcher in renderFields. NOT `linkable` — the only
      // command that emitted a `rules` output (computeDefaultSubtitleRules)
      // was dropped in W26b in favor of the `hasDefaultRules` toggle, so
      // there's nothing upstream to wire into. Strip the link picker
      // until/unless a new rules-emitting command appears.
      { name: "rules", type: "subtitleRules", label: "Rules", required: false },
    ]
  },
  // Analysis
  hasBetterAudio: {
    summary: "Analyze and compare audio quality across files",
    tag: "Analysis",
    outputFolderName: null,
    fields: [
      { name: "sourcePath", type: "path", label: "Source Path", required: true },
      { name: "isRecursive", type: "boolean", label: "Recursive", default: false },
      { name: "recursiveDepth", type: "number", label: "Recursive Depth", default: 0 },
    ]
  },
  hasBetterVersion: {
    summary: "Check if better version of media exists",
    tag: "Analysis",
    outputFolderName: null,
    fields: [
      { name: "sourcePath", type: "path", label: "Source Path", required: true },
      { name: "isRecursive", type: "boolean", label: "Recursive", default: false },
      { name: "recursiveDepth", type: "number", label: "Recursive Depth", default: 0 },
    ]
  },
  hasDuplicateMusicFiles: {
    summary: "Identify duplicate music files",
    tag: "Analysis",
    outputFolderName: null,
    fields: [
      { name: "sourcePath", type: "path", label: "Source Path", required: true },
      { name: "isRecursive", type: "boolean", label: "Recursive", default: false },
      { name: "recursiveDepth", type: "number", label: "Recursive Depth", default: 0 },
    ]
  },
  hasImaxEnhancedAudio: {
    summary: "Check for IMAX enhanced audio tracks",
    tag: "Analysis",
    outputFolderName: null,
    fields: [
      { name: "sourcePath", type: "path", label: "Source Path", required: true },
      { name: "isRecursive", type: "boolean", label: "Recursive", default: false },
    ]
  },
  hasManyAudioTracks: {
    summary: "Identify files with many audio tracks",
    tag: "Analysis",
    outputFolderName: null,
    fields: [
      { name: "sourcePath", type: "path", label: "Source Path", required: true },
      { name: "isRecursive", type: "boolean", label: "Recursive", default: false },
    ]
  },
  hasSurroundSound: {
    summary: "Check for surround sound audio tracks",
    tag: "Analysis",
    outputFolderName: null,
    fields: [
      { name: "sourcePath", type: "path", label: "Source Path", required: true },
      { name: "isRecursive", type: "boolean", label: "Recursive", default: false },
      { name: "recursiveDepth", type: "number", label: "Recursive Depth", default: 0 },
    ]
  },
  hasWrongDefaultTrack: {
    summary: "Find files with incorrect default track selection",
    tag: "Analysis",
    outputFolderName: null,
    fields: [
      { name: "sourcePath", type: "path", label: "Source Path", required: true },
      { name: "isRecursive", type: "boolean", label: "Recursive", default: false },
    ]
  },
  // Naming Operations
  nameAnimeEpisodes: {
    summary: "Rename anime episode files using MyAnimeList metadata",
    tag: "Naming Operations",
    outputFolderName: null,
    fields: [
      { name: "sourcePath", type: "path", label: "Source Path", required: true },
      { name: "malId", type: "numberWithLookup", lookupType: "mal", label: "MAL ID", placeholder: "39534", required: true, companionNameField: "malName" },
      { name: "seasonNumber", type: "number", label: "Season Number", default: 1 },
    ]
  },
  nameAnimeEpisodesAniDB: {
    summary: "Rename anime episode files using AniDB metadata (better OVA/special coverage than MAL)",
    note: "Specials / Credits / Trailers / Parodies each run an interactive length-matched per-file picker — answer the prompts in the job log. Space skips the current file; Esc cancels the loop and applies any matches confirmed so far. Regular and Others are index-paired with a duration sanity-check warning when the file and AniDB lengths diverge by >2m. If AniDB lists both a 'Complete' and 'Part N' form, you'll be asked which one your files match. Episode-range selection is still planned — see README §AniDB command notes.",
    tag: "Naming Operations",
    outputFolderName: null,
    fields: [
      { name: "sourcePath", type: "path", label: "Source Path", required: true },
      { name: "anidbId", type: "numberWithLookup", lookupType: "anidb", label: "AniDB Anime ID", placeholder: "8160", required: true, companionNameField: "anidbName" },
      { name: "seasonNumber", type: "number", label: "Season Number", default: 1 },
      {
        name: "episodeType",
        type: "enum",
        label: "Episode Type",
        default: "regular",
        options: [
          { value: "regular", label: "Regular (type=1)" },
          { value: "specials", label: "Specials (S, type=2)" },
          { value: "credits", label: "Credits / OP / ED (C, type=3)" },
          { value: "trailers", label: "Trailers (T, type=4)" },
          { value: "parodies", label: "Parodies (P, type=5)" },
          { value: "others", label: "Others (O, type=6, alt cuts)" },
        ],
      },
    ]
  },
  nameSpecialFeatures: {
    summary: "Rename special features (and the main movie file) based on DVDCompare timecodes — title canonicalized via TMDB",
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
      { name: "sourcePath", type: "path", label: "Source Path", required: true },
      { name: "dvdCompareId", type: "numberWithLookup", lookupType: "dvdcompare", label: "DVDCompare Film ID", placeholder: "74759", required: true, companionNameField: "dvdCompareName" },
      { name: "dvdCompareReleaseHash", type: "number", label: "Release Hash", default: 1, companionNameField: "dvdCompareReleaseLabel" },
      { name: "fixedOffset", type: "number", label: "Fixed Offset (ms)", default: 0 },
      { name: "timecodePadding", type: "number", label: "Timecode Padding", default: 2 },
      // Defaults to false in the Builder so the Phase-B "which file is
      // which?" pick modal becomes the interactive UX. The schema /
      // sequence-runner default remains true so non-interactive callers
      // (sequence YAML / direct API) keep today's deterministic
      // (2)/(3)/… behavior unless they opt in explicitly.
      { name: "autoNameDuplicates", type: "boolean", label: "Auto-name duplicates", default: false },
    ]
  },
  nameTvShowEpisodes: {
    summary: "Rename TV show episode files based on metadata",
    tag: "Naming Operations",
    outputFolderName: null,
    fields: [
      { name: "sourcePath", type: "path", label: "Source Path", required: true },
      { name: "tvdbId", type: "numberWithLookup", lookupType: "tvdb", label: "TVDB ID", placeholder: "76703", required: true, companionNameField: "tvdbName" },
      { name: "seasonNumber", type: "number", label: "Season Number", required: true },
    ]
  },
  renameDemos: {
    summary: "Rename demo files based on content analysis",
    tag: "Naming Operations",
    outputFolderName: null,
    fields: [
      { name: "sourcePath", type: "path", label: "Source Path", required: true },
      { name: "isRecursive", type: "boolean", label: "Recursive", default: false },
    ]
  },
  renameMovieClipDownloads: {
    summary: "Rename downloaded movie clip files",
    tag: "Naming Operations",
    outputFolderName: null,
    fields: [
      { name: "sourcePath", type: "path", label: "Source Path", required: true },
    ]
  },
  // Video Operations
  setDisplayWidth: {
    summary: "Set display width for video tracks",
    tag: "Video Operations",
    outputFolderName: null,
    fields: [
      { name: "sourcePath", type: "path", label: "Source Path", required: true },
      { name: "displayWidth", type: "number", label: "Display Width (px)", default: 853 },
      { name: "isRecursive", type: "boolean", label: "Recursive", default: false },
      { name: "recursiveDepth", type: "number", label: "Recursive Depth", default: 0 },
    ]
  },
  // Metadata Operations
  storeAspectRatioData: {
    summary: "Analyze and store aspect ratio metadata",
    tag: "Metadata Operations",
    outputFolderName: null,
    fields: [
      { name: "sourcePath", type: "path", label: "Source Path", required: true },
      { name: "isRecursive", type: "boolean", label: "Recursive", default: false },
      { name: "recursiveDepth", type: "number", label: "Recursive Depth", default: 0 },
      { name: "outputPath", type: "path", label: "Output Path" },
      { name: "rootPath", type: "path", label: "Root Path" },
      { name: "folders", type: "stringArray", label: "Folders" },
      { name: "force", type: "boolean", label: "Force Overwrite", default: false },
      { name: "threads", type: "number", label: "Thread Count" },
    ]
  },
}

export const TAG_ORDER = [
  "File Operations","Audio Operations","Track Operations",
  "Subtitle Operations","Analysis","Naming Operations",
  "Video Operations","Metadata Operations",
]
