import { describe, expect, test } from "vitest"
import { LOW_CONFIDENCE_THRESHOLD } from "../app-commands/nameSpecialFeaturesDvdCompareTmdb.rankCandidates.js"
import {
  CLUSTER_LOOKUP_THRESHOLD,
  DEFAULT_PREFERRED_COUNTRIES,
  DEFAULT_PREFERRED_FORMATS,
  DEFAULT_RELEASE_TYPE_SCORE,
  DEFAULT_RELEASE_TYPE_SCORES,
  FILE_LOOKUP_THRESHOLD,
  IGNORED_TRACK_DURATION_DIFFERENCE_MILLISECONDS,
  type ReleaseCandidate,
  type ReleaseCandidateFile,
  rankReleaseCandidates,
  scoreDurationMatch,
  scorePreferenceRank,
  scoreTextSimilarity,
  scoreTrackCountMatch,
  TRACK_MATCHING_THRESHOLD,
} from "./rankReleaseCandidates.js"

const createCandidate = ({
  country,
  formats,
  releaseId,
  title = "Kind of Blue",
  trackLengthsMilliseconds = [545_000, 586_000],
}: {
  country: string
  formats: string[]
  releaseId: string
  title?: string
  trackLengthsMilliseconds?: number[]
}): ReleaseCandidate => ({
  artistCredit: [{ name: "Miles Davis" }],
  country,
  formats,
  media: [
    {
      discNumber: 1,
      tracks: trackLengthsMilliseconds.map(
        (lengthMilliseconds, trackIndex) => ({
          lengthMilliseconds,
          position: trackIndex + 1,
          title: `Track ${trackIndex + 1}`,
        }),
      ),
    },
  ],
  primaryType: "Album",
  releaseId,
  secondaryTypes: [],
  title,
  trackCount: trackLengthsMilliseconds.length,
})

const files: ReleaseCandidateFile[] = [
  {
    album: "Kind of Blue",
    albumArtist: "Miles Davis",
    durationSeconds: 545,
    title: "So What",
    trackNumber: 1,
  },
  {
    album: "Kind of Blue",
    albumArtist: "Miles Davis",
    durationSeconds: 586,
    title: "Freddie Freeloader",
    trackNumber: 2,
  },
]

describe("Picard's three matching thresholds", () => {
  test("are 0.7, 0.7 and 0.4", () => {
    expect(FILE_LOOKUP_THRESHOLD).toBe(0.7)
    expect(CLUSTER_LOOKUP_THRESHOLD).toBe(0.7)
    expect(TRACK_MATCHING_THRESHOLD).toBe(0.4)
  })

  test("are not the NSF scorer's 0.6, which must never be reused here", () => {
    expect(LOW_CONFIDENCE_THRESHOLD).toBe(0.6)
    expect(FILE_LOOKUP_THRESHOLD).not.toBe(
      LOW_CONFIDENCE_THRESHOLD,
    )
    expect(CLUSTER_LOOKUP_THRESHOLD).not.toBe(
      LOW_CONFIDENCE_THRESHOLD,
    )
    expect(TRACK_MATCHING_THRESHOLD).not.toBe(
      LOW_CONFIDENCE_THRESHOLD,
    )
  })
})

describe("the release-picking defaults", () => {
  test("prefer US then JP, in that order", () => {
    expect(DEFAULT_PREFERRED_COUNTRIES).toEqual([
      "US",
      "JP",
    ])
  })

  test("prefer Digital Media then CD, in that order", () => {
    expect(DEFAULT_PREFERRED_FORMATS).toEqual([
      "Digital Media",
      "CD",
    ])
  })

  test("weight every release type at 0.5, with no preference for album", () => {
    expect(DEFAULT_RELEASE_TYPE_SCORE).toBe(0.5)
    expect(
      Object.values(DEFAULT_RELEASE_TYPE_SCORES),
    ).toEqual(
      Object.values(DEFAULT_RELEASE_TYPE_SCORES).map(
        () => 0.5,
      ),
    )
    expect(DEFAULT_RELEASE_TYPE_SCORES.album).toBe(
      DEFAULT_RELEASE_TYPE_SCORES.soundtrack,
    )
    expect(DEFAULT_RELEASE_TYPE_SCORES.album).toBe(
      DEFAULT_RELEASE_TYPE_SCORES.compilation,
    )
  })
})

