import { describe, expect, test } from "vitest"

import type { AudioFileInfo } from "../tags/audioTagFields.js"
import {
  getIsCopySuffixed,
  getIsLosslessExtension,
  rankDuplicateCopies,
} from "./rankDuplicateCopies.js"

const buildInfo = (
  overrides: Partial<AudioFileInfo> = {},
): AudioFileInfo => ({
  fileSizeBytes: 1_000_000,
  filePath: "/library/track.flac",
  hasEmbeddedCoverArt: false,
  ...overrides,
})

describe(rankDuplicateCopies.name, () => {
  // The owner's rule, in his words: "Prefer FLAC; higher bit depth/rate
  // wins." Lossless comes FIRST, before every size or bit-rate signal.
  test("keeps the lossless copy even when the lossy one is bigger", () => {
    const ranked = rankDuplicateCopies([
      {
        filePath: "/library/track.mp3",
        info: buildInfo({
          bitRate: 320_000,
          fileSizeBytes: 9_000_000,
          filePath: "/library/track.mp3",
        }),
      },
      {
        filePath: "/library/track.flac",
        info: buildInfo({
          bitDepth: 16,
          fileSizeBytes: 1_000_000,
          sampleRate: 44_100,
        }),
      },
    ])

    expect(
      ranked.find((copy) => copy.isRecommendedKeep)
        ?.filePath,
    ).toBe("/library/track.flac")
  })

  test("higher bit depth wins between two lossless copies", () => {
    const ranked = rankDuplicateCopies([
      {
        filePath: "/library/16bit.flac",
        info: buildInfo({
          bitDepth: 16,
          filePath: "/library/16bit.flac",
          sampleRate: 44_100,
        }),
      },
      {
        filePath: "/library/24bit.flac",
        info: buildInfo({
          bitDepth: 24,
          filePath: "/library/24bit.flac",
          sampleRate: 44_100,
        }),
      },
    ])

    expect(ranked[0].filePath).toBe("/library/24bit.flac")
  })

  test("higher sample rate breaks a tie at equal bit depth", () => {
    const ranked = rankDuplicateCopies([
      {
        filePath: "/library/44k.flac",
        info: buildInfo({
          bitDepth: 24,
          filePath: "/library/44k.flac",
          sampleRate: 44_100,
        }),
      },
      {
        filePath: "/library/96k.flac",
        info: buildInfo({
          bitDepth: 24,
          filePath: "/library/96k.flac",
          sampleRate: 96_000,
        }),
      },
    ])

    expect(ranked[0].filePath).toBe("/library/96k.flac")
  })

  test("an original name beats a copy-suffixed one when nothing else differs", () => {
    const ranked = rankDuplicateCopies([
      {
        filePath: "/library/Track (1).flac",
        info: buildInfo({
          bitDepth: 16,
          filePath: "/library/Track (1).flac",
          sampleRate: 44_100,
        }),
      },
      {
        filePath: "/library/Track.flac",
        info: buildInfo({
          bitDepth: 16,
          filePath: "/library/Track.flac",
          sampleRate: 44_100,
        }),
      },
    ])

    expect(ranked[0].filePath).toBe("/library/Track.flac")
  })

  // A dedup pass that recommends a different keeper on each run is
  // unusable, and directory-read order is not stable.
  test("is deterministic when every dimension ties", () => {
    const copies = [
      {
        filePath: "/library/b.flac",
        info: buildInfo({
          bitDepth: 16,
          filePath: "/library/b.flac",
          sampleRate: 44_100,
        }),
      },
      {
        filePath: "/library/a.flac",
        info: buildInfo({
          bitDepth: 16,
          filePath: "/library/a.flac",
          sampleRate: 44_100,
        }),
      },
    ]

    expect(rankDuplicateCopies(copies)[0].filePath).toBe(
      "/library/a.flac",
    )
    expect(
      rankDuplicateCopies(copies.toReversed())[0].filePath,
    ).toBe("/library/a.flac")
  })

  test("says why the kept copy won, so a human can disagree on sight", () => {
    const ranked = rankDuplicateCopies([
      {
        filePath: "/library/track.mp3",
        info: buildInfo({
          filePath: "/library/track.mp3",
        }),
      },
      {
        filePath: "/library/track.flac",
        info: buildInfo({
          bitDepth: 24,
          sampleRate: 96_000,
        }),
      },
    ])

    expect(ranked[0].rankReasons).toContain(
      "lossless: lossless",
    )
    expect(ranked[0].rankReasons).toContain(
      "bit depth: 24-bit",
    )
  })

  test("only the kept copy carries reasons", () => {
    const ranked = rankDuplicateCopies([
      {
        filePath: "/library/track.mp3",
        info: buildInfo({
          filePath: "/library/track.mp3",
        }),
      },
      {
        filePath: "/library/track.flac",
        info: buildInfo({ bitDepth: 16 }),
      },
    ])

    expect(
      ranked.filter((copy) => copy.isRecommendedKeep),
    ).toHaveLength(1)
    expect(ranked[1].rankReasons).toEqual([])
  })
})

describe(getIsLosslessExtension.name, () => {
  test.each([
    [".flac", true],
    [".wav", true],
    [".wv", true],
    [".aiff", true],
    [".mp3", false],
    [".m4a", false],
    [".opus", false],
  ])("%s is lossless: %s", (extension, isLossless) => {
    expect(
      getIsLosslessExtension(`/library/track${extension}`),
    ).toBe(isLossless)
  })
})

describe(getIsCopySuffixed.name, () => {
  test.each([
    ["/library/Track (1).flac", true],
    ["/library/Track (12).flac", true],
    ["/library/Track - Copy.flac", true],
    ["/library/Track.flac", false],
    // A real title, not a copy marker. Stripping this would pair two
    // genuinely different recordings.
    ["/library/Track (Live).flac", false],
  ])("%s is copy-suffixed: %s", (filePath, isCopy) => {
    expect(getIsCopySuffixed(filePath)).toBe(isCopy)
  })
})
