import { readdir } from "node:fs/promises"
import { join } from "node:path"

import { LOCAL_COVER_ART_PATTERN } from "../../tools/coverArtArchive.js"

// The fourth provider in `COVER_ART_PROVIDER_ORDER`: art already sitting in
// the album folder. Picard matches it with `local_files_pattern`, which is
// `LOCAL_COVER_ART_PATTERN` here.
//
// `cover.*` wins over `folder.*` wins over `albumart*.*` because that is the
// order the pattern lists them, and a folder that has both is a folder where
// somebody wrote `cover.jpg` on purpose next to whatever Windows Media Player
// left behind. Within one prefix the shortest name wins, so `cover.jpg` beats
// `cover (1).jpg`.
const PREFIX_ORDER = ["cover", "folder", "albumart"]

const getPrefixRank = (filename: string) =>
  PREFIX_ORDER.findIndex((prefix) =>
    filename.toLowerCase().startsWith(prefix),
  )

export const selectLocalCoverArtFilename = (
  filenames: string[],
) =>
  filenames
    .filter((filename) =>
      LOCAL_COVER_ART_PATTERN.test(filename),
    )
    .toSorted(
      (firstFilename, secondFilename) =>
        getPrefixRank(firstFilename) -
          getPrefixRank(secondFilename) ||
        firstFilename.length - secondFilename.length ||
        firstFilename.localeCompare(secondFilename),
    )
    .at(0) ?? null

export const findLocalCoverArt = (folderPath: string) =>
  readdir(folderPath, { withFileTypes: true })
    .then((entries) =>
      selectLocalCoverArtFilename(
        entries
          .filter((entry) => entry.isFile())
          .map((entry) => entry.name),
      ),
    )
    .then((filename) =>
      filename === null ? null : join(folderPath, filename),
    )
    .catch(() => null)
