import { logAndRethrowPipelineError } from "@mux-magic/tools"
import { from, type Observable } from "rxjs"

import type { CachedFetch } from "./musicBrainzApi.js"

export const ITUNES_SEARCH_BASE_URL =
  "https://itunes.apple.com/search"

export const ITUNES_LOOKUP_BASE_URL =
  "https://itunes.apple.com/lookup"

// A release the tags date to one year and Apple dates to the next is the
// same release either side of a territory launch. Twenty-three years apart
// is a different album.
export const ITUNES_MAXIMUM_YEAR_DIFFERENCE = 1

// Apple publishes no rate limit for the search endpoint and throttles at
// roughly 20 calls a minute. This is the politeness number, not a published
// one, and it is what keeps a library-wide pass from reading as a flood.
export const ITUNES_MINIMUM_REQUEST_INTERVAL_MILLISECONDS = 3_000

// `artworkUrl100` is a 100 x 100 thumbnail. Apple serves every size from the
// same path, so swapping the segment is how the full-resolution image is
// requested — the same "original, not a thumbnail" rule the Cover Art
// Archive gets through `caa_image_size = -1`.
export const ITUNES_ARTWORK_SIZE = "1200x1200bb"

export type ItunesArtworkImage = {
  albumTitle: string
  artistName: string
  imageUrl: string
}

export type ItunesRawResult = {
  artistName?: string
  artworkUrl100?: string
  collectionId?: number
  collectionName?: string
  releaseDate?: string
  trackName?: string
  wrapperType?: string
}

export type ItunesRawResponse = {
  results?: ItunesRawResult[]
}

// A search provider can put the WRONG cover on an album, which is worse than
// leaving it blank, so the match is deliberately strict: the album title and
// the artist must both be equal once punctuation, case and spacing are
// removed. A close-enough title is not accepted.
//
// That was still not enough. A 2001 compilation called *Pulse* credited to
// "Various Artists" matched a 2024 album called *Pulse* credited to "Various
// Artists", and the wrong cover went onto the record. Title and artist name
// a release only when the release has a distinctive name; "Various Artists"
// plus one common word names nothing. So a candidate that clears the name
// test then has to clear `getIsCandidateConfirmed` below.
export const normaliseForComparison = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/gu, "")
    .replace(/[^a-z0-9]+/gu, "")

const getIsMatch = ({
  albumTitle,
  artistName,
  result,
}: {
  albumTitle: string
  artistName: string
  result: ItunesRawResult
}) =>
  normaliseForComparison(result.collectionName ?? "") ===
    normaliseForComparison(albumTitle) &&
  normaliseForComparison(result.artistName ?? "") ===
    normaliseForComparison(artistName)

export const upgradeArtworkUrl = (artworkUrl: string) =>
  artworkUrl.replace(
    /\/\d+x\d+bb\.(jpg|png)$/u,
    `/${ITUNES_ARTWORK_SIZE}.$1`,
  )

// Apple appends the mix or the edit to a track title and the file does not,
// so "Fame (radio edit)" and "Fame (Theme)" are the same track under two
// names. Dropping a trailing bracketed qualifier makes the two comparable
// without loosening the comparison into a substring test.
export const getComparableTrackTitles = (title: string) =>
  new Set(
    [title, title.replace(/\s*[([][^)\]]*[)\]]\s*$/u, "")]
      .map(normaliseForComparison)
      .filter((value) => value.length > 0),
  )

export const getSharedTrackTitleCount = ({
  candidateTrackTitles,
  localTrackTitles,
}: {
  candidateTrackTitles: string[]
  localTrackTitles: string[]
}) =>
  ((candidateTitles: Set<string>) =>
    localTrackTitles.filter((localTitle) =>
      getComparableTrackTitles(localTitle)
        .values()
        .some((comparable) =>
          candidateTitles.has(comparable),
        ),
    ).length)(
    new Set(
      candidateTrackTitles.flatMap((candidateTitle) => [
        ...getComparableTrackTitles(candidateTitle),
      ]),
    ),
  )

export const getReleaseYear = (date?: string) =>
  ((match: RegExpMatchArray | null) =>
    match === null ? null : Number(match[1]))(
    (date ?? "").match(/(\d{4})/u),
  )

// Two ways to confirm a candidate, and the ORDER matters. A shared track
// title is direct evidence and it is checked first, because a released-in
// year is often the year the file was ripped rather than the year the album
// came out — three albums in this library carry a rip year two decades after
// the release and are correctly matched.
//
// The year is the fallback for the case a title comparison cannot settle: a
// folder holding one track whose title is written in a different script from
// Apple's romanisation. `ゆっくり` and "Yukkuri" share nothing to compare, and
// the release date settles it instead.
//
// Measured against the 17 albums this library matched through iTunes: all 16
// correct ones are confirmed, and the one wrong one is refused.
export const getIsCandidateConfirmed = ({
  candidateTrackTitles,
  candidateYear,
  localTrackTitles,
  releaseYear,
}: {
  candidateTrackTitles: string[]
  candidateYear: number | null
  localTrackTitles: string[]
  releaseYear: number | null
}) =>
  getSharedTrackTitleCount({
    candidateTrackTitles,
    localTrackTitles,
  }) > 0 ||
  (releaseYear !== null &&
    candidateYear !== null &&
    Math.abs(releaseYear - candidateYear) <=
      ITUNES_MAXIMUM_YEAR_DIFFERENCE)

