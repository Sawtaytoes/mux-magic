import { requireMusicBrainzUserAgent } from "../../tools/musicBrainzApi.js"
import {
  buildCoverArtImage,
  type CoverArtImage,
} from "./coverArtImage.js"

export const COVER_ART_DOWNLOAD_TIMEOUT_MILLISECONDS = 30_000

// A front cover is a few megabytes at the original size the parity doc asks
// for. Anything past this is not album art, and a runaway response would be
// held whole in memory before anything could reject it.
export const COVER_ART_MAXIMUM_BYTES = 32 * 1024 * 1024

export type DownloadCoverArtImage = (
  imageUrl: string,
) => Promise<CoverArtImage>

const readImageBytes = ({
  imageUrl,
  response,
}: {
  imageUrl: string
  response: Response
}) =>
  response
    .arrayBuffer()
    .then((imageBuffer) =>
      imageBuffer.byteLength > COVER_ART_MAXIMUM_BYTES
        ? Promise.reject(
            new Error(
              `Cover art at "${imageUrl}" is ${imageBuffer.byteLength} bytes, past the ${COVER_ART_MAXIMUM_BYTES}-byte limit.`,
            ),
          )
        : new Uint8Array(imageBuffer),
    )

// The Cover Art Archive answers with a redirect to an Internet Archive
// storage host, so redirects are followed rather than treated as the answer.
export const downloadCoverArtImage: DownloadCoverArtImage =
  (imageUrl) =>
    fetch(imageUrl, {
      headers: {
        Accept: "image/*",
        "User-Agent": requireMusicBrainzUserAgent(),
      },
      redirect: "follow",
      signal: AbortSignal.timeout(
        COVER_ART_DOWNLOAD_TIMEOUT_MILLISECONDS,
      ),
    })
      .then((response) =>
        response.ok
          ? readImageBytes({ imageUrl, response })
          : Promise.reject(
              new Error(
                `Cover art request for "${imageUrl}" failed with HTTP ${response.status}.`,
              ),
            ),
      )
      .then(
        (bytes) =>
          // The declared content type is ignored in favour of the magic bytes:
          // the archive's storage hosts have answered `application/binary` for a
          // JPEG, and a wrong MIME type is what stops a player drawing the
          // picture it is holding.
          buildCoverArtImage(bytes) ??
          Promise.reject(
            new Error(
              `Cover art at "${imageUrl}" is not a recognised image format.`,
            ),
          ),
      )
