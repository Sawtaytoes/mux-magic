import { describe, expect, test } from "vitest"

import { COMMANDS } from "./commands"

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
