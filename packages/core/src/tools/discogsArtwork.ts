import { logAndRethrowPipelineError } from "@mux-magic/tools"
import { firstValueFrom, from } from "rxjs"

import {
  type DiscogsIdentifierKind,
  type DiscogsImage,
  type DiscogsRelease,
  getDiscogsRelease,
  searchDiscogsReleasesByIdentifier,
} from "./discogsApi.js"
import type { CachedFetch } from "./musicBrainzApi.js"

// Discogs, reached by an IDENTIFIER rather than by a search.
//
// The chain already asks MusicBrainz first and takes the Cover Art Archive
// image attached to the release id in the album's own tags, and that image
// cannot belong to a different album. This provider exists for the gap after
// it: MusicBrainz knows the release, so the identity is settled, but nobody
// ever uploaded a cover for it. That was true of 65 albums in this library,
// including a 2001 compilation called *Pulse* whose blank Cover Art Archive
// entry sent the chain to iTunes, which found a DIFFERENT album of the same
// name and put its cover on the record.
//
// So this runs on the barcode and the catalogue number that MusicBrainz
// already holds for that exact release. A barcode names one product. A title
// does not, which is why iTunes stays below this and keeps its own checks.
export const DISCOGS_MAXIMUM_CANDIDATES_PER_IDENTIFIER = 3

export type DiscogsArtworkImage = {
  imageUrl: string
  matchedBy: DiscogsIdentifierKind
  releaseId: string
}

// An album cover is SQUARE. That is the one property that separates a front
// cover from the other things Discogs contributors upload for a release, and
// it is checked because `primary` does not mean "front":
//
//   * Lambert, Hendricks & Ross — *The Best of the Best!* has exactly one
//     image, marked `primary`, and it is a 600x281 scan of the back tray
//     and the front laid side by side.
//   * *Feel Good Rock: Songs You Know by Heart* has one `secondary` image,
//     600x450 — a photograph of the jewel case on a desk, at an angle, with
//     a shop's price sticker on it.
//
// Both were installed on real albums before this check existed. 4:3 is a
// camera's aspect ratio, and it is the tell for a photograph of the case
// rather than a scan of the cover, so the band stops short of it at 5:4.
export const DISCOGS_MINIMUM_COVER_ASPECT_RATIO = 0.8
export const DISCOGS_MAXIMUM_COVER_ASPECT_RATIO = 1.25

export const getIsPlausibleCoverShape = (
  image: DiscogsImage,
) =>
  image.width > 0 &&
  image.height > 0 &&
  image.width / image.height >=
    DISCOGS_MINIMUM_COVER_ASPECT_RATIO &&
  image.width / image.height <=
    DISCOGS_MAXIMUM_COVER_ASPECT_RATIO

// Among the square-enough images, `primary` is the release's chosen picture
// and wins. Otherwise the largest one does, because a contributor who
// uploads several usually scans the front at the highest resolution. A
// release whose images are ALL the wrong shape returns null and lets the
// chain carry on to iTunes and then the album folder — a back cover on a
// record is worse than a blank one.
export const selectDiscogsFrontImageUrl = (
  release: DiscogsRelease,
) =>
  ((plausibleImages) =>
    (
      plausibleImages.find((image) => image.isPrimary) ??
      plausibleImages.reduce(
        (largest: DiscogsImage | null, image) =>
          largest === null ||
          image.width * image.height >
            largest.width * largest.height
            ? image
            : largest,
        null,
      )
    )?.imageUrl ?? null)(
    release.images.filter(getIsPlausibleCoverShape),
  )

// `normaliseForComparison` keeps only `a-z0-9`, so a title written entirely
// in Japanese normalises to the EMPTY STRING — and two empty strings are
// equal. That made this check silently vacuous for exactly the releases the
// identifier path exists to serve: 恋恋風歌, つぼみ and シナリオ all matched
// on an empty comparison rather than on their titles.
//
// So the comparison here keeps letters and numbers in ANY script. A trailing
// bracketed qualifier is also dropped, because Discogs writes a Japanese
// release as `Chara No Mori (チャラの森)` where the tags carry only the
// romanisation.
export const normaliseTitleForIdentifierMatch = (
  title: string,
) =>
  title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]+/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, "")

export const getComparableReleaseTitles = (title: string) =>
  Array.from(
    new Set(
      [
        title,
        title.replace(/\s*[([{][^)\]}]*[)\]}]\s*$/u, ""),
      ]
        .map(normaliseTitleForIdentifierMatch)
        .filter(
          (comparableTitle) => comparableTitle.length > 0,
        ),
    ),
  )

