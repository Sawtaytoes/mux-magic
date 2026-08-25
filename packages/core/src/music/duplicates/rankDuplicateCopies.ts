import { basename, extname } from "node:path"

import type { AudioFileInfo } from "../tags/audioTagFields.js"

// Which copy of a duplicate is the one to keep. The order is the owner's,
// settled while the library was deduplicated by hand:
//
//   "Prefer FLAC; higher bit depth/rate wins."
//   "Prefer keeping the lossless copy."
//
// ⚠️ This produces a RECOMMENDATION, never an action. `G:` has no Recycle
// Bin and a delete there is effectively permanent inside the hour, so the
// recommendation arrives pre-selected in a review table and a human
// confirms it. Nothing here deletes anything.

// FLAC, WAV, WavPack, AIFF and ALAC reconstruct the original samples. An
// MP3 next to any of them is redundant if you prefer lossless, and the
// owner does.
export const LOSSLESS_AUDIO_EXTENSIONS = [
  ".flac",
  ".wav",
  ".wv",
  ".aiff",
  ".aif",
  ".ape",
]

// A copy Windows made, not a release the owner chose. `Track (1).flac`
// and `Track - Copy.flac` both come from something copying a same-named
// file into a folder that already had one.
const COPY_SUFFIX_PATTERNS = [/\s\(\d+\)$/u, /\s-\sCopy$/iu]

export type DuplicateCopy = {
  filePath: string
  info: AudioFileInfo
}

export type RankedDuplicateCopy = {
  filePath: string
  info: AudioFileInfo
  isLossless: boolean
  isRecommendedKeep: boolean
  rankReasons: string[]
}

export const getIsLosslessExtension = (filePath: string) =>
  LOSSLESS_AUDIO_EXTENSIONS.includes(
    extname(filePath).toLowerCase(),
  )

export const getIsCopySuffixed = (filePath: string) =>
  COPY_SUFFIX_PATTERNS.some((pattern) =>
    pattern.test(basename(filePath, extname(filePath))),
  )

// Compared in order, first difference wins. Deliberately not a weighted
// sum: a weighted score lets a big lossy file outrank a small lossless
// one, which is the exact mistake the rule exists to prevent.
const RANK_DIMENSIONS: {
  describe: (copy: DuplicateCopy) => string
  name: string
  valueOf: (copy: DuplicateCopy) => number
}[] = [
  {
    describe: (copy) =>
      getIsLosslessExtension(copy.filePath)
        ? "lossless"
        : "lossy",
    name: "lossless",
    valueOf: (copy) =>
      getIsLosslessExtension(copy.filePath) ? 1 : 0,
  },
  {
    describe: (copy) => `${copy.info.bitDepth ?? "?"}-bit`,
    name: "bit depth",
    valueOf: (copy) => copy.info.bitDepth ?? 0,
  },
  {
    describe: (copy) => `${copy.info.sampleRate ?? "?"} Hz`,
    name: "sample rate",
    valueOf: (copy) => copy.info.sampleRate ?? 0,
  },
  {
    describe: (copy) => `${copy.info.bitRate ?? "?"} bps`,
    name: "bit rate",
    valueOf: (copy) => copy.info.bitRate ?? 0,
  },
  {
    describe: (copy) =>
      getIsCopySuffixed(copy.filePath)
        ? "a copy-suffixed name"
        : "an original name",
    name: "original name",
    valueOf: (copy) =>
      getIsCopySuffixed(copy.filePath) ? 0 : 1,
  },
  {
    describe: (copy) => `${copy.info.fileSizeBytes} bytes`,
    name: "file size",
    valueOf: (copy) => copy.info.fileSizeBytes,
  },
]

const compareCopies = (
  firstCopy: DuplicateCopy,
  secondCopy: DuplicateCopy,
) =>
  RANK_DIMENSIONS.reduce(
    (decided, dimension) =>
      decided === 0
        ? dimension.valueOf(secondCopy) -
          dimension.valueOf(firstCopy)
        : decided,
    0,
  ) ||
  // Last resort so the order never depends on directory-read order. A
  // dedup pass that recommends a different keeper each run is unusable.
  firstCopy.filePath.localeCompare(secondCopy.filePath)

// Why THIS copy won, in the words of the dimensions that decided it. The
// table shows these beside the row so a human can disagree on sight
// rather than trusting a bare "recommended".
const describeWinningReasons = ({
  keptCopy,
  otherCopies,
}: {
  keptCopy: DuplicateCopy
  otherCopies: DuplicateCopy[]
}) =>
  RANK_DIMENSIONS.filter((dimension) =>
    otherCopies.some(
      (otherCopy) =>
        dimension.valueOf(keptCopy) >
        dimension.valueOf(otherCopy),
    ),
  ).map(
    (dimension) =>
      `${dimension.name}: ${dimension.describe(keptCopy)}`,
  )

export const rankDuplicateCopies = (
  copies: DuplicateCopy[],
): RankedDuplicateCopy[] =>
  ((sorted: DuplicateCopy[]) =>
    sorted.map((copy, copyIndex) => ({
      filePath: copy.filePath,
      info: copy.info,
      isLossless: getIsLosslessExtension(copy.filePath),
      isRecommendedKeep: copyIndex === 0,
      rankReasons:
        copyIndex === 0
          ? describeWinningReasons({
              keptCopy: copy,
              otherCopies: sorted.slice(1),
            })
          : [],
    })))(copies.toSorted(compareCopies))
