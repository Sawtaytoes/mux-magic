import { stat, utimes } from "node:fs/promises"
import {
  ByteVector,
  File,
  Picture,
  PictureType,
} from "node-taglib-sharp"

import type { CoverArtImage } from "./coverArtImage.js"

export const COVER_ART_DESCRIPTION = "Cover (front)"

// taglib holds the file open until the handle is disposed, and a handle left
// alive locks the next writer out. Every read and every write below goes
// through here so the dispose cannot be forgotten in one branch.
// `File.createFromPath` throws synchronously on a missing or unreadable
// file, so the open itself is inside the promise. Otherwise a caller that
// started a second promise alongside this one would see that one reject with
// nobody listening.
const withAudioFile = <TResult>({
  filePath,
  useAudioFile,
}: {
  filePath: string
  useAudioFile: (audioFile: File) => TResult
}) =>
  Promise.resolve()
    .then(() => File.createFromPath(filePath))
    .then((audioFile) =>
      Promise.resolve()
        .then(() => useAudioFile(audioFile))
        .finally(() => {
          audioFile.dispose()
        }),
    )

// `preserve_images=false` in the parity doc: the new front image REPLACES
// whatever the file was carrying, and the file ends with exactly one picture.
// Assigning a one-element array is what makes both true at once.
const buildFrontCoverPicture = ({
  imageBytes,
  mimeType,
}: {
  imageBytes: ByteVector
  mimeType: string
}) =>
  Picture.fromFullData(
    imageBytes,
    PictureType.FrontCover,
    mimeType,
    COVER_ART_DESCRIPTION,
  )

// "Already written" is one front picture whose bytes are identical. Anything
// else — no picture, two pictures, a different image — is a file that still
// needs the write, so a second run over a half-done folder finishes it.
const getIsCoverArtAlreadyWritten = ({
  audioFile,
  imageBytes,
}: {
  audioFile: File
  imageBytes: ByteVector
}) =>
  audioFile.tag.pictures.length === 1 &&
  audioFile.tag.pictures[0]?.data.equals(imageBytes) ===
    true

const readIsCoverArtAlreadyWritten = ({
  filePath,
  imageBytes,
}: {
  filePath: string
  imageBytes: ByteVector
}) =>
  withAudioFile({
    filePath,
    useAudioFile: (audioFile) =>
      getIsCoverArtAlreadyWritten({
        audioFile,
        imageBytes,
      }),
  })

const savePictureToAudioFile = ({
  filePath,
  imageBytes,
  mimeType,
}: {
  filePath: string
  imageBytes: ByteVector
  mimeType: string
}) =>
  withAudioFile({
    filePath,
    useAudioFile: (audioFile) => {
      audioFile.tag.pictures = [
        buildFrontCoverPicture({ imageBytes, mimeType }),
      ]
      audioFile.save()
    },
  })

// Restoring the timestamp is a courtesy, not part of the write. The picture
// is already in the file by the time this runs, so a failure here must not
// report the file as unwritten — it did get the cover art.
//
// `EPERM` is the common one and it is an OWNERSHIP fact, not a permission
// bug: `utimes` to an arbitrary time needs the file's owner or `CAP_FOWNER`,
// and a group-writable file owned by another user gives neither. A large
// part of the music library is owned by `root` while the agent runs as
// `node`, so 17 of the first 65 albums hit this. Before the fix the whole
// album reported `failed` even though every file had the cover art, and one
// of them killed the run.
const TIMESTAMP_ERROR_CODES = new Set(["EACCES", "EPERM"])

const getIsIgnorableTimestampError = (error: unknown) =>
  TIMESTAMP_ERROR_CODES.has(
    (error as { code?: string }).code ?? "",
  )

export type SetFileTimestamps = (
  filePath: string,
  accessedTime: Date,
  modifiedTime: Date,
) => Promise<void>

const restoreTimestamps = ({
  filePath,
  originalFileStats,
  setFileTimestamps,
}: {
  filePath: string
  originalFileStats: { atime: Date; mtime: Date }
  setFileTimestamps: SetFileTimestamps
}) =>
  setFileTimestamps(
    filePath,
    originalFileStats.atime,
    originalFileStats.mtime,
  )
    .then(() => true)
    .catch((error: unknown) =>
      getIsIgnorableTimestampError(error)
        ? false
        : Promise.reject(error),
    )

export const writeEmbeddedCoverArt = ({
  filePath,
  image,
  isDryRun = false,
  isTimestampPreserved = true,
  setFileTimestamps = utimes,
}: {
  filePath: string
  image: CoverArtImage
  isDryRun?: boolean
  isTimestampPreserved?: boolean
  setFileTimestamps?: SetFileTimestamps
}) =>
  ((imageBytes: ByteVector) =>
    stat(filePath)
      .then((originalFileStats) =>
        readIsCoverArtAlreadyWritten({
          filePath,
          imageBytes,
        }).then(
          (isAlreadyWritten) =>
            [originalFileStats, isAlreadyWritten] as const,
        ),
      )
      .then(([originalFileStats, isAlreadyWritten]) =>
        // A file already carrying exactly this image is not rewritten.
        // Running the command twice over a folder must be a no-op, the same
        // acceptance test `writeAudioTags` is held to.
        isAlreadyWritten || isDryRun
          ? {
              isChanged: !isAlreadyWritten,
              isTimestampRestored: true,
            }
          : savePictureToAudioFile({
              filePath,
              imageBytes,
              mimeType: image.mimeType,
            })
              .then(() =>
                isTimestampPreserved
                  ? restoreTimestamps({
                      filePath,
                      originalFileStats,
                      setFileTimestamps,
                    })
                  : true,
              )
              .then((isTimestampRestored) => ({
                isChanged: true,
                isTimestampRestored,
              })),
      )
      .catch((error: unknown) =>
        Promise.reject(
          new Error(
            `Cannot write cover art to "${filePath}": ${
              error instanceof Error
                ? error.message
                : String(error)
            }`,
            { cause: error },
          ),
        ),
      ))(ByteVector.fromByteArray(image.bytes))
