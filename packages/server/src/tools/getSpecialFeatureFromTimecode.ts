import { logAndSwallowPipelineError } from "@mux-magic/tools"
import {
  EMPTY,
  filter,
  map,
  mergeMap,
  type Observable,
  of,
} from "rxjs"
import { convertNumberToTimeString } from "./getFileDuration.js"
import { getUserSearchInput } from "./getUserSearchInput.js"
import {
  type SpecialFeature,
  specialFeatureTypes,
} from "./parseSpecialFeatures.js"

export const specialFeatureMatchRenames = [
  {
    searchTerm: /(.*deleted.*)/i,
    replacement: "$1 -deleted",
  },
  {
    searchTerm: /(.*outtakes.*)/i,
    replacement: "$1 -deleted",
  },
  {
    searchTerm: /(.*alternate version?.*)/i,
    replacement: "$1 -deleted",
  },
  {
    searchTerm: /(.*extended version?.*)/i,
    replacement: "$1 -deleted",
  },
  {
    searchTerm: /(.*trailers?.*)/i,
    replacement: "$1 -trailer",
  },
  {
    searchTerm: /(featurettes?)$/i,
    replacement: "-featurette",
  },
  {
    searchTerm: /(.*featurettes?.*)/i,
    replacement: "$1 -featurette",
  },
  {
    searchTerm: /(.*documentary.*)/i,
    replacement: "$1 -featurette",
  },
  {
    searchTerm: /(.*behind the scenes.*)/i,
    replacement: "$1 -behindthescenes",
  },
  {
    searchTerm: /(.*blooper.*)/i,
    replacement: "$1 -behindthescenes",
  },
  {
    searchTerm: /(.*making of.*)/i,
    replacement: "$1 -behindthescenes",
  },
  {
    searchTerm: /(.*audition.*)/i,
    replacement: "$1 -behindthescenes",
  },
  {
    searchTerm: /(.*conversation.*)/i,
    replacement: "$1 -interview",
  },
  {
    searchTerm: /(.*interview.*)/i,
    replacement: "$1 -interview",
  },
  {
    searchTerm: /(.*q&a.*)$/i,
    replacement: "$1 -interview",
  },
  {
    searchTerm: /(.*promotional?.*)/i,
    replacement: "$1 -trailer",
  },
  {
    searchTerm: /(.*essay.*)/i,
    replacement: "$1 -featurette",
  },
  {
    searchTerm: /(.*shorts?.*)/i,
    replacement: "$1 -short",
  },
  {
    searchTerm: /(.*excerpts.*)$/i,
    replacement: "$1 -short",
  },
  {
    searchTerm: /(.*story.*)/i,
    replacement: "$1 -short",
  },
  {
    searchTerm: /(.*song.*)/i,
    replacement: "$1 -short",
  },
  {
    searchTerm: /(.*sing.*)/i,
    replacement: "$1 -short",
  },
  {
    searchTerm: /(.*prologue.*)/i,
    replacement: "$1 -short",
  },
  {
    searchTerm: /(.*) scene$/i,
    replacement: "$1 -scene",
  },
  {
    searchTerm: /(.*spot.*)/i,
    replacement: "$1 -trailer",
  },
  {
    searchTerm: /(.*promo.*)/i,
    replacement: "$1 -trailer",
  },
  {
    searchTerm: /(.*montage.*)/i,
    replacement: "$1 -featurette",
  },
  {
    searchTerm: /(.*clips?.*)$/i,
    replacement: "$1 -behindthescenes",
  },
  {
    searchTerm: /(.*stills?.*)$/i,
    replacement: "$1 -other",
  },
  {
    searchTerm: /(.*image gallery?.*)$/i,
    replacement: "$1 -other",
  },
  {
    searchTerm: /(.*art gallery?.*)$/i,
    replacement: "$1 -other",
  },
] as const

export const getTimecodeAtOffset = (
  timecode: string,
  offset: number,
) => {
  const date = new Date(0, 0, 0, 0, 0, 0)

  timecode
    .split(":")
    .reverse()
    .map((timeString) => Number(timeString))
    .forEach((timeValue, index) => {
      if (index === 0) {
        date.setSeconds(timeValue)
      } else if (index === 1) {
        date.setMinutes(timeValue)
      } else if (index === 2) {
        date.setHours(timeValue)
      }
    })

  date.setSeconds(date.getSeconds() + offset)

  return [
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
  ]
    .filter((value, index) =>
      index === 0 ? Boolean(value) : true,
    )
    .map((value, index) =>
      index > 0 ? convertNumberToTimeString(value) : value,
    )
    .join(":")
}

