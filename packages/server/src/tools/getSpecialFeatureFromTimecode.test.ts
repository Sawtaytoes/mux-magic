import { describe, expect, test } from "vitest"

import { getIsSimilarTimecode, getOffsetsFromCenterPoint } from "./getSpecialFeatureFromTimecode.js"

describe(getOffsetsFromCenterPoint.name, () => {
  test("with no offset nor padding", async () => {
    expect(
      getOffsetsFromCenterPoint({
        offset: 0,
        paddingAmount: 0,
      })
    )
    .toEqual([
      0,
    ])
  })

  test("with an offset", async () => {
    expect(
      getOffsetsFromCenterPoint({
        offset: 2,
        paddingAmount: 0,
      })
    )
    .toEqual([
      2,
    ])
  })

  test("with a padding", async () => {
    expect(
      getOffsetsFromCenterPoint({
        offset: 0,
        paddingAmount: 2,
      })
    )
    .toEqual([
      -2,
      -1,
      0,
      1,
      2,
    ])
  })

  test("with padding and offset", async () => {
    expect(
      getOffsetsFromCenterPoint({
        offset: 2,
        paddingAmount: 2,
      })
    )
    .toEqual([
      0,
      1,
      2,
      3,
      4,
    ])
  })
})

describe(getIsSimilarTimecode.name, () => {
  test("when timecodes match exactly w/ hours", async () => {
    expect(
      getIsSimilarTimecode(
        "1:11:20",
        "1:11:20",
      )
    )
    .toBe(
      true
    )
  })

  test("when timecodes don't match exactly w/ hours", async () => {
    expect(
      getIsSimilarTimecode(
        "1:11:20",
        "1:11:21",
      )
    )
    .toBe(
      false
    )
  })

  test("when timecodes match exactly w/o hours", async () => {
    expect(
      getIsSimilarTimecode(
        "1:20",
        "1:20",
      )
    )
    .toBe(
      true
    )
  })

  test("when timecodes don't match exactly w/o hours", async () => {
    expect(
      getIsSimilarTimecode(
        "1:20",
        "1:21",
      )
    )
    .toBe(
      false
    )
  })

  test("where timecodes are off by 2", async () => {
    const fixedOffset = 2

    expect(
      getIsSimilarTimecode(
        "1:20",
        "1:22",
        {
          fixedOffset,
        },
      )
    )
    .toBe(
      true
    )

    expect(
      getIsSimilarTimecode(
        "1:20",
        "1:20",
        {
          fixedOffset,
        },
      )
    )
    .toBe(
      false
    )

    expect(
      getIsSimilarTimecode(
        "1:20",
        "1:21",
        {
          fixedOffset,
        },
      )
    )
    .toBe(
      false
    )

    expect(
      getIsSimilarTimecode(
        "1:20",
        "1:23",
        {
          fixedOffset,
        },
      )
    )
    .toBe(
      false
    )
  })

  test("where timecodes are off by +/-1", async () => {
    const timecodePaddingAmount = 1

    expect(
      getIsSimilarTimecode(
        "1:20",
        "1:20",
        {
          timecodePaddingAmount,
        },
      )
    )
    .toBe(
      true
    )

    expect(
      getIsSimilarTimecode(
        "1:20",
        "1:21",
        {
          timecodePaddingAmount,
        },
      )
    )
    .toBe(
      true
    )

    expect(
      getIsSimilarTimecode(
        "1:20",
        "1:19",
        {
          timecodePaddingAmount,
        },
      )
    )
    .toBe(
      true
    )

    expect(
      getIsSimilarTimecode(
        "1:20",
        "1:22",
        {
          timecodePaddingAmount,
        },
      )
    )
    .toBe(
      false
    )

    expect(
      getIsSimilarTimecode(
        "1:20",
        "1:18",
        {
          timecodePaddingAmount,
        },
      )
    )
    .toBe(
      false
    )
  })
})
