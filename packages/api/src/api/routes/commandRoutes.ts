import {
  createRoute,
  OpenAPIHono,
  z,
} from "@hono/zod-openapi"
import { createJob } from "@mux-magic/core/src/api/jobStore.js"
import {
  addSubtitles,
  addSubtitlesDefaultProps,
} from "@mux-magic/core/src/app-commands/addSubtitles.js"
import { analyseDiscBackup } from "@mux-magic/core/src/app-commands/analyseDiscBackup.js"
import { changeTrackLanguages } from "@mux-magic/core/src/app-commands/changeTrackLanguages.js"
import {
  type ConvertContainerAudioToFlacConvertedRecord,
  type ConvertContainerAudioToFlacRecord,
  convertContainerAudioToFlac,
} from "@mux-magic/core/src/app-commands/convertContainerAudioToFlac.js"
import {
  type ConvertLosslessToFlacConvertedRecord,
  type ConvertLosslessToFlacRecord,
  type ConvertLosslessToFlacSkippedRecord,
  convertLosslessToFlac,
} from "@mux-magic/core/src/app-commands/convertLosslessToFlac.js"
import {
  type CopyRecord,
  copyFiles,
} from "@mux-magic/core/src/app-commands/copyFiles.js"
import { copyOutSubtitles } from "@mux-magic/core/src/app-commands/copyOutSubtitles.js"
import { deleteCopiedOriginals } from "@mux-magic/core/src/app-commands/deleteCopiedOriginals.js"
import { deleteFilesByExtension } from "@mux-magic/core/src/app-commands/deleteFilesByExtension.js"
import { deleteFolder } from "@mux-magic/core/src/app-commands/deleteFolder.js"
import { distributeFolderToSiblings } from "@mux-magic/core/src/app-commands/distributeFolderToSiblings.js"
import { exitIfEmpty } from "@mux-magic/core/src/app-commands/exitIfEmpty.js"
import {
  extractDiscTitles,
  extractedTitlesFolderName,
} from "@mux-magic/core/src/app-commands/extractDiscTitles.js"
import {
  extractSubtitles,
  extractSubtitlesDefaultProps,
} from "@mux-magic/core/src/app-commands/extractSubtitles.js"
import { fetchThemeMusic } from "@mux-magic/core/src/app-commands/fetchThemeMusic.js"
import { findContainerAudioFiles } from "@mux-magic/core/src/app-commands/findContainerAudioFiles.js"
import {
  type FindDuplicateAudioFilesGroupRecord,
  findDuplicateAudioFiles,
} from "@mux-magic/core/src/app-commands/findDuplicateAudioFiles.js"
import {
  type FingerprintAudioFilesRecord,
  fingerprintAudioFiles,
} from "@mux-magic/core/src/app-commands/fingerprintAudioFiles.js"
import { fixIncorrectDefaultTracks } from "@mux-magic/core/src/app-commands/fixIncorrectDefaultTracks.js"
import { flattenChildFolders } from "@mux-magic/core/src/app-commands/flattenChildFolders.js"
import { flattenOutput } from "@mux-magic/core/src/app-commands/flattenOutput.js"
import {
  getAudioOffsets,
  getAudioOffsetsDefaultProps,
} from "@mux-magic/core/src/app-commands/getAudioOffsets.js"
import { hasBetterAudio } from "@mux-magic/core/src/app-commands/hasBetterAudio.js"
import { hasBetterVersion } from "@mux-magic/core/src/app-commands/hasBetterVersion.js"
import { hasDuplicateMusicFiles } from "@mux-magic/core/src/app-commands/hasDuplicateMusicFiles.js"
import { hasImaxEnhancedAudio } from "@mux-magic/core/src/app-commands/hasImaxEnhancedAudio.js"
import { hasManyAudioTracks } from "@mux-magic/core/src/app-commands/hasManyAudioTracks.js"
import { hasSurroundSound } from "@mux-magic/core/src/app-commands/hasSurroundSound.js"
import { hasWrongDefaultTrack } from "@mux-magic/core/src/app-commands/hasWrongDefaultTrack.js"
import { isMissingSubtitles } from "@mux-magic/core/src/app-commands/isMissingSubtitles.js"
import {
  keepLanguages,
  keepLanguagesDefaultProps,
} from "@mux-magic/core/src/app-commands/keepLanguages.js"
import { matchFreedbRelease } from "@mux-magic/core/src/app-commands/matchFreedbRelease.js"
import {
  type MusicMatchClusterRecord,
  matchMusicBrainzRelease,
} from "@mux-magic/core/src/app-commands/matchMusicBrainzRelease.js"
import { matchMusicRelease } from "@mux-magic/core/src/app-commands/matchMusicRelease.js"
import { matchVgmdbRelease } from "@mux-magic/core/src/app-commands/matchVgmdbRelease.js"
import { mergeTracks } from "@mux-magic/core/src/app-commands/mergeTracks.js"
import { modifySubtitleMetadata } from "@mux-magic/core/src/app-commands/modifySubtitleMetadata.js"
import { moveFiles } from "@mux-magic/core/src/app-commands/moveFiles.js"
import { moveFilesIntoNamedFolders } from "@mux-magic/core/src/app-commands/moveFilesIntoNamedFolders.js"
import { nameAnimeEpisodes } from "@mux-magic/core/src/app-commands/nameAnimeEpisodes.js"
import { nameAnimeEpisodesAniDB } from "@mux-magic/core/src/app-commands/nameAnimeEpisodesAniDB.js"
import { nameMovieCutsDvdCompareTmdb } from "@mux-magic/core/src/app-commands/nameMovieCutsDvdCompareTmdb.js"
import { nameSpecialFeaturesDvdCompareTmdb } from "@mux-magic/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.js"
import { nameTvShowEpisodes } from "@mux-magic/core/src/app-commands/nameTvShowEpisodes.js"
import { onlyNameSpecialFeaturesDvdCompare } from "@mux-magic/core/src/app-commands/onlyNameSpecialFeaturesDvdCompare.js"
import { remuxToMkv } from "@mux-magic/core/src/app-commands/remuxToMkv.js"
import {
  type RenameAndMoveAudioFilesRecord,
  renameAndMoveAudioFiles,
} from "@mux-magic/core/src/app-commands/renameAndMoveAudioFiles.js"
import { renameDemos } from "@mux-magic/core/src/app-commands/renameDemos.js"
import {
  type RenameRecord,
  renameFiles,
} from "@mux-magic/core/src/app-commands/renameFiles.js"
import {
  type RenameFilesAndFoldersRecord,
  renameFilesAndFolders,
} from "@mux-magic/core/src/app-commands/renameFilesAndFolders.js"
import { renameMovieClipDownloads } from "@mux-magic/core/src/app-commands/renameMovieClipDownloads.js"
import { renumberChapters } from "@mux-magic/core/src/app-commands/renumberChapters.js"
import {
  reorderTracks,
  reorderTracksDefaultProps,
} from "@mux-magic/core/src/app-commands/reorderTracks.js"
import {
  replaceAttachments,
  replaceAttachmentsDefaultProps,
} from "@mux-magic/core/src/app-commands/replaceAttachments.js"
import {
  replaceFlacWithPcmAudio,
  replaceFlacWithPcmAudioDefaultProps,
} from "@mux-magic/core/src/app-commands/replaceFlacWithPcmAudio.js"
import {
  replaceTracks,
  replaceTracksDefaultProps,
} from "@mux-magic/core/src/app-commands/replaceTracks.js"
import {
  type ScanAudioFilesRecord,
  scanAudioFiles,
} from "@mux-magic/core/src/app-commands/scanAudioFiles.js"
import { setDisplayWidth } from "@mux-magic/core/src/app-commands/setDisplayWidth.js"
import {
  splitChapters,
  splitChaptersDefaultProps,
} from "@mux-magic/core/src/app-commands/splitChapters.js"
import {
  splitCueSheet,
  splitCueSheetDefaultProps,
} from "@mux-magic/core/src/app-commands/splitCueSheet.js"
import { storeAspectRatioData } from "@mux-magic/core/src/app-commands/storeAspectRatioData.js"
import { writeAudioTags } from "@mux-magic/core/src/app-commands/writeAudioTags.js"
import { makeDirectory } from "@mux-magic/tools"
import type { Context } from "hono"
import type { Observable } from "rxjs"
import {
  getEffectiveCommandConfigs,
  getFakeScenario,
  isFakeRequest,
} from "../../fake-data/index.js"
import { runJob } from "../jobRunner.js"
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

