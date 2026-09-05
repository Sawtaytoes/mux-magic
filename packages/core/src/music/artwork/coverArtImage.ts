import { Picture } from "node-taglib-sharp"

// The parity doc asks for the original upload, so there is no resize step and
// no re-encode anywhere in this module. Whatever bytes the provider returned
// are the bytes that reach the file and the folder.
export type CoverArtImage = {
  bytes: Uint8Array
  mimeType: string
}

const MIME_TYPE_BY_SIGNATURE = [
  {
    mimeType: "image/jpeg",
    signature: [0xff, 0xd8, 0xff],
  },
  {
    mimeType: "image/png",
    signature: [0x89, 0x50, 0x4e, 0x47],
  },
  {
    mimeType: "image/gif",
    signature: [0x47, 0x49, 0x46, 0x38],
  },
  {
    mimeType: "image/bmp",
    signature: [0x42, 0x4d],
  },
] as const

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "image/bmp": ".bmp",
  "image/gif": ".gif",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/tiff": ".tif",
  "image/webp": ".webp",
}

const getIsSignatureMatched = ({
  bytes,
  signature,
}: {
  bytes: Uint8Array
  signature: readonly number[]
}) =>
  signature.every(
    (expectedByte, offset) =>
      bytes[offset] === expectedByte,
  )

const getIsWebpSignature = (bytes: Uint8Array) =>
  getIsSignatureMatched({
    bytes,
    signature: [0x52, 0x49, 0x46, 0x46],
  }) &&
  getIsSignatureMatched({
    bytes: bytes.subarray(8),
    signature: [0x57, 0x45, 0x42, 0x50],
  })

// The declared `Content-Type` is not trusted on its own. The Cover Art
// Archive redirects to storage hosts that have answered `application/binary`
// for a JPEG, and a wrong MIME type in the tag is what makes a player refuse
// to draw the picture it is holding.
export const getCoverArtMimeType = (bytes: Uint8Array) =>
  getIsWebpSignature(bytes)
    ? "image/webp"
    : (MIME_TYPE_BY_SIGNATURE.find((candidate) =>
        getIsSignatureMatched({
          bytes,
          signature: candidate.signature,
        }),
      )?.mimeType ?? null)

export const getCoverArtExtension = (mimeType: string) =>
  EXTENSION_BY_MIME_TYPE[mimeType.toLowerCase()] ?? null

export const buildCoverArtImage = (
  bytes: Uint8Array,
): CoverArtImage | null =>
  ((mimeType) =>
    mimeType === null ? null : { bytes, mimeType })(
    getCoverArtMimeType(bytes),
  )

// taglib's own sniffing is reached through a Picture, and a Picture is what
// the writer needs anyway, so the two conversions share one place.
export const getPictureMimeTypeFromFilename = (
  filename: string,
) => Picture.getMimeTypeFromFilename(filename)
