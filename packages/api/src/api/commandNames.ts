// Single source of truth for the set of commands the server registers.
// Extracted to its own file (no Node-side imports) so it can be imported
// from browser-mode vitest in packages/web — the registry-sync test in
// packages/web/src/commands/commands.test.ts asserts this list matches
// the web COMMANDS map and commandLabels keys.
//
// commandRoutes.ts re-exports both `commandNames` and the derived
// `CommandName` type from here so existing call sites keep working.

export const commandNames = [
  "makeDirectory",
  "changeTrackLanguages",
  "convertLosslessToFlac",
  "convertContainerAudioToFlac",
  "findContainerAudioFiles",
  "copyFiles",
  "flattenOutput",
  "copyOutSubtitles",
  "extractSubtitles",
  "fixIncorrectDefaultTracks",
  "getAudioOffsets",
  "hasBetterAudio",
  "hasBetterVersion",
  "hasDuplicateMusicFiles",
  "hasImaxEnhancedAudio",
  "hasManyAudioTracks",
  "hasSurroundSound",
  "hasWrongDefaultTrack",
  "isMissingSubtitles",
  "deleteCopiedOriginals",
  "deleteFilesByExtension",
  "deleteFolder",
  "exitIfEmpty",
  "modifySubtitleMetadata",
  "keepLanguages",
  "addSubtitles",
  "mergeTracks",
  "moveFiles",
  "moveFilesIntoNamedFolders",
  "distributeFolderToSiblings",
  "flattenChildFolders",
  "renameFiles",
  "nameAnimeEpisodes",
  "nameAnimeEpisodesAniDB",
  "nameMovieCutsDvdCompareTmdb",
  "nameSpecialFeaturesDvdCompareTmdb",
  "onlyNameSpecialFeaturesDvdCompare",
  "nameTvShowEpisodes",
  "remuxToMkv",
  "renumberChapters",
  "renameDemos",
  "renameMovieClipDownloads",
  "reorderTracks",
  "replaceAttachments",
  "replaceFlacWithPcmAudio",
  "replaceTracks",
  "setDisplayWidth",
  "splitChapters",
  "splitCueSheet",
  "storeAspectRatioData",
] as const

export type CommandName = (typeof commandNames)[number]
