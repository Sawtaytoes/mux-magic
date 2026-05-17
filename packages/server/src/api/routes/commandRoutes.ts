import {
  createRoute,
  OpenAPIHono,
  z,
} from "@hono/zod-openapi"
import { makeDirectory } from "@mux-magic/tools"
import type { Context } from "hono"
import type { Observable } from "rxjs"
import {
  addSubtitles,
  addSubtitlesDefaultProps,
} from "../../app-commands/addSubtitles.js"
import { changeTrackLanguages } from "../../app-commands/changeTrackLanguages.js"
import {
  type CopyRecord,
  copyFiles,
} from "../../app-commands/copyFiles.js"
import { copyOutSubtitles } from "../../app-commands/copyOutSubtitles.js"
import { deleteCopiedOriginals } from "../../app-commands/deleteCopiedOriginals.js"
import { deleteFilesByExtension } from "../../app-commands/deleteFilesByExtension.js"
import { deleteFolder } from "../../app-commands/deleteFolder.js"
import { exitIfEmpty } from "../../app-commands/exitIfEmpty.js"
import {
  extractSubtitles,
  extractSubtitlesDefaultProps,
} from "../../app-commands/extractSubtitles.js"
import { fixIncorrectDefaultTracks } from "../../app-commands/fixIncorrectDefaultTracks.js"
import { flattenOutput } from "../../app-commands/flattenOutput.js"
import {
  getAudioOffsets,
  getAudioOffsetsDefaultProps,
} from "../../app-commands/getAudioOffsets.js"
import { hasBetterAudio } from "../../app-commands/hasBetterAudio.js"
import { hasBetterVersion } from "../../app-commands/hasBetterVersion.js"
import { hasDuplicateMusicFiles } from "../../app-commands/hasDuplicateMusicFiles.js"
import { hasImaxEnhancedAudio } from "../../app-commands/hasImaxEnhancedAudio.js"
import { hasManyAudioTracks } from "../../app-commands/hasManyAudioTracks.js"
import { hasSurroundSound } from "../../app-commands/hasSurroundSound.js"
import { hasWrongDefaultTrack } from "../../app-commands/hasWrongDefaultTrack.js"
import { isMissingSubtitles } from "../../app-commands/isMissingSubtitles.js"
import {
  keepLanguages,
  keepLanguagesDefaultProps,
} from "../../app-commands/keepLanguages.js"
import { mergeTracks } from "../../app-commands/mergeTracks.js"
import { modifySubtitleMetadata } from "../../app-commands/modifySubtitleMetadata.js"
import { moveFiles } from "../../app-commands/moveFiles.js"
import { nameAnimeEpisodes } from "../../app-commands/nameAnimeEpisodes.js"
import { nameAnimeEpisodesAniDB } from "../../app-commands/nameAnimeEpisodesAniDB.js"
import { nameMovieCutsDvdCompareTmdb } from "../../app-commands/nameMovieCutsDvdCompareTmdb.js"
import { nameSpecialFeaturesDvdCompareTmdb } from "../../app-commands/nameSpecialFeaturesDvdCompareTmdb.js"
import { nameTvShowEpisodes } from "../../app-commands/nameTvShowEpisodes.js"
import { remuxToMkv } from "../../app-commands/remuxToMkv.js"
import { renameDemos } from "../../app-commands/renameDemos.js"
import {
  type RenameRecord,
  renameFiles,
} from "../../app-commands/renameFiles.js"
import { renameMovieClipDownloads } from "../../app-commands/renameMovieClipDownloads.js"
import { renumberChapters } from "../../app-commands/renumberChapters.js"
import {
  reorderTracks,
  reorderTracksDefaultProps,
} from "../../app-commands/reorderTracks.js"
import {
  replaceAttachments,
  replaceAttachmentsDefaultProps,
} from "../../app-commands/replaceAttachments.js"
import {
  replaceFlacWithPcmAudio,
  replaceFlacWithPcmAudioDefaultProps,
} from "../../app-commands/replaceFlacWithPcmAudio.js"
import {
  replaceTracks,
  replaceTracksDefaultProps,
} from "../../app-commands/replaceTracks.js"
import { setDisplayWidth } from "../../app-commands/setDisplayWidth.js"
import {
  splitChapters,
  splitChaptersDefaultProps,
} from "../../app-commands/splitChapters.js"
import { storeAspectRatioData } from "../../app-commands/storeAspectRatioData.js"
import {
  getEffectiveCommandConfigs,
  getFakeScenario,
  isFakeRequest,
} from "../../fake-data/index.js"
import { runJob } from "../jobRunner.js"
import { createJob } from "../jobStore.js"
import * as schemas from "../schemas.js"

