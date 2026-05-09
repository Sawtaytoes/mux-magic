import { describe, expect, test } from "vitest"

import { insertIntoArray } from "./insertIntoArray.js"

describe(insertIntoArray.name, () => {
  test("inserts at the beginning", async () => {
    expect(
      insertIntoArray({
        array: [
          1,
          2,
          3,
        ],
        index: 0,
        value: 0,
      })
    )
    .toEqual([
      0,
      1,
      2,
      3,
    ])
  })

  test("inserts after the first value", async () => {
    expect(
      insertIntoArray({
        array: [
          1,
          2,
          3,
        ],
        index: 1,
        value: 0,
      })
    )
    .toEqual([
      1,
      0,
      2,
      3,
    ])
  })

  test("inserts at the end", async () => {
    expect(
      insertIntoArray({
        array: [
          1,
          2,
          3,
        ],
        index: 3,
        value: 0,
      })
    )
    .toEqual([
      1,
      2,
      3,
      0,
    ])
  })
})
