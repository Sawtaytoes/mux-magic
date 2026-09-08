import { logAndRethrowPipelineError } from "@mux-magic/tools"
import { firstValueFrom, from } from "rxjs"

import {
  type DiscogsIdentifierKind,
  type DiscogsRelease,
  getDiscogsRelease,
  searchDiscogsReleasesByIdentifier,
} from "./discogsApi.js"
import { normaliseForComparison } from "./itunesArtwork.js"
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

// Discogs marks one image `primary`. A release photographed by a contributor
// often has only `secondary` images — the case, the disc, the inlay — and
// the front is the first of them, so a secondary image is accepted rather
// than leaving the album blank.
export const selectDiscogsFrontImageUrl = (
  release: DiscogsRelease,
) =>
  (
    release.images.find((image) => image.isPrimary) ??
    release.images.at(0) ??
    null
  )?.imageUrl ?? null

// The identifier found the release, but a barcode can be reused across a
// reissue and a catalogue number is only unique within its label. Requiring
// the title to agree is what stops a near-miss becoming a wrong cover.
export const getIsTitleMatch = ({
  albumTitle,
  release,
}: {
  albumTitle: string
  release: DiscogsRelease
}) =>
  normaliseForComparison(release.title) ===
  normaliseForComparison(albumTitle)

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
