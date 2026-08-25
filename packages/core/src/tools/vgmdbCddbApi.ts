import { logAndRethrowPipelineError } from "@mux-magic/tools"
import { from, map, type Observable } from "rxjs"

import type { CachedFetch } from "./musicBrainzApi.js"

// VGMdb, reached through the freedb/CDDB server emulator VGMdb runs
// itself. Announced by a VGMdb administrator in 2009 and still answering
// in 2026.
//
// ⚠️ This is the route that WORKS, and the reason matters. VGMdb's web
// pages sit behind a Cloudflare managed challenge that headless Chromium
// does not pass — measured 403 from a datacentre address AND from the
// household's own address. The community JSON mirror at vgmdb.info is
// offline. The CDDB endpoint is plain HTTP, needs **no account and no
// cookie**, and is not challenged. Verified 2026-08-25 against real
// library albums.
//
// Do not "modernise" this into an HTTPS JSON call. There is no official
// VGMdb JSON API; this emulator is the supported programmatic surface.

export const VGMDB_CDDB_BASE_URL = "http://vgmdb.net/cddb"

// The announcement lists a language segment on the path. When a title is
// not recorded in the asked-for language the server reverts to the
// default, which is why two of these can return identical text for the
// same album — measured on two albums, both of which carry only one
// language.
export const VGMDB_CDDB_LANGUAGES = [
  "default",
  "en",
  "ja",
  "ja-Latn",
] as const

export type VgmdbCddbLanguage =
  (typeof VGMDB_CDDB_LANGUAGES)[number]

// CD frames per second, fixed by the Red Book audio standard. The whole
// disc-id calculation is in frames.
export const CD_FRAMES_PER_SECOND = 75

// Every disc starts after a two-second lead-in, so track 1 sits at frame
// 150 rather than 0. Getting this wrong shifts every offset and the disc
// id never matches anything.
export const CD_LEAD_IN_FRAMES = 150

export type VgmdbCddbMatch = {
  albumTitle: string
  category: string
  discId: string
  // The numeric part of the category IS the VGMdb album id, which is what
  // makes a match linkable back to the site.
  vgmdbAlbumId: string
}

export type VgmdbCddbAlbum = {
  albumTitle: string
  artistName: string
  category: string
  discId: string
  genre: string
  trackTitles: string[]
  vgmdbAlbumId: string
  year: string
}

const sumDecimalDigits = (value: number): number =>
  value <= 0
    ? 0
    : (value % 10) +
      sumDecimalDigits(Math.floor(value / 10))

// Track 1 starts at the lead-in, and each later track starts where the
// previous one ended.
export const buildTrackOffsets = (
  trackLengthsSeconds: number[],
) =>
  trackLengthsSeconds.reduce(
    (offsets: number[], _lengthSeconds, trackIndex) =>
      offsets.concat([
        trackIndex === 0
          ? CD_LEAD_IN_FRAMES
          : (offsets[trackIndex - 1] ?? 0) +
            Math.round(
              (trackLengthsSeconds[trackIndex - 1] ?? 0) *
                CD_FRAMES_PER_SECOND,
            ),
      ]),
    [],
  )

export const getTotalDiscSeconds = (
  trackLengthsSeconds: number[],
) =>
  Math.floor(
    (CD_LEAD_IN_FRAMES +
      trackLengthsSeconds.reduce(
        (total, lengthSeconds) =>
          total +
          Math.round(lengthSeconds * CD_FRAMES_PER_SECOND),
        0,
      )) /
      CD_FRAMES_PER_SECOND,
  )

// The freedb disc id: a checksum of each track's start second, the disc's
// playing length, and the track count, packed into 32 bits and printed as
// eight hex digits.
export const buildDiscId = (
  trackLengthsSeconds: number[],
) =>
  ((offsets: number[]) =>
    (
      (((offsets.reduce(
        (checksum, offsetFrames) =>
          checksum +
          sumDecimalDigits(
            Math.floor(offsetFrames / CD_FRAMES_PER_SECOND),
          ),
        0,
      ) %
        255) <<
        24) |
        ((getTotalDiscSeconds(trackLengthsSeconds) -
          Math.floor(
            (offsets.at(0) ?? CD_LEAD_IN_FRAMES) /
              CD_FRAMES_PER_SECOND,
          )) <<
          8) |
        trackLengthsSeconds.length) >>>
      // ⚠️ `>>> 0` because the checksum occupies the TOP byte and
      // JavaScript's bitwise operators produce a SIGNED 32-bit result.
      // Without it a disc whose checksum lands above 127 prints as a
      // negative hex number and matches nothing, on exactly half of all
      // discs.
      0
    )
      .toString(16)
      .padStart(8, "0"))(
    buildTrackOffsets(trackLengthsSeconds),
  )

const buildBaseUrl = (language: VgmdbCddbLanguage) =>
  language === "default"
    ? `${VGMDB_CDDB_BASE_URL}/cddb.cgi`
    : `${VGMDB_CDDB_BASE_URL}/${language}/cddb.cgi`

// `hello` identifies the client and is required by the protocol. `proto=6`
// asks for UTF-8 rather than the protocol's original Latin-1, which is not
// optional here — VGMdb is full of Japanese titles.
const buildCommandUrl = ({
  command,
  language,
}: {
  command: string
  language: VgmdbCddbLanguage
}) =>
  `${buildBaseUrl(language)}?${new URLSearchParams({
    cmd: command,
    hello: "muxmagic octen.dev mux-magic 1.0.0",
    proto: "6",
  }).toString()}`