export const selectItunesCandidates = ({
  albumTitle,
  artistName,
  rawResponse,
}: {
  albumTitle: string
  artistName: string
  rawResponse: ItunesRawResponse
}) =>
  (rawResponse.results ?? []).filter(
    (result) =>
      result.artworkUrl100 !== undefined &&
      getIsMatch({ albumTitle, artistName, result }),
  )

export const buildItunesArtworkImage = (
  result: ItunesRawResult,
): ItunesArtworkImage => ({
  albumTitle: result.collectionName ?? "",
  artistName: result.artistName ?? "",
  imageUrl: upgradeArtworkUrl(result.artworkUrl100 ?? ""),
})

export const selectItunesArtwork = ({
  albumTitle,
  artistName,
  rawResponse,
}: {
  albumTitle: string
  artistName: string
  rawResponse: ItunesRawResponse
}): ItunesArtworkImage | null =>
  selectItunesCandidates({
    albumTitle,
    artistName,
    rawResponse,
  })
    .map(buildItunesArtworkImage)
    .at(0) ?? null

export const selectItunesTrackNames = (
  rawResponse: ItunesRawResponse,
) =>
  (rawResponse.results ?? [])
    .filter((result) => result.wrapperType === "track")
    .map((result) => result.trackName ?? "")
    .filter((trackName) => trackName.length > 0)

export const buildLookupUrl = (collectionId: number) =>
  `${ITUNES_LOOKUP_BASE_URL}?${new URLSearchParams({
    entity: "song",
    id: String(collectionId),
    limit: "200",
  }).toString()}`

const buildSearchUrl = ({
  albumTitle,
  artistName,
}: {
  albumTitle: string
  artistName: string
}) =>
  `${ITUNES_SEARCH_BASE_URL}?${new URLSearchParams({
    entity: "album",
    limit: "25",
    media: "music",
    term: `${artistName} ${albumTitle}`,
  }).toString()}`

// The fifth provider, and the one the parity doc does not list. Picard's
// chain stops at TheAudioDB and local files, which between them covered 37
// of the 333 albums in this library that had no art at all. This one is here
// because the owner's rule is that an album has artwork, not that the
// lookup matched Picard.
//
// Two requests, not one. The search finds candidates whose album title and
// artist match exactly; the lookup then reads each candidate's own track
// list so the match can be confirmed against the files on disk. Without
// `localTrackTitles` and `releaseYear` there is nothing to confirm against
// and the first name match is taken, which is what this did before.
const confirmCandidate = ({
  cachedFetch,
  candidate,
  localTrackTitles,
  releaseYear,
}: {
  cachedFetch: CachedFetch
  candidate: ItunesRawResult
  localTrackTitles: string[]
  releaseYear: number | null
}) =>
  candidate.collectionId === undefined
    ? Promise.resolve(false)
    : cachedFetch(buildLookupUrl(candidate.collectionId))
        .then(({ body }) =>
          selectItunesTrackNames(
            JSON.parse(body) as ItunesRawResponse,
          ),
        )
        .then((candidateTrackTitles) =>
          getIsCandidateConfirmed({
            candidateTrackTitles,
            candidateYear: getReleaseYear(
              candidate.releaseDate,
            ),
            localTrackTitles,
            releaseYear,
          }),
        )
        // An unreadable track list is not a confirmation. Refusing here
        // leaves the album blank for one run; accepting could put the wrong
        // cover on it for good.
        .catch(() => false)

const findConfirmedCandidate = ({
  cachedFetch,
  candidates,
  localTrackTitles,
  releaseYear,
}: {
  cachedFetch: CachedFetch
  candidates: ItunesRawResult[]
  localTrackTitles: string[]
  releaseYear: number | null
}) =>
  candidates.reduce(
    (
      foundSoFar: Promise<ItunesArtworkImage | null>,
      candidate,
    ) =>
      foundSoFar.then((found) =>
        found !== null
          ? found
          : confirmCandidate({
              cachedFetch,
              candidate,
              localTrackTitles,
              releaseYear,
            }).then((isConfirmed) =>
              isConfirmed
                ? buildItunesArtworkImage(candidate)
                : null,
            ),
      ),
    Promise.resolve<ItunesArtworkImage | null>(null),
  )

export const getItunesArtwork = ({
  albumTitle,
  artistName,
  cachedFetch,
  localTrackTitles = [],
  releaseYear = null,
}: {
  albumTitle: string
  artistName: string
  cachedFetch: CachedFetch
  localTrackTitles?: string[]
  releaseYear?: number | null
}): Observable<ItunesArtworkImage | null> =>
  from(
    albumTitle === "" || artistName === ""
      ? Promise.resolve(null)
      : cachedFetch(
          buildSearchUrl({ albumTitle, artistName }),
        )
          .then(({ body }) =>
            selectItunesCandidates({
              albumTitle,
              artistName,
              rawResponse: JSON.parse(
                body,
              ) as ItunesRawResponse,
            }),
          )
          .then((candidates) =>
            localTrackTitles.length === 0 &&
            releaseYear === null
              ? (candidates
                  .map(buildItunesArtworkImage)
                  .at(0) ?? null)
              : findConfirmedCandidate({
                  cachedFetch,
                  candidates,
                  localTrackTitles,
                  releaseYear,
                }),
          )
          // A search that finds nothing is a normal outcome, not a failure.
          // One unreachable provider must not stop the chain reaching the
          // art already sitting in the album folder.
          .catch(() => null),
  ).pipe(logAndRethrowPipelineError(getItunesArtwork))
