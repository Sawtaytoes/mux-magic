import { describe, expect, test } from "vitest"
import {
  addEditorToTrackName,
  decodeSubtitleTrackName,
  encodeSubtitleTrackName,
  findCreditedEditors,
  findEncodedTrackName,
  isEncodedTrackNameSegment,
  normalizeSubtitleTrackName,
} from "./subtitleTrackNames.js"

describe("encodeSubtitleTrackName", () => {
  test("round-trips a name containing a path separator", () => {
    const trackName = "Signs/Songs [iKaos/corre/moi15moi]"

    expect(
      decodeSubtitleTrackName(
        encodeSubtitleTrackName(trackName),
      ),
    ).toBe(trackName)
  })

  test("round-trips every character a filename rejects", () => {
    const trackName = 'a<b>c:d"e/f\\g|h?i*j'

    expect(
      decodeSubtitleTrackName(
        encodeSubtitleTrackName(trackName),
      ),
    ).toBe(trackName)
  })

  test("round-trips non-latin text", () => {
    const trackName = "日本語 [字幕組]"

    expect(
      decodeSubtitleTrackName(
        encodeSubtitleTrackName(trackName),
      ),
    ).toBe(trackName)
  })

  test("never emits a character a filename rejects", () => {
    const encoded = encodeSubtitleTrackName(
      'Signs/Songs: "a" <b> |c| ?d? *e*',
    )

    expect(encoded).toMatch(/^name-[A-Za-z0-9_-]+$/)
  })

  test("is recognized as an encoded segment", () => {
    expect(
      isEncodedTrackNameSegment(
        encodeSubtitleTrackName("Dialogue"),
      ),
    ).toBe(true)
  })

  test("does not mistake a language segment for an encoded name", () => {
    expect(isEncodedTrackNameSegment("eng")).toBe(false)
  })
})

describe("findEncodedTrackName", () => {
  test("finds the encoded segment inside an extracted path", () => {
    const encoded = encodeSubtitleTrackName(
      "Signs & Songs [koala]",
    )

    expect(
      findEncodedTrackName(
        `Episode 01.track3.eng.${encoded}.ass`,
      ),
    ).toBe(encoded)
  })

  test("returns undefined when the path carries no name", () => {
    expect(
      findEncodedTrackName("Episode 01.track3.eng.ass"),
    ).toBeUndefined()
  })
})

describe("normalizeSubtitleTrackName", () => {
  test("keeps an empty name empty", () => {
    expect(normalizeSubtitleTrackName("")).toBe("")
  })

  test.each([
    ["English", "Full Subtitles"],
    ["Dialogue", "Full Subtitles"],
    ["Full", "Full Subtitles"],
    ["Full Subtitles", "Full Subtitles"],
    ["English subs", "Full Subtitles"],
    ["Signs & Songs", "Signs & Songs"],
    ["Signs/Songs", "Signs & Songs"],
    ["VobSub: Signs", "Signs & Songs"],
    ["ASS / Forced", "Forced"],
    ["Commentary", "Commentary"],
  ])("maps %s to %s", (trackName, expected) => {
    expect(normalizeSubtitleTrackName(trackName)).toBe(
      expected,
    )
  })

  test.each([
    ["Full Subtitles [MTBB]", "Full Subtitles [MTBB]"],
    ["English [CR]", "Full Subtitles [CR]"],
    [
      "[MiraiAnime] Dialogue",
      "Full Subtitles [MiraiAnime]",
    ],
    [
      "[MiraiAnime] Sign&Songs",
      "Signs & Songs [MiraiAnime]",
    ],
    ["Signs (NYAV Post)", "Signs & Songs [NYAV Post]"],
    [
      "Stylized Subtitles [iKaos/corre/moi15moi]",
      "Full Subtitles [iKaos/corre/moi15moi]",
    ],
    [
      "Songs/Titles/NEPs [iKaos/corre]",
      "Signs & Songs [iKaos/corre]",
    ],
    ["WSE/KAA Full", "Full Subtitles [WSE/KAA]"],
    [
      "Full Subs (SCY/Foxtrot)",
      "Full Subtitles [SCY/Foxtrot]",
    ],
    [
      "Subtitles [Discotek BD]",
      "Full Subtitles [Discotek BD]",
    ],
  ])("maps %s to %s", (trackName, expected) => {
    expect(normalizeSubtitleTrackName(trackName)).toBe(
      expected,
    )
  })

  test("keeps a qualifier alongside the group", () => {
    expect(
      normalizeSubtitleTrackName(
        "Full Subtitles (Honorifics) [Astral]",
      ),
    ).toBe("Full Subtitles (Honorifics) [Astral]")
  })

  test("marks a name the owner modified", () => {
    expect(
      normalizeSubtitleTrackName(
        "Full Subtitles [MTBB Modified]",
      ),
    ).toBe("Full Subtitles [MTBB] (edited)")
  })

  test("marks an editor credited inside the group", () => {
    expect(
      normalizeSubtitleTrackName(
        "Full Subtitles [Chihiro (ed. Kametsu)]",
      ),
    ).toBe("Full Subtitles [Chihiro] (edited by Kametsu)")
  })

  test("marks a parenthesised modification note", () => {
    expect(
      normalizeSubtitleTrackName(
        "(SBR Modified) UTW - Signs/Songs",
      ),
    ).toBe("Signs & Songs [UTW] (edited by SBR)")
  })

  test("is idempotent", () => {
    const normalized = normalizeSubtitleTrackName(
      "Full Subtitles [Chihiro (ed. Kametsu)]",
    )

    expect(normalizeSubtitleTrackName(normalized)).toBe(
      normalized,
    )
  })

  test("keeps an unrecognized group as the group", () => {
    expect(
      normalizeSubtitleTrackName("Tenrai-Sensei/hchcsen"),
    ).toBe("Full Subtitles [Tenrai-Sensei/hchcsen]")
  })
})

