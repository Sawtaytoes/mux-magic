import { describe, expect, test } from "vitest"
import {
  findNsfEditionPlan,
  isNsfEditionPlan,
  mergeAppliedRenamesIntoNsfResults,
  type NsfEditionPlanRecord,
  type NsfRenamePair,
  type NsfSummaryRecord,
} from "./findNsfResults"

const sampleRename: NsfRenamePair = {
  oldName: "Shrek 2-SF_02_t47",
  newName: "Secrets of Shrek 2 -featurette",
}

const sampleSummary: NsfSummaryRecord = {
  unrenamedFilenames: [
    "Shrek 2-SF_01_SpotlightPussInBoots_t46",
    "Shrek 2-SF_03_FarAwayIdol_t48",
    "Shrek 2-SF_04_MV_01_Accidentally_t49",
  ],
  possibleNames: [],
  unnamedFileCandidates: [
    {
      filename: "Shrek 2-SF_01_SpotlightPussInBoots_t46",
      durationSeconds: 643,
      rankedCandidates: [
        {
          candidate: {
            name: "Spotlight on Puss in Boots Featurette",
            timecode: undefined,
          },
          confidence: 0.6,
          durationScore: Number.NaN,
          filenameScore: 1,
        },
      ],
    },
    {
      filename: "Shrek 2-SF_03_FarAwayIdol_t48",
      durationSeconds: 535,
      rankedCandidates: [
        {
          candidate: {
            name: "Far Far Away Idol",
            timecode: undefined,
          },
          confidence: 0.4,
          durationScore: Number.NaN,
          filenameScore: 0,
        },
      ],
    },
    {
      filename: "Shrek 2-SF_04_MV_01_Accidentally_t49",
      durationSeconds: 188,
      rankedCandidates: [
        {
          candidate: {
            name: "Accidentally in Love Music Video by Counting Crows",
            timecode: undefined,
          },
          confidence: 0.3,
          durationScore: Number.NaN,
          filenameScore: 0,
        },
      ],
    },
  ],
}

describe(mergeAppliedRenamesIntoNsfResults.name, () => {
  test("no applied renames → returns inputs unchanged (referential equality not required)", () => {
    const result = mergeAppliedRenamesIntoNsfResults({
      summary: sampleSummary,
      renamePairs: [sampleRename],
      appliedRenames: [],
    })
    expect(result.summary).toBe(sampleSummary)
    expect(result.renamePairs).toEqual([sampleRename])
  })

  test("appends applied renames to the emerald rename-pairs list", () => {
    const applied: NsfRenamePair = {
      oldName: "Shrek 2-SF_01_SpotlightPussInBoots_t46",
      newName: "Spotlight on Puss in Boots Featurette",
    }
    const result = mergeAppliedRenamesIntoNsfResults({
      summary: sampleSummary,
      renamePairs: [sampleRename],
      appliedRenames: [applied],
    })
    expect(result.renamePairs).toEqual([
      sampleRename,
      applied,
    ])
  })

  test("strips the applied filename out of summary.unrenamedFilenames", () => {
    const applied: NsfRenamePair = {
      oldName: "Shrek 2-SF_01_SpotlightPussInBoots_t46",
      newName: "Spotlight on Puss in Boots Featurette",
    }
    const result = mergeAppliedRenamesIntoNsfResults({
      summary: sampleSummary,
      renamePairs: [],
      appliedRenames: [applied],
    })
    expect(
      result.summary?.unrenamedFilenames,
    ).not.toContain(
      "Shrek 2-SF_01_SpotlightPussInBoots_t46",
    )
    expect(result.summary?.unrenamedFilenames).toHaveLength(
      2,
    )
  })

  test("strips the applied filename out of summary.unnamedFileCandidates so re-opening Smart Match doesn't re-list it", () => {
    const applied: NsfRenamePair = {
      oldName: "Shrek 2-SF_03_FarAwayIdol_t48",
      newName: "Far Far Away Idol",
    }
    const result = mergeAppliedRenamesIntoNsfResults({
      summary: sampleSummary,
      renamePairs: [],
      appliedRenames: [applied],
    })
    const candidateFilenames =
      result.summary?.unnamedFileCandidates?.map(
        (entry) => entry.filename,
      )
    expect(candidateFilenames).not.toContain(
      "Shrek 2-SF_03_FarAwayIdol_t48",
    )
    expect(
      result.summary?.unnamedFileCandidates,
    ).toHaveLength(2)
  })

  test("handles multiple applied renames in a single pass", () => {
    const result = mergeAppliedRenamesIntoNsfResults({
      summary: sampleSummary,
      renamePairs: [],
      appliedRenames: [
        {
          oldName: "Shrek 2-SF_01_SpotlightPussInBoots_t46",
          newName: "Spotlight on Puss in Boots Featurette",
        },
        {
          oldName: "Shrek 2-SF_03_FarAwayIdol_t48",
          newName: "Far Far Away Idol",
        },
      ],
    })
    expect(result.renamePairs).toHaveLength(2)
    expect(result.summary?.unrenamedFilenames).toEqual([
      "Shrek 2-SF_04_MV_01_Accidentally_t49",
    ])
    expect(
      result.summary?.unnamedFileCandidates,
    ).toHaveLength(1)
  })

  test("summary === null still produces a merged rename-pairs list (covers the non-NSF / renames-only branch)", () => {
    const applied: NsfRenamePair = {
      oldName: "any",
      newName: "Any New Name",
    }
    const result = mergeAppliedRenamesIntoNsfResults({
      summary: null,
      renamePairs: [],
      appliedRenames: [applied],
    })
    expect(result.summary).toBeNull()
    expect(result.renamePairs).toEqual([applied])
  })
})

