import { describe, expect, test } from "vitest"

import {
  applyOrderBonus,
  combineScores,
  DURATION_PROXIMITY_TOLERANCE_SECONDS,
  DURATION_WEIGHT,
  FILENAME_ONLY_SCORE_FACTOR,
  ORDER_BONUS,
  parseTimecodeToSeconds,
  rankCandidatesForFile,
  scoreDurationProximity,
  scoreFilenameOverlap,
} from "./nameSpecialFeaturesDvdCompareTmdb.rankCandidates.js"

describe(parseTimecodeToSeconds.name, () => {
  test("parses HH:MM:SS into total seconds", () => {
    expect(parseTimecodeToSeconds("1:30:45")).toBe(5445)
  })

  test("parses MM:SS into total seconds", () => {
    expect(parseTimecodeToSeconds("12:34")).toBe(754)
  })

  test("parses a bare seconds value", () => {
    expect(parseTimecodeToSeconds("45")).toBe(45)
  })

  test("returns NaN for empty / non-string input", () => {
    expect(parseTimecodeToSeconds("")).toBeNaN()
    expect(parseTimecodeToSeconds(undefined)).toBeNaN()
    expect(parseTimecodeToSeconds(null)).toBeNaN()
  })

  test("returns NaN for unparseable garbage", () => {
    expect(parseTimecodeToSeconds("foo:bar")).toBeNaN()
  })
})

describe(scoreFilenameOverlap.name, () => {
  test("returns 1 when every candidate word appears in the file stem", () => {
    expect(
      scoreFilenameOverlap({
        candidateName: "Image Gallery",
        filename: "image-gallery-extra.mkv",
      }),
    ).toBe(1)
  })

  test("returns 0 when no candidate word appears in the stem", () => {
    expect(
      scoreFilenameOverlap({
        candidateName: "Trailer",
        filename: "MOVIE_t23.mkv",
      }),
    ).toBe(0)
  })

  test("scales by candidate-word count for partial matches", () => {
    expect(
      scoreFilenameOverlap({
        candidateName: "Behind Scenes",
        filename: "scenes-only.mkv",
      }),
    ).toBe(0.5)
  })

  test("returns 0 for an empty candidate name", () => {
    expect(
      scoreFilenameOverlap({
        candidateName: "",
        filename: "anything.mkv",
      }),
    ).toBe(0)
  })
})

describe(scoreDurationProximity.name, () => {
  test("returns 1 for an exact-match duration", () => {
    expect(
      scoreDurationProximity({
        candidateTimecode: "1:30:00",
        fileDurationSeconds: 5400,
      }),
    ).toBe(1)
  })

  test("returns NaN when the candidate timecode is missing", () => {
    expect(
      scoreDurationProximity({
        candidateTimecode: undefined,
        fileDurationSeconds: 5400,
      }),
    ).toBeNaN()
  })

  test("returns NaN when the file duration is null", () => {
    expect(
      scoreDurationProximity({
        candidateTimecode: "1:30:00",
        fileDurationSeconds: null,
      }),
    ).toBeNaN()
  })

  test("returns 0 once the delta exceeds the tolerance window", () => {
    expect(
      scoreDurationProximity({
        candidateTimecode: "1:30:00",
        fileDurationSeconds: 5520,
      }),
    ).toBe(0)
  })

  test("scales linearly within the tolerance window", () => {
    const score = scoreDurationProximity({
      candidateTimecode: "1:30:00",
      fileDurationSeconds: 5430,
    })
    expect(score).toBeCloseTo(
      1 - 30 / DURATION_PROXIMITY_TOLERANCE_SECONDS,
      5,
    )
  })
})

describe(combineScores.name, () => {
  test("blends both signals with the duration weight when both are available", () => {
    const combined = combineScores({
      durationScore: 1,
      filenameScore: 0,
    })
    expect(combined).toBeCloseTo(DURATION_WEIGHT, 5)
  })

  test("returns the duration score alone when filename info is missing", () => {
    expect(
      combineScores({
        durationScore: 0.8,
        filenameScore: NaN,
      }),
    ).toBeCloseTo(0.8, 5)
  })

  test("penalizes filename-only matches by FILENAME_ONLY_SCORE_FACTOR", () => {
    expect(
      combineScores({
        durationScore: NaN,
        filenameScore: 1,
      }),
    ).toBeCloseTo(FILENAME_ONLY_SCORE_FACTOR, 5)
  })

  test("returns 0 when both signals are unavailable", () => {
    expect(
      combineScores({
        durationScore: NaN,
        filenameScore: NaN,
      }),
    ).toBe(0)
  })
})

