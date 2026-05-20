import { readdir, readFile, stat } from "node:fs/promises"
import { basename, dirname, extname, join } from "node:path"
import {
  logAndRethrowPipelineError,
  logInfo,
  logWarning,
} from "@mux-magic/tools"
import chardet from "chardet"
import iconv from "iconv-lite"
import {
  concatMap,
  defer,
  EMPTY,
  from,
  map,
  Observable,
  toArray,
} from "rxjs"
import { splitCueSheetFfmpeg } from "../cli-spawn-operations/splitCueSheetFfmpeg.js"
import { cueTrackToOutputFilename } from "../tools/cueTrackToOutputFilename.js"
import {
  type CueTrack,
  parseCueSheet,
} from "../tools/parseCueSheet.js"
import { CUE_SPLITS_FOLDER_NAME } from "../tools/outputFolderNames.js"
import { resolveCueAudioFile } from "../tools/resolveCueAudioFile.js"
import { getMediaInfo } from "../tools/getMediaInfo.js"
import { getFileDuration } from "../tools/getFileDuration.js"

export type SplitCueSheetRecord = {
  source: string
  destination: string
  trackNumber: number
  title: string
}

type SplitCueSheetRequiredProps = {
  sourcePath: string
}

type SplitCueSheetOptionalProps = {
  isRecursive?: boolean
  outputFolderName?: string
}

export type SplitCueSheetProps =
  SplitCueSheetRequiredProps & SplitCueSheetOptionalProps

export const splitCueSheetDefaultProps = {
  isRecursive: true,
  outputFolderName: CUE_SPLITS_FOLDER_NAME,
} satisfies SplitCueSheetOptionalProps

// Inline decoder so this module can be tested with `node:fs` mocked
// (the wrapper helper reads the buffer via fs/promises which memfs
// supplies in tests). Mirrors readCueWithEncodingFallback.ts.
const decodeCueBytes = (buffer: Buffer): string => {
  try {
    const decoder = new TextDecoder("utf-8", {
      fatal: true,
    })
    return decoder.decode(buffer)
  } catch {
    const guess =
      chardet.detect(buffer) ?? "windows-1252"
    return iconv.decode(buffer, guess)
  }
}

type CuePlan = {
  cuePath: string
  audioPath: string
  albumFolderName: string
  tracks: CueTrack[]
}

type TrackPlan = {
  cuePath: string
  inputAudioPath: string
  outputFilePath: string
  startSeconds: number
  endSeconds: number
  trackNumber: number
  title: string
}

// Walk `sourcePath` recursively (when isRecursive) and collect every
// folder that contains at least one `.cue` file. Returns an array of
// { folderPath, cuePath } pairs — first .cue in each folder wins; we
// log a warning if multiple .cue files coexist in a single folder
// since picking the wrong one would silently split the wrong album.
const collectCueFolders = async ({
  isRecursive,
  rootPath,
}: {
  isRecursive: boolean
  rootPath: string
}): Promise<
  Array<{ folderPath: string; cuePath: string }>
> => {
  const visit = async (
    folderPath: string,
  ): Promise<
    Array<{ folderPath: string; cuePath: string }>
  > => {
    const entries = await readdir(folderPath)
    const stats = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = join(folderPath, entry)
        try {
          const entryStat = await stat(fullPath)
          return { entry, fullPath, entryStat }
        } catch {
          return null
        }
      }),
    )
    const validStats = stats.filter(
      (
        info,
      ): info is {
        entry: string
        fullPath: string
        entryStat: Awaited<ReturnType<typeof stat>>
      } => info !== null,
    )
    const cueEntries = validStats.filter(
      (info) =>
        info.entryStat.isFile() &&
        extname(info.entry).toLowerCase() === ".cue",
    )
    const selfHit =
      cueEntries.length === 0
        ? []
        : [
            {
              folderPath,
              cuePath: cueEntries[0].fullPath,
            },
          ]
    if (cueEntries.length > 1) {
      logWarning(
        "splitCueSheet",
        `Multiple .cue files in ${folderPath}; using ${cueEntries[0].entry}`,
      )
    }
    if (!isRecursive) return selfHit
    const subfolders = validStats.filter((info) =>
      info.entryStat.isDirectory(),
    )
    const childResults = await Promise.all(
      subfolders.map((info) => visit(info.fullPath)),
    )
    return childResults.reduce(
      (collected, items) => collected.concat(items),
      selfHit,
    )
  }
  return visit(rootPath)
}

const FRAMES_PER_SECOND = 75

const cueFrameToSeconds = (frame: number): number =>
  frame / FRAMES_PER_SECOND

