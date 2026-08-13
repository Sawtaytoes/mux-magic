import { join } from "node:path"

import { describe, expect, test, vi } from "vitest"

import { parseTitleGraph } from "../makemkv/parseTitleGraph.js"
import { buildDiscAnalysis } from "./buildDiscAnalysis.js"
import { clusterTitlesBySegmentMap } from "./clusterTitlesBySegmentMap.js"
import { resolveDisposition } from "./discTitleAnalysis.js"
import { discTitleRules } from "./discTitleRules.js"

// vitest.setup.ts mocks node:fs globally with memfs, so use vi.importActual
// to read on-disk fixtures at module init.
const realFs =
  await vi.importActual<typeof import("node:fs")>("node:fs")
const FIXTURES_DIR = join(
  import.meta.dirname,
  "..",
  "makemkv",
  "__fixtures__",
)
const analyseFixture = (fixtureName: string) =>
  buildDiscAnalysis({
    graph: parseTitleGraph(
      realFs.readFileSync(
        join(FIXTURES_DIR, fixtureName),
        "utf8",
      ),
    ),
  })

const findTitle = ({
  analysis,
  sourceFileName,
}: {
  analysis: ReturnType<typeof buildDiscAnalysis>
  sourceFileName: string
}) =>
  analysis.titles.find(
    (analysed) =>
      analysed.title.sourceFileName === sourceFileName,
  )

describe(resolveDisposition.name, () => {
  test("defaults to keep when no rule fired", () => {
    // The deliberate bias: the backup is already paid for, and a wrong
    // discard silently loses the only copy of an edition.
    expect(resolveDisposition([])).toBe("keep")
  })

  test("a lone discard verdict resolves to discard", () => {
    // Regression: seeding the reduce with "keep" outranked discard, so
    // every single-verdict discard proposal silently vanished.
    expect(resolveDisposition(["discard"])).toBe("discard")
  })

  test("inspect outranks discard so uncertainty is never overwritten", () => {
    expect(resolveDisposition(["discard", "inspect"])).toBe(
      "inspect",
    )
  })

  test("keep outranks discard when rules disagree", () => {
    expect(resolveDisposition(["discard", "keep"])).toBe(
      "keep",
    )
  })
})

