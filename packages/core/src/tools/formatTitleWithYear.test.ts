import { describe, expect, test } from "vitest"
import { formatTitleWithYear } from "./formatTitleWithYear.js"

describe(formatTitleWithYear, () => {
  test("does not duplicate a release year already in the title", () => {
    expect(
      formatTitleWithYear({
        title: "Fire Force (2020)",
        year: "2020",
      }),
    ).toBe("Fire Force (2020)")
  })

  test("keeps a different parenthetical year and appends the release year", () => {
    expect(
      formatTitleWithYear({
        title: "Fire Force (2019)",
        year: "2020",
      }),
    ).toBe("Fire Force (2019) (2020)")
  })
})
