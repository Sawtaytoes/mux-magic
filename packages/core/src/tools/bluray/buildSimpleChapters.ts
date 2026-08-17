import {
  getMplsChapterTimesFromPlaylistStart,
  type MplsPlaylist,
} from "./parseMpls.js"

const padNumber = ({
  digits,
  value,
}: {
  digits: number
  value: number
}) => String(value).padStart(digits, "0")

const formatChapterTimestamp = (secondsFromStart: number) =>
  [
    padNumber({
      digits: 2,
      value: Math.floor(secondsFromStart / 3600),
    }),
    padNumber({
      digits: 2,
      value: Math.floor(secondsFromStart / 60) % 60,
    }),
    padNumber({
      digits: 2,
      value: Math.floor(secondsFromStart) % 60,
    }),
  ]
    .join(":")
    .concat(
      ".",
      padNumber({
        digits: 3,
        value: Math.round(
          (secondsFromStart -
            Math.floor(secondsFromStart)) *
            1000,
        ),
      }),
    )

/**
 * Render a playlist's chapter marks as mkvtoolnix simple-chapter text.
 *
 * Simple format rather than the XML one because `mkvpropedit --chapters`
 * takes either and this needs no UIDs, no edition entries and no XML
 * dependency — it is eight lines of text per chapter mark.
 *
 * The end marker is dropped. The final mark usually lands on the
 * playlist's end rather than on a chapter, which is why MakeMKV reports
 * one fewer chapter than there are marks; keeping it would add a
 * zero-length chapter at the end of every grafted rip.
 */
export const buildSimpleChapters = ({
  playlist,
}: {
  playlist: MplsPlaylist
}) =>
  getMplsChapterTimesFromPlaylistStart(playlist)
    .filter((mark) => !mark.isPlaylistEndMarker)
    .flatMap((mark, index) =>
      ((chapterNumber: string) => [
        `CHAPTER${chapterNumber}=${formatChapterTimestamp(mark.secondsFromStart)}`,
        `CHAPTER${chapterNumber}NAME=Chapter ${index + 1}`,
      ])(padNumber({ digits: 2, value: index + 1 })),
    )
    .join("\n")
    .concat("\n")
