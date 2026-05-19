import { describe, expect, test } from "vitest"
import {
  type NsfRenamePair,
  type NsfSummaryRecord,
  mergeAppliedRenamesIntoNsfResults,
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
      candidates: ["Spotlight on Puss in Boots Featurette"],
    },
    {
      filename: "Shrek 2-SF_03_FarAwayIdol_t48",
      durationSeconds: 535,
      candidates: ["Far Far Away Idol"],
    },
    {
      filename: "Shrek 2-SF_04_MV_01_Accidentally_t49",
      durationSeconds: 188,
      candidates: [
        "Accidentally in Love Music Video by Counting Crows",
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
