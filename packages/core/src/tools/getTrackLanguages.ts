import type { LanguageSelection } from "@mux-magic/api/src/api/languageSelection.js"
import { concatMap, filter, map, reduce } from "rxjs"
import { deriveIso6392FromBcp47Tag } from "./bcp47Variants.js"
import { convertIso6391ToIso6392 } from "./convertIso6391ToIso6392.js"
import {
  type AudioTrack,
  getMediaInfo,
  type TextTrack,
} from "./getMediaInfo.js"
import type { Iso6391LanguageCode } from "./iso6391LanguageCodes.js"
import type { Iso6392LanguageCode } from "./iso6392LanguageCodes.js"

export const orderedDeduplication = <Value>(
  array: Value[],
) =>
  array.reduce(
    (deduplicatedArray, value) =>
      deduplicatedArray.includes(value)
        ? deduplicatedArray
        : deduplicatedArray.concat(value),
    [] as Value[],
  )

type TrackTypeSelections = Record<
  AudioTrack["@type"] | TextTrack["@type"],
  LanguageSelection[]
>

const parseLanguageField = (
  languageField: string,
): LanguageSelection => {
  if (languageField.includes("-")) {
    const derivedCode =
      deriveIso6392FromBcp47Tag(languageField)
    if (derivedCode) {
      return {
        code: derivedCode,
        ietf: languageField as LanguageSelection["ietf"],
      }
    }
  }

  if (languageField.length === 2) {
    const iso6392Code = convertIso6391ToIso6392(
      languageField as Iso6391LanguageCode,
    )
    return { code: iso6392Code }
  }

  return {
    code: languageField as Iso6392LanguageCode,
  }
}

export const getTrackLanguages = (filePath: string) =>
  getMediaInfo(filePath).pipe(
    filter(Boolean),
    map(({ media }) => media),
    filter(Boolean),
    concatMap(({ track }) => track),
    filter(
      (track) =>
        track["@type"] === "Audio" ||
        track["@type"] === "Text",
    ),
    filter((track) => Boolean(track.Language)),
    reduce(
      (trackSelections, track) => {
        const trackType = track["@type"]
        const existingSelections =
          trackSelections[trackType]

        if (track.Language === undefined) {
          return trackSelections
        }

        const newSelection = parseLanguageField(
          track.Language,
        )

        const isAlreadyPresent = existingSelections.some(
          (existing) =>
            existing.code === newSelection.code &&
            existing.ietf === newSelection.ietf,
        )

        return {
          ...trackSelections,
          [trackType]: isAlreadyPresent
            ? existingSelections
            : existingSelections.concat(newSelection),
        }
      },
      {
        Audio: [],
        Text: [],
      } satisfies TrackTypeSelections as TrackTypeSelections,
    ),
    map(
      ({
        Audio: audioSelections,
        Text: textSelections,
      }) => ({
        audioLanguages: audioSelections.map(
          (selection) => selection.code,
        ),
        subtitlesLanguages: textSelections.map(
          (selection) => selection.code,
        ),
        audioLanguageSelections: audioSelections,
        subtitlesLanguageSelections: textSelections,
      }),
    ),
  )
