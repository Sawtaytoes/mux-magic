import { describe, expect, test } from "vitest"
import { createIgnoredStyleNameMatcher } from "./createIgnoredStyleNameMatcher.js"

const isDefaultIgnoredStyleName =
  createIgnoredStyleNameMatcher({
    ignoredStyleNamesRegexString: "signs?|opening|ending",
    ignoredStyleNameWords: ["op", "ed", "ncop", "nced"],
  })

describe(createIgnoredStyleNameMatcher.name, () => {
  test.each([
    "OP",
    "op2",
    "OccultOP1",
    "NCOP1",
    "NCED",
    "MainEDSong",
    "ED_Kanji",
    "OpeningCredits",
    "endingromaji",
    "Signage",
    "TypesettingSigns",
  ])("protects theme/sign style %s", (styleName) => {
    expect(isDefaultIgnoredStyleName(styleName)).toBe(true)
  })
  test.each([
    "Top",
    "Top Secondary Dialog 1080P",
    "DefaultStyled",
    "EditedDialogue",
    "Developed",
    "Credits Dialogue",
    "OPERA",
  ])("does not mistake dialogue style %s for OP/ED", (styleName) => {
    expect(isDefaultIgnoredStyleName(styleName)).toBe(false)
  })
  test("explicit custom regular expressions retain raw substring matching", () => {
    const isIgnoredStyleName =
      createIgnoredStyleNameMatcher({
        ignoredStyleNamesRegexString: "op|ed",
      })
    expect(isIgnoredStyleName("Top")).toBe(true)
    expect(isIgnoredStyleName("DefaultStyled")).toBe(true)
  })
  test("word matching is case-insensitive and an empty matcher ignores nothing", () => {
    expect(
      createIgnoredStyleNameMatcher({
        ignoredStyleNameWords: [" OP "],
      })("OccultOP1"),
    ).toBe(true)
    expect(createIgnoredStyleNameMatcher({})("OP")).toBe(
      false,
    )
  })
})
