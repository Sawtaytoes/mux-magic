import { describe, expect, test } from "vitest"

import {
  SOURCE_PATH_FIELD_NAME,
  SOURCE_PATH_LABEL,
} from "./sourcePath.js"

describe("sourcePath constants", () => {
  test("SOURCE_PATH_FIELD_NAME is the canonical internal field name", () => {
    expect(SOURCE_PATH_FIELD_NAME).toBe("sourcePath")
  })

  test("SOURCE_PATH_LABEL is the canonical user-facing label", () => {
    expect(SOURCE_PATH_LABEL).toBe("Source Path")
  })
})
