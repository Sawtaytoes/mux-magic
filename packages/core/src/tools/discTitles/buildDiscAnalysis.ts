import type { DiscTitleGraph } from "../makemkv/parseTitleGraph.js"
import { clusterTitlesBySegmentMap } from "./clusterTitlesBySegmentMap.js"
import {
  type DiscAnalysis,
  type RuleVerdict,
  resolveConfidence,
  resolveDisposition,
} from "./discTitleAnalysis.js"
import { getEnabledRules } from "./discTitleRules.js"

/**
 * Run the rule set over a title graph and resolve one proposal per title.
 *
 * Pure — no filesystem, no spawning — so the whole analyser is testable
 * from committed robot-mode fixtures.
 *
 * Titles no rule fires on default to `keep`. That is the deliberate bias:
 * the backup is already paid for, disk is cheaper than a re-rip of a disc
 * that may since have gone back in a box, and a wrong discard silently
 * loses the only copy of an edition. Nothing is ever discarded without a
 * rule that can say why.
 */
export const buildDiscAnalysis = ({
  disabledRuleNames = [],
  graph,
}: {
  disabledRuleNames?: string[]
  graph: DiscTitleGraph
}): DiscAnalysis =>
  ((clusters) =>
    ((verdicts: RuleVerdict[]) => ({
      clusters,
      discName: graph.discName,
      graph,
      titles: graph.titles.map((title) =>
        ((verdictsForTitle) => ({
          clusterKey:
            clusters.find((cluster) =>
              cluster.titleIndices.includes(
                title.titleIndex,
              ),
            )?.clusterKey ?? "",
          confidence: resolveConfidence(
            verdictsForTitle.map(
              (verdict) => verdict.confidence,
            ),
          ),
          disposition: resolveDisposition(
            verdictsForTitle.map(
              (verdict) => verdict.disposition,
            ),
          ),
          reasons: verdictsForTitle.map(
            (verdict) => verdict.reason,
          ),
          title,
        }))(
          verdicts.filter((verdict) =>
            verdict.titleIndices.includes(title.titleIndex),
          ),
        ),
      ),
      verdicts,
    }))(
      getEnabledRules({ disabledRuleNames }).flatMap(
        (rule) => rule.evaluate({ clusters, graph }),
      ),
    ))(clusterTitlesBySegmentMap({ graph }))
