// Friendly UI labels for the camelCase command identifiers shipped over
// the API. The raw names (`copyFiles`, `nameAnimeEpisodesAniDB`) read fine
// in the CLI but feel awkward in a GUI — this map is the single source of
// truth for the human-readable label rendered in both the builder
// (command picker, step trigger, link-picker step rows) and the jobs
// page (job card header, step rows).
//
// Loaded as a plain (non-module) script by both pages via a top-level
// <script src="/command-labels.js"> tag, so it runs before each page's
// inline script and exposes `commandLabels` + `commandLabel(name)` on
// `window`. Falls back to the raw name for any command not in the map,
// so a brand-new command introduced server-side never renders as
// "undefined" — it just shows the camelCase id until a label is added
// here.
window.commandLabels = {
  // File Operations
  makeDirectory: "Make Directory",
  copyFiles: "Copy Files",
  flattenOutput: "Flatten Output",
  moveFiles: "Move Files",
  replaceAttachments: "Replace Attachments",
  deleteFilesByExtension: "Delete Files by Extension",
  deleteFolder: "Delete Folder",
  splitChapters: "Split Chapters",
  remuxToMkv: "Remux to MKV",

  // Audio Operations
  getAudioOffsets: "Get Audio Offsets",
  replaceFlacWithPcmAudio: "Replace FLAC with PCM Audio",

  // Track Operations
  changeTrackLanguages: "Change Track Languages",
  fixIncorrectDefaultTracks: "Fix Incorrect Default Tracks",
  keepLanguages: "Keep Languages",
  mergeTracks: "Merge Tracks",
  reorderTracks: "Reorder Tracks",
  replaceTracks: "Replace Tracks",

  // Subtitle Operations
  extractSubtitles: "Extract Subtitles",
  copyOutSubtitles: "Extract Subtitles (deprecated alias)",
  isMissingSubtitles: "Check Missing Subtitles",
  modifySubtitleMetadata: "Modify Subtitle Metadata",
  computeDefaultSubtitleRules: "Compute Default Subtitle Rules",
  adjustSubtitlePositioning: "Adjust Subtitle Positioning",
  getSubtitleMetadata: "Get Subtitle Metadata",

  // Analysis
  hasBetterAudio: "Has Better Audio",
  hasBetterVersion: "Has Better Version",
  hasDuplicateMusicFiles: "Has Duplicate Music Files",
  hasImaxEnhancedAudio: "Has IMAX-Enhanced Audio",
  hasManyAudioTracks: "Has Many Audio Tracks",
  hasSurroundSound: "Has Surround Sound",
  hasWrongDefaultTrack: "Has Wrong Default Track",

  // Naming Operations
  nameAnimeEpisodes: "Name Anime Episodes (MAL)",
  nameAnimeEpisodesAniDB: "Name Anime Episodes (AniDB)",
  nameSpecialFeatures: "Name Special Features",
  nameTvShowEpisodes: "Name TV Show Episodes",
  renameDemos: "Rename Demos",
  renameMovieClipDownloads: "Rename Movie Clip Downloads",

  // Video Operations
  setDisplayWidth: "Set Display Width",
  inverseTelecineDiscRips: "Inverse-Telecine Disc Rips",

  // Metadata Operations
  storeAspectRatioData: "Store Aspect Ratio Data",

  // Misc
  mergeOrderedChapters: "Merge Ordered Chapters",
  processUhdDiscForumPost: "Process UHD Disc Forum Post",
}

window.commandLabel = function commandLabel(name) {
  if (!name) {
    return ""
  }
  return window.commandLabels[name] || name
}