describe(scoreDurationMatch.name, () => {
  test("ignores a difference under two seconds entirely", () => {
    expect(
      IGNORED_TRACK_DURATION_DIFFERENCE_MILLISECONDS,
    ).toBe(2_000)
    expect(
      scoreDurationMatch({
        candidateLengthMilliseconds: 200_000,
        fileDurationSeconds: 200,
      }),
    ).toBe(1)
    expect(
      scoreDurationMatch({
        candidateLengthMilliseconds: 201_999,
        fileDurationSeconds: 200,
      }),
    ).toBe(1)
  })

  test("starts counting the difference at exactly two seconds", () => {
    // The decay is continuous, so the penalty at exactly 2.000 s is still
    // zero. One millisecond past the window is where the score first drops.
    expect(
      scoreDurationMatch({
        candidateLengthMilliseconds: 202_000,
        fileDurationSeconds: 200,
      }),
    ).toBe(1)
    expect(
      scoreDurationMatch({
        candidateLengthMilliseconds: 202_001,
        fileDurationSeconds: 200,
      }),
    ).toBeLessThan(1)
    expect(
      scoreDurationMatch({
        candidateLengthMilliseconds: 205_000,
        fileDurationSeconds: 200,
      }),
    ).toBeCloseTo(0.9)
  })

  test("falls to zero once the difference passes the decay span", () => {
    expect(
      scoreDurationMatch({
        candidateLengthMilliseconds: 300_000,
        fileDurationSeconds: 200,
      }),
    ).toBe(0)
  })

  test("is not-a-number when either side has no duration", () => {
    expect(
      scoreDurationMatch({
        candidateLengthMilliseconds: null,
        fileDurationSeconds: 200,
      }),
    ).toBeNaN()
    expect(
      scoreDurationMatch({
        candidateLengthMilliseconds: 200_000,
        fileDurationSeconds: undefined,
      }),
    ).toBeNaN()
  })
})

describe(scoreTrackCountMatch.name, () => {
  test("scores an exact track-count match at 1", () => {
    expect(
      scoreTrackCountMatch({
        candidateTrackCount: 12,
        fileCount: 12,
      }),
    ).toBe(1)
  })

  test("penalises a candidate with a different track count", () => {
    expect(
      scoreTrackCountMatch({
        candidateTrackCount: 14,
        fileCount: 12,
      }),
    ).toBeCloseTo(1 - 2 / 12)
  })
})

describe(scoreTextSimilarity.name, () => {
  test("scores identical text at 1 and unrelated text at 0", () => {
    expect(
      scoreTextSimilarity({
        leftText: "Kind of Blue",
        rightText: "kind of blue",
      }),
    ).toBe(1)
    expect(
      scoreTextSimilarity({
        leftText: "Kind of Blue",
        rightText: "Abbey Road",
      }),
    ).toBe(0)
  })

  test("is not-a-number when either side is empty", () => {
    expect(
      scoreTextSimilarity({
        leftText: "",
        rightText: "Kind of Blue",
      }),
    ).toBeNaN()
  })
})

describe(scorePreferenceRank.name, () => {
  test("ranks the first preference above the second and an absent value at zero", () => {
    expect(
      scorePreferenceRank({
        preferences: DEFAULT_PREFERRED_COUNTRIES,
        values: ["US"],
      }),
    ).toBe(1)
    expect(
      scorePreferenceRank({
        preferences: DEFAULT_PREFERRED_COUNTRIES,
        values: ["JP"],
      }),
    ).toBe(0.5)
    expect(
      scorePreferenceRank({
        preferences: DEFAULT_PREFERRED_COUNTRIES,
        values: ["GB"],
      }),
    ).toBe(0)
  })
})

