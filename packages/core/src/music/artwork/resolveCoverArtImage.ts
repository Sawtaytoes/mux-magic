import { readFile } from "node:fs/promises"

import { firstValueFrom } from "rxjs"

import {
  type CoverArtImage as CoverArtArchiveImage,
  getCoverArt,
} from "../../tools/coverArtArchive.js"
import { getItunesArtwork } from "../../tools/itunesArtwork.js"
import type { CachedFetch } from "../../tools/musicBrainzApi.js"
import {
  buildCoverArtImage,
  type CoverArtImage,
} from "./coverArtImage.js"
import { downloadCoverArtImage } from "./downloadCoverArtImage.js"
import { findLocalCoverArt } from "./findLocalCoverArt.js"

export type CoverArtSource =
  | "cover-art-archive-release"
  | "cover-art-archive-release-group"
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
//   5. iTunes, searched by album title and artist — NOT in Picard's chain.
//      It is here because the Cover Art Archive knew only 37 of the 333
//      albums in this library that had no art at all, and the owner's rule
//      is that an album has artwork, not that the lookup matched Picard.
//   6. local files already in the album folder
//
// Local files come LAST on purpose. Picard puts them last too: art already
// on disk is the fallback when no provider knows the release, not a reason
// to skip the lookup.
//
// iTunes is a SEARCH, so it can only put the wrong cover on an album if its
// match is loose. `getItunesArtwork` requires the album title and the artist
// to be equal once punctuation, case and spacing are removed.
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
}: {
  albumTitle?: string
  artistName?: string
  cachedFetch: CachedFetch
}) =>
  albumTitle === undefined || artistName === undefined
    ? Promise.resolve(null)
    : firstValueFrom(
        getItunesArtwork({
          albumTitle,
          artistName,
          cachedFetch,
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

export const resolveCoverArtImage = ({
  albumTitle,
  artistName,
  cachedFetch,
  folderPath,
  imageUrl,
  itunesCachedFetch,
  releaseGroupId,
  releaseId,
}: {
  albumTitle?: string
  artistName?: string
  cachedFetch: CachedFetch
  folderPath: string
  imageUrl?: string
  itunesCachedFetch?: CachedFetch
  releaseGroupId?: string
  releaseId?: string
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
              ? readItunesArtwork({
                  albumTitle,
                  artistName,
                  cachedFetch:
                    itunesCachedFetch ?? cachedFetch,
                })
              : archiveImage,
          )
          .then((foundImage) =>
            foundImage === null
              ? readLocalCoverArt(folderPath)
              : foundImage,
          )
      : explicitImage,
  )
