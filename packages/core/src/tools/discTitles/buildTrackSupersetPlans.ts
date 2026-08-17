import type { DiscAnalysis } from "./discTitleAnalysis.js"

export type TrackSupersetPlan = {
  /** The `.mpls` the chapter marks come from, or null if no sibling has any. */
  chapterSourceFileName: string | null
  /** Cluster siblings this plan makes unnecessary to rip. */
  supersededTitleIndexes: number[]
  titleIndex: number
}

/**
 * Turn `isTrackSuperset` verdicts into "rip THIS one, take chapters from THAT one".
 *
 * The rule already found the title carrying every track its cluster
 * siblings expose — Soylent Green's raw `00425.m2ts`, which holds the LPCM
 * mono original and all three DD 2.0 tracks where each playlist exposes a
 * subset. Ripping it once replaces ripping three 65.5 GB playlists.
 *
 * What the rule deliberately would not do is take it silently, because the
 * superset is chapterless — it is the very title `isChapterlessTwin`
 * proposes discarding — and chapters have to come from the playlist. That
 * is what this plans: the chapter source is the sibling with the most
 * chapter marks, tie-broken by title index so the same disc always plans
 * the same way.
 */
export const buildTrackSupersetPlans = ({
  analysis,
}: {
  analysis: DiscAnalysis
}): TrackSupersetPlan[] =>
  analysis.verdicts
    .filter(
      (verdict) => verdict.ruleName === "isTrackSuperset",
    )
    .flatMap((verdict) => verdict.titleIndices)
    .flatMap((titleIndex) => {
      const cluster = analysis.clusters.find((candidate) =>
        candidate.titleIndices.includes(titleIndex),
      )

      const siblings = (cluster?.titleIndices ?? [])
        .filter(
          (siblingIndex) => siblingIndex !== titleIndex,
        )
        .map((siblingIndex) =>
          analysis.titles.find(
            (analysed) =>
              analysed.title.titleIndex === siblingIndex,
          ),
        )
        .filter((analysed) => analysed !== undefined)

      const chapterSource = siblings
        .filter(
          (analysed) =>
            (analysed.title.chapterCount ?? 0) > 0,
        )
        .sort(
          (first, second) =>
            (second.title.chapterCount ?? 0) -
              (first.title.chapterCount ?? 0) ||
            first.title.titleIndex -
              second.title.titleIndex,
        )
        .at(0)

      return [
        {
          chapterSourceFileName:
            chapterSource?.title.sourceFileName ?? null,
          supersededTitleIndexes: siblings.map(
            (analysed) => analysed.title.titleIndex,
          ),
          titleIndex,
        },
      ]
    })
