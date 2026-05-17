import { describe, expect, test } from "vitest"

import {
  combineScores,
  DURATION_PROXIMITY_TOLERANCE_SECONDS,
  DURATION_WEIGHT,
  FILENAME_ONLY_SCORE_FACTOR,
  parseTimecodeToSeconds,
  rankCandidatesForFile,
  rankSuggestions,
  scoreDurationProximity,
  scoreFilenameOverlap,
} from "./smartMatchScoring"

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
    // 30s delta inside a 90s window → 1 - 30/90 ≈ 0.6666…
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
        // Filename overlap is zero; duration proximity is exact.
        { name: "Theatrical Cut", timecode: "1:30:00" },
        // Filename overlap zero; no timecode → 0 score.
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
    // All zero scores — `.toSorted()` (TimSort under the hood) is stable
    // in modern JS engines, so the input order is preserved.
    expect(
      result.map((entry) => entry.candidate.name),
    ).toEqual(["Xyz", "Pqr"])
  })
})

describe(rankSuggestions.name, () => {
  test("returns one entry per unrenamed file with its ranked candidates", () => {
    const result = rankSuggestions({
      candidates: [
        { name: "Theatrical", timecode: "1:30:00" },
        { name: "Trailer", timecode: "0:02:30" },
      ],
      unrenamedFiles: [
        {
          filename: "BONUS_1.mkv",
          durationSeconds: 5395,
        },
        {
          filename: "BONUS_2.mkv",
          durationSeconds: 151,
        },
      ],
    })
    expect(result).toHaveLength(2)
    expect(
      result[0].rankedCandidates[0].candidate.name,
    ).toBe("Theatrical")
    expect(
      result[1].rankedCandidates[0].candidate.name,
    ).toBe("Trailer")
  })

  test("works with no file durations (filename-fuzz fallback)", () => {
    const result = rankSuggestions({
      candidates: [
        { name: "Image Gallery", timecode: undefined },
        { name: "Trailer", timecode: undefined },
      ],
      unrenamedFiles: [
        {
          filename: "image-gallery.mkv",
          durationSeconds: null,
        },
      ],
    })
    expect(
      result[0].rankedCandidates[0].candidate.name,
    ).toBe("Image Gallery")
  })
})
