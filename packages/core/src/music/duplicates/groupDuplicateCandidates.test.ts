import { describe, expect, test } from "vitest"

import type { AudioTags } from "../tags/audioTagFields.js"
import {
  buildTagGroupKey,
  type DuplicateCandidate,
  findCopySuffixedSiblings,
  groupDuplicateCandidates,
} from "./groupDuplicateCandidates.js"

const buildCandidate = ({
  audioContentHash = null,
  filePath,
  fingerprint = null,
  tags = {},
}: {
  audioContentHash?: string | null
  filePath: string
  fingerprint?: string | null
  tags?: AudioTags
}): DuplicateCandidate => ({
  audioContentHash,
  filePath,
  fingerprint,
  tags,
})

const albumTags = (
  overrides: Partial<AudioTags> = {},
): AudioTags => ({
  album: "Happy Nation",
  albumArtist: "Ace of Base",
  discNumber: 1,
  title: "All That She Wants",
  trackNumber: 1,
  ...overrides,
})

describe(groupDuplicateCandidates.name, () => {
  test("groups two files with identical decoded audio", () => {
    expect(
      groupDuplicateCandidates({
        candidates: [
          buildCandidate({
            audioContentHash: "abc",
            filePath: "/library/a.flac",
          }),
          buildCandidate({
            audioContentHash: "abc",
            filePath: "/library/b.flac",
          }),
        ],
      }),
    ).toEqual([
      {
        filePaths: ["/library/a.flac", "/library/b.flac"],
        groupKey: "abc",
        matchReason: "audio",
      },
    ])
  })

  test("leaves different audio alone", () => {
    expect(
      groupDuplicateCandidates({
        candidates: [
          buildCandidate({
            audioContentHash: "abc",
            filePath: "/library/a.flac",
          }),
          buildCandidate({
            audioContentHash: "def",
            filePath: "/library/b.flac",
          }),
        ],
      }),
    ).toEqual([])
  })

  // A FLAC and an MP3 of the same recording can never hash-match, because
  // the encoders produce different samples. The fingerprint is the only
  // thing that pairs them.
  test("pairs a FLAC with an MP3 by fingerprint, which no hash can", () => {
    const groups = groupDuplicateCandidates({
      candidates: [
        buildCandidate({
          audioContentHash: "flac-hash",
          filePath: "/library/track.flac",
          fingerprint: "AQAD",
        }),
        buildCandidate({
          audioContentHash: "mp3-hash",
          filePath: "/library/track.mp3",
          fingerprint: "AQAD",
        }),
      ],
    })

    expect(groups).toHaveLength(1)
    expect(groups[0].matchReason).toBe("fingerprint")
  })

  test("falls back to tags when nothing has been decoded", () => {
    const groups = groupDuplicateCandidates({
      candidates: [
        buildCandidate({
          filePath: "/inbox/01.flac",
          tags: albumTags(),
        }),
        buildCandidate({
          filePath: "/library/01.flac",
          tags: albumTags(),
        }),
      ],
    })

    expect(groups).toHaveLength(1)
    expect(groups[0].matchReason).toBe("tags")
  })

  // Without this, every untagged file in a folder groups with every
  // other one and the table is nothing but noise.
  test("an empty tag set is an absence, not a match", () => {
    expect(
      groupDuplicateCandidates({
        candidates: [
          buildCandidate({ filePath: "/inbox/01.mp3" }),
          buildCandidate({ filePath: "/inbox/02.mp3" }),
        ],
      }),
    ).toEqual([])
  })

  // Files with identical audio are also tag-identical. Reporting them
  // twice would let a human confirm the same removal from two rows.
  test("a file belongs to exactly one group, the strongest that claimed it", () => {
    const groups = groupDuplicateCandidates({
      candidates: [
        buildCandidate({
          audioContentHash: "abc",
          filePath: "/library/a.flac",
          tags: albumTags(),
        }),
        buildCandidate({
          audioContentHash: "abc",
          filePath: "/library/b.flac",
          tags: albumTags(),
        }),
      ],
    })

    expect(groups).toHaveLength(1)
    expect(groups[0].matchReason).toBe("audio")
  })

  test("a lone file is never a group", () => {
    expect(
      groupDuplicateCandidates({
        candidates: [
          buildCandidate({
            audioContentHash: "abc",
            filePath: "/library/a.flac",
          }),
        ],
      }),
    ).toEqual([])
  })

  test("different track numbers on the same album are not duplicates", () => {
    expect(
      groupDuplicateCandidates({
        candidates: [
          buildCandidate({
            filePath: "/inbox/01.flac",
            tags: albumTags({
              title: "All That She Wants",
              trackNumber: 1,
            }),
          }),
          buildCandidate({
            filePath: "/inbox/02.flac",
            tags: albumTags({
              title: "Wheel of Fortune",
              trackNumber: 2,
            }),
          }),
        ],
      }),
    ).toEqual([])
  })
})

describe(buildTagGroupKey.name, () => {
  test("ignores case and surrounding whitespace", () => {
    expect(
      buildTagGroupKey(
        albumTags({ album: "  HAPPY NATION " }),
      ),
    ).toBe(buildTagGroupKey(albumTags()))
  })

  test("falls back to the track artist when there is no album artist", () => {
    expect(
      buildTagGroupKey(
        albumTags({
          albumArtist: undefined,
          artist: "Ace of Base",
        }),
      ),
    ).toBe(buildTagGroupKey(albumTags()))
  })
})

describe(findCopySuffixedSiblings.name, () => {
  test("pairs a copy-suffixed file with its base", () => {
    expect(
      findCopySuffixedSiblings([
        "/library/Track.flac",
        "/library/Track (1).flac",
      ]),
    ).toEqual([
      {
        basePath: "/library/Track.flac",
        copyPath: "/library/Track (1).flac",
      },
    ])
  })

  test("reports nothing for an orphan copy with no base", () => {
    expect(
      findCopySuffixedSiblings(["/library/Track (1).flac"]),
    ).toEqual([])
  })

  test("does not pair across folders", () => {
    expect(
      findCopySuffixedSiblings([
        "/library/albumA/Track.flac",
        "/library/albumB/Track (1).flac",
      ]),
    ).toEqual([])
  })
})
