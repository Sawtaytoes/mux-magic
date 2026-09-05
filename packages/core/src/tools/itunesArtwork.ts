import { logAndRethrowPipelineError } from "@mux-magic/tools"
import { from, type Observable } from "rxjs"

import type { CachedFetch } from "./musicBrainzApi.js"

export const ITUNES_SEARCH_BASE_URL =
  "https://itunes.apple.com/search"

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
  collectionName?: string
}

export type ItunesRawResponse = {
  results?: ItunesRawResult[]
}

// A search provider can put the WRONG cover on an album, which is worse than
// leaving it blank, so the match is deliberately strict: the album title and
// the artist must both be equal once punctuation, case and spacing are
// removed. A close-enough title is not accepted.
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

export const selectItunesArtwork = ({
  albumTitle,
  artistName,
  rawResponse,
}: {
  albumTitle: string
  artistName: string
  rawResponse: ItunesRawResponse
}): ItunesArtworkImage | null =>
  (rawResponse.results ?? [])
    .filter(
      (result) =>
        result.artworkUrl100 !== undefined &&
        getIsMatch({ albumTitle, artistName, result }),
    )
    .map(
      (result): ItunesArtworkImage => ({
        albumTitle: result.collectionName ?? "",
        artistName: result.artistName ?? "",
        imageUrl: upgradeArtworkUrl(
          result.artworkUrl100 ?? "",
        ),
      }),
    )
    .at(0) ?? null

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
export const getItunesArtwork = ({
  albumTitle,
  artistName,
  cachedFetch,
}: {
  albumTitle: string
  artistName: string
  cachedFetch: CachedFetch
}): Observable<ItunesArtworkImage | null> =>
  from(
    albumTitle === "" || artistName === ""
      ? Promise.resolve(null)
      : cachedFetch(
          buildSearchUrl({ albumTitle, artistName }),
        )
          .then(({ body }) =>
            selectItunesArtwork({
              albumTitle,
              artistName,
              rawResponse: JSON.parse(
                body,
              ) as ItunesRawResponse,
            }),
          )
          // A search that finds nothing is a normal outcome, not a failure.
          // One unreachable provider must not stop the chain reaching the
          // art already sitting in the album folder.
          .catch(() => null),
  ).pipe(logAndRethrowPipelineError(getItunesArtwork))
