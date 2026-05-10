import {
  bufferCount,
  concatMap,
  filter,
  find,
  from,
  map,
  Observable,
  reduce,
} from "rxjs";

import { runTasks } from "../tools/taskScheduler.js";
import { runReadlineFfmpeg } from "./runReadlineFfmpeg.js";

export type AspectRatioCalculation = {
  exactMaxHeightAspectRatio: string
  exactMedianAspectRadio: string
  relativeMaxHeightAspectRatio: string
  relativeMedianAspectRadio: string
}

/*
 * **ORDER MATTERS!**
 *
 * The order of these thresholds is important for the `find` operator to work correctly.
 *
 * The first threshold that matches the duration will be used.
 */
export const durationSampleCountThresholds = [
  {
    maximumSeconds: 600,
    sampleCount: 30,
  },
  {
    maximumSeconds: 30,
    sampleCount: 6,
  },
  {
    maximumSeconds: 0,
    sampleCount: 4,
  },
  {
    maximumSeconds: 120,
    sampleCount: 8,
  },
  {
    maximumSeconds: 360,
    sampleCount: 12,
  },
] as const

export const ffmpegCropdetectRegex = /lavfi\.cropdetect\.(?<measurementType>\w)=(?<measurementValue>.+)/

export const minimumAspectRatios = [
  1.33,
  1.37,
  1.78,
  1.85,
  1.90,
  2.10,
  2.39,
] as const

export const getAspectRatio = ({
  anamorphicCorrectionMultiplier = 1,
  height,
  width,
}: {
  anamorphicCorrectionMultiplier?: number
  height: number
  width: number
}) => (
  (
    (
      width
      / height
    )
    * anamorphicCorrectionMultiplier
  )
  .toFixed(2)
)

export const getRelativeAspectRatio = (
  aspectRatio: (
    | string
    | number
  )
) => {
  const exactAspectRatio = (
    Number(
      aspectRatio
    )
  )

  const relativeAspectRatio = (
    minimumAspectRatios
    .find((
      minimumAspectRatio,
    ) => (
      Math
      .min(
        (
          Number(
            minimumAspectRatio
          )
          + 0.02 // Slight padding for minor offsets.
        ),
        exactAspectRatio,
      )
      === (
        exactAspectRatio
      )
    ))
  )

  return (
    relativeAspectRatio
    ? (
      relativeAspectRatio
      .toFixed(2)
    )
    : "OUT_OF_RANGE"
  )
}

export const getArgsForSeconds = ({
  filePath,
  isHdr,
  seconds,
}: {
  filePath: string
  isHdr: boolean
  seconds: number,
}) => ([
  "-hide_banner",

  "-loglevel",
  "info",

  // Might be wroth looking into `-vsync 0` instead.
  "-skip_frame",
  "nokey",

  "-ss",
  (
    String(
      seconds
    )
  ),

  "-i",
  filePath,

  "-threads",
  "1",

  "-map",
  "0:v:0",

  "-frames:v",
  "1",

  "-vf",
  (
    (
      isHdr
      ? "zscale=transfer=bt709,format=yuv420p,"
      : ""
    )
    .concat(
      // For ffmpeg v5
      // "cropdetect=skip=0:limit=16:round=4,metadata=mode=print:file='pipe\\:1'"

      // For ffmpeg v7+
      "cropdetect=mode=black:skip=0:limit=16:round=4:mv_threshold=0,metadata=mode=print:file='pipe\\:1'"
    )
  ),

  "-f",
  "null",
  "-",
])