// The identifier found the release, but a barcode can be reused across a
// reissue and a catalogue number is only unique within its label. Requiring
// the title to agree is what stops a near-miss becoming a wrong cover. A
// title that normalises to nothing is NOT a match — it is a missing check.
export const getIsTitleMatch = ({
  albumTitle,
  release,
}: {
  albumTitle: string
  release: DiscogsRelease
}) =>
  ((albumTitles, releaseTitles) =>
    albumTitles.length > 0 &&
    releaseTitles.length > 0 &&
    albumTitles.some((comparableAlbumTitle) =>
      releaseTitles.includes(comparableAlbumTitle),
    ))(
    getComparableReleaseTitles(albumTitle),
    getComparableReleaseTitles(release.title),
  )

const readFirstMatchingRelease = ({
  albumTitle,
  cachedFetch,
  kind,
  releaseIds,
}: {
  albumTitle: string
  cachedFetch: CachedFetch
  kind: DiscogsIdentifierKind
  releaseIds: string[]
}) =>
  releaseIds
    .slice(0, DISCOGS_MAXIMUM_CANDIDATES_PER_IDENTIFIER)
    .reduce(
      (
        foundSoFar: Promise<DiscogsArtworkImage | null>,
        releaseId,
      ) =>
        foundSoFar.then((found) =>
          found !== null
            ? found
            : firstValueFrom(
                getDiscogsRelease({
                  cachedFetch,
                  releaseId,
                }),
              )
                .then((release) =>
                  getIsTitleMatch({ albumTitle, release })
                    ? selectDiscogsFrontImageUrl(release)
                    : null,
                )
                .then((imageUrl) =>
                  imageUrl === null
                    ? null
                    : {
                        imageUrl,
                        matchedBy: kind,
                        releaseId,
                      },
                )
                // One unreadable release must not stop the chain. The next
                // candidate, and then iTunes, still get their turn.
                .catch(() => null),
        ),
      Promise.resolve<DiscogsArtworkImage | null>(null),
    )

const readOneIdentifier = ({
  albumTitle,
  cachedFetch,
  identifier,
  kind,
}: {
  albumTitle: string
  cachedFetch: CachedFetch
  identifier: string
  kind: DiscogsIdentifierKind
}) =>
  firstValueFrom(
    searchDiscogsReleasesByIdentifier({
      cachedFetch,
      identifier,
      kind,
    }),
  )
    .then((releaseIds) =>
      readFirstMatchingRelease({
        albumTitle,
        cachedFetch,
        kind,
        releaseIds,
      }),
    )
    .catch(() => null)

// Barcode first: it names one product. The catalogue numbers follow, in the
// order MusicBrainz lists them, because a release can carry more than one.
export const buildDiscogsIdentifiers = ({
  barcode,
  catalogNumbers,
}: {
  barcode?: string
  catalogNumbers?: string[]
}) => [
  ...(barcode !== undefined && barcode.length > 0
    ? [
        {
          identifier: barcode,
          kind: "barcode" as const,
        },
      ]
    : []),
  ...(catalogNumbers ?? [])
    .filter((catalogNumber) => catalogNumber.length > 0)
    .map((catalogNumber) => ({
      identifier: catalogNumber,
      kind: "catno" as const,
    })),
]

export const getDiscogsArtwork = ({
  albumTitle,
  barcode,
  cachedFetch,
  catalogNumbers,
}: {
  albumTitle?: string
  barcode?: string
  cachedFetch: CachedFetch
  catalogNumbers?: string[]
}) =>
  from(
    ((identifiers) =>
      albumTitle === undefined ||
      albumTitle.length === 0 ||
      identifiers.length === 0
        ? Promise.resolve<DiscogsArtworkImage | null>(null)
        : identifiers.reduce(
            (
              foundSoFar: Promise<DiscogsArtworkImage | null>,
              { identifier, kind },
            ) =>
              foundSoFar.then((found) =>
                found !== null
                  ? found
                  : readOneIdentifier({
                      albumTitle,
                      cachedFetch,
                      identifier,
                      kind,
                    }),
              ),
            Promise.resolve<DiscogsArtworkImage | null>(
              null,
            ),
          ))(
      buildDiscogsIdentifiers({ barcode, catalogNumbers }),
    ),
  ).pipe(logAndRethrowPipelineError(getDiscogsArtwork))
