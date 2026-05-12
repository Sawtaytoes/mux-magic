import { concatMap, filter, map, reduce, tap } from "rxjs"
import { filterIsVideoFile } from "../tools/filterIsVideoFile.js"
import { getFilesAtDepth } from "../tools/getFilesAtDepth.js"
import {
  type AudioTrack,
  getMediaInfo,
} from "../tools/getMediaInfo.js"
import { logAndRethrow } from "../tools/logAndRethrow.js"
import { logInfo } from "../tools/logMessage.js"
import { withFileProgress } from "../tools/progressEmitter.js"

export const hasBetterAudio = ({
  isRecursive,
  recursiveDepth,
  sourcePath,
}: {
  isRecursive: boolean
  recursiveDepth: number
  sourcePath: string
}) =>
  getFilesAtDepth({
    depth: isRecursive ? recursiveDepth || 1 : 0,
    sourcePath,
  }).pipe(
    filterIsVideoFile(),
    withFileProgress((fileInfo) =>
      getMediaInfo(fileInfo.fullPath).pipe(
        filter(Boolean),
        map(({ media }) => media),
        filter(Boolean),
        concatMap(({ track }) => track),
        filter(
          (track): track is AudioTrack =>
            track["@type"] === "Audio",
        ),
        map((track) => {
          const audioFormat =
            track.Format_Commercial_IfAny ||
            track.Format_Commercial ||
            track.Format

          const channelLayout =
            track.ChannelLayout_Original ||
            track.ChannelLayout

          const formatAdditionalFeatures =
            track.Format_AdditionalFeatures

          const numberOfChannels = Number(
            track.Channels_Original || track.Channels || 2,
          )

          if (
            audioFormat?.includes("Atmos") ||
            formatAdditionalFeatures === "XLL X" ||
            formatAdditionalFeatures === "XLL X IMAX"
          ) {
            return {
              channelCount: 16,
              track,
            }
          }

          // This doesn't work correctly.

          // const formatSettingsMode = (
          //   track
          //   .Format_Settings_Mode
          // )

          // if (
          //   formatSettingsMode
          //   === 'Dolby Surround EX'
          // ) {
          //   return {
          //     channelCount: 8,
          //     track,
          //   }
          // }

          // This doesn't work correctly.

          // if (
          //   formatSettingsMode
          //   === 'Dolby Surround'
          // ) {
          //   return {
          //     channelCount: 4,
          //     track,
          //   }
          // }

          if (channelLayout) {
            return {
              channelCount: channelLayout.split(" ").length,
              track,
            }
          }

          return {
            channelCount: numberOfChannels,
            track,
          }
        }),
        reduce(
          (selectedValue, value, index) =>
            selectedValue.channelCount >= value.channelCount
              ? selectedValue
              : {
                  ...value,
                  index,
                },
          {
            channelCount: 0,
            index: -1,
            track: {},
          } as {
            channelCount: number
            index: number
            track: AudioTrack
          },
        ),
        filter(({ channelCount }) => channelCount > 0),
        filter(({ index }) => index > 0),
        tap(({ channelCount, track }) => {
          logInfo(fileInfo.fullPath, channelCount, track)
        }),
      ),
    ),
    logAndRethrow(hasBetterAudio),
  )
