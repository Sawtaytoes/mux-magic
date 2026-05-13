import { describe, expect, test } from "vitest"

import { cleanupFilename } from "./cleanupFilename.js"

describe(cleanupFilename.name, () => {
  ;[
    {
      input:
        "Super String: Marco Polo’s Travel to the Multiverse",
      expected:
        "Super String - Marco Polo’s Travel to the Multiverse",
    },
    {
      input: "Some Title:Marco",
      expected: "Some Title-Marco",
    },
    {
      input: "Some Title : Marco",
      expected: "Some Title - Marco",
    },
  ].forEach(({ input, expected }) => {
    test(`from "${input}"`, () => {
      expect(cleanupFilename(input)).toBe(expected)
    })
  })
})
