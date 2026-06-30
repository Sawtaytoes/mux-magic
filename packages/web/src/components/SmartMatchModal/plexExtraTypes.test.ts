import { describe, expect, test } from "vitest"
import {
  buildRenameTarget,
  extractSuffixFromStem,
  inferSuffixFromName,
  stripSuffixFromBase,
} from "./plexExtraTypes"

describe("extractSuffixFromStem", () => {
  test("returns the suffix when the stem ends with a known Plex suffix", () => {
    expect(
      extractSuffixFromStem(
        "Commentary - The Making of the Film-featurette",
      ),
    ).toBe("-featurette")
  })

  test("returns empty string when the stem contains a Plex label word but NOT the slug", () => {
    // 'Behind the Scenes' is the human label; '-behindthescenes' is the slug.
    // A bare label should NOT match.
    expect(extractSuffixFromStem("Behind the Scenes")).toBe(
      "",
    )
  })

  test("returns the suffix for a stem ending in -behindthescenes", () => {
    expect(
      extractSuffixFromStem(
        "some-file-name-behindthescenes",
      ),
    ).toBe("-behindthescenes")
  })

  test("is case-insensitive", () => {
    expect(
      extractSuffixFromStem("Some Title-FEATURETTE"),
    ).toBe("-featurette")
  })

  test("returns empty string for a stem with no known suffix", () => {
    expect(extractSuffixFromStem("Theatrical Cut")).toBe("")
  })

  test("returns -trailer for a stem ending in -trailer", () => {
    expect(
      extractSuffixFromStem("Theatrical Trailer-trailer"),
    ).toBe("-trailer")
  })

  test("returns -deleted for a stem ending in -deleted", () => {
    expect(
      extractSuffixFromStem("Extended Scene-deleted"),
    ).toBe("-deleted")
  })

  test("returns -other for a stem ending in -other", () => {
    expect(
      extractSuffixFromStem("Image Gallery-other"),
    ).toBe("-other")
  })

  test("returns -interview for a stem ending in -interview", () => {
    expect(
      extractSuffixFromStem("Cast Interview-interview"),
    ).toBe("-interview")
  })

  test("returns -scene for a stem ending in -scene", () => {
    expect(
      extractSuffixFromStem("Opening Sequence-scene"),
    ).toBe("-scene")
  })

  test("returns -short for a stem ending in -short", () => {
    expect(extractSuffixFromStem("Short Film-short")).toBe(
      "-short",
    )
  })
})

describe("inferSuffixFromName", () => {
  test("returns -trailer for a name containing 'Trailer'", () => {
    expect(inferSuffixFromName("Theatrical Trailer")).toBe(
      "-trailer",
    )
  })

  test("returns -interview for a name containing 'Interview'", () => {
    expect(inferSuffixFromName("Cast Interview")).toBe(
      "-interview",
    )
  })

  test("returns -behindthescenes for a name containing 'Behind the Scenes'", () => {
    expect(inferSuffixFromName("Behind the Scenes")).toBe(
      "-behindthescenes",
    )
  })

  test("returns -other for a name that matches no known keyword", () => {
    // 'Shorts' doesn't match '\bshort\b' (word boundary at end fails on 'Shorts')
    // Per spec TDD step 2: inferSuffixFromName('Shrek Shorts') → '-other'
    expect(inferSuffixFromName("Shrek Shorts")).toBe(
      "-other",
    )
  })

  test("returns -featurette for a name containing 'featurette'", () => {
    expect(
      inferSuffixFromName("Spotlight Featurette"),
    ).toBe("-featurette")
  })

  test("returns -featurette for a name containing 'documentary' (not -behindthescenes)", () => {
    // Per the 2023-07-31 vocabulary decision: documentary → featurette
    expect(
      inferSuffixFromName("Making-of Documentary"),
    ).toBe("-featurette")
  })

  test("returns -featurette for a name containing 'clip'", () => {
    // Per the vocabulary decision: clip → featurette
    expect(inferSuffixFromName("Music Clip")).toBe(
      "-featurette",
    )
  })

  test("returns -deleted for a name containing 'deleted'", () => {
    expect(
      inferSuffixFromName("Deleted Extended Scene"),
    ).toBe("-deleted")
  })

  test("returns -scene for a name containing 'scene'", () => {
    expect(inferSuffixFromName("Opening Scene")).toBe(
      "-scene",
    )
  })

  test("returns -trailer for a name containing 'teaser'", () => {
    expect(inferSuffixFromName("Teaser Trailer")).toBe(
      "-trailer",
    )
  })

  test("never returns empty string — always falls back to -other", () => {
    expect(inferSuffixFromName("Unknown Content")).toBe(
      "-other",
    )
    expect(inferSuffixFromName("")).toBe("-other")
  })
})

describe("stripSuffixFromBase", () => {
  test("strips a known suffix off the end of a base name", () => {
    expect(
      stripSuffixFromBase("Theatrical Trailer -featurette"),
    ).toBe("Theatrical Trailer")
  })

  test("returns the base unchanged when no known suffix is present", () => {
    expect(stripSuffixFromBase("Theatrical Cut")).toBe(
      "Theatrical Cut",
    )
  })

  test("strips trailing whitespace after suffix removal", () => {
    // Ensures 'Title -featurette' → 'Title' not 'Title '
    expect(stripSuffixFromBase("Title -featurette")).toBe(
      "Title",
    )
  })
})

describe("buildRenameTarget", () => {
  test("appends the suffix to the base name", () => {
    expect(
      buildRenameTarget(
        "Theatrical Trailer",
        "-featurette",
      ),
    ).toBe("Theatrical Trailer -featurette")
  })

  test("returns the base unchanged when suffix is empty string", () => {
    expect(buildRenameTarget("Theatrical Cut", "")).toBe(
      "Theatrical Cut",
    )
  })

  test("strips an existing suffix before appending the new one (no double-suffix)", () => {
    expect(
      buildRenameTarget(
        "Theatrical Trailer -featurette",
        "-trailer",
      ),
    ).toBe("Theatrical Trailer -trailer")
  })

  test("handles a base that already has -other and re-applies -other cleanly", () => {
    expect(
      buildRenameTarget("Image Gallery -other", "-other"),
    ).toBe("Image Gallery -other")
  })
})