export const splitCueSheet = ({
  isRecursive = splitCueSheetDefaultProps.isRecursive,
  outputFolderName = splitCueSheetDefaultProps.outputFolderName,
  sourcePath,
}: SplitCueSheetProps): Observable<SplitCueSheetRecord> =>
  new Observable<SplitCueSheetRecord>((subscriber) => {
    const abortController = new AbortController()

    const collectAndPlan$ = defer(() =>
      from(
        collectCueFolders({
          isRecursive,
          rootPath: sourcePath,
        }),
      ),
    ).pipe(
      concatMap((cueFolders) => from(cueFolders)),
      concatMap(({ folderPath, cuePath }) =>
        defer(async () => {
          const buffer = await readFile(cuePath)
          const text = decodeCueBytes(buffer)
          const parsed = parseCueSheet(text)
          if (parsed.kind === "error") {
            throw new Error(
              `splitCueSheet: ${cuePath} parse error (${parsed.reason}).`,
            )
          }
          const dirEntries = await readdir(folderPath)
          const resolved = resolveCueAudioFile({
            cuePath,
            audioFileHint: parsed.audioFileHint,
            dirEntries,
          })
          if (resolved.kind === "error") {
            throw new Error(
              `splitCueSheet: ${resolved.reason}`,
            )
          }
          const albumFolderName = basename(folderPath)
          return {
            cuePath,
            audioPath: resolved.path,
            albumFolderName,
            tracks: parsed.tracks,
          } satisfies CuePlan
        }),
      ),
      toArray(),
    )

    const pipeline$ = collectAndPlan$.pipe(
      concatMap((plans) => {
        if (plans.length === 0) return EMPTY
        // Pre-flight: detect album-folder basename collisions
        // (worker 66 halt-and-list pattern). Same basename in
        // different parents would silently overwrite — refuse.
        const grouped = plans.reduce(
          (groups, plan) => {
            const key = plan.albumFolderName.toLowerCase()
            const existing = groups.get(key) ?? []
            return new Map(groups).set(
              key,
              existing.concat(plan),
            )
          },
          new Map<string, CuePlan[]>(),
        )
        const collisions = Array.from(grouped.values()).filter(
          (group) => group.length > 1,
        )
        if (collisions.length > 0) {
          const message = collisions
            .map(
              (group) =>
                `${group[0].albumFolderName}: ${group
                  .map((plan) => plan.cuePath)
                  .join(", ")}`,
            )
            .join("\n")
          throw new Error(
            `splitCueSheet album-folder collision — refusing to split. Conflicts:\n${message}`,
          )
        }
        return from(plans).pipe(
          concatMap((plan) =>
            getMediaInfo(plan.audioPath).pipe(
              concatMap((mediaInfo) =>
                getFileDuration({ mediaInfo }),
              ),
              map((duration) => {
                const tracks = plan.tracks
                const albumOutputFolder = join(
                  sourcePath,
                  outputFolderName,
                  plan.albumFolderName,
                )
                return tracks.map((track, index) => {
                  const nextTrack = tracks[index + 1]
                  const startSeconds = cueFrameToSeconds(
                    track.startFrame,
                  )
                  const endSeconds =
                    nextTrack === undefined
                      ? duration
                      : cueFrameToSeconds(
                          nextTrack.startFrame,
                        )
                  return {
                    cuePath: plan.cuePath,
                    inputAudioPath: plan.audioPath,
                    outputFilePath: join(
                      albumOutputFolder,
                      cueTrackToOutputFilename(
                        track.number,
                        track.title,
                      ),
                    ),
                    startSeconds,
                    endSeconds,
                    trackNumber: track.number,
                    title: track.title,
                  } satisfies TrackPlan
                })
              }),
              concatMap((trackPlans) => from(trackPlans)),
            ),
          ),
          concatMap((trackPlan) =>
            defer(() => {
              if (abortController.signal.aborted) {
                return EMPTY
              }
              return splitCueSheetFfmpeg({
                inputAudioPath: trackPlan.inputAudioPath,
                outputFilePath: trackPlan.outputFilePath,
                startSeconds: trackPlan.startSeconds,
                endSeconds: trackPlan.endSeconds,
              }).pipe(
                map(
                  () =>
                    ({
                      source: trackPlan.cuePath,
                      destination: trackPlan.outputFilePath,
                      trackNumber: trackPlan.trackNumber,
                      title: trackPlan.title,
                    }) satisfies SplitCueSheetRecord,
                ),
              )
            }),
          ),
        )
      }),
    )

    const innerSubscription = pipeline$
      .pipe(logAndRethrowPipelineError(splitCueSheet))
      .subscribe(subscriber)

    // Mirror copyFiles: abort first so any in-flight defer that
    // hasn't yet spawned ffmpeg short-circuits via the signal
    // check; then unsubscribe to tear down the rest.
    return () => {
      abortController.abort()
      innerSubscription.unsubscribe()
    }
  }).pipe(logAndRethrowPipelineError(splitCueSheet))
