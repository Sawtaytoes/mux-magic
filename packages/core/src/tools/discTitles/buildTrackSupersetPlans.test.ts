import { join } from "node:path"

import { describe, expect, test, vi } from "vitest"

import { parseTitleGraph } from "../makemkv/parseTitleGraph.js"
import { buildDiscAnalysis } from "./buildDiscAnalysis.js"
import { buildTrackSupersetPlans } from "./buildTrackSupersetPlans.js"

const realFs =
  await vi.importActual<typeof import("node:fs")>("node:fs")

const loadAnalysis = (fixtureName: string) =>
  buildDiscAnalysis({
    disabledRuleNames: [],
    graph: parseTitleGraph(
      realFs.readFileSync(
        join(
          import.meta.dirname,
          "..",
          "makemkv",
          "__fixtures__",
          fixtureName,
        ),
        "utf8",
      ),
    ),
  })

describe(buildTrackSupersetPlans.name, () => {
  test("plans Soylent Green as one rip of the raw stream plus chapters from the playlist", () => {
    // 00425.m2ts holds LPCM 1.0 + all three DD 2.0; the three playlists
    // each hold a subset. Ripping it once replaces three 65.5 GB rips.
    const analysis = loadAnalysis(
      "soylent-green-uhd.robot.log",
    )
    const plans = buildTrackSupersetPlans({ analysis })

    expect(plans).toHaveLength(1)

    const [plan] = plans
    const supersetTitle = analysis.titles.find(
      (analysed) =>
        analysed.title.titleIndex === plan?.titleIndex,
    )
    const chapterSource = analysis.titles.find(
      (analysed) =>
        analysed.title.sourceFileName ===
        plan?.chapterSourceFileName,
    )

    expect(supersetTitle?.title.sourceFileName).toBe(
      "00425.m2ts",
    )
    expect(supersetTitle?.title.chapterCount).toBeNull()
    expect(plan?.chapterSourceFileName).toBe("00012.mpls")
    expect(chapterSource?.title.chapterCount).toBe(12)
    expect(plan?.supersededTitleIndexes).toHaveLength(3)
  })

  test("plans nothing for a disc with no superset title", () => {
    expect(
      buildTrackSupersetPlans({
        analysis: loadAnalysis("desk-set-bluray.robot.log"),
      }),
    ).toEqual([])
  })
})