describe(buildDiscAnalysis.name, () => {
  test("every title gets a disposition and discards always carry a reason", () => {
    const analysis = analyseFixture(
      "troy-bonus-disc-bluray.robot.log",
    )

    expect(analysis.titles).toHaveLength(94)
    analysis.titles
      .filter(
        (analysed) => analysed.disposition === "discard",
      )
      .forEach((analysed) => {
        expect(analysed.reasons.length).toBeGreaterThan(0)
      })
  })

  test("Soylent Green collapses three 65.5 GB playlists into one merge", () => {
    // The hard-case regression. Three playlists over segment 425 must
    // become ONE proposal, not three rips (~197 GB for ~65 GB of video).
    const analysis = analyseFixture(
      "soylent-green-uhd.robot.log",
    )
    const trackSetVerdicts = analysis.verdicts.filter(
      (verdict) => verdict.ruleName === "isTrackSetVariant",
    )

    expect(trackSetVerdicts).toHaveLength(1)
    expect(trackSetVerdicts[0].disposition).toBe("merge")
    expect(trackSetVerdicts[0].titleIndices).toHaveLength(3)
    expect(trackSetVerdicts[0].reason).toContain(
      "segment map 425",
    )
    expect(trackSetVerdicts[0].reason).toContain(
      "3 different track sets",
    )
  })

  test("Soylent Green's raw twin surfaces as the track superset, not a discard", () => {
    // isChapterlessTwin proposes discarding 00425.m2ts; isTrackSuperset
    // proposes inspecting it because it carries every track. The resolver
    // must let the uncertainty win, or the cheap one-pass source is
    // silently thrown away.
    const analysis = analyseFixture(
      "soylent-green-uhd.robot.log",
    )
    const rawTwin = findTitle({
      analysis,
      sourceFileName: "00425.m2ts",
    })

    expect(rawTwin?.disposition).toBe("inspect")
    expect(rawTwin?.reasons.join(" ")).toContain(
      "carries every audio/subtitle track",
    )
  })

  test("Troy's 4K chapterless twin is proposed for discard", () => {
    const analysis = analyseFixture(
      "troy-directors-cut-uhd.robot.log",
    )
    const twin = findTitle({
      analysis,
      sourceFileName: "00005.m2ts",
    })

    expect(twin?.disposition).toBe("discard")
    expect(twin?.confidence).toBe("high")
    expect(twin?.reasons[0]).toContain("00001.mpls")
  })

  test("Troy's chaptered 90.9 GB feature is kept", () => {
    const analysis = analyseFixture(
      "troy-directors-cut-uhd.robot.log",
    )

    expect(
      findTitle({
        analysis,
        sourceFileName: "00001.mpls",
      })?.disposition,
    ).toBe("keep")
  })

  test("The Outfit's two cuts are both kept, with the segment diff in the reason", () => {
    const analysis = analyseFixture(
      "the-outfit-bluray.robot.log",
    )
    const distinctCutVerdicts = analysis.verdicts.filter(
      (verdict) => verdict.ruleName === "isDistinctCut",
    )

    expect(distinctCutVerdicts).toHaveLength(1)
    expect(distinctCutVerdicts[0].reason).toContain(
      "segments 4,6",
    )
    expect(distinctCutVerdicts[0].reason).toContain(
      "segments 4,5",
    )
    expect(
      findTitle({
        analysis,
        sourceFileName: "00011.mpls",
      })?.disposition,
    ).toBe("keep")
    expect(
      findTitle({
        analysis,
        sourceFileName: "00002.mpls",
      })?.disposition,
    ).toBe("keep")
  })

  test("menu loops are discarded by chapter density, not by missing chapters", () => {
    // 87 chapters in 1:27 with no audio. A rule keyed on "no chapters"
    // would miss every one of these.
    const analysis = analyseFixture(
      "the-outfit-bluray.robot.log",
    )
    const menuLoop = findTitle({
      analysis,
      sourceFileName: "00010.mpls",
    })

    expect(menuLoop?.disposition).toBe("discard")
    expect(menuLoop?.reasons[0]).toContain(
      "87 chapters in 0:01:27 with no audio track",
    )
  })

  test("Troy's bonus-disc featurettes are NOT discarded for lacking chapters", () => {
    // 1–17 minute chapterless .m2ts extras are real content. A
    // "long chapterless → discard" rule would propose throwing away
    // 20-odd of them, which is why isChapterlessLongTitle's floor is
    // feature length.
    const analysis = analyseFixture(
      "troy-bonus-disc-bluray.robot.log",
    )
    const featurette = findTitle({
      analysis,
      sourceFileName: "00030.m2ts",
    })

    expect(featurette?.title.durationText).toBe("0:15:10")
    expect(featurette?.title.chapterCount).toBeNull()
    expect(featurette?.disposition).toBe("keep")
  })

  test("Desk Set's main feature is kept and its raw segments discarded", () => {
    const analysis = analyseFixture(
      "desk-set-bluray.robot.log",
    )

    expect(
      findTitle({
        analysis,
        sourceFileName: "00850.mpls",
      })?.disposition,
    ).toBe("keep")
    expect(
      findTitle({
        analysis,
        sourceFileName: "01393.m2ts",
      })?.disposition,
    ).toBe("discard")
  })

  test("a rule can be disabled by name without touching the others", () => {
    // The make-or-break property: studio patterns are conventions, so a
    // rule that turns out to be wrong has to be switchable off.
    const graph = parseTitleGraph(
      realFs.readFileSync(
        join(FIXTURES_DIR, "soylent-green-uhd.robot.log"),
        "utf8",
      ),
    )
    const withRule = buildDiscAnalysis({ graph })
    const withoutRule = buildDiscAnalysis({
      disabledRuleNames: ["isTrackSetVariant"],
      graph,
    })

    expect(
      withRule.verdicts.some(
        (verdict) =>
          verdict.ruleName === "isTrackSetVariant",
      ),
    ).toBe(true)
    expect(
      withoutRule.verdicts.some(
        (verdict) =>
          verdict.ruleName === "isTrackSetVariant",
      ),
    ).toBe(false)
    expect(
      withoutRule.verdicts.some(
        (verdict) => verdict.ruleName === "isMenuLoop",
      ),
    ).toBe(true)
  })

  test("no rule claims identity on a truncated segment map", () => {
    // makemkvcon elides long maps, so "same segments" is unknowable for
    // those titles and a false identity claim would merge two real cuts.
    const analysis = analyseFixture(
      "soylent-green-uhd.robot.log",
    )
    const truncatedClusters = analysis.clusters.filter(
      (cluster) => cluster.isSegmentMapTruncated,
    )

    expect(truncatedClusters.length).toBeGreaterThan(0)
    truncatedClusters.forEach((cluster) => {
      analysis.verdicts
        .filter((verdict) =>
          verdict.titleIndices.some((titleIndex) =>
            cluster.titleIndices.includes(titleIndex),
          ),
        )
        .forEach((verdict) => {
          expect(verdict.ruleName).not.toBe(
            "isTrackSetVariant",
          )
          expect(verdict.ruleName).not.toBe(
            "isChapterlessTwin",
          )
        })
    })
  })
})

describe("the rule registry", () => {
  test("every rule has a unique name and a description", () => {
    const ruleNames = discTitleRules.map(
      (rule) => rule.name,
    )

    expect(new Set(ruleNames).size).toBe(ruleNames.length)
    discTitleRules.forEach((rule) => {
      expect(rule.description.length).toBeGreaterThan(0)
    })
  })

  test("a rule with no validating backup never proposes a discard", () => {
    // An unvalidated rule is a hypothesis. It may surface a title for
    // inspection; it may not propose throwing one away.
    const unvalidatedRules = discTitleRules.filter(
      (rule) => rule.validatedAgainst.length === 0,
    )

    unvalidatedRules.forEach((rule) => {
      expect({
        disposition: rule
          .evaluate({
            clusters: clusterTitlesBySegmentMap({
              graph: parseTitleGraph(
                realFs.readFileSync(
                  join(
                    FIXTURES_DIR,
                    "soylent-green-uhd.robot.log",
                  ),
                  "utf8",
                ),
              ),
            }),
            graph: parseTitleGraph(
              realFs.readFileSync(
                join(
                  FIXTURES_DIR,
                  "soylent-green-uhd.robot.log",
                ),
                "utf8",
              ),
            ),
          })
          .map((verdict) => verdict.disposition),
        rule: rule.name,
      }).toEqual({
        disposition: [],
        rule: rule.name,
      })
    })
  })
})