const startCommandJob = ({
  command,
  commandObservable,
  context,
  extractOutputs,
  outputFolderName = null,
  params,
}: {
  command: string
  commandObservable: Observable<unknown>
  context: Context
  extractOutputs?: (
    results: unknown[],
  ) => Record<string, unknown>
  outputFolderName?: string | null
  params: unknown
}) => {
  const job = createJob({
    commandName: command,
    params,
    outputFolderName,
  })

  runJob(job.id, commandObservable, { extractOutputs })

  return context.json(
    {
      jobId: job.id,
      logsUrl: `/jobs/${job.id}/logs`,
      outputFolderName,
    },
    202,
  )
}

export const commandNames = [
  "makeDirectory",
  "changeTrackLanguages",
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
  "renameFiles",
  "nameAnimeEpisodes",
  "nameAnimeEpisodesAniDB",
  "nameMovieCutsDvdCompareTmdb",
  "nameSpecialFeaturesDvdCompareTmdb",
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
  "storeAspectRatioData",
] as const

export type CommandName = (typeof commandNames)[number]

export type CommandConfig = {
  // Optional projector that maps the collected emission stream into a
  // named-outputs record once the command completes. Surfaced on the job
  // for downstream sequence steps to consume via the linkedTo/output
  // mechanism. Distinct from `outputFolderName` — that is static metadata
  // declared up-front; this is computed at runtime.
  extractOutputs?: (
    results: unknown[],
  ) => Record<string, unknown>
  // biome-ignore lint/suspicious/noExplicitAny: body type is enforced at runtime by each command's Zod schema
  getObservable: (body: any) => Observable<unknown>
  outputFolderName?: string
  // Override for the synthesized "folder" output when a downstream step
  // links to this one via { linkedTo, output: 'folder' }. Without it, the
  // resolver falls back to <sourcePath>/<outputFolderName> (or the source
  // itself). 'parentOfSource' covers the flattenOutput case where files
  // are written into dirname(sourcePath).
  outputComputation?: "parentOfSource"
  // When true, surfaces as `deprecated: true` on the OpenAPI operation
  // — Scalar UI renders the route with a strikethrough + badge so users
  // can see it's on the way out alongside the runtime [name] DEPRECATED
  // log line emitted by the underlying app-command shim.
  isDeprecated?: boolean
  schema: z.ZodTypeAny
  summary: string
  tags: string[]
}

export const commandConfigs: Record<
  CommandName,
  CommandConfig