import {
  type CommandName,
  commandNames,
} from "../commandNames.js"

export { type CommandName, commandNames }

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
  // ─── Music tagging ──────────────────────────────────────────────────
  //
  // The Picard/MP3Tag replacement. Read first, then match, then review in
  // the tag table, then write, then file. Only two of these change a file,
  // and both have a dry run.
  scanAudioFiles: {
    getObservable: (body) =>
      scanAudioFiles({
        isRecursive: body.isRecursive,
        recursiveDepth: body.recursiveDepth,
        sourcePath: body.sourcePath,
      }),
    extractOutputs: (results) => ({
      audioFilePaths: (results as ScanAudioFilesRecord[])
        .filter((record) => record.kind === "scanned")
        .map((record) => record.filePath),
      unreadableFilePaths: (
        results as ScanAudioFilesRecord[]
      )
        .filter((record) => record.kind === "unreadable")
        .map((record) => record.filePath),
    }),
    schema: schemas.scanAudioFilesRequestSchema,
    summary:
      "Walk a folder for audio files and report each one's existing tags, codec, bit depth, sample rate and duration. Pure read — no filesystem mutation.",
    tags: ["Music Tagging"],
  },
  findDuplicateAudioFiles: {
    getObservable: (body) =>
      findDuplicateAudioFiles({
        isFingerprintCompared: body.isFingerprintCompared,
        isRecursive: body.isRecursive,
        recursiveDepth: body.recursiveDepth,
        sourcePath: body.sourcePath,
      }),
    extractOutputs: (results) => ({
      // The copies the ranking would drop, NOT a delete list. Nothing
      // acts on these without a confirmed row in the compare table.
      recommendedKeepFilePaths: (
        results as FindDuplicateAudioFilesGroupRecord[]
      ).flatMap((group) =>
        group.copies
          .filter((copy) => copy.isRecommendedKeep)
          .map((copy) => copy.filePath),
      ),
      redundantFilePaths: (
        results as FindDuplicateAudioFilesGroupRecord[]
      ).flatMap((group) =>
        group.copies
          .filter((copy) => !copy.isRecommendedKeep)
          .map((copy) => copy.filePath),
      ),
    }),
    schema: schemas.findDuplicateAudioFilesRequestSchema,
    summary:
      "Find duplicate audio files by identical decoded audio, by AcoustID fingerprint, or by tags, and rank which copy to keep — lossless first, then bit depth and sample rate. Read-only: it recommends, the compare table confirms, and nothing is deleted here.",
    tags: ["Music Tagging"],
  },
  fingerprintAudioFiles: {
    getObservable: (body) =>
      fingerprintAudioFiles({
        isRecursive: body.isRecursive,
        minimumScore: body.minimumScore,
        recordingLimit: body.recordingLimit,
        recursiveDepth: body.recursiveDepth,
        sourcePath: body.sourcePath,
      }),
    extractOutputs: (results) => ({
      matchedFilePaths: (
        results as FingerprintAudioFilesRecord[]
      )
        .filter((record) => record.kind === "matched")
        .map((record) => record.filePath),
      unmatchedFilePaths: (
        results as FingerprintAudioFilesRecord[]
      )
        .filter((record) => record.kind === "unmatched")
        .map((record) => record.filePath),
    }),
    schema: schemas.fingerprintAudioFilesRequestSchema,
    summary:
      "Fingerprint each audio file with fpcalc and ask AcoustID which recording it is. Identifies untagged and mis-tagged files, which the MusicBrainz cluster match cannot. Read-only.",
    tags: ["Music Tagging"],
  },
  matchMusicBrainzRelease: {
    getObservable: (body) =>
      matchMusicBrainzRelease({
        candidateFetchLimit: body.candidateFetchLimit,
        isRecursive: body.isRecursive,
        recursiveDepth: body.recursiveDepth,
        sourcePath: body.sourcePath,
      }),
    extractOutputs: (results) => ({
      matchedFilePaths: (
        results as MusicMatchClusterRecord[]
      ).flatMap((cluster) =>
        cluster.files
          .filter(
            (file) => file.rankedCandidates.length > 0,
          )
          .map((file) => file.filePath),
      ),
    }),
    schema: schemas.matchMusicBrainzReleaseRequestSchema,
    summary:
      "Cluster a folder's audio files into candidate albums from their existing tags, search MusicBrainz for each cluster, and attach ranked releases with a proposed tag set per file. Read-only — the tag table is where a match is accepted.",
    tags: ["Music Tagging"],
  },
  matchMusicRelease: {
    getObservable: (body) =>
      matchMusicRelease({
        isRecursive: body.isRecursive,
        language: body.language,
        recursiveDepth: body.recursiveDepth,
        sourcePath: body.sourcePath,
      }),
    extractOutputs: (results) => ({
      matchedFilePaths: (
        results as MusicMatchClusterRecord[]
      ).flatMap((cluster) =>
        cluster.files
          .filter(
            (file) => file.rankedCandidates.length > 0,
          )
          .map((file) => file.filePath),
      ),
    }),
    schema: schemas.matchMusicReleaseRequestSchema,
    summary:
      "Match a folder against MusicBrainz, VGMdb and freedb in that order, then combine every candidate into one tag review table. One provider failure does not prevent the other two from running. Read-only.",
    tags: ["Music Tagging"],
  },
  matchFreedbRelease: {
    getObservable: (body) =>
      matchFreedbRelease({
        candidateLimit: body.candidateLimit,
        isRecursive: body.isRecursive,
        recursiveDepth: body.recursiveDepth,
        sourcePath: body.sourcePath,
      }),
    extractOutputs: (results) => ({
      matchedFilePaths: (
        results as MusicMatchClusterRecord[]
      ).flatMap((cluster) =>
        cluster.files
          .filter(
            (file) => file.rankedCandidates.length > 0,
          )
          .map((file) => file.filePath),
      ),
    }),
    schema: schemas.matchFreedbReleaseRequestSchema,
    summary:
      "Match a folder against general freedb — the THIRD fallback, for discs neither MusicBrainz nor VGMdb has. freedb is user-submitted CD metadata with no editorial review and no ids to link back to, so run it last. Like VGMdb it identifies a whole disc by track count and total playing time, so point it at ONE disc. Read-only.",
    tags: ["Music Tagging"],
  },
  matchVgmdbRelease: {
    getObservable: (body) =>
      matchVgmdbRelease({
        candidateLimit: body.candidateLimit,
        isRecursive: body.isRecursive,
        language: body.language,
        recursiveDepth: body.recursiveDepth,
        sourcePath: body.sourcePath,
      }),
    extractOutputs: (results) => ({
      matchedFilePaths: (
        results as MusicMatchClusterRecord[]
      ).flatMap((cluster) =>
        cluster.files
          .filter(
            (file) => file.rankedCandidates.length > 0,
          )
          .map((file) => file.filePath),
      ),
    }),
    schema: schemas.matchVgmdbReleaseRequestSchema,
    summary:
      "Match a folder against VGMdb for game and anime soundtracks, which MusicBrainz covers badly. VGMdb identifies a whole disc by track count and total playing time, so point this at ONE disc — a flattened multi-disc folder will not match. Read-only; the tag table is where a match is accepted.",
    tags: ["Music Tagging"],
  },
  writeAudioTags: {
    getObservable: (body) =>
      writeAudioTags({
        isDryRun: body.isDryRun,
        isRecursive: body.isRecursive,
        isTimestampPreserved: body.isTimestampPreserved,
        recursiveDepth: body.recursiveDepth,
        sourcePath: body.sourcePath,
        // Only the fields the caller actually set are forwarded. An absent
        // key means "leave what is there" all the way down to the writer,
        // so spreading `body` wholesale would turn every unset field into
        // an explicit clear.
        tags: Object.fromEntries(
          (
            [
              "album",
              "albumArtist",
              "artist",
              "comment",
              "composer",
              "date",
              "genres",
              "totalDiscs",
            ] as const
          )
            .filter((field) => body[field] !== undefined)
            .map((field) => [field, body[field]]),
        ),
      }),
    schema: schemas.writeAudioTagsRequestSchema,
    summary:
      "Set the same tag fields on every audio file under a folder — MP3Tag's bulk edit. The reviewed, per-file write behind the tag table is POST /music/tags, not this command.",
    tags: ["Music Tagging"],
  },
  renameAndMoveAudioFiles: {
    getObservable: (body) =>
      renameAndMoveAudioFiles({
        isDryRun: body.isDryRun,
        isOverwriteAllowed: body.isOverwriteAllowed,
        isRecursive: body.isRecursive,
        libraryRoot: body.libraryRoot,
        namingScript: body.namingScript,
        recursiveDepth: body.recursiveDepth,
        sourcePath: body.sourcePath,
      }),
    extractOutputs: (results) => ({
      movedFilePaths: (
        results as RenameAndMoveAudioFilesRecord[]
      )
        .filter((record) => record.kind === "moved")
        .map((record) => record.destination),
    }),
    schema: schemas.renameAndMoveAudioFilesRequestSchema,
    summary:
      "File tagged audio into the library tree using the Picard naming script. Each file's own tags decide its destination, so run this after the tags are right.",
    tags: ["Music Tagging"],
  },
  renameFilesAndFolders: {
    getObservable: (body) =>
      renameFilesAndFolders({
        isDryRun: body.isDryRun,
        isRenamingFiles: body.isRenamingFiles,
        isRenamingFolders: body.isRenamingFolders,
        nameFilterRegex: body.nameFilterRegex,
        recursiveDepth: body.recursiveDepth,
        renameRegex: body.renameRegex,
        sourcePath: body.sourcePath,
      }),
    extractOutputs: (results) => ({
      renamedPaths: (
        results as RenameFilesAndFoldersRecord[]
      )
        .filter((record) => record.kind === "renamed")
        .map((record) => record.destination),
    }),
    schema: schemas.renameFilesAndFoldersRequestSchema,
    summary:
      "Rename files and folders by regex. The general renamer — renaming was previously only ever a side effect of a naming command, and renameFiles covers files only.",
    tags: ["File Operations"],
  },
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
  convertLosslessToFlac: {
    getObservable: (body) =>
      convertLosslessToFlac({
        isAuditOnly: body.isAuditOnly,
        isRecursive: body.isRecursive,
        isSourceDeleted: body.isSourceDeleted,
        recursiveDepth: body.recursiveDepth,
        sourcePath: body.sourcePath,
      }),
    extractOutputs: (results) => {
      const records =
        results as ConvertLosslessToFlacRecord[]
      const converted = records.filter(
        (
          record,
        ): record is ConvertLosslessToFlacConvertedRecord =>
          record.kind === "converted",
      )
      const skipped = records.filter(
        (
          record,
        ): record is ConvertLosslessToFlacSkippedRecord =>
          record.kind === "skipped",
      )
      return {
        converted: converted.map((record) => ({
          source: record.source,
          destination: record.destination,
        })),
        skipped: skipped.map((record) => ({
          source: record.source,
          reason: record.reason,
        })),
      }
    },
    schema: schemas.convertLosslessToFlacRequestSchema,
    summary:
      "Encode lossless audio files (.wav / .aif / .aiff / .m4a / .m4b) to FLAC in-place (strictly lossless)",
    tags: ["Audio Operations"],
  },
  findContainerAudioFiles: {
    getObservable: (body) =>
      findContainerAudioFiles({
        isRecursive: body.isRecursive,
        sourcePath: body.sourcePath,
      }),
    schema: schemas.findContainerAudioFilesRequestSchema,
    summary:
      "Probe container-with-video files (.mkv / .mp4 / .m4v / .mov / .webm / .avi) with MediaInfo and report per-file track summaries (audio count, video count, codec, hasVideoTrack). Pure read — no filesystem mutation.",
    tags: ["Audio Operations"],
  },
  convertContainerAudioToFlac: {
    getObservable: (body) =>
      convertContainerAudioToFlac({
        isRecursive: body.isRecursive,
        isSourceDeleted: body.isSourceDeleted,
        isVideoDropAcknowledged:
          body.isVideoDropAcknowledged,
        sourcePath: body.sourcePath,
      }),
    extractOutputs: (results) => {
      const records =
        results as ConvertContainerAudioToFlacRecord[]
      const converted = records.filter(
        (
          record,
        ): record is ConvertContainerAudioToFlacConvertedRecord =>
          record.kind === "converted",
      )
      return {
        converted: converted.map((record) => ({
          source: record.source,
          destination: record.destination,
        })),
      }
    },
    schema:
      schemas.convertContainerAudioToFlacRequestSchema,
    summary:
      "Encode audio tracks from container-with-video files (.mkv / .mp4 / etc.) to FLAC in-place, dropping the video stream. Requires isVideoDropAcknowledged: true to convert files that have a video track.",
    tags: ["Audio Operations"],
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
        isOverwriteAllowed: body.allowOverwrite,
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
  analyseDiscBackup: {
    getObservable: (body) =>
      analyseDiscBackup({
        disabledRuleNames: body.disabledRuleNames,
        minimumTitleLengthSeconds:
          body.minimumTitleLengthSeconds,
        sourcePath: body.sourcePath,
      }),
    // Read-only, so no outputFolderName / outputComputation: the analysis
    // goes to a DISC-ANALYSIS/ sidecar inside the backup and nothing else
    // in the folder is touched, leaving sourcePath itself as what a
    // downstream step chains off.
    schema: schemas.analyseDiscBackupRequestSchema,
    summary:
      "Analyse a disc backup and propose which titles to rip, with a stated reason per title",
    tags: ["Disc Backups"],
  },
  extractDiscTitles: {
    extractOutputs: (results) => ({
      extractedFilePaths: (
        results as { filePath: string }[]
      ).map((extracted) => extracted.filePath),
    }),
    getObservable: (body) =>
      extractDiscTitles({
        destinationPath: body.destinationPath,
        disabledRuleNames: body.disabledRuleNames,
        isRippingTrackSupersets:
          body.isRippingTrackSupersets,
        minimumTitleLengthSeconds:
          body.minimumTitleLengthSeconds,
        sourcePath: body.sourcePath,
        titleIndexes: body.titleIndexes,
      }),
    // The ripped files are what a downstream step consumes, so the chain
    // point is the EXTRACTED-TITLES/ folder, not the backup.
    outputFolderName: extractedTitlesFolderName,
    schema: schemas.extractDiscTitlesRequestSchema,
    summary:
      "Rip the titles a disc analysis proposed keeping out of a `[BACKUP]` folder into .mkv files",
    tags: ["Disc Backups"],
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
        subtitleTypes: body.subtitleTypes,
        // Schema normalizes to { code } objects; the core takes bare codes.
        subtitlesLanguages: body.subtitlesLanguages.map(
          (selection: { code: string }) => selection.code,
        ),
        typesMode: body.typesMode,
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
        subtitleTypes: body.subtitleTypes,
        // Schema normalizes to { code } objects; the core takes bare codes.
        subtitlesLanguages: body.subtitlesLanguages.map(
          (selection: { code: string }) => selection.code,
        ),
        typesMode: body.typesMode,
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
        isOverwritingExtractedAudio:
          body.isOverwritingExtractedAudio,
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
    // The runner reads `isExiting` / `exitReason` off the child job's
    // outputs to decide whether to short-circuit the umbrella sequence
    // with `status: "exited"`. The keys here are a reserved contract —
    // any future flow-control command (`exitIfFileCountBelow`, etc.)
    // can publish the same shape without touching the runner.
    extractOutputs: (results) => {
      const decision = results[0] as
        | { isExiting?: boolean; exitReason?: string }
        | undefined
      return {
        isExiting: decision?.isExiting === true,
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
        isOverwriteAllowed: body.allowOverwrite,
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
  moveFilesIntoNamedFolders: {
    getObservable: (body) =>
      moveFilesIntoNamedFolders({
        sourcePath: body.sourcePath,
      }),
    schema: schemas.moveFilesIntoNamedFoldersRequestSchema,
    summary:
      "Foldarize a directory: each file is moved into a new same-named subdirectory (extension stripped from the folder name)",
    tags: ["File Operations"],
  },
  distributeFolderToSiblings: {
    getObservable: (body) =>
      distributeFolderToSiblings({
        isDeletingSourceFolderAfterDistributing:
          body.deleteSourceFolderAfterDistributing,
        sourceFolderPath: body.sourceFolderPath,
      }),
    schema: schemas.distributeFolderToSiblingsRequestSchema,
    summary:
      "Copy a folder (default ./attachments) into every sibling directory of its parent, with optional source-folder cleanup",
    tags: ["File Operations"],
  },
  flattenChildFolders: {
    getObservable: (body) =>
      flattenChildFolders({
        isDeletingEmptyChildFoldersAfterFlattening:
          body.deleteEmptyChildFoldersAfterFlattening,
        parentPath: body.parentPath,
      }),
    schema: schemas.flattenChildFoldersRequestSchema,
    summary:
      "Move every file from each immediate child directory of parentPath up to parentPath itself, with optional empty-child cleanup",
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
        filenameRegex: body.filenameRegex,
        searchTerm: body.searchTerm,
        seasonNumber: body.seasonNumber,
        seriesName: body.seriesName,
        sourcePath: body.sourcePath,
        startEpisodeNumber: body.startEpisodeNumber,
      }),
    // Every renamed file carries the same seriesFolderName ("<name>
    // [anidb-<id>]"); surface it as a named output so a downstream
    // copyFiles/moveFiles step can target the Plex/Sonarr library folder
    // via linkedTo. Empty when nothing was renamed.
    extractOutputs: (results) => {
      const seriesFolderName = (
        results as { seriesFolderName?: string }[]
      ).find(
        (record) => record?.seriesFolderName,
      )?.seriesFolderName
      return seriesFolderName ? { seriesFolderName } : {}
    },
    schema: schemas.nameAnimeEpisodesAniDBRequestSchema,
    summary:
      "Rename anime episode files using AniDB metadata (regular, specials with length-matched picker, or type=6 alternates)",
    tags: ["Naming Operations"],
  },
  fetchThemeMusic: {
    getObservable: (body) =>
      fetchThemeMusic({
        isApplied: body.isApplied,
        isOverwrite: body.isOverwrite,
        manifestPath: body.manifestPath,
        sourcePath: body.sourcePath,
      }),
    schema: schemas.fetchThemeMusicRequestSchema,
    summary:
      "Resolve AniDB-tagged anime folders through AnimeThemes and create a reviewable Plex theme music manifest.",
    tags: ["Metadata Operations"],
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
  onlyNameSpecialFeaturesDvdCompare: {
    getObservable: (body) =>
      onlyNameSpecialFeaturesDvdCompare({
        isAutoNamingDuplicates: body.autoNameDuplicates,
        dvdCompareId: body.dvdCompareId,
        dvdCompareReleaseHash: body.dvdCompareReleaseHash,
        fixedOffset: body.fixedOffset,
        searchTerm: body.searchTerm,
        sourcePath: body.sourcePath,
        timecodePaddingAmount: body.timecodePadding,
        url: body.url,
      }),
    schema:
      schemas.onlyNameSpecialFeaturesDvdCompareRequestSchema,
    summary:
      "Rename special features by timecode matching against DVDCompare.net — no TMDB lookup. Suited for concerts, documentaries, and other non-movie workflows.",
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
        hasAudioSyncOffset: body.hasAudioSyncOffset,
        hasChapters: body.includeChapters,
        isOverwritingExtractedAudio:
          body.isOverwritingExtractedAudio,
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
        isPaddingChapterNumbers:
          body.isPaddingChapterNumbers,
        isRenumberingChapters: body.isRenumberingChapters,
        sourcePath: body.sourcePath,
      }),
    outputFolderName:
      splitChaptersDefaultProps.outputFolderName,
    schema: schemas.splitChaptersRequestSchema,
    summary: "Split media files by chapter markers",
    tags: ["File Operations"],
  },
  splitCueSheet: {
    getObservable: (body) =>
      splitCueSheet({
        isRecursive: body.isRecursive,
        outputFolderName: body.outputFolderName,
        sourcePath: body.sourcePath,
      }),
    outputFolderName:
      splitCueSheetDefaultProps.outputFolderName,
    schema: schemas.splitCueSheetRequestSchema,
    summary: "Split CUE sheet to FLAC",
    tags: ["Audio Operations"],
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
