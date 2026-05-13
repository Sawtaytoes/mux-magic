import { logAndSwallowPipelineError } from "@mux-magic/tools"
import {
  filter,
  from,
  map,
  type Observable,
  reduce,
} from "rxjs"
import { getTimecodeAtOffset } from "./getSpecialFeatureFromTimecode.js"

export const specialFeatureTypes = [
  "behindthescenes",
  "deleted",
  "featurette",
  "interview",
  "other",
  "scene",
  "short",
  "trailer",
] as const

export type SpecialFeatureType =
  | (typeof specialFeatureTypes)[number]
  | "unknown"

export type SpecialFeature = {
  children?: SpecialFeature[]
  parentType: SpecialFeatureType
  timecode?: string
  text: string
  type: SpecialFeatureType
}

export const specialFeatureMatchKeys = [
  "behind the scenes",
  "clip",
  "deleted scene",
  "documentary",
  "essay",
  "featurette",
  "interview",
  "montage",
  "music video",
  "outtakes",
  "promotional",
  "q&a",
  "scene",
  "short",
  "sing",
  "song",
  "story",
  "trailer",
  "teaser",
] as const

export type SpecialFeatureMatchKey =
  (typeof specialFeatureMatchKeys)[number]

export const specialFeatureMatchTypes: Record<
  SpecialFeatureMatchKey,
  SpecialFeatureType
> = {
  "behind the scenes": "behindthescenes",
  clip: "featurette",
  "deleted scene": "deleted",
  documentary: "featurette",
  essay: "featurette",
  featurette: "featurette",
  interview: "interview",
  montage: "featurette",
  "music video": "short",
  outtakes: "deleted",
  promotional: "trailer",
  "q&a": "interview",
  scene: "scene",
  short: "short",
  sing: "short",
  song: "short",
  story: "short",
  teaser: "trailer",
  trailer: "trailer",
}

const timecodeRegex =
  /\s*\([^)]*?\s*(\d+:\d{2}:\d{2}|\d+:\d{2})\s*[^)]*?\)/

// DVDCompare's Extras section flags main-feature entries with a leading
// asterisk + "The Film". The whitespace after the asterisk is sometimes
// present, sometimes not — both `* The Film …` and `*The Film …` show up
// in the wild. Anchored, case-insensitive, requires a word boundary on
// "Film" so things like "*The Filmography" don't false-match.
const cutLineRegex = /^\*\s*The Film\b/iu

// A "cut" is a main-feature entry from the Extras list. `name` is the
// edition/version label that comes after "The Film" — e.g. "Hong Kong
// Version", "Director's Cut" — or empty when the release labels its
// only main-feature entry just "*The Film" (with no further text).
// `timecode` is the parenthetical runtime when DVDCompare publishes one
// for this cut.
export type Cut = {
  name: string
  timecode?: string
}

const formatOnlyParenRegex =
  /^\((?:\d+p|3D|2D|HDR\d*|UHD|IMAX)[^)]*\)$/iu

const parseCutLine = (rawLine: string): Cut => {
  // Strip the "*<optional space>The Film" prefix plus any separator
  // (em-dash, en-dash, hyphen, colon).
  let remainder = rawLine
    .trim()
    .replace(/^\*\s*The Film\b\s*[-–—:]?\s*/iu, "")
  let timecode: string | undefined
  const timecodeMatch = remainder.match(timecodeRegex)
  if (timecodeMatch?.[1]) {
    timecode = getTimecodeAtOffset(timecodeMatch[1], 0)
    remainder = remainder.replace(timecodeRegex, "").trim()
  }
  // Drop residue parens that only carry format/resolution info — e.g.
  // "(2160p)" on a release where the only "*The Film" entry differs by
  // resolution, not by edition. Those don't contribute to a Plex edition.
  if (formatOnlyParenRegex.test(remainder)) {
    remainder = ""
  }
  return { name: remainder.trim(), timecode }
}

export const parseCuts = (
  specialFeatureText: string,
): Cut[] =>
  specialFeatureText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => cutLineRegex.test(line))
    .map(parseCutLine)

const discHeaderRegex =
  /^DISC (ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT)/

// One entry in the trailing summary record's `possibleNames` list. The
// `timecode` slot is populated when DVDCompare published a runtime for
// the candidate but the main matcher rejected it (out of tolerance) —
// reserved for the client-side smart-suggestion modal so it can rank
// suggestions by duration proximity. For purely untimed sources the
// field is undefined and the client falls back to filename fuzz alone.
export type PossibleName = {
  name: string
  timecode?: string
}