describe("qualifiers versus groups", () => {
  test.each([
    ["English [SDH]", "Full Subtitles (SDH)"],
    ["Signs & Karaoke", "Signs & Songs (Karaoke)"],
    [
      "Full Subtitles (Honorifics) [Astral]",
      "Full Subtitles (Honorifics) [Astral]",
    ],
  ])("routes %s to %s", (trackName, expected) => {
    expect(normalizeSubtitleTrackName(trackName)).toBe(
      expected,
    )
  })
})

describe("separator handling", () => {
  test.each([
    ["Dialogue@Foxtrot", "Full Subtitles [Foxtrot]"],
    [
      "Steins;Sub (deanzel modified)",
      "Full Subtitles [Steins;Sub] (edited by deanzel)",
    ],
    ["CR_English", "Full Subtitles [CR]"],
    [
      "Puella Magi Madoka Magica【R1】",
      "Full Subtitles (Puella Magi Madoka Magica) [R1]",
    ],
  ])("maps %s to %s", (trackName, expected) => {
    expect(normalizeSubtitleTrackName(trackName)).toBe(
      expected,
    )
  })
})

describe("findCreditedEditors", () => {
  test.each([
    ["Full Subtitles [Chihiro (ed. Kametsu)]", ["Kametsu"]],
    [
      "Signs+Songs [Chihiro (ed. Kametsu and Solaufein)]",
      ["Kametsu", "Solaufein"],
    ],
    ["Commie (BSEnc modified)", ["BSEnc"]],
    ["Full Subtitles [MTBB Modified]", []],
  ])("reads %s as %j", (trackName, expected) => {
    expect(findCreditedEditors(trackName)).toEqual(expected)
  })
})

describe("addEditorToTrackName", () => {
  test("keeps the original editor and appends the owner", () => {
    expect(
      addEditorToTrackName({
        editorName: "Sawtaytoes",
        trackName: normalizeSubtitleTrackName(
          "Full Subtitles [Chihiro (ed. Kametsu)]",
        ),
      }),
    ).toBe(
      "Full Subtitles [Chihiro] (edited by Kametsu and Sawtaytoes)",
    )
  })

  test("names the owner when no editor was credited", () => {
    expect(
      addEditorToTrackName({
        editorName: "Sawtaytoes",
        trackName: normalizeSubtitleTrackName(
          "Full Subtitles [MTBB Modified]",
        ),
      }),
    ).toBe("Full Subtitles [MTBB] (edited by Sawtaytoes)")
  })

  test("adds the owner to an otherwise unedited track", () => {
    expect(
      addEditorToTrackName({
        editorName: "Sawtaytoes",
        trackName: "Full Subtitles [koala]",
      }),
    ).toBe("Full Subtitles [koala] (edited by Sawtaytoes)")
  })

  test("keeps three editors in order", () => {
    expect(
      addEditorToTrackName({
        editorName: "Sawtaytoes",
        trackName: normalizeSubtitleTrackName(
          "Signs+Songs [Chihiro (ed. Kametsu and Solaufein)]",
        ),
      }),
    ).toBe(
      "Signs & Songs [Chihiro] (edited by Kametsu, Solaufein and Sawtaytoes)",
    )
  })

  test("does not add the owner twice", () => {
    const named = addEditorToTrackName({
      editorName: "Sawtaytoes",
      trackName: "Full Subtitles [koala]",
    })

    expect(
      addEditorToTrackName({
        editorName: "Sawtaytoes",
        trackName: named,
      }),
    ).toBe(named)
  })
})

describe("ambiguous edit credits", () => {
  test.each([
    [
      "Signs & Songs (Steins;Sub modified)",
      "Signs & Songs [Steins;Sub] (edited)",
    ],
    [
      "ASS / Main (Coalgirls modified)",
      "Full Subtitles [Coalgirls] (edited)",
    ],
    [
      "Commie (BSEnc modified)",
      "Full Subtitles [Commie] (edited by BSEnc)",
    ],
    [
      "R1 (Heavily modified) [Judgement]",
      "Full Subtitles (R1) [Judgement] (edited)",
    ],
  ])("maps %s to %s", (trackName, expected) => {
    expect(normalizeSubtitleTrackName(trackName)).toBe(
      expected,
    )
  })
})
