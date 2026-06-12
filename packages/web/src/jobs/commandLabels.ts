// Exported (not file-local) so the registry-sync test in
// commands.test.ts can assert every server-side commandName has a
// human label here. Treat this as read-only outside this file.
export const commandLabels: Record<string, string> = {
  // File Operations
  makeDirectory: "Make Directory",
  copyFiles: "Copy Files",
  flattenOutput: "Flatten Output",
  moveFiles: "Move Files",
  moveFilesIntoNamedFolders:
    "Move Files Into Named Folders",
  distributeFolderToSiblings:
    "Distribute Folder to Siblings",
  flattenChildFolders: "Flatten Child Folders",
  replaceAttachments: "Replace Attachments",
  deleteFilesByExtension: "Delete Files by Extension",
  deleteFolder: "Delete Folder",
  deleteCopiedOriginals: "Delete Copied Originals",
  splitChapters: "Split Chapters",
  remuxToMkv: "Remux to MKV",

  // Flow Control
  exitIfEmpty: "Exit If Empty",

  // Audio Operations
  convertLosslessToFlac: "Convert Lossless Audio to FLAC",
  findContainerAudioFiles: "Find Audio-in-Container Files",
  convertContainerAudioToFlac:
    "Convert Audio-in-Container to FLAC",
  getAudioOffsets: "Get Audio Offsets",
  replaceFlacWithPcmAudio: "Replace FLAC with PCM Audio",
  splitCueSheet: "Split CUE Sheet to FLAC",

  // Track Operations
  changeTrackLanguages: "Change Track Languages",
  fixIncorrectDefaultTracks: "Fix Incorrect Default Tracks",
  keepLanguages: "Keep Languages",
  mergeTracks: "Add Subtitles (deprecated)",
  renumberChapters: "Renumber Chapters",
  reorderTracks: "Reorder Tracks",
  replaceTracks: "Replace Tracks",

  // Subtitle Operations
  addSubtitles: "Add Subtitles",
  extractSubtitles: "Extract Subtitles",
  copyOutSubtitles: "Extract Subtitles (deprecated)",
  isMissingSubtitles: "Check Missing Subtitles",
  modifySubtitleMetadata: "Modify Subtitle Metadata",
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
  renameFiles: "Rename Files",
  nameAnimeEpisodes: "Name Anime Episodes (MAL)",
  nameAnimeEpisodesAniDB: "Name Anime Episodes (AniDB)",
  nameMovieCutsDvdCompareTmdb:
    "Name Movie Cuts (DVD Compare + TMDB)",
  nameSpecialFeaturesDvdCompareTmdb:
    "Name Special Features (DVD Compare + TMDB)",
  onlyNameSpecialFeaturesDvdCompare:
    "Name Special Features (DVD Compare, no TMDB)",
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
  sequence: "Sequence",
}

export const commandLabel = (name: string | undefined) => {
  if (!name) return ""
  return commandLabels[name] ?? name
}