> = {
  makeDirectory: {
    getObservable: (body) => makeDirectory(body.sourcePath),
    schema: schemas.makeDirectoryRequestSchema,
    summary:
      "Create a directory (or the parent directory of a file path)",
    tags: ["File Operations"],
  },
  changeTrackLanguages: {
    getObservable: (body) =>
      changeTrackLanguages({
        audioLanguage: body.audioLanguage,
        isRecursive: body.isRecursive,
        sourcePath: body.sourcePath,
        subtitlesLanguage: body.subtitlesLanguage,
        videoLanguage: body.videoLanguage,
      }),
    schema: schemas.changeTrackLanguagesRequestSchema,
    summary: "Change language tags for media tracks",
    tags: ["Track Operations"],
  },
  copyFiles: {
    getObservable: (body) =>
      copyFiles({
        destinationPath: body.destinationPath,
        fileFilterRegex: body.fileFilterRegex,
        folderFilterRegex: body.folderFilterRegex,
        isIncludingFolders: body.includeFolders,
        renameRegex: body.renameRegex,
        sourcePath: body.sourcePath,
      }),
    extractOutputs: (results) => ({
      copiedSourcePaths: (results as CopyRecord[]).map(
        (record) => record.source,
      ),
    }),
    schema: schemas.copyFilesRequestSchema,
    summary:
      "Copy files (and optionally folders) from source to destination, with optional regex filtering and renaming",
    tags: ["File Operations"],
  },
  flattenOutput: {
    getObservable: (body) =>
      flattenOutput({
        isDeletingSourceFolder: body.deleteSourceFolder,
        sourcePath: body.sourcePath,
      }),
    // Files land in dirname(sourcePath); downstream linkedTo:folder
    // references should resolve to the parent, not the source itself.
    outputComputation: "parentOfSource",
    schema: schemas.flattenOutputRequestSchema,
    summary:
      "Flatten a chained step's output: copies the folder's contents up one level (deletes source only if requested)",
    tags: ["File Operations"],
  },
  copyOutSubtitles: {
    // Deprecated alias for extractSubtitles — getObservable points to the
    // shim app-command which logs a deprecation warning then delegates.
    isDeprecated: true,
    getObservable: (body) =>
      copyOutSubtitles({
        isRecursive: body.isRecursive,
        sourcePath: body.sourcePath,
        subtitlesLanguage: body.subtitlesLanguage,
      }),
    outputFolderName:
      extractSubtitlesDefaultProps.outputFolderName,
    schema: schemas.copyOutSubtitlesRequestSchema,
    summary:
      "[DEPRECATED — use extractSubtitles] Extract subtitle tracks into separate files alongside each video file.",
    tags: ["Subtitle Operations"],
  },
  extractSubtitles: {
    getObservable: (body) =>
      extractSubtitles({
        isRecursive: body.isRecursive,
        sourcePath: body.sourcePath,
        subtitlesLanguage: body.subtitlesLanguage,
      }),
    outputFolderName:
      extractSubtitlesDefaultProps.outputFolderName,
    schema: schemas.extractSubtitlesRequestSchema,
    summary:
      "Extract subtitle tracks into separate files alongside each video file.",
    tags: ["Subtitle Operations"],
  },
  fixIncorrectDefaultTracks: {
    getObservable: (body) =>
      fixIncorrectDefaultTracks({
        isRecursive: body.isRecursive,
        sourcePath: body.sourcePath,
      }),
    schema: schemas.fixIncorrectDefaultTracksRequestSchema,
    summary: "Fix incorrect default track designations",
    tags: ["Track Operations"],
  },
  getAudioOffsets: {
    getObservable: (body) =>
      getAudioOffsets({
        destinationFilesPath: body.destinationFilesPath,
        sourcePath: body.sourcePath,
      }),
    outputFolderName:
      getAudioOffsetsDefaultProps.outputFolderName,
    schema: schemas.getAudioOffsetsRequestSchema,
    summary:
      "Calculate audio synchronization offsets between files",
    tags: ["Audio Operations"],
  },
  hasBetterAudio: {
    getObservable: (body) =>
      hasBetterAudio({
        isRecursive: body.isRecursive,
        recursiveDepth: body.recursiveDepth,
        sourcePath: body.sourcePath,
      }),
    schema: schemas.hasBetterAudioRequestSchema,
    summary:
      "Analyze and compare audio quality across files",
    tags: ["Analysis"],
  },
  hasBetterVersion: {
    getObservable: (body) =>
      hasBetterVersion({
        isRecursive: body.isRecursive,
        recursiveDepth: body.recursiveDepth,
        sourcePath: body.sourcePath,
      }),
    schema: schemas.hasBetterVersionRequestSchema,
    summary: "Check if better version of media exists",
    tags: ["Analysis"],
  },
  hasDuplicateMusicFiles: {
    getObservable: (body) =>
      hasDuplicateMusicFiles({
        isRecursive: body.isRecursive,
        recursiveDepth: body.recursiveDepth,
        sourcePath: body.sourcePath,
      }),
    schema: schemas.hasDuplicateMusicFilesRequestSchema,
    summary: "Identify duplicate music files",
    tags: ["Analysis"],
  },
  hasImaxEnhancedAudio: {
    getObservable: (body) =>
      hasImaxEnhancedAudio({
        isRecursive: body.isRecursive,
        sourcePath: body.sourcePath,
      }),
    schema: schemas.hasImaxEnhancedAudioRequestSchema,
    summary: "Check for IMAX enhanced audio tracks",
    tags: ["Analysis"],
  },
  hasManyAudioTracks: {
    getObservable: (body) =>
      hasManyAudioTracks({
        isRecursive: body.isRecursive,
        sourcePath: body.sourcePath,
      }),
    schema: schemas.hasManyAudioTracksRequestSchema,
    summary: "Identify files with many audio tracks",
    tags: ["Analysis"],
  },
  hasSurroundSound: {
    getObservable: (body) =>
      hasSurroundSound({
        isRecursive: body.isRecursive,
        recursiveDepth: body.recursiveDepth,
        sourcePath: body.sourcePath,
      }),
    schema: schemas.hasSurroundSoundRequestSchema,
    summary: "Check for surround sound audio tracks",
    tags: ["Analysis"],
  },
  hasWrongDefaultTrack: {
    getObservable: (body) =>
      hasWrongDefaultTrack({
        isRecursive: body.isRecursive,
        sourcePath: body.sourcePath,
      }),
    schema: schemas.hasWrongDefaultTrackRequestSchema,
    summary:
      "Find files with incorrect default track selection",
    tags: ["Analysis"],
  },
  isMissingSubtitles: {
    getObservable: (body) =>
      isMissingSubtitles({
        isRecursive: body.isRecursive,
        sourcePath: body.sourcePath,
      }),
    schema: schemas.isMissingSubtitlesRequestSchema,
    summary: "Identify media files missing subtitle tracks",
    tags: ["Subtitle Operations"],
  },
  deleteFilesByExtension: {
    getObservable: (body) =>
      deleteFilesByExtension({
        extensions: body.extensions,
        isRecursive: body.isRecursive,
        recursiveDepth: body.recursiveDepth,
        sourcePath: body.sourcePath,
      }),
    schema: schemas.deleteFilesByExtensionRequestSchema,
    summary:
      "Delete files that match one or more extensions",
    tags: ["File Operations"],
  },
  deleteFolder: {
    getObservable: (body) =>
      deleteFolder({
        isConfirmed: body.confirm,
        sourcePath: body.sourcePath,
      }),
    schema: schemas.deleteFolderRequestSchema,
    summary:
      "Recursively delete a folder (DESTRUCTIVE — requires confirm: true)",
    tags: ["File Operations"],
  },
  exitIfEmpty: {
    getObservable: (body) =>
      exitIfEmpty({ sourcePath: body.sourcePath }),
    // The runner reads `shouldExit` / `exitReason` off the child job's
    // outputs to decide whether to short-circuit the umbrella sequence
    // with `status: "exited"`. The keys here are a reserved contract —
    // any future flow-control command (`exitIfFileCountBelow`, etc.)
    // can publish the same shape without touching the runner.
    extractOutputs: (results) => {
      const decision = results[0] as
        | { shouldExit?: boolean; exitReason?: string }
        | undefined
      return {
        shouldExit: decision?.shouldExit === true,
        exitReason:
          typeof decision?.exitReason === "string"
            ? decision.exitReason
            : "",
      }
    },
    schema: schemas.exitIfEmptyRequestSchema,
    summary:
      "Exit the umbrella sequence cleanly (status: exited) if sourcePath does not exist or contains zero entries. No-op if the folder has any contents.",
    tags: ["Flow Control"],
  },
  modifySubtitleMetadata: {
    getObservable: (body) =>
      modifySubtitleMetadata({
        hasDefaultRules: body.hasDefaultRules,
        isRecursive: body.isRecursive,
        predicates: body.predicates,
        recursiveDepth: body.recursiveDepth,
        rules: body.rules,
        sourcePath: body.sourcePath,
      }),
    schema: schemas.modifySubtitleMetadataRequestSchema,
    summary:
      "Apply DSL-driven modifications to ASS subtitle metadata. Set hasDefaultRules:true to prepend the in-tree default-rules heuristic.",
    tags: ["Subtitle Operations"],
  },
  keepLanguages: {
    getObservable: (body) =>
      keepLanguages({
        audioLanguages: body.audioLanguages,
        hasFirstAudioLanguage: body.useFirstAudioLanguage,
        hasFirstSubtitlesLanguage:
          body.useFirstSubtitlesLanguage,
        isRecursive: body.isRecursive,
        sourcePath: body.sourcePath,
        subtitlesLanguages: body.subtitlesLanguages,
      }),
    outputFolderName:
      keepLanguagesDefaultProps.outputFolderName,
    schema: schemas.keepLanguagesRequestSchema,
    summary: "Filter media tracks by language",
    tags: ["Track Operations"],
  },
  addSubtitles: {
    getObservable: (body) =>
      addSubtitles({
        globalOffsetInMilliseconds: body.globalOffset,
        hasChapterSyncOffset: body.hasChapterSyncOffset,
        hasChapters: body.includeChapters,
        offsetsInMilliseconds: body.offsets,
        sourcePath: body.sourcePath,
        subtitlesPath: body.subtitlesPath,
      }),
    outputFolderName:
      addSubtitlesDefaultProps.outputFolderName,
    schema: schemas.addSubtitlesRequestSchema,
    summary:
      "Mux a folder of per-file subtitle directories into matching media files (preserves attachments and optional chapters.xml).",
    tags: ["Subtitle Operations"],
  },
  mergeTracks: {
    // Deprecated alias for addSubtitles — getObservable points to the
    // shim app-command which logs a deprecation warning then delegates.
    isDeprecated: true,
    getObservable: (body) =>
      mergeTracks({
        globalOffsetInMilliseconds: body.globalOffset,
        hasChapterSyncOffset: body.hasChapterSyncOffset,
        hasChapters: body.includeChapters,
        offsetsInMilliseconds: body.offsets,
        sourcePath: body.sourcePath,
        subtitlesPath: body.subtitlesPath,
      }),
    outputFolderName:
      addSubtitlesDefaultProps.outputFolderName,
    schema: schemas.mergeTracksRequestSchema,
    summary:
      "[DEPRECATED — use addSubtitles] Merge subtitle tracks into media files.",
    tags: ["Subtitle Operations"],
  },
  moveFiles: {
    getObservable: (body) =>
      moveFiles({
        destinationPath: body.destinationPath,
        fileFilterRegex: body.fileFilterRegex,
        renameRegex: body.renameRegex,
        sourcePath: body.sourcePath,
      }),
    extractOutputs: (results) => ({
      copiedSourcePaths: (results as CopyRecord[]).map(
        (record) => record.source,
      ),
    }),
    schema: schemas.moveFilesRequestSchema,
    summary:
      "Move files from source to destination, with optional regex filtering and renaming",
    tags: ["File Operations"],
  },
  renameFiles: {
    getObservable: (body) =>
      renameFiles({
        fileFilterRegex: body.fileFilterRegex,
        isRecursive: body.isRecursive,
        recursiveDepth: body.recursiveDepth,
        renameRegex: body.renameRegex,
        sourcePath: body.sourcePath,
      }),
    extractOutputs: (results) => ({
      renamedPaths: (results as RenameRecord[]).map(
        (record) => record.destination,
      ),
    }),
    schema: schemas.renameFilesRequestSchema,
    summary:
      "Rename files in place via regex (no copy, no move). Pre-flight halts the run if two files would map to the same target name.",
    tags: ["File Operations"],
  },
  deleteCopiedOriginals: {
    getObservable: (body) =>
      deleteCopiedOriginals({
        pathsToDelete: body.pathsToDelete,
      }),
    schema: schemas.deleteCopiedOriginalsRequestSchema,
    summary:
      "Delete the original source files that were copied by a prior copyFiles or moveFiles step. Receives its pathsToDelete list via linkedTo from the prior step's copiedSourcePaths output.",
    tags: ["File Operations"],
  },
  nameAnimeEpisodes: {
    getObservable: (body) =>
      nameAnimeEpisodes({
        malId: body.malId,
        searchTerm: body.searchTerm,
        seasonNumber: body.seasonNumber,
        sourcePath: body.sourcePath,
      }),
    schema: schemas.nameAnimeEpisodesRequestSchema,
    summary:
      "Rename anime episode files using MyAnimeList metadata",
    tags: ["Naming Operations"],
  },
  nameAnimeEpisodesAniDB: {
    getObservable: (body) =>
      nameAnimeEpisodesAniDB({
        anidbId: body.anidbId,
        episodeType: body.episodeType,
        searchTerm: body.searchTerm,
        seasonNumber: body.seasonNumber,
        sourcePath: body.sourcePath,
      }),
    schema: schemas.nameAnimeEpisodesAniDBRequestSchema,
    summary:
      "Rename anime episode files using AniDB metadata (regular, specials with length-matched picker, or type=6 alternates)",
    tags: ["Naming Operations"],
  },
  nameMovieCutsDvdCompareTmdb: {
    getObservable: (body) =>
      nameMovieCutsDvdCompareTmdb({
        dvdCompareId: body.dvdCompareId,
        dvdCompareReleaseHash: body.dvdCompareReleaseHash,
        fixedOffset: body.fixedOffset,
        searchTerm: body.searchTerm,
        sourcePath: body.sourcePath,
        timecodePaddingAmount: body.timecodePadding,
        url: body.url,
      }),
    schema:
      schemas.nameMovieCutsDvdCompareTmdbRequestSchema,
    summary:
      "Rename main-feature movie cuts (Director's Cut, Theatrical, etc.) and move into Plex edition-folder layout. Skips any file whose duration doesn't match a DVDCompare cut.",
    tags: ["Naming Operations"],
  },
  nameSpecialFeaturesDvdCompareTmdb: {
    getObservable: (body) =>
      nameSpecialFeaturesDvdCompareTmdb({
        isAutoNamingDuplicates: body.autoNameDuplicates,
        dvdCompareId: body.dvdCompareId,
        dvdCompareReleaseHash: body.dvdCompareReleaseHash,
        fixedOffset: body.fixedOffset,
        isMovingToEditionFolders: body.moveToEditionFolders,
        isNonInteractive: body.nonInteractive,
        searchTerm: body.searchTerm,
        sourcePath: body.sourcePath,
        timecodePaddingAmount: body.timecodePadding,
        url: body.url,
      }),
    schema:
      schemas.nameSpecialFeaturesDvdCompareTmdbRequestSchema,
    summary:
      "Rename special features (and the main movie file) based on DVDCompare timecodes; movie title is canonicalized via TMDB",
    tags: ["Naming Operations"],
  },
  nameTvShowEpisodes: {
    getObservable: (body) =>
      nameTvShowEpisodes({
        searchTerm: body.searchTerm,
        seasonNumber: body.seasonNumber,
        sourcePath: body.sourcePath,
        tvdbId: body.tvdbId,
      }),
    schema: schemas.nameTvShowEpisodesRequestSchema,
    summary:
      "Rename TV show episode files based on metadata",
    tags: ["Naming Operations"],
  },
  remuxToMkv: {
    getObservable: (body) =>
      remuxToMkv({
        extensions: body.extensions,
        isRecursive: body.isRecursive,
        isSourceDeletedOnSuccess:
          body.isSourceDeletedOnSuccess,
        recursiveDepth: body.recursiveDepth,
        sourcePath: body.sourcePath,
      }),
    schema: schemas.remuxToMkvRequestSchema,
    summary:
      "Pass-through container remux of every matching file into an .mkv sibling using mkvmerge",
    tags: ["File Operations"],
  },
  renumberChapters: {
    getObservable: (body) =>
      renumberChapters({
        isPaddingChapterNumbers:
          body.isPaddingChapterNumbers,
        isRecursive: body.isRecursive,
        sourcePath: body.sourcePath,
      }),
    schema: schemas.renumberChaptersRequestSchema,
    summary:
      "Renumber `Chapter NN`-style chapter names sequentially via a metadata-only mkvmerge remux (preserves timecodes, UIDs, custom-named chapters)",
    tags: ["Track Operations"],
  },
  renameDemos: {
    getObservable: (body) =>
      renameDemos({
        isRecursive: body.isRecursive,
        sourcePath: body.sourcePath,
      }),
    schema: schemas.renameDemosRequestSchema,
    summary: "Rename demo files based on content analysis",
    tags: ["Naming Operations"],
  },
  renameMovieClipDownloads: {
    getObservable: (body) =>
      renameMovieClipDownloads({
        sourcePath: body.sourcePath,
      }),
    schema: schemas.renameMovieClipDownloadsRequestSchema,
    summary: "Rename downloaded movie clip files",
    tags: ["Naming Operations"],
  },
  reorderTracks: {
    getObservable: (body) =>
      reorderTracks({
        audioTrackIndexes: body.audioTrackIndexes,
        isRecursive: body.isRecursive,
        isSkipOnTrackMisalignment:
          body.isSkipOnTrackMisalignment,
        sourcePath: body.sourcePath,
        subtitlesTrackIndexes: body.subtitlesTrackIndexes,
        videoTrackIndexes: body.videoTrackIndexes,
      }),
    outputFolderName:
      reorderTracksDefaultProps.outputFolderName,
    schema: schemas.reorderTracksRequestSchema,
    summary: "Reorder media tracks",
    tags: ["Track Operations"],
  },
  replaceAttachments: {
    getObservable: (body) =>
      replaceAttachments({
        destinationFilesPath: body.destinationFilesPath,
        sourcePath: body.sourcePath,
      }),
    outputFolderName:
      replaceAttachmentsDefaultProps.outputFolderName,
    schema: schemas.replaceAttachmentsRequestSchema,
    summary: "Replace attachments in media files",
    tags: ["File Operations"],
  },
  replaceFlacWithPcmAudio: {
    getObservable: (body) =>
      replaceFlacWithPcmAudio({
        isRecursive: body.isRecursive,
        sourcePath: body.sourcePath,
      }),
    outputFolderName:
      replaceFlacWithPcmAudioDefaultProps.outputFolderName,
    schema: schemas.replaceFlacWithPcmAudioRequestSchema,
    summary: "Replace FLAC audio with PCM audio",
    tags: ["Audio Operations"],
  },
  replaceTracks: {
    getObservable: (body) =>
      replaceTracks({
        audioLanguages: body.audioLanguages,
        destinationFilesPath: body.destinationFilesPath,
        globalOffsetInMilliseconds: body.globalOffset,
        hasChapterSyncOffset: body.hasChapterSyncOffset,
        hasChapters: body.includeChapters,
        offsets: body.offsets,
        sourcePath: body.sourcePath,
        subtitlesLanguages: body.subtitlesLanguages,
        videoLanguages: body.videoLanguages,
      }),
    outputFolderName:
      replaceTracksDefaultProps.outputFolderName,
    schema: schemas.replaceTracksRequestSchema,
    summary: "Replace media tracks in destination files",
    tags: ["Track Operations"],
  },
  setDisplayWidth: {
    getObservable: (body) =>
      setDisplayWidth({
        displayWidth: body.displayWidth,
        isRecursive: body.isRecursive,
        recursiveDepth: body.recursiveDepth,
        sourcePath: body.sourcePath,
      }),
    schema: schemas.setDisplayWidthRequestSchema,
    summary: "Set display width for video tracks",
    tags: ["Video Operations"],
  },
  splitChapters: {
    getObservable: (body) =>
      splitChapters({
        chapterSplitsList: body.chapterSplits,
        sourcePath: body.sourcePath,
      }),
    outputFolderName:
      splitChaptersDefaultProps.outputFolderName,
    schema: schemas.splitChaptersRequestSchema,
    summary: "Split media files by chapter markers",
    tags: ["File Operations"],
  },
  storeAspectRatioData: {
    getObservable: (body) =>
      storeAspectRatioData({
        folderNames: body.folders,
        isRecursive: body.isRecursive,
        mode: body.force ? "overwrite" : "append",
        outputPath: body.outputPath,
        recursiveDepth: body.recursiveDepth,
        rootPath: body.rootPath,
        sourcePath: body.sourcePath,
      }),
    schema: schemas.storeAspectRatioDataRequestSchema,
    summary: "Analyze and store aspect ratio metadata",
    tags: ["Metadata Operations"],
  },
}

