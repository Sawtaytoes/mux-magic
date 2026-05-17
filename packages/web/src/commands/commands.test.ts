import { describe, expect, test } from "vitest"

import { COMMANDS } from "./commands"

describe("addSubtitles offsets field label", () => {
  test("offsets field has the per-episode label", () => {
    const addSubtitlesFields = COMMANDS.addSubtitles.fields
    const offsetsField = addSubtitlesFields.find(
      ({ name }) => name === "offsets",
    )

    expect(offsetsField?.label).toBe(
      "Offsets (milliseconds, one per episode)",
    )
  })
})

describe("COMMANDS field descriptions (regression guard)", () => {
  test("every non-hidden command field has a non-empty description", () => {
    Object.entries(COMMANDS).forEach(
      ([commandName, def]) => {
        def.fields.forEach((field) => {
          if (field.type === "hidden") return
          expect(
            field.description,
            `${commandName}.${field.name} is missing a description`,
          ).toBeTruthy()
        })
      },
    )
  })
})
