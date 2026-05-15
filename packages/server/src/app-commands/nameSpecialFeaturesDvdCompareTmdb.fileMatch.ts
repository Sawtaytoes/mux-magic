import type { FileInfo } from "@mux-magic/tools"
import type { Cut } from "../tools/parseSpecialFeatures.js"

// Per-file match outcome. The post-processor walks the buffered list of
// these and assigns final renamedFilenames, including the (1)/(2) prefix
// fallback for unmatched files when no cut matched anything. Each match
// carries the file's computed timecode so the post-processor's
// main-feature fallback can apply a minimum-duration filter (image
// galleries and other short DVDCompare-unlisted extras shouldn't be
// renamed as the movie just because they didn't match anything).
export type FileMatch =
  | {
      fileInfo: FileInfo
      timecode: string
      kind: "cut"
      cut: Cut
    }
  | {
      fileInfo: FileInfo
      timecode: string
      kind: "extra"
      renamedFilename: string
    }
  | {
      fileInfo: FileInfo
      timecode: string
      kind: "unmatched"
    }