export const getOffsetsFromCenterPoint = ({
  offset: fixedOffset,
  paddingAmount,
}: {
  /** All numbers will be pushed positively or negatively by this amount. */
  offset: number
  /** Number of items that will be both positively and negatively padded. */
  paddingAmount: number
}) =>
  Array(paddingAmount * 2 + 1)
    .fill(null)
    .map((_, index) => index - paddingAmount + fixedOffset)

export type TimecodeDeviation = {
  /**
   * Timecodes are pushed positively or negatively by this amount.
   *
   * Passing `2` changes `1:20` to `1:22`.
   * */
  fixedOffset?: number
  /** A range an amount that timecodes may be off. Typically, it's safe to have this be `1` second, but it can be `2+` depending on someone's wrong metadata. */
  timecodePaddingAmount?: number
}

export const getIsSimilarTimecode = (
  timecodeA: string,
  timecodeB: string,
  {
    fixedOffset = 0,
    timecodePaddingAmount = 0,
  }: TimecodeDeviation = {},
) =>
  getOffsetsFromCenterPoint({
    offset: fixedOffset,
    paddingAmount: timecodePaddingAmount,
  }).some(
    (offset) =>
      getTimecodeAtOffset(timecodeA, offset) === timecodeB,
  )

export const getSpecialFeatureFromTimecode = ({
  filename,
  filePath,
  fixedOffset,
  specialFeatures,
  timecode: mediaTimecode,
  timecodePaddingAmount,
}: {
  filename: string
  // Absolute path for the file being prompted about. Forwarded to
  // getUserSearchInput so the Builder's prompt modal can render a
  // ▶ Play button. Optional so CLI / non-Builder callers don't have
  // to thread it through if they don't need it.
  filePath?: string
  specialFeatures: SpecialFeature[]
  timecode: string
} & TimecodeDeviation): Observable<string> =>
  of(null).pipe(
    mergeMap(() => {
      const matchingExtras = specialFeatures
        .filter(
          ({ timecode: specialFeatureTimecode }) =>
            specialFeatureTimecode &&
            getIsSimilarTimecode(
              mediaTimecode,
              specialFeatureTimecode,
              {
                fixedOffset,
                timecodePaddingAmount,
              },
            ),
        )
        .concat(
          specialFeatures
            .filter(
              ({ timecode: specialFeatureTimecode }) =>
                !specialFeatureTimecode,
            )
            .flatMap(({ children }) => children)
            .filter(Boolean)
            .filter(
              ({ timecode: SpecialFeatureChildTimecode }) =>
                SpecialFeatureChildTimecode &&
                getIsSimilarTimecode(
                  mediaTimecode,
                  SpecialFeatureChildTimecode,
                  {
                    fixedOffset,
                    timecodePaddingAmount,
                  },
                ),
            ),
        )

      if (matchingExtras.length > 1) {
        return getUserSearchInput({
          message: `${filename}\n${mediaTimecode}`,
          filePath,
          options: [
            ...matchingExtras.map(
              (matchingExtra, index) => ({
                index,
                label: matchingExtra.text,
              }),
            ),
            {
              index: -1,
              label: "Don't rename / skip",
            },
          ],
        }).pipe(
          map((selectedIndex) => {
            if (selectedIndex === -1) return undefined

            return matchingExtras.at(selectedIndex)
          }),
          filter(Boolean),
        )
      }

      if (matchingExtras.length === 1) {
        return of(matchingExtras.at(0)).pipe(
          filter(Boolean),
        )
      }

      return EMPTY
    }),
    mergeMap(({ parentType, text, type }) => {
      const specialFeatureMatchRename =
        specialFeatureMatchRenames.find(({ searchTerm }) =>
          text.match(searchTerm),
        )

      if (specialFeatureMatchRename) {
        const { searchTerm, replacement } =
          specialFeatureMatchRename

        return of(text.replace(searchTerm, replacement))
      }

      if (type === "unknown") {
        if (parentType === "unknown") {
          return getUserSearchInput({
            message: `${filename}\n${text}`,
            filePath,
            options: [
              ...specialFeatureTypes.map(
                (specialFeatureType, index) => ({
                  index,
                  label: specialFeatureType,
                }),
              ),
              {
                index: -1,
                label: "Don't rename / skip",
              },
            ],
          }).pipe(
            map((selectedIndex) => {
              if (selectedIndex === -1) return undefined

              return specialFeatureTypes.at(selectedIndex)
            }),
            filter(Boolean),
            map(
              (selectedType) => `${text} -${selectedType}`,
            ),
          )
        }

        return of(`${text} -${parentType}`)
      }

      return of(`${text} -${type}`)
    }),
    logAndSwallowPipelineError(
      getSpecialFeatureFromTimecode,
    ),
  )
