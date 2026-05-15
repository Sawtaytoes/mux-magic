import { afterEach, describe, expect, test } from "vitest"

import {
  __resetLoggingModeForTests,
  getLoggingMode,
  setLoggingMode,
} from "./mode.js"

afterEach(() => {
  __resetLoggingModeForTests()
})

describe(getLoggingMode.name, () => {
  test('defaults to "cli"', () => {
    expect(getLoggingMode()).toBe("cli")
  })

  test('returns "api" after setLoggingMode("api")', () => {
    setLoggingMode("api")

    expect(getLoggingMode()).toBe("api")
  })

  test('returns "cli-debug" after setLoggingMode("cli-debug")', () => {
    setLoggingMode("cli-debug")

    expect(getLoggingMode()).toBe("cli-debug")
  })

  test("reset helper returns to the default", () => {
    setLoggingMode("api")
    __resetLoggingModeForTests()

    expect(getLoggingMode()).toBe("cli")
  })
})
