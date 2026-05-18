import { describe, expect, test } from "vitest"
import {
  buildMovieBaseName,
  buildMovieFeatureName,
} from "./nameSpecialFeaturesDvdCompareTmdb.filename.js"

describe(buildMovieBaseName.name, () => {
  test("formats 'Title (Year)' for a normal entry", () => {
    expect(
      buildMovieBaseName({
        title: "Inception",
        year: "2010",
      }),
    ).toBe("Inception (2010)")
  })

  test("drops the year parenthetical when missing", () => {
    expect(
      buildMovieBaseName({ title: "Untitled", year: "" }),
    ).toBe("Untitled")
  })

  test("strips filename-illegal characters from the title", () => {
    expect(
      buildMovieBaseName({
        title: "Soldier: Reloaded?",
        year: "1998",
      }),
    ).toBe("Soldier - Reloaded (1998)")
  })
})

describe(buildMovieFeatureName.name, () => {
  test("appends '{edition-…}' when a cut name is provided", () => {
    expect(
      buildMovieFeatureName(
        { title: "Dragon Lord", year: "1982" },
        "Hong Kong Version",
      ),
    ).toBe("Dragon Lord (1982) {edition-Hong Kong Version}")
  })

  test("omits the edition suffix for an empty cut name", () => {
    expect(
      buildMovieFeatureName(
        { title: "Dragon Lord", year: "1982" },
        "",
      ),
    ).toBe("Dragon Lord (1982)")
  })
})