describe(rankCandidatesForFile.name, () => {
  test("ranks candidates with strong duration proximity ahead of filename-only matches", () => {
    const result = rankCandidatesForFile({
      fileDurationSeconds: 5400,
      filename: "BONUS_1.mkv",
      candidates: [
        { name: "Theatrical Cut", timecode: "1:30:00" },
        { name: "Image Gallery", timecode: undefined },
      ],
    })
    expect(result[0].candidate.name).toBe("Theatrical Cut")
    expect(result[0].confidence).toBeGreaterThan(
      result[1].confidence,
    )
  })

  test("falls back to filename-only when no candidate has a timecode", () => {
    const result = rankCandidatesForFile({
      fileDurationSeconds: 5400,
      filename: "image-gallery-disc1.mkv",
      candidates: [
        { name: "Trailer", timecode: undefined },
        { name: "Image Gallery", timecode: undefined },
      ],
    })
    expect(result[0].candidate.name).toBe("Image Gallery")
  })

  test("returns the candidates in original order when nothing scores above zero", () => {
    const result = rankCandidatesForFile({
      fileDurationSeconds: null,
      filename: "abc.mkv",
      candidates: [
        { name: "Xyz", timecode: undefined },
        { name: "Pqr", timecode: undefined },
      ],
    })
    expect(
      result.map((entry) => entry.candidate.name),
    ).toEqual(["Xyz", "Pqr"])
  })
})

describe(applyOrderBonus.name, () => {
  test("adds ORDER_BONUS to the candidate at the matching index and re-sorts", () => {
    const ranked = rankCandidatesForFile({
      fileDurationSeconds: null,
      filename: "title3.mkv",
      candidates: [
        { name: "Alpha", timecode: undefined },
        { name: "Beta", timecode: undefined },
        { name: "Gamma", timecode: undefined },
      ],
    })
    // Every score is 0 here — pure order tie-break case.
    const result = applyOrderBonus({
      rankedCandidates: ranked,
      fileIndex: 1,
      dvdCompareOrder: ["Alpha", "Beta", "Gamma"],
    })
    expect(result[0].candidate.name).toBe("Beta")
    expect(result[0].confidence).toBeCloseTo(
      ORDER_BONUS,
      5,
    )
  })

  test("never overrides a strong duration signal", () => {
    const ranked = rankCandidatesForFile({
      fileDurationSeconds: 5400,
      filename: "title2.mkv",
      candidates: [
        // Strong duration match — confidence ~0.7.
        { name: "Theatrical", timecode: "1:30:00" },
        // No duration, no filename overlap — confidence 0.
        { name: "Gallery", timecode: undefined },
      ],
    })
    const result = applyOrderBonus({
      rankedCandidates: ranked,
      fileIndex: 1,
      dvdCompareOrder: ["Theatrical", "Gallery"],
    })
    expect(result[0].candidate.name).toBe("Theatrical")
  })

  test("returns input unchanged when fileIndex is out of range", () => {
    const ranked = rankCandidatesForFile({
      fileDurationSeconds: null,
      filename: "x.mkv",
      candidates: [
        { name: "Alpha", timecode: undefined },
        { name: "Beta", timecode: undefined },
      ],
    })
    const result = applyOrderBonus({
      rankedCandidates: ranked,
      fileIndex: 99,
      dvdCompareOrder: ["Alpha", "Beta"],
    })
    expect(result).toEqual(ranked)
  })

  test("only nudges the matching candidate, not all candidates", () => {
    const ranked = rankCandidatesForFile({
      fileDurationSeconds: null,
      filename: "x.mkv",
      candidates: [
        { name: "Alpha", timecode: undefined },
        { name: "Beta", timecode: undefined },
        { name: "Gamma", timecode: undefined },
      ],
    })
    const result = applyOrderBonus({
      rankedCandidates: ranked,
      fileIndex: 2,
      dvdCompareOrder: ["Alpha", "Beta", "Gamma"],
    })
    const gamma = result.find(
      (entry) => entry.candidate.name === "Gamma",
    )
    const alpha = result.find(
      (entry) => entry.candidate.name === "Alpha",
    )
    expect(gamma?.confidence).toBeCloseTo(ORDER_BONUS, 5)
    expect(alpha?.confidence).toBe(0)
  })
})
