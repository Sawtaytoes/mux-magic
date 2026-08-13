import type { DiscTitleRule } from "./discTitleAnalysis.js"
import { isChapterlessLongTitle } from "./rules/isChapterlessLongTitle.js"
import { isChapterlessTwin } from "./rules/isChapterlessTwin.js"
import { isDistinctCut } from "./rules/isDistinctCut.js"
import { isMenuLoop } from "./rules/isMenuLoop.js"
import { isPlayAllStitch } from "./rules/isPlayAllStitch.js"
import { isStreamCoveredByPlaylist } from "./rules/isStreamCoveredByPlaylist.js"
import { isTrackSetVariant } from "./rules/isTrackSetVariant.js"
import { isTrackSuperset } from "./rules/isTrackSuperset.js"

/**
 * Every heuristic, named and individually disableable.
 *
 * This is the make-or-break property of the whole feature. Studio patterns
 * are conventions, not standards — they change between releases — so a
 * rule that turns out to be wrong has to be switchable off by name without
 * unpicking the analyser. Callers pass `disabledRuleNames`.
 *
 * **Deliberately absent, and staying absent until a matching backup has
 * actually been run through the analyser:**
 *
 *  - Disney `mls0800` localised-text sets. The owner's own framing was
 *    "typically mls0800 or something is the English one" — remembered, not
 *    verified — and he scoped it to the main feature on BD only, not UHD.
 *  - Ghibli sides (the belief that the difference is only intro/outro
 *    credits). If a Ghibli disc ever differs in the body, a credits-only
 *    assumption silently takes the wrong side.
 *  - Anime Play-All chapter-splitting. `splitChapters` exists; choosing
 *    the split points does not, and a mis-split silently truncates
 *    episodes.
 *
 * All three take the shape `isDistinctCut` already detects, and its answer
 * — keep both, show the segment diff — is the safe one for each of them.
 */
export const discTitleRules: DiscTitleRule[] = [
  isMenuLoop,
  isChapterlessTwin,
  isChapterlessLongTitle,
  isTrackSetVariant,
  isTrackSuperset,
  isDistinctCut,
  isStreamCoveredByPlaylist,
  isPlayAllStitch,
]

export const getEnabledRules = ({
  disabledRuleNames = [],
}: {
  disabledRuleNames?: string[]
}) =>
  discTitleRules.filter(
    (rule) => !disabledRuleNames.includes(rule.name),
  )
