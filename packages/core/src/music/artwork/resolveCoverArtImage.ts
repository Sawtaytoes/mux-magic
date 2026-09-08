import { readFile } from "node:fs/promises"

import { firstValueFrom } from "rxjs"

import {
  type CoverArtImage as CoverArtArchiveImage,
  getCoverArt,
} from "../../tools/coverArtArchive.js"
import { getDiscogsArtwork } from "../../tools/discogsArtwork.js"
import { getItunesArtwork } from "../../tools/itunesArtwork.js"
import {
  type CachedFetch,
  getMusicBrainzRelease,
} from "../../tools/musicBrainzApi.js"
import {
  buildCoverArtImage,
  type CoverArtImage,
} from "./coverArtImage.js"
import { downloadCoverArtImage } from "./downloadCoverArtImage.js"
import { findLocalCoverArt } from "./findLocalCoverArt.js"

export type CoverArtSource =
  | "cover-art-archive-release"
  | "cover-art-archive-release-group"
  | "discogs"
  | "image-url"
  | "itunes"
  | "local-file"

export type ResolvedCoverArt = {
  image: CoverArtImage
  imageUrl: string | null
  source: CoverArtSource
  sourcePath: string | null
}

// Provider order, from `docs/picard-parity.md` §2:
//
//   1. an explicit image — a URL or a file the caller chose, which is the
//      escape hatch for a release MusicBrainz has never heard of (a
//      day-old game soundtrack, a Bandcamp-only EP)
//   2. Cover Art Archive, by release id
//   3. Cover Art Archive, by release group id
//   4. TheAudioDB — still the unimplemented seam in `coverArtArchive.ts`
//   5. Discogs, by the barcode and catalogue number MusicBrainz holds for
//      the release the tags already name — NOT in Picard's chain
//   6. iTunes, searched by album title and artist — NOT in Picard's chain.
//      It is here because the Cover Art Archive knew only 37 of the 333
//      albums in this library that had no art at all, and the owner's rule
//      is that an album has artwork, not that the lookup matched Picard.
//   7. local files already in the album folder
//
// Local files come LAST on purpose. Picard puts them last too: art already
// on disk is the fallback when no provider knows the release, not a reason
// to skip the lookup.
//
// MusicBrainz stays first and Discogs does NOT displace it. Discogs sits
// where it does because of what it is asked WITH: the barcode and catalogue
// number of the exact release the Cover Art Archive had no picture for. That
// is an identifier, so it can only return the wrong album if the identifier
// is wrong. iTunes is a text SEARCH and stays below it, with its own
// confirmation step, because a title and an artist name a release only when
// the release has a distinctive name — "Various Artists" plus one common
// word names nothing, and that put a 2024 cover on a 2001 compilation.
const readLocalCoverArt = (folderPath: string) =>
  findLocalCoverArt(folderPath).then((coverArtFilePath) =>
    coverArtFilePath === null
      ? null
      : readFile(coverArtFilePath).then(
          (fileBytes): ResolvedCoverArt | null =>
            ((image: CoverArtImage | null) =>
              image === null
                ? null
                : {
                    image,
                    imageUrl: null,
                    source: "local-file" as const,
                    sourcePath: coverArtFilePath,
                  })(
              buildCoverArtImage(
                Uint8Array.from(fileBytes),
              ),
            ),
        ),
  )

const readImageUrl = (imageUrl: string) =>
  downloadCoverArtImage(imageUrl).then(
    (image): ResolvedCoverArt => ({
      image,
      imageUrl,
      source: "image-url",
      sourcePath: null,
    }),
  )

const readItunesArtwork = ({
  albumTitle,
  artistName,
  cachedFetch,
  localTrackTitles,
  releaseYear,
}: {
  albumTitle?: string
  artistName?: string
  cachedFetch: CachedFetch
  localTrackTitles?: string[]
  releaseYear?: number | null
}) =>
  albumTitle === undefined || artistName === undefined
    ? Promise.resolve(null)
    : firstValueFrom(
        getItunesArtwork({
          albumTitle,
          artistName,
          cachedFetch,
          localTrackTitles,
          releaseYear,
        }),
      ).then((itunesImage) =>
        itunesImage === null
          ? null
          : downloadCoverArtImage(
              itunesImage.imageUrl,
            ).then(
              (image): ResolvedCoverArt => ({
                image,
                imageUrl: itunesImage.imageUrl,
                source: "itunes",
                sourcePath: null,
              }),
            ),
      )

