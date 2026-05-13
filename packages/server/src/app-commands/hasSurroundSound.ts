import { dirname } from "node:path"
import {
  getFilesAtDepth,
  logAndRethrowPipelineError,
  logInfo,
} from "@mux-magic/tools"
import { filter, groupBy, map, take, tap } from "rxjs"
import { filterIsVideoFile } from "../tools/filterIsVideoFile.js"
import {
  type AudioTrack,
  getMediaInfo,
} from "../tools/getMediaInfo.js"
import {
  mergeMapOrdered,
  runTasks,
} from "../tools/taskScheduler.js"

export const hasSurroundSound = ({
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
    groupBy((fileInfo) => dirname(fileInfo.fullPath)),
    // Outer: emit one log line per directory in directory-encounter
    // order. Plain mergeMapOrdered (no runTask wrap) — the inner per-
    // file IO is what competes for scheduler slots; wrapping the outer
    // group in runTask too would deadlock at MAX_THREADS groups.
    mergeMapOrdered((groupObservable) =>
      groupObservable.pipe(
        filterIsVideoFile(),
        // Inner: per-file getMediaInfo runs as a parallel Task,
        // capped by MAX_THREADS across all directories. take(1)
        // below short-circuits as soon as ANY file in the directory
        // is detected as surround sound — RxJS unsubscribes the
        // remaining in-flight Tasks, freeing their scheduler slots.
        runTasks((fileInfo) =>
          getMediaInfo(fileInfo.fullPath).pipe(
            filter(Boolean),
            map(({ media }) => media),
            filter(Boolean),
            map(({ track }) =>
              track.filter(
                (trackEntry): trackEntry is AudioTrack =>
                  trackEntry["@type"] === "Audio",
              ),
            ),
            map((audioTracks) =>
              audioTracks
                .map((track) => {
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
                    track.Channels_Original ||
                      track.Channels ||
                      2,
                  )

                  if (
                    audioFormat?.includes("Atmos") ||
                    formatAdditionalFeatures === "XLL X" ||
                    formatAdditionalFeatures ===
                      "XLL X IMAX"
                  ) {
                    return {
                      channelCount: 16,
                      track,
                    }
                  }

                  // This might not work correctly.

                  const formatSettingsMode =
                    track.Format_Settings_Mode

                  if (
                    formatSettingsMode ===
                    "Dolby Surround EX"
                  ) {
                    return {
                      channelCount: 8,
                      track,
                    }
                  }

                  // This might not work correctly.

                  if (
                    formatSettingsMode === "Dolby Surround"
                  ) {
                    return {
                      channelCount: 4,
                      track,
                    }
                  }

                  if (channelLayout) {
                    return {
                      channelCount:
                        channelLayout.split(" ").length,
                      track,
                    }
                  }

                  return {
                    channelCount: numberOfChannels,
                    track,
                  }
                })
                .reduce(
                  (selectedValue, value, index) =>
                    selectedValue.channelCount >=
                    value.channelCount
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
            ),
            filter(({ channelCount }) => channelCount > 2),
            map((props) => ({
              ...props,
              fileInfo,
            })),
          ),
        ),
        take(1),
        tap(({ channelCount, fileInfo, track }) => {
          logInfo(
            dirname(fileInfo.fullPath),
            (
              track.Format_Commercial_IfAny ||
              track.Format_Commercial ||
              track.Format
            ).concat(
              " ",
              track.Format_AdditionalFeatures || "",
            ),
            channelCount.toString(),
          )
        }),
      ),
    ),
    logAndRethrowPipelineError(hasSurroundSound),
  )
