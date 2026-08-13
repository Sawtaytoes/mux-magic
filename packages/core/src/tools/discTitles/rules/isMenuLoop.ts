import type { DiscTitle } from "../../makemkv/parseTitleGraph.js"
import type { DiscTitleRule } from "../discTitleAnalysis.js"

/**
 * Menu backgrounds and button loops.
 *
 * The sketch guessed "tiny, chapterless, near-identical siblings". Real
 * backups say the opposite about chapters: a menu loop carries an ABSURD
 * number of them — one per button/still — packed into a runtime of a
 * minute or two, with no audio track at all.
 *
 *   THE OUTFIT   00010.mpls   1:27  37.4 MB   87 chapters   no audio
 *   TROY BONUS   00017.mpls   1:04  52.0 MB   64 chapters   no audio
 *   SOYLENT      00010.mpls   3:56 359.3 MB  236 chapters   no audio
 *   SOYLENT      00011.mpls   2:45 215.6 MB  165 chapters   no audio
 *   TROY BONUS   00055.mpls   4:31 207.4 MB  271 chapters   no audio
 *
 * So the discriminator is chapter DENSITY plus the missing audio, not a
 * missing chapter list. A real featurette of the same length has two or
 * three chapters and always has audio.
 */
const chaptersPerMinuteThreshold = 10
const maximumDurationSeconds = 15 * 60

const getIsMenuLoopTitle = (title: DiscTitle) =>
  title.chapterCount !== null &&
  title.chapterCount > 1 &&
  title.durationSeconds !== null &&
  title.durationSeconds > 0 &&
  title.durationSeconds <= maximumDurationSeconds &&
  title.chapterCount / (title.durationSeconds / 60) >
    chaptersPerMinuteThreshold &&
  title.streams.every((stream) => stream.kind !== "audio")

export const isMenuLoop: DiscTitleRule = {
  description:
    "A silent title with a chapter every few seconds — a menu background or button loop, not content.",
  evaluate: ({ graph }) =>
    graph.titles
      .filter(getIsMenuLoopTitle)
      .map((title) => ({
        confidence: "high",
        disposition: "discard",
        reason: `${title.sourceFileName}: ${title.chapterCount} chapters in ${title.durationText} with no audio track — a menu loop, not content.`,
        ruleName: isMenuLoop.name,
        titleIndices: [title.titleIndex],
      })),
  name: "isMenuLoop",
  validatedAgainst: [
    "[BACKUP] THE OUTFIT - Blu-ray",
    "[BACKUP] TROY - BONUS DISC - Blu-ray",
    "[BACKUP] SOYLENT GREEN - UHD - 4K",
  ],
}