const readCoverArtArchive = ({
  cachedFetch,
  releaseGroupId,
  releaseId,
}: {
  cachedFetch: CachedFetch
  releaseGroupId?: string
  releaseId?: string
}) =>
  releaseId === undefined && releaseGroupId === undefined
    ? Promise.resolve(null)
    : firstValueFrom(
        getCoverArt({
          cachedFetch,
          releaseGroupId,
          releaseId,
        }),
      ).then((archiveImage: CoverArtArchiveImage | null) =>
        archiveImage === null
          ? null
          : downloadCoverArtImage(
              archiveImage.imageUrl,
            ).then(
              (image): ResolvedCoverArt => ({
                image,
                imageUrl: archiveImage.imageUrl,
                source:
                  archiveImage.provider === "release"
                    ? "cover-art-archive-release"
                    : "cover-art-archive-release-group",
                sourcePath: null,
              }),
            ),
      )

// The barcode and the catalogue number are not in the file's tags for most
// of this library, but MusicBrainz holds both for the release the tags DO
// name. So this costs one more MusicBrainz request, and only on the path
// where the Cover Art Archive already came back empty.
const readDiscogsArtwork = ({
  albumTitle,
  cachedFetch,
  discogsCachedFetch,
  releaseId,
}: {
  albumTitle?: string
  cachedFetch: CachedFetch
  discogsCachedFetch: CachedFetch
  releaseId?: string
}) =>
  releaseId === undefined || albumTitle === undefined
    ? Promise.resolve<ResolvedCoverArt | null>(null)
    : firstValueFrom(
        getMusicBrainzRelease({ cachedFetch, releaseId }),
      )
        .then((release) =>
          firstValueFrom(
            getDiscogsArtwork({
              albumTitle,
              barcode: release.barcode,
              cachedFetch: discogsCachedFetch,
              catalogNumbers: release.catalogNumbers,
            }),
          ),
        )
        .then((discogsImage) =>
          discogsImage === null
            ? null
            : downloadCoverArtImage(
                discogsImage.imageUrl,
              ).then(
                (image): ResolvedCoverArt => ({
                  image,
                  imageUrl: discogsImage.imageUrl,
                  source: "discogs",
                  sourcePath: null,
                }),
              ),
        )
        // A release MusicBrainz cannot serve, or a Discogs outage, must not
        // stop the chain reaching iTunes and then the album folder.
        .catch(() => null)

export const resolveCoverArtImage = ({
  albumTitle,
  artistName,
  cachedFetch,
  discogsCachedFetch,
  folderPath,
  imageUrl,
  itunesCachedFetch,
  localTrackTitles,
  releaseGroupId,
  releaseId,
  releaseYear,
}: {
  albumTitle?: string
  artistName?: string
  cachedFetch: CachedFetch
  discogsCachedFetch?: CachedFetch
  folderPath: string
  imageUrl?: string
  itunesCachedFetch?: CachedFetch
  localTrackTitles?: string[]
  releaseGroupId?: string
  releaseId?: string
  releaseYear?: number | null
}): Promise<ResolvedCoverArt | null> =>
  (imageUrl === undefined
    ? Promise.resolve<ResolvedCoverArt | null>(null)
    : readImageUrl(imageUrl)
  ).then((explicitImage) =>
    explicitImage === null
      ? readCoverArtArchive({
          cachedFetch,
          releaseGroupId,
          releaseId,
        })
          .then((archiveImage) =>
            archiveImage === null
              ? readDiscogsArtwork({
                  albumTitle,
                  cachedFetch,
                  discogsCachedFetch:
                    discogsCachedFetch ?? cachedFetch,
                  releaseId,
                })
              : archiveImage,
          )
          .then((identifierImage) =>
            identifierImage === null
              ? readItunesArtwork({
                  albumTitle,
                  artistName,
                  cachedFetch:
                    itunesCachedFetch ?? cachedFetch,
                  localTrackTitles,
                  releaseYear,
                })
              : identifierImage,
          )
          .then((foundImage) =>
            foundImage === null
              ? readLocalCoverArt(folderPath)
              : foundImage,
          )
      : explicitImage,
  )
