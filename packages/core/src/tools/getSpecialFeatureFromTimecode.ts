import { basename } from "node:path"
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
  type SpecialFeatureType,
  specialFeatureTypes,
} from "./parseSpecialFeatures.js"

export const specialFeatureMatchRenames = [
  {
    // Image/photo galleries from DVDCompare surface as "Title (N images)"
    // or "Title (N pages)". These are always -other regardless of any
    // keyword in the title — a gallery named "Behind-the-Scenes (21 images)"
    // is a photo gallery, not a behind-the-scenes video. This rule is placed
    // first so it wins over all keyword rules below.
    searchTerm: /(.*\(\d+\s+(?:images|pages)\).*)/i,
    replacement: "$1 -other",
  },
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
    searchTerm: /(.*alternate scenes?.*)/i,
    replacement: "$1 -deleted",
  },
  {
    searchTerm: /(.*extended version?.*)/i,
    replacement: "$1 -deleted",
  },
  {
    searchTerm: /(.*extended scenes?.*)/i,
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
    // Tolerate hyphen / underscore separators so "behind-the-scenes" (the
    // form DVDCompare and many EPK release titles use) classifies as
    // -behindthescenes instead of leaking through to the trailing
    // ` scene$` rule and producing a misleading -scene suffix.
    searchTerm: /(.*behind[-_\s]the[-_\s]scenes.*)/i,
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

// DVDCompare lists child entries to grammatically extend their parent
// header — e.g. "Interviews with cast and crew including:" followed by
// "- actor Kurt Russell". Pulled out of context the fragment reads as a
// lowercase sentence fragment ("actor Kurt Russell"), which Plex then
// displays unchanged in its Extras shelf. When the effective category
// is `interview`, prepending "Interview with " produces natural English;
// for other categories we just capitalize the leading letter so the
// shelf label doesn't start lowercase.
export const humanizeExtraName = ({
  text,
  type,
  parentType,
}: {
  text: string
  type?: SpecialFeatureType
  parentType?: SpecialFeatureType
}): string => {
  const firstChar = text.charAt(0)
  const isLowercaseStart =
    firstChar >= "a" && firstChar <= "z"
  if (!isLowercaseStart) {
    return text
  }
  const effectiveType =
    type && type !== "unknown" ? type : parentType
  if (effectiveType === "interview") {
    return `Interview with ${text}`
  }
  return firstChar.toUpperCase() + text.slice(1)
}

// Mirrors `getSpecialFeatureFromTimecode`'s suffix decision tree as a
// pure transform so the Smart Match candidate builder can apply the
// SAME `-trailer` / `-featurette` / `-behindthescenes` suffix the main
// NSF flow appends after a successful match.
//
// Decision order matches the rxjs pipeline above:
//   1. Humanize lowercase-fragment names (DVDCompare child entries that
//      grammatically extend a parent header).
//   2. Text-regex table (`specialFeatureMatchRenames`) — catches names
//      that carry their category in their words ("Theatrical Trailer",
//      "Making of …", etc.).
//   3. Parsed `type` from DVDCompare's section heading.
//   4. Parsed `parentType` when the entry itself was untyped but its
//      section heading had a type.
//   5. Fallthrough: return the text unmodified. The pipeline's
//      "prompt the user for a category" branch has no equivalent here
//      because Smart Match already exposes ✏ free-text editing — the
//      user can hand-tag categories that DVDCompare didn't classify.
export const applySpecialFeatureSuffix = ({
  text,
  type,
  parentType,
}: {
  text: string
  type?: SpecialFeatureType
  parentType?: SpecialFeatureType
}): string => {
  const humanized = humanizeExtraName({
    text,
    type,
    parentType,
  })
  const matchRename = specialFeatureMatchRenames.find(
    ({ searchTerm }) => humanized.match(searchTerm),
  )
  if (matchRename) {
    return humanized.replace(
      matchRename.searchTerm,
      matchRename.replacement,
    )
  }
  if (type && type !== "unknown") {
    return `${humanized} -${type}`
  }
  if (parentType && parentType !== "unknown") {
    return `${humanized} -${parentType}`
  }
  return humanized
}

export const getTimecodeAtOffset = (
  timecode: string,
  offset: number,
) => {
  const reversedParts = timecode
    .split(":")
    .reverse()
    .map((timeString) => Number(timeString))
  const seconds = reversedParts[0] ?? 0
  const minutes = reversedParts[1] ?? 0
  const hours = reversedParts[2] ?? 0
  // Folding `offset` into the Date constructor lets the standard
  // overflow/underflow rules normalize a negative or >60 offset back into
  // h:mm:ss form — matching the original `setSeconds(getSeconds() + offset)`
  // chain without mutation.
  const date = new Date(
    0,
    0,
    0,
    hours,
    minutes,
    seconds + offset,
  )

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
      const rawMatchingExtras = specialFeatures
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
            .filter(
              (child): child is NonNullable<typeof child> =>
                Boolean(child),
            )
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
      // Dedupe by (text, timecode). DVDCompare parsing can surface the
      // same line twice — once as a top-level extra and once as a child
      // of an untimed parent (or two children with identical text/time).
      // Without this pass the disambiguation prompt would show two rows
      // with the exact same label, forcing the user to "pick" between
      // indistinguishable options.
      const matchingExtras = rawMatchingExtras.filter(
        (extra, index, all) =>
          all.findIndex(
            (other) =>
              other.text === extra.text &&
              other.timecode === extra.timecode,
          ) === index,
      )

      if (matchingExtras.length > 1) {
        return getUserSearchInput({
          message: `${filename}\n${mediaTimecode}`,
          filePath,
          options: [
            ...matchingExtras.map(
              (matchingExtra, index) => ({
                index,
                // When the DVDCompare entry sits under a section heading
                // (e.g. "3 Side-By-Side Comparisons › Airplane Models"),
                // prefix the parent's text so the user can tell otherwise
                // identical-looking child options apart.
                label: matchingExtra.parentText
                  ? `${matchingExtra.parentText} › ${matchingExtra.text}`
                  : matchingExtra.text,
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
    mergeMap(({ parentType, parentText, text, type }) => {
      const humanized = humanizeExtraName({
        text,
        type,
        parentType,
      })
      const specialFeatureMatchRename =
        specialFeatureMatchRenames.find(({ searchTerm }) =>
          humanized.match(searchTerm),
        )

      if (specialFeatureMatchRename) {
        const { searchTerm, replacement } =
          specialFeatureMatchRename

        return of(
          humanized.replace(searchTerm, replacement),
        )
      }

      // Note: the deeper unknown/unknown branch keeps its own interactive
      // prompt path because users in the main NSF flow expect to be
      // asked. `applySpecialFeatureSuffix` is the non-interactive twin
      // used by the Smart Match candidate builder.
      if (type === "unknown") {
        if (parentType === "unknown") {
          // `subtitle` carries both the on-disk filename and the file's
          // media timecode so the user can see how long the clip runs
          // before picking a Plex category — short clips often belong
          // to a different bucket (e.g. -trailer vs -featurette) than
          // long-form ones with the same headline text.
          const baseFilename = filePath
            ? basename(filePath)
            : filename
          return getUserSearchInput({
            message: text,
            subtitle: `${baseFilename} · ${mediaTimecode}`,
            context: parentText,
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
              (selectedType) =>
                `${humanizeExtraName({ text, type: selectedType, parentType })} -${selectedType}`,
            ),
          )
        }

        return of(`${humanized} -${parentType}`)
      }

      return of(`${humanized} -${type}`)
    }),
    logAndSwallowPipelineError(
      getSpecialFeatureFromTimecode,
    ),
  )