export const buildQueryCommand = (
  trackLengthsSeconds: number[],
) =>
  [
    "cddb query",
    buildDiscId(trackLengthsSeconds),
    String(trackLengthsSeconds.length),
    buildTrackOffsets(trackLengthsSeconds).join(" "),
    String(getTotalDiscSeconds(trackLengthsSeconds)),
  ].join(" ")

// The category carries the VGMdb album id, as `Soundtrack141255`. That is
// how a CDDB result becomes a link back to the site.
export const extractVgmdbAlbumId = (category: string) =>
  category.replace(/^\D+/u, "")

const parseMatchLine = (line: string): VgmdbCddbMatch => {
  const [category = "", discId = "", ...titleParts] = line
    .trim()
    .split(" ")
  return {
    albumTitle: titleParts.join(" "),
    category,
    discId,
    vgmdbAlbumId: extractVgmdbAlbumId(category),
  }
}

// Three answers matter. `200` is one exact match on the same line as the
// status. `211` (and `210`) open a list that runs until a lone `.`. `202`
// means no match, which is a normal outcome for an album VGMdb has never
// seen, not a failure.
export const parseQueryResponse = (
  body: string,
): VgmdbCddbMatch[] =>
  ((lines: string[]) =>
    ((statusCode: string) =>
      statusCode === "200"
        ? [
            parseMatchLine(
              (lines.at(0) ?? "").slice("200 ".length),
            ),
          ]
        : statusCode === "211" || statusCode === "210"
          ? lines
              .slice(1)
              .filter(
                (line) =>
                  line.trim().length > 0 &&
                  line.trim() !== ".",
              )
              .map(parseMatchLine)
          : [])((lines.at(0) ?? "").slice(0, 3)))(
    body.split(/\r?\n/u),
  )

// An xmcd record is `KEY=value` lines, and a value longer than the line
// limit is CONTINUED by repeating the same key. Joining rather than
// overwriting is why a long title survives.
export const parseXmcd = (body: string) =>
  body
    .split(/\r?\n/u)
    .filter((line) => !line.startsWith("#"))
    .reduce((fields: Map<string, string>, line) => {
      const separatorIndex = line.indexOf("=")
      return separatorIndex <= 0
        ? fields
        : fields.set(
            line.slice(0, separatorIndex),
            (fields.get(line.slice(0, separatorIndex)) ??
              "") + line.slice(separatorIndex + 1),
          )
    }, new Map<string, string>())

// `DTITLE` is `artist / album`. VGMdb frequently leaves the artist empty
// and answers ` / [CATALOG] Album`, so splitting on the FIRST separator
// and tolerating an empty left side is required — an album title
// containing a slash must not be truncated.
export const splitDiscTitle = (discTitle: string) =>
  ((separatorIndex: number) =>
    separatorIndex < 0
      ? { albumTitle: discTitle.trim(), artistName: "" }
      : {
          albumTitle: discTitle
            .slice(separatorIndex + 3)
            .trim(),
          artistName: discTitle
            .slice(0, separatorIndex)
            .trim(),
        })(discTitle.indexOf(" / "))

export const parseReadResponse = ({
  body,
  category,
  discId,
}: {
  body: string
  category: string
  discId: string
}): VgmdbCddbAlbum =>
  ((fields: Map<string, string>) =>
    ((titleParts: {
      albumTitle: string
      artistName: string
    }) => ({
      albumTitle: titleParts.albumTitle,
      artistName: titleParts.artistName,
      category,
      discId,
      genre: fields.get("DGENRE") ?? "",
      trackTitles: Array.from(fields.entries())
        .filter(([key]) => /^TTITLE\d+$/u.test(key))
        .toSorted(
          ([firstKey], [secondKey]) =>
            Number(firstKey.slice("TTITLE".length)) -
            Number(secondKey.slice("TTITLE".length)),
        )
        .map(([, value]) => value),
      vgmdbAlbumId: extractVgmdbAlbumId(category),
      year: fields.get("DYEAR") ?? "",
    }))(splitDiscTitle(fields.get("DTITLE") ?? "")))(
    parseXmcd(body),
  )

export const queryVgmdbCddb = ({
  cachedFetch,
  language = "default",
  trackLengthsSeconds,
}: {
  cachedFetch: CachedFetch
  language?: VgmdbCddbLanguage
  trackLengthsSeconds: number[]
}): Observable<VgmdbCddbMatch[]> =>
  from(
    cachedFetch(
      buildCommandUrl({
        command: buildQueryCommand(trackLengthsSeconds),
        language,
      }),
    ),
  ).pipe(
    map(({ body }) => parseQueryResponse(body)),
    logAndRethrowPipelineError(queryVgmdbCddb),
  )

export const readVgmdbCddbAlbum = ({
  cachedFetch,
  category,
  discId,
  language = "default",
}: {
  cachedFetch: CachedFetch
  category: string
  discId: string
  language?: VgmdbCddbLanguage
}): Observable<VgmdbCddbAlbum> =>
  from(
    cachedFetch(
      buildCommandUrl({
        command: `cddb read ${category} ${discId}`,
        language,
      }),
    ),
  ).pipe(
    map(({ body }) =>
      parseReadResponse({ body, category, discId }),
    ),
    logAndRethrowPipelineError(readVgmdbCddbAlbum),
  )