// Lines from the raw DVDCompare extras text that have no timecode — the
// natural set of "couldn't possibly match by timecode" entries. Surfaces
// image galleries (which the main extras pipeline drops via the
// `images)` / `pages)` filter), photo galleries, and `*The Film` cut
// labels DVDCompare published without runtimes. The user's leftover
// files almost always correspond to one of these, so the rename pipeline
// emits this list in its trailing summary record so the user has the
// candidate labels right in front of them. Each entry carries an
// optional `timecode` slot (always undefined for the untimed pool, but
// the shape lets callers attach a timecode when the source did publish
// one and the main matcher rejected it as out of tolerance).
export const parseUntimedSuggestions = (
  specialFeatureText: string,
): PossibleName[] =>
  specialFeatureText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !discHeaderRegex.test(line))
    .filter((line) => !timecodeRegex.test(line))
    .map((line) =>
      cutLineRegex.test(line)
        ? line
        : line
            .replace(/^[-–—]+\s*/u, "")
            .replace(/:$/, "")
            .trim(),
    )
    .filter(Boolean)
    .map((name) => ({ name, timecode: undefined }))

export const parseSpecialFeatures = (
  specialFeatureText: string,
): Observable<{
  extras: SpecialFeature[]
  cuts: Cut[]
  possibleNames: PossibleName[]
}> =>
  from(specialFeatureText.split("\n"))
    .pipe(
      map((lineItem) => lineItem.trim()),
      filter(Boolean),
      filter(
        (lineItem) =>
          // Drops main-feature entries from the extras stream — they're
          // collected separately by parseCuts and feed the movie-naming
          // branch, not the extras-naming branch. Regex tolerates the
          // missing-space `*The Film` form that DVDCompare also emits.
          !cutLineRegex.test(lineItem),
      ),
      filter(
        (lineItem) =>
          !lineItem.includes("pages)") &&
          !lineItem.includes("images)"),
      ),
      filter(
        (lineItem) =>
          !lineItem.match(
            /^DISC (ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT)/,
          ),
      ),
    )
    .pipe(
      map((lineItem) => ({
        text: lineItem
          .trim()
          .replace(/:$/, "")
          .replace(/ \([^)]*Play All[^)]*\)/, ""),
      })),
      map(({ text, ...otherProps }) => {
        const matches = text.match(timecodeRegex)

        if (matches) {
          const timecode = matches.at(1)

          if (timecode) {
            return {
              ...otherProps,
              text: text.replace(timecodeRegex, ""),
              timecode: getTimecodeAtOffset(timecode, 0),
            }
          }
        }

        return {
          ...otherProps,
          timecode: undefined,
          text,
        }
      }),
      map(({ text, ...otherProps }) => {
        const matches = text.match(/^([*\-–]+ ?)/)

        const modifiedText = matches
          ? text.replace(matches.at(1) || "", "")
          : text

        return {
          ...otherProps,
          isChild: Boolean(matches),
          text: modifiedText,
        }
      }),
      map(({ text, ...otherProps }) => ({
        ...otherProps,
        text: text
          .replaceAll(/"/g, "")
          .replaceAll(/“/g, "")
          .replaceAll(/”/g, "")
          .replaceAll(/: /g, " - ")
          .replaceAll(/:/g, "-")
          .replaceAll(/^- /g, "")
          .replaceAll(/ \/ /g, " - ")
          .replaceAll(/\//g, " - ")
          .replaceAll(/\? /g, " - ")
          .replaceAll(/\?$/g, ""),
      })),
    )
    .pipe(
      map(({ text, ...otherProps }) => {
        const matches = text.match(
          new RegExp(
            specialFeatureMatchKeys.join("|"),
            "i",
          ),
        )

        if (matches) {
          const specialFeatureMatchKey = matches.at(0)

          if (specialFeatureMatchKey) {
            return {
              ...otherProps,
              text,
              type: specialFeatureMatchTypes[
                specialFeatureMatchKey.toLowerCase() as SpecialFeatureMatchKey
              ],
            }
          }
        }

        return {
          ...otherProps,
          text,
          type: "unknown" as SpecialFeatureType,
        }
      }),
      reduce((combined, { isChild, ...otherProps }) => {
        if (isChild) {
          const parent = combined.slice(-1).at(0)

          if (parent) {
            return combined.slice(0, -1).concat({
              ...parent,
              children: parent.children
                ? parent.children.concat({
                    ...otherProps,
                    parentType: parent.type,
                  })
                : [
                    {
                      ...otherProps,
                      parentType: parent.type,
                    },
                  ],
            })
          }
        }

        return combined.concat({
          ...otherProps,
          parentType: "unknown",
        })
      }, [] as SpecialFeature[]),
      // Cuts come from the same source text but use a separate (sync)
      // parser. Pair them with the reduced extras so callers see one
      // structured payload regardless of which side they consume.
      // possibleNames are untimed suggestions surfaced for the user when a
      // file ends up unrenamed — they're cheap to compute and travel with
      // the rest of the parser output for callers that want them.
      map((extras) => ({
        extras,
        cuts: parseCuts(specialFeatureText),
        possibleNames: parseUntimedSuggestions(
          specialFeatureText,
        ),
      })),
      logAndSwallowPipelineError(parseSpecialFeatures),
    )