describe(rankReleaseCandidates.name, () => {
  test("sorts the best match first", () => {
    const ranked = rankReleaseCandidates({
      candidates: [
        createCandidate({
          country: "GB",
          formats: ["Vinyl"],
          releaseId: "wrong-album",
          title: "Bitches Brew",
          trackLengthsMilliseconds: [
            100_000, 200_000, 300_000,
          ],
        }),
        createCandidate({
          country: "US",
          formats: ["CD"],
          releaseId: "right-album",
        }),
      ],
      files,
    })
    expect(ranked[0].candidate.releaseId).toBe(
      "right-album",
    )
    expect(ranked[0].matchConfidence).toBe(1)
    expect(ranked[0].isAboveClusterLookupThreshold).toBe(
      true,
    )
  })

  test("outranks a European pressing with a Japanese one for the same release group", () => {
    const ranked = rankReleaseCandidates({
      candidates: [
        createCandidate({
          country: "GB",
          formats: ["CD"],
          releaseId: "european",
        }),
        createCandidate({
          country: "JP",
          formats: ["CD"],
          releaseId: "japanese",
        }),
      ],
      files,
    })
    expect(ranked[0].candidate.releaseId).toBe("japanese")
  })

  test("keeps the non-preferred country in the results — the preference ranks, it does not filter", () => {
    const ranked = rankReleaseCandidates({
      candidates: [
        createCandidate({
          country: "GB",
          formats: ["Vinyl"],
          releaseId: "european",
        }),
        createCandidate({
          country: "US",
          formats: ["Digital Media"],
          releaseId: "american",
        }),
      ],
      files,
    })
    expect(ranked).toHaveLength(2)
    expect(
      ranked.map((scored) => scored.candidate.releaseId),
    ).toEqual(["american", "european"])
    expect(ranked[1].matchConfidence).toBe(1)
  })

  test("prefers Digital Media over CD when the country is the same", () => {
    const ranked = rankReleaseCandidates({
      candidates: [
        createCandidate({
          country: "US",
          formats: ["CD"],
          releaseId: "compact-disc",
        }),
        createCandidate({
          country: "US",
          formats: ["Digital Media"],
          releaseId: "digital",
        }),
      ],
      files,
    })
    expect(ranked[0].candidate.releaseId).toBe("digital")
  })

  test("does not prefer an album over a soundtrack", () => {
    const ranked = rankReleaseCandidates({
      candidates: [
        {
          ...createCandidate({
            country: "US",
            formats: ["CD"],
            releaseId: "soundtrack",
          }),
          primaryType: "Soundtrack",
        },
        createCandidate({
          country: "US",
          formats: ["CD"],
          releaseId: "album",
        }),
      ],
      files,
    })
    expect(ranked[0].releaseTypeScore).toBe(
      ranked[1].releaseTypeScore,
    )
    expect(ranked[0].score).toBe(ranked[1].score)
  })

  test("a track whose duration is 1.5 seconds off still scores a perfect match", () => {
    const ranked = rankReleaseCandidates({
      candidates: [
        createCandidate({
          country: "US",
          formats: ["CD"],
          releaseId: "close-enough",
          trackLengthsMilliseconds: [546_500, 584_500],
        }),
      ],
      files,
    })
    expect(ranked[0].durationScore).toBe(1)
    expect(ranked[0].matchConfidence).toBe(1)
  })

  test("still ranks when the files carry no tags at all, using the components it does have", () => {
    const ranked = rankReleaseCandidates({
      candidates: [
        createCandidate({
          country: "US",
          formats: ["CD"],
          releaseId: "two-track",
        }),
        createCandidate({
          country: "US",
          formats: ["CD"],
          releaseId: "nine-track",
          trackLengthsMilliseconds: [
            1, 2, 3, 4, 5, 6, 7, 8, 9,
          ],
        }),
      ],
      files: [{}, {}],
    })
    expect(ranked[0].candidate.releaseId).toBe("two-track")
    expect(ranked[0].titleScore).toBeNaN()
    expect(ranked[0].durationScore).toBeNaN()
    expect(ranked[0].matchConfidence).toBe(1)
  })

  test("marks a weak match as below the cluster lookup threshold", () => {
    const ranked = rankReleaseCandidates({
      candidates: [
        createCandidate({
          country: "GB",
          formats: ["Vinyl"],
          releaseId: "wrong",
          title: "Something Else Entirely",
          trackLengthsMilliseconds: [10_000, 900_000],
        }),
      ],
      files,
    })
    expect(ranked[0].matchConfidence).toBeLessThan(
      CLUSTER_LOOKUP_THRESHOLD,
    )
    expect(ranked[0].isAboveClusterLookupThreshold).toBe(
      false,
    )
  })

  test("returns an empty list when there are no candidates", () => {
    expect(
      rankReleaseCandidates({ candidates: [], files }),
    ).toEqual([])
  })
})