export const getAspectRatioData = ({
  anamorphicCorrectionMultiplier = 1,
  duration,
  filePath,
  isHdr,
}: {
  /**
   * When anamorphic, pass this in to compute the aspect ratio relative to: `(displayAspectRatio / (videoWidth / videoHeight))`.
  */
  anamorphicCorrectionMultiplier?: number
  duration: number
  filePath: string
  isHdr: boolean
}): (
  Observable<
    AspectRatioCalculation
  >
) => (
  from(
    durationSampleCountThresholds
  )
  .pipe(
    find(({
      maximumSeconds,
    }) => (
      duration
      >= maximumSeconds
    )),
    filter(
      Boolean
    ),
    map(({
      sampleCount,
    }) => (
      sampleCount
      + 2 // We don't use the first and last frame of the video, so we add 2 more samples to compensate.
    )),
    concatMap((
      paddedSampleCount
    ) => (
      from(
        Array(paddedSampleCount)
        .fill(null)
        .map((
          _,
          index,
        ) => (
          (
            Math
            .floor(
              duration
              / paddedSampleCount
            )
          )
          * index
        ))
        .slice(1, -1)
      )
    )),
    map((
      seconds,
    ) => (
      getArgsForSeconds({
        filePath,
        isHdr,
        seconds,
      })
    )),
    runTasks((
      args,
    ) => (
      runReadlineFfmpeg({
        args,
      })
    )),
  )
  .pipe(
    filter((
      output,
    ) => (
      output
      .startsWith(
        "lavfi.cropdetect.h"
      )
      || (
        output
        .startsWith(
          "lavfi.cropdetect.w"
        )
      )
    )),
    map((
      output,
    ) => (
      output
      .match(
        ffmpegCropdetectRegex
      )
    )),
    filter(
      Boolean
    ),
    map((
      match,
    ) => (
      match
      .groups!
    )),
    map(({
      measurementType,
      measurementValue,
    }) => ({
      [measurementType]: (
        Number(
          measurementValue
        )
      ),
    })),
    bufferCount(
      2
    ),
  )
  .pipe(
    map((
      measurementInfos
    ) => (
      measurementInfos
      .reduce(
        (
          measurements: {
            h: number,
            w: number,
          },
          measurement,
        ) => ({
          ...measurements,
          ...measurement,
        }),
        {} as {
          h: number,
          w: number,
        },
      )
    )),
    map(({
      h,
      w,
    }) => ({
      height: h,
      width: w,
    })),
    reduce(
      (
        cropData,
        {
          height,
          width,
        },
      ) => {
        const identifier = `${width}x${height}`

        if (identifier in cropData) {
          const {
            count,
          } = (
            cropData
            [identifier]
          )

          return {
            ...cropData,
            [identifier]: (
              cropData
              [identifier] = {
                ...(
                  cropData
                  [identifier]
                ),
                count: (
                  count
                  + 1
                ),
              }
            )
          }
        }
        else {
          return {
            ...cropData,
            [identifier]: {
              count: 1,
              height,
              width,
            }
          }
        }
      },
      {} as (
        Record<
          string,
          {
            count: number,
            height: number,
            width: number,
          }
        >
      ),
    ),
    map((
      cropData,
    ) => {
      const cropDataValues = (
        Object
        .values(
          cropData
        )
      )

      const maxHeightCrop = {
        ...(
          cropDataValues
          .sort((
            itemA,
            itemB,
          ) => (
            itemB.height
            - itemA.height
          ))
          .at(0)!
        ),
        anamorphicCorrectionMultiplier,
      }

      const medianCrop = {
        ...(
          cropDataValues
          .sort((
            itemA,
            itemB,
          ) => (
            itemB.count
            - itemA.count
          ))
          .at(0)!
        ),
        anamorphicCorrectionMultiplier,
      }

      return {
        exactMaxHeightAspectRatio: (
          getAspectRatio(
            maxHeightCrop
          )
        ),
        exactMedianAspectRadio: (
          getAspectRatio(
            medianCrop
          )
        ),
        relativeMaxHeightAspectRatio: (
          getRelativeAspectRatio(
            getAspectRatio(
              maxHeightCrop
            )
          )
        ),
        relativeMedianAspectRadio: (
          getRelativeAspectRatio(
            getAspectRatio(
              medianCrop
            )
          )
        ),
      }
    }),
  )
)
