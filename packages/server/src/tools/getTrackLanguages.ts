import {
  concatMap,
  filter,
  map,
  reduce,
} from "rxjs"

import { convertIso6391ToIso6392 } from "./convertIso6391ToIso6392.js"
import {
  getMediaInfo,
  type AudioTrack,
  type TextTrack,
} from "./getMediaInfo.js"
import { type Iso6391LanguageCode } from "./iso6391LanguageCodes.js"

export const orderedDeduplication = <
  Value
>(
  array: Value[]
) => (
  array
  .reduce(
    (
      deduplicatedArray,
      value,
    ) => (
      deduplicatedArray
      .includes(
        value
      )
      ? deduplicatedArray
      : (
        deduplicatedArray
        .concat(
          value
        )
      )
    ),
    [] as (
      Value[]
    ),
  )
)

export type TrackTypeLanguages = (
  Record<
    (
      | AudioTrack["@type"]
      | TextTrack["@type"]
    ),
    Iso6391LanguageCode[]
  >
)

export const getTrackLanguages = (
  filePath: string,
) => (
  getMediaInfo(
    filePath
  )
  .pipe(
    filter(
      Boolean
    ),
    map(({
      media,
    }) => (
      media
    )),
    filter(
      Boolean
    ),
    concatMap(({
      track,
    }) => (
      track
    )),
    filter((
      track,
    ) => (
      (
        (
          track
          ["@type"]
        )
        === "Audio"
      )
      || (
        (
          track
          ["@type"]
        )
        === "Text"
      )
    )),
    filter((
      track,
    ) => (
      Boolean(
        track
        .Language
      )
    )),
    reduce(
      (
        trackLanguages,
        track,
      ) => ({
        ...trackLanguages,
        [
          track
          ["@type"]
        ]: [
          ...(
            trackLanguages[
              track
              ["@type"]
            ]
          ),
          ...(
            trackLanguages[
              track
              ["@type"]
            ]
            .includes(
              track
              .Language!
            )
            ? []
            : [
              track
              .Language!
            ]
          ),
        ]
      }),
      {
        Audio: [],
        Text: [],
      } satisfies (
        TrackTypeLanguages
      ) as (
        TrackTypeLanguages
      ),
    ),
    map(({
      Audio: audioLanguages,
      Text: textLanguages,
    }) => ({
      audioLanguages: (
        orderedDeduplication(
          audioLanguages
        )
        .map((
          iso6391LanguageCode,
        ) => (
          convertIso6391ToIso6392(
            iso6391LanguageCode
          )
        ))
      ),
      subtitlesLanguages: (
        orderedDeduplication(
          textLanguages
        )
        .map((
          iso6391LanguageCode,
        ) => (
          convertIso6391ToIso6392(
            iso6391LanguageCode
          )
        ))
      ),
    })),
  )
)
