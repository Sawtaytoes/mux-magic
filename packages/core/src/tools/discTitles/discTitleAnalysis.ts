import type {
  DiscTitle,
  DiscTitleGraph,
} from "../makemkv/parseTitleGraph.js"

/**
 * What the analyser proposes doing with a title.
 *
 * Every one of these is a PROPOSAL with a stated reason, never an action.
 * The backup itself is never deleted by this process, and the full title
 * list stays available regardless of disposition.
 */
export type TitleDisposition =
  /** Rip it. */
  | "keep"
  /** Almost certainly not wanted — junk, menu loop, chapterless twin. */
  | "discard"
  /** One video, several track sets: rip once and graft, don't rip twice. */
  | "merge"
  /** Can't be settled from metadata alone; needs the probe step. */
  | "inspect"

/**
 * How much the rule trusts itself.
 *
 * Studio patterns are conventions, not standards, so a rule that encodes
 * one says so here rather than presenting itself as fact.
 */
export type RuleConfidence = "high" | "medium" | "low"

export type RuleVerdict = {
  confidence: RuleConfidence
  disposition: TitleDisposition
  /** The reason string. This is the product — it is what makes the UI verifiable at a glance. */
  reason: string
  ruleName: string
  titleIndices: number[]
}

/**
 * Titles that share one video.
 *
 * Built from the segment map, which for a single-segment feature is exact.
 * `isSegmentMapTruncated` marks a cluster whose members' maps makemkvcon
 * elided, where identity is a guess rather than a fact.
 */
export type TitleCluster = {
  clusterKey: string
  isSegmentMapTruncated: boolean
  segmentMapText: string
  titleIndices: number[]
}

export type AnalysedTitle = {
  clusterKey: string
  confidence: RuleConfidence
  disposition: TitleDisposition
  /** Every rule that fired, kept so a wrong one can be spotted and disabled. */
  reasons: string[]
  title: DiscTitle
}

export type DiscAnalysis = {
  clusters: TitleCluster[]
  discName: string
  graph: DiscTitleGraph
  titles: AnalysedTitle[]
  verdicts: RuleVerdict[]
}

export type DiscTitleRule = {
  /** One line on what the rule looks for — surfaced in the UI. */
  description: string
  evaluate: (input: {
    clusters: TitleCluster[]
    graph: DiscTitleGraph
  }) => RuleVerdict[]
  name: string
  /**
   * The backup this rule was validated against.
   *
   * A rule with no validating fixture is a hypothesis, and the UI says so.
   * Studio patterns (Disney text-swaps, Ghibli sides, anime Play-All
   * splitting) stay out of the registry entirely until a matching backup
   * has been run through the analyser.
   */
  validatedAgainst: string[]
}

/**
 * Resolution order when rules disagree.
 *
 * Keeping outranks discarding, deliberately: the disc backup is already
 * paid for, disk is cheaper than re-ripping a disc that may since have
 * gone back in a box, and a wrong discard silently loses the only copy of
 * an edition. `inspect` outranks everything because "I am not sure" must
 * never be overwritten by a confident-sounding sibling.
 */
const dispositionRank: Record<TitleDisposition, number> = {
  discard: 0,
  keep: 1,
  merge: 2,
  inspect: 3,
}

export const resolveDisposition = (
  dispositions: TitleDisposition[],
) =>
  // Seeded from the first verdict, NOT from "keep". Seeding with "keep"
  // outranks `discard` (rank 0 < 1), so a title with a single discard
  // verdict silently resolved to keep and every discard proposal vanished
  // from the output. A title with no verdicts at all still defaults to
  // keep — that is the separate, deliberate bias below.
  dispositions.length === 0
    ? "keep"
    : dispositions.reduce<TitleDisposition>(
        (winner, candidate) =>
          dispositionRank[candidate] >
          dispositionRank[winner]
            ? candidate
            : winner,
        dispositions[0],
      )

const confidenceRank: Record<RuleConfidence, number> = {
  high: 2,
  low: 0,
  medium: 1,
}

/** The weakest link: a proposal is only as trustworthy as its shakiest rule. */
export const resolveConfidence = (
  confidences: RuleConfidence[],
) =>
  confidences.reduce<RuleConfidence>(
    (weakest, candidate) =>
      confidenceRank[candidate] < confidenceRank[weakest]
        ? candidate
        : weakest,
    "high",
  )

export const getIsPlaylistTitle = (title: DiscTitle) =>
  title.sourceFileName.toLowerCase().endsWith(".mpls")

export const getIsStreamTitle = (title: DiscTitle) =>
  title.sourceFileName.toLowerCase().endsWith(".m2ts")

/**
 * A track-set signature that ignores ordering.
 *
 * Two playlists over the same video differ in which audio and subtitle
 * tracks they expose; comparing sorted signatures is what turns "three
 * 65.5 GB editions" into "one video, three track sets".
 */
export const getTrackSignature = (title: DiscTitle) =>
  title.streams
    .filter((stream) => stream.kind !== "video")
    .map((stream) =>
      [
        stream.kind,
        stream.codecId,
        stream.languageCode,
        stream.channelCount ?? "",
      ].join(":"),
    )
    .sort()
    .join("|")