export const commandRoutes = new OpenAPIHono()

// commandRoutes.openapi(
//   createRoute({
//     method: "get",
//     path: "/commands",
//     summary: "List all available command names.",
//     tags: ["Commands"],
//     responses: {
//       200: {
//         description: "List of available command names",
//         content: {
//           "application/json": {
//             schema: z.object({ commandNames: z.array(z.enum(commandNames)) }),
//           },
//         },
//       },
//     },
//   }),
//   (context) => context.json({ commandNames: [...commandNames] }, 200),
// )

commandRoutes.openapi(
  createRoute({
    method: "get",
    path: "/commands",
    summary: "List all available command names.",
    tags: ["Commands"],
    responses: {
      200: {
        description: "List of available command names",
        content: {
          "application/json": {
            schema: z.object({
              commandNames: z.array(z.enum(commandNames)),
            }),
          },
        },
      },
    },
  }),
  (context) =>
    context.json({ commandNames: [...commandNames] }, 200),
)

commandNames.forEach((commandName) => {
  // Schema / summary / tags / outputFolderName are static metadata —
  // closed over at registration time so the OpenAPI doc is generated
  // from the real config. The runtime parts (`getObservable`,
  // `extractOutputs`) are looked up per-request so a `?fake=1` query
  // can swap them out without touching the OpenAPI surface.
  const {
    isDeprecated,
    outputFolderName,
    schema,
    summary,
    tags,
  } = commandConfigs[commandName]

  commandRoutes.openapi(
    createRoute({
      method: "post",
      path: `/commands/${commandName}`,
      summary,
      tags,
      ...(isDeprecated ? { deprecated: true } : {}),
      request: {
        body: {
          content: {
            "application/json": { schema },
          },
        },
      },
      responses: {
        202: {
          description: "Job started successfully",
          content: {
            "application/json": {
              schema: schemas.createJobResponseSchema(
                outputFolderName === null
                  ? undefined
                  : z.literal(outputFolderName),
              ),
            },
          },
        },
      },
    }),
    async (context) => {
      const body = context.req.valid("json")
      const isUsingFake = isFakeRequest(context)
      const effectiveConfig = getEffectiveCommandConfigs(
        isUsingFake,
        getFakeScenario(context),
      )[commandName]
      return startCommandJob({
        command: commandName,
        commandObservable:
          effectiveConfig.getObservable(body),
        context,
        extractOutputs: effectiveConfig.extractOutputs,
        outputFolderName,
        params: body,
      })
    },
  )
})
