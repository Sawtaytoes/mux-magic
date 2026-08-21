import { describe, expect, test, vi } from "vitest"
import {
  encodeSubtitleTrackName,
  normalizeSubtitleTrackName,
} from "../tools/subtitleTrackNames.js"

vi.unmock("./mergeSubtitlesMkvMerge.js")

const { buildSubtitleSourceArgs } = await import(
  "./mergeSubtitlesMkvMerge.js"
)

const pathForTrackName = (trackName: string) =>
  `Episode 01.track3.eng.${encodeSubtitleTrackName(
    normalizeSubtitleTrackName(trackName),
  )}.ass`

describe("buildSubtitleSourceArgs", () => {
  test("passes a path through untouched when it carries no name", () => {
    expect(
      buildSubtitleSourceArgs([
        "Episode 01.track3.eng.ass",
      ]),
    ).toEqual(["Episode 01.track3.eng.ass"])
  })

  test("emits --track-name before the file it applies to", () => {
    const subtitleFilePath = pathForTrackName(
      "Full Subtitles [koala]",
    )

    expect(
      buildSubtitleSourceArgs([subtitleFilePath]),
    ).toEqual([
      "--track-name",
      "0:Full Subtitles [koala]",
      subtitleFilePath,
    ])
  })

  test("restores a name containing a path separator", () => {
    expect(
      buildSubtitleSourceArgs([
        pathForTrackName(
          "Signs/Songs/NEPs [iKaos/corre/moi15moi]",
        ),
      ])[1],
    ).toBe("0:Signs & Songs [iKaos/corre/moi15moi]")
  })

  test("keeps the owner's edited marker", () => {
    expect(
      buildSubtitleSourceArgs([
        pathForTrackName("Full Subtitles [MTBB Modified]"),
      ])[1],
    ).toBe("0:Full Subtitles [MTBB] (edited by Sawtaytoes)")
  })

  test("names each file in a multi-track merge", () => {
    const dialoguePath = pathForTrackName(
      "Dialogue [koala]",
    )
    const signsPath = pathForTrackName(
      "Signs & Songs [koala]",
    )

    expect(
      buildSubtitleSourceArgs([dialoguePath, signsPath]),
    ).toEqual([
      "--track-name",
      "0:Full Subtitles [koala]",
      dialoguePath,
      "--track-name",
      "0:Signs & Songs [koala]",
      signsPath,
    ])
  })
})