describe(isNsfEditionPlan.name, () => {
  const validPlan: NsfEditionPlanRecord = {
    isEditionPlan: true,
    moves: [
      {
        sourceFilename:
          "Dragon Lord (1982) {edition-Hong Kong Version}.mkv",
        destinationPath:
          "/Dragon Lord (1982)/Dragon Lord (1982) {edition-Hong Kong Version}/Dragon Lord (1982) {edition-Hong Kong Version}.mkv",
        editionName: "Hong Kong Version",
        isSibling: false,
      },
    ],
  }

  test("returns true for a valid edition plan record", () => {
    expect(isNsfEditionPlan(validPlan)).toBe(true)
  })

  test("returns false for a rename pair (different shape)", () => {
    const renamePair: NsfRenamePair = {
      oldName: "old.mkv",
      newName: "new.mkv",
    }
    expect(isNsfEditionPlan(renamePair)).toBe(false)
  })

  test("returns false for null", () => {
    expect(isNsfEditionPlan(null)).toBe(false)
  })

  test("returns false when isEditionPlan is missing", () => {
    expect(isNsfEditionPlan({ moves: [] })).toBe(false)
  })

  test("returns false when moves is not an array", () => {
    expect(
      isNsfEditionPlan({
        isEditionPlan: true,
        moves: "not-array",
      }),
    ).toBe(false)
  })

  test("returns true for a plan with empty moves array", () => {
    expect(
      isNsfEditionPlan({ isEditionPlan: true, moves: [] }),
    ).toBe(true)
  })
})

describe(findNsfEditionPlan.name, () => {
  test("finds the edition plan in a mixed results array", () => {
    const editionPlan: NsfEditionPlanRecord = {
      isEditionPlan: true,
      moves: [],
    }
    const results = [
      { oldName: "foo", newName: "bar" },
      editionPlan,
      {
        unrenamedFilenames: [],
        possibleNames: [],
      },
    ]
    expect(findNsfEditionPlan(results)).toBe(editionPlan)
  })

  test("returns null when no edition plan is present", () => {
    const results = [{ oldName: "foo", newName: "bar" }]
    expect(findNsfEditionPlan(results)).toBeNull()
  })

  test("returns null for undefined input", () => {
    expect(findNsfEditionPlan(undefined)).toBeNull()
  })
})
