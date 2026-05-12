import { describe, expect, test } from "vitest"
import { buildRunFetchUrl } from "./dryRunQuery"

describe("buildRunFetchUrl — Dry-Run query forwarding", () => {
  test("returns URL unchanged when dry-run is off", () => {
    expect(
      buildRunFetchUrl("/sequences/run", {
        isDryRun: false,
        isFailureMode: false,
      }),
    ).toBe("/sequences/run")
  })

  test("returns URL unchanged when dry-run is off, even if failureMode is true (defensive)", () => {
    expect(
      buildRunFetchUrl("/sequences/run", {
        isDryRun: false,
        isFailureMode: true,
      }),
    ).toBe("/sequences/run")
  })

  test("appends ?fake=1 when dry-run is on and failureMode is off", () => {
    expect(
      buildRunFetchUrl("/sequences/run", {
        isDryRun: true,
        isFailureMode: false,
      }),
    ).toBe("/sequences/run?fake=1")
  })

  test("appends ?fake=failure when dry-run AND failureMode are both on", () => {
    expect(
      buildRunFetchUrl("/sequences/run", {
        isDryRun: true,
        isFailureMode: true,
      }),
    ).toBe("/sequences/run?fake=failure")
  })

  test("uses & not ? when baseUrl already has a query string", () => {
    expect(
      buildRunFetchUrl("/commands/foo?bar=baz", {
        isDryRun: true,
        isFailureMode: false,
      }),
    ).toBe("/commands/foo?bar=baz&fake=1")
  })

  test("works for the /commands/:name endpoint shape", () => {
    expect(
      buildRunFetchUrl("/commands/deleteFolder", {
        isDryRun: true,
        isFailureMode: false,
      }),
    ).toBe("/commands/deleteFolder?fake=1")
  })

  test("works for the /commands/:name endpoint shape with failure mode", () => {
    expect(
      buildRunFetchUrl("/commands/deleteFolder", {
        isDryRun: true,
        isFailureMode: true,
      }),
    ).toBe("/commands/deleteFolder?fake=failure")
  })
})
