import "@mux-magic/server/src/loadEnv.js"
// Side-effect import — must come BEFORE any app-command import so the
// scheduler is initialized at concurrency=1 before module bodies run.
import "./tools/initTaskSchedulerCli.js"

import { logError } from "@mux-magic/tools"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"

import { addSubtitlesCommand } from "./cli-commands/addSubtitlesCommand.js"
import { changeTrackLanguagesCommand } from "./cli-commands/changeTrackLanguagesCommand.js"
import { copyFilesCommand } from "./cli-commands/copyFilesCommand.js"
import { copyOutSubtitlesCommand } from "./cli-commands/copyOutSubtitlesCommand.js"
import { deleteCopiedOriginalsCommand } from "./cli-commands/deleteCopiedOriginalsCommand.js"
import { deleteFilesByExtensionCommand } from "./cli-commands/deleteFilesByExtensionCommand.js"
import { deleteFolderCommand } from "./cli-commands/deleteFolderCommand.js"
import { extractSubtitlesCommand } from "./cli-commands/extractSubtitlesCommand.js"
import { fixIncorrectDefaultTracksCommand } from "./cli-commands/fixIncorrectDefaultTracksCommand.js"
import { flattenOutputCommand } from "./cli-commands/flattenOutputCommand.js"
import { getAudioOffsetsCommand } from "./cli-commands/getAudioOffsetsCommand.js"
import { getSubtitleMetadataCommand } from "./cli-commands/getSubtitleMetadataCommand.js"
import { hasBetterAudioCommand } from "./cli-commands/hasBetterAudioCommand.js"
import { hasBetterVersionCommand } from "./cli-commands/hasBetterVersionCommand.js"
import { hasDuplicateMusicFilesCommand } from "./cli-commands/hasDuplicateMusicFilesCommand.js"
import { hasImaxEnhancedAudioCommand } from "./cli-commands/hasImaxEnhancedAudioCommand.js"
import { hasManyAudioTracksCommand } from "./cli-commands/hasManyAudioTracksCommand.js"
import { hasSurroundSoundCommand } from "./cli-commands/hasSurroundSoundCommand.js"
import { hasWrongDefaultTrackCommand } from "./cli-commands/hasWrongDefaultTrackCommand.js"
import { inverseTelecineDiscRipsCommand } from "./cli-commands/inverseTelecineDiscRipsCommand.js"
import { isMissingSubtitlesCommand } from "./cli-commands/isMissingSubtitlesCommand.js"
import { keepLanguagesCommand } from "./cli-commands/keepLanguagesCommand.js"
import { mergeOrderedChaptersCommand } from "./cli-commands/mergeOrderedChaptersCommand.js"
import { mergeTracksCommand } from "./cli-commands/mergeTracksCommand.js"
import { modifySubtitleMetadataCommand } from "./cli-commands/modifySubtitleMetadataCommand.js"
import { moveFilesCommand } from "./cli-commands/moveFilesCommand.js"
import { nameAnimeEpisodesAniDBCommand } from "./cli-commands/nameAnimeEpisodesAniDBCommand.js"
import { nameAnimeEpisodesCommand } from "./cli-commands/nameAnimeEpisodesCommand.js"
import { nameMovieCutsDvdCompareTmdbCommand } from "./cli-commands/nameMovieCutsDvdCompareTmdbCommand.js"
import { nameSpecialFeaturesDvdCompareTmdbCommand } from "./cli-commands/nameSpecialFeaturesDvdCompareTmdbCommand.js"
import { nameTvShowEpisodesCommand } from "./cli-commands/nameTvShowEpisodesCommand.js"
import { remuxToMkvCommand } from "./cli-commands/remuxToMkvCommand.js"
import { renameDemosCommand } from "./cli-commands/renameDemosCommand.js"
import { renameFilesCommand } from "./cli-commands/renameFilesCommand.js"
import { renameMovieClipDownloadsCommand } from "./cli-commands/renameMovieClipDownloadsCommand.js"
import { renumberChaptersCommand } from "./cli-commands/renumberChaptersCommand.js"
import { reorderTracksCommand } from "./cli-commands/reorderTracksCommand.js"
import { replaceAttachmentsCommand } from "./cli-commands/replaceAttachmentsCommand.js"
import { replaceFlacWithPcmAudioCommand } from "./cli-commands/replaceFlacWithPcmAudioCommand.js"
import { replaceTracksCommand } from "./cli-commands/replaceTracksCommand.js"
import { setDisplayWidthCommand } from "./cli-commands/setDisplayWidthCommand.js"
import { splitChaptersCommand } from "./cli-commands/splitChaptersCommand.js"
import { storeAspectRatioDataCommand } from "./cli-commands/storeAspectRatioDataCommand.js"

console.time("Command Runtime")

process.on("uncaughtException", (exception) => {
  logError("UNCAUGHT", exception)
})

yargs(hideBin(process.argv))
  .scriptName("")
  .wrap(process.stdout.columns)
  .usage("Usage: $0 <cmd> [args]")
  .command(changeTrackLanguagesCommand)
  .command(copyFilesCommand)
  .command(copyOutSubtitlesCommand)
  .command(extractSubtitlesCommand)
  .command(fixIncorrectDefaultTracksCommand)
  .command(flattenOutputCommand)
  .command(getAudioOffsetsCommand)
  .command(getSubtitleMetadataCommand)
  .command(deleteCopiedOriginalsCommand)
  .command(deleteFilesByExtensionCommand)
  .command(deleteFolderCommand)
  .command(hasBetterAudioCommand)
  .command(hasBetterVersionCommand)
  .command(hasDuplicateMusicFilesCommand)
  .command(hasImaxEnhancedAudioCommand)
  .command(hasManyAudioTracksCommand)
  .command(hasSurroundSoundCommand)
  .command(hasWrongDefaultTrackCommand)
  .command(inverseTelecineDiscRipsCommand)
  .command(isMissingSubtitlesCommand)
  .command(modifySubtitleMetadataCommand)
  .command(keepLanguagesCommand)
  .command(addSubtitlesCommand)
  .command(mergeOrderedChaptersCommand)
  .command(mergeTracksCommand)
  .command(moveFilesCommand)
  .command(nameAnimeEpisodesCommand)
  .command(nameAnimeEpisodesAniDBCommand)
  .command(nameMovieCutsDvdCompareTmdbCommand)
  .command(nameSpecialFeaturesDvdCompareTmdbCommand)
  .command(nameTvShowEpisodesCommand)
  .command(remuxToMkvCommand)
  .command(renameDemosCommand)
  .command(renameFilesCommand)
  .command(renumberChaptersCommand)
  .command(renameMovieClipDownloadsCommand)
  .command(reorderTracksCommand)
  .command(replaceAttachmentsCommand)
  .command(replaceFlacWithPcmAudioCommand)
  .command(replaceTracksCommand)
  .command(setDisplayWidthCommand)
  .command(splitChaptersCommand)
  .command(storeAspectRatioDataCommand)
  .strict().argv
