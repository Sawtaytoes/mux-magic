import { writeFile } from "node:fs/promises"
import { join } from "node:path"

import { COVER_ART_FILENAME } from "../../tools/coverArtArchive.js"
import {
  type CoverArtImage,
  getCoverArtExtension,
} from "./coverArtImage.js"
import { findLocalCoverArt } from "./findLocalCoverArt.js"

export type SaveCoverArtFileResult = {
  coverArtFilePath: string | null
  isWritten: boolean
  reason: "already-present" | "dry-run" | "written"
}

// Picard saves the art beside the files as `cover.<ext>` and **never
// overwrites** an existing file. That rule is what makes this safe to run
// across a whole library: a folder where somebody already chose a cover keeps
// the one they chose, and this only ever fills a gap.
//
// `LOCAL_COVER_ART_PATTERN` decides what counts as already present, so a
// `Folder.jpg` left by Windows Media Player blocks the write too. That is
// deliberate — the folder is not missing art.
export const saveCoverArtFile = ({
  folderPath,
  image,
  isDryRun = false,
}: {
  folderPath: string
  image: CoverArtImage
  isDryRun?: boolean
}) =>
  findLocalCoverArt(folderPath).then(
    (
      existingCoverArtPath,
    ): Promise<SaveCoverArtFileResult> =>
      existingCoverArtPath === null
        ? ((extension: string | null) =>
            extension === null
              ? Promise.reject(
                  new Error(
                    `Cover art has an unsupported image type "${image.mimeType}", so no filename can be chosen for "${folderPath}".`,
                  ),
                )
              : ((coverArtFilePath: string) =>
                  isDryRun
                    ? Promise.resolve({
                        coverArtFilePath,
                        isWritten: false,
                        reason: "dry-run" as const,
                      })
                    : writeFile(
                        coverArtFilePath,
                        image.bytes,
                      ).then(() => ({
                        coverArtFilePath,
                        isWritten: true,
                        reason: "written" as const,
                      })))(
                  join(
                    folderPath,
                    `${COVER_ART_FILENAME}${extension}`,
                  ),
                ))(getCoverArtExtension(image.mimeType))
        : Promise.resolve({
            coverArtFilePath: existingCoverArtPath,
            isWritten: false,
            reason: "already-present" as const,
          }),
  )
