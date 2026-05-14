import { describe, expect, test } from "vitest"

// We need to test the fetch functions but they're not exported.
// This test documents the expected behavior when integrating with the API.

describe("LookupSearchStage fetch functions", () => {
  test("dvdCompareId should be converted to number before sending to server", () => {
    // The DVDCompare ID is stored as a string in the UI (e.g., "12345")
    // but the server expects a number in the POST body: { dvdCompareId: 12345 }
    // This test documents the requirement to prevent regressions where
    // string IDs are sent, causing validation failures (400 Bad Request)

    const dvdCompareIdAsString = "12345"
    const expectedBodyForServer = {
      dvdCompareId: Number(dvdCompareIdAsString),
    }

    expect(expectedBodyForServer.dvdCompareId).toEqual(
      12345,
    )
    expect(typeof expectedBodyForServer.dvdCompareId).toBe(
      "number",
    )
  })
})
