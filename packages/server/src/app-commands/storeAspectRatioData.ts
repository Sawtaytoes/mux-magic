import {
  access,
  constants,
  readFile,
  writeFile,
} from "node:fs/promises"
import { join, sep } from "node:path"
import {
  getFilesAtDepth,
  logAndRethrowPipelineError,
  logInfo,
  runTasks,
} from "@mux-magic/tools"
import {
  catchError,
  concatMap,
  defer,
  filter,
  from,
  map,
  of,
  reduce,
  tap,
  toArray,
} from "rxjs"
import {
  type AspectRatioCalculation,
  getAspectRatioData,
} from "../cli-spawn-operations/getAspectRatioData.js"
import { filterIsVideoFile } from "../tools/filterIsVideoFile.js"
import {
  getMediaInfo,
  type VideoTrack,
} from "../tools/getMediaInfo.js"
import { withFileProgress } from "../tools/progressEmitter.js"

export type AspectRatioData = Record<
  string,
  {
    aspectRatioCalculation: AspectRatioCalculation
    filename: string
    fullPath: string
  }
>

export const replaceRootPath = ({
  filePath,
  fileSeparator = sep,
  newSourcePath,
  oldSourcePath,
}: {
  filePath: string
  fileSeparator?: "/" | "\\"
  newSourcePath: string
  oldSourcePath: string
}) =>
  filePath
    .replace(
      oldSourcePath
        .replace(/[\\/]$/, "")
        .concat(fileSeparator),
      newSourcePath
        .replace(/[\\/]$/, "")
        .concat(fileSeparator),
    )
    .split(fileSeparator)
    .join(newSourcePath.includes("/") ? "/" : "\\")

export const storeAspectRatioData = ({
  folderNames,
  isRecursive,
  mode = "append",
  outputPath,
  recursiveDepth,
  rootPath,
  sourcePath,
}: {
  folderNames: string[]
  isRecursive: boolean
  mode?: "append" | "overwrite"
  outputPath?: string
  recursiveDepth: number
  rootPath?: string
  sourcePath: string
}) =>
  of(
    join(
      outputPath || sourcePath,
      "aspectRatioCalculations.json",
    ),
  ).pipe(
    concatMap((jsonFilePath) =>
      mode === "append"
        ? from(access(jsonFilePath, constants.F_OK)).pipe(
            concatMap(() => readFile(jsonFilePath)),
            map(
              (jsonFileData) =>
                JSON.parse(
                  jsonFileData.toString(),
                ) as AspectRatioData,
            ),
            catchError(() => of({})),
            map((jsonFileData) => ({
              jsonFileData,
              jsonFilePath,
            })),
          )
        : of({
            jsonFileData: {},
            jsonFilePath,
          }),
    ),
    concatMap(({ jsonFileData, jsonFilePath }) =>
      (folderNames.length
        ? from(folderNames).pipe(
            concatMap((folderName) =>
              getFilesAtDepth({
                depth: isRecursive
                  ? recursiveDepth - 1 || 0
                  : 0,
                sourcePath: join(sourcePath, folderName),
              }),
            ),
          )
        : getFilesAtDepth({
            depth: isRecursive ? recursiveDepth || 1 : 0,
            sourcePath,
          })
      ).pipe(
        filterIsVideoFile(),
        map((fileInfo) => ({
          localMediaFilePath: fileInfo.fullPath,
          plexMediaFilePath: rootPath
            ? replaceRootPath({
                filePath: fileInfo.fullPath,
                newSourcePath: rootPath,
                oldSourcePath: sourcePath,
              })
            : fileInfo.fullPath,
        })),
        runTasks(
          ({ localMediaFilePath, plexMediaFilePath }) =>
            of(plexMediaFilePath).pipe(
              filter(() =>
                mode === "append"
                  ? !(plexMediaFilePath in jsonFileData)
                  : true,
              ),
              map(() => ({
                localMediaFilePath,
                plexMediaFilePath,
              })),
            ),
        ),
        toArray(),
        map((filePaths) => ({
          filePaths,
          jsonFileData,
          jsonFilePath,
        })),
      ),
    ),
    concatMap(({ filePaths, jsonFileData, jsonFilePath }) =>
      from(filePaths).pipe(
        withFileProgress(
          ({ localMediaFilePath, plexMediaFilePath }) =>
            from(getMediaInfo(localMediaFilePath))
              .pipe(
                filter(Boolean),
                map(({ media }) => media),
                filter(Boolean),
                concatMap(({ track }) => track),
                filter(
                  (track): track is VideoTrack =>
                    track["@type"] === "Video",
                ),
              )
              .pipe(
                map(
                  ({
                    DisplayAspectRatio: displayAspectRatio,
                    Duration: duration,
                    HDR_Format_Compatibility:
                      hdrFormatCompatibility,
                    Height: height,
                    transfer_characteristics:
                      transferCharacteristics,
                    Width: width,
                  }) => ({
                    displayAspectRatio: Number(
                      displayAspectRatio,
                    ),
                    duration: Math.floor(Number(duration)),
                    height,
                    isAnamorphic:
                      displayAspectRatio !==
                      (
                        Number(width) / Number(height)
                      ).toFixed(3),
                    isHdr: Boolean(
                      transferCharacteristics === "PQ" ||
                        transferCharacteristics?.includes(
                          "HLG",
                        ) ||
                        hdrFormatCompatibility ===
                          "HDR10" ||
                        hdrFormatCompatibility?.endsWith(
                          "HDR10",
                        ),
                    ),
                    videoAspectRatio:
                      Number(width) / Number(height),
                  }),
                ),
                concatMap(
                  ({
                    duration,
                    displayAspectRatio,
                    isAnamorphic,
                    isHdr,
                    videoAspectRatio,
                  }) =>
                    getAspectRatioData({
                      anamorphicCorrectionMultiplier:
                        isAnamorphic
                          ? displayAspectRatio /
                            videoAspectRatio
                          : 1,
                      duration,
                      filePath: localMediaFilePath,
                      isHdr,
                    }),
                ),
                filter(Boolean),
                map((aspectRatioCalculation) => ({
                  aspectRatioCalculation,
                  localMediaFilePath,
                  plexMediaFilePath,
                })),
                tap(() => {
                  logInfo(
                    "CALCULATED ASPECT RATIOS",
                    localMediaFilePath,
                  )
                }),
              ),
          {
            concurrency: Infinity,
          },
        ),
        reduce(
          (
            aspectRatioCalculationData,
            { aspectRatioCalculation, plexMediaFilePath },
          ) => ({
            ...aspectRatioCalculationData,
            [plexMediaFilePath]: aspectRatioCalculation,
          }),
          jsonFileData,
        ),
        map((aspectRatioCalculationData) => ({
          aspectRatioCalculationData,
          jsonFilePath,
        })),
      ),
    ),
    concatMap(
      ({ aspectRatioCalculationData, jsonFilePath }) =>
        defer(() =>
          writeFile(
            jsonFilePath,
            JSON.stringify(aspectRatioCalculationData),
          ),
        ).pipe(
          // Emit the persisted JSON path so job.results says where the
          // aspect-ratio data was written instead of [null].
          map(() => ({ jsonFilePath })),
        ),
    ),
    logAndRethrowPipelineError(storeAspectRatioData),
  )
