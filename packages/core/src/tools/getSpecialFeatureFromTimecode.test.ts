import { describe, expect, test } from "vitest"

import {
  applySpecialFeatureSuffix,
  getIsSimilarTimecode,
  getOffsetsFromCenterPoint,
} from "./getSpecialFeatureFromTimecode.js"

describe(getOffsetsFromCenterPoint.name, () => {
  test("with no offset nor padding", async () => {
    expect(
      getOffsetsFromCenterPoint({
        offset: 0,
        paddingAmount: 0,
      }),
    ).toEqual([0])
  })

  test("with an offset", async () => {
    expect(
      getOffsetsFromCenterPoint({
        offset: 2,
        paddingAmount: 0,
      }),
    ).toEqual([2])
  })

  test("with a padding", async () => {
    expect(
      getOffsetsFromCenterPoint({
        offset: 0,
        paddingAmount: 2,
      }),
    ).toEqual([-2, -1, 0, 1, 2])
  })

  test("with padding and offset", async () => {
    expect(
      getOffsetsFromCenterPoint({
        offset: 2,
        paddingAmount: 2,
      }),
    ).toEqual([0, 1, 2, 3, 4])
  })
})

describe(getIsSimilarTimecode.name, () => {
  test("when timecodes match exactly w/ hours", async () => {
    expect(getIsSimilarTimecode("1:11:20", "1:11:20")).toBe(
      true,
    )
  })

  test("when timecodes don't match exactly w/ hours", async () => {
    expect(getIsSimilarTimecode("1:11:20", "1:11:21")).toBe(
      false,
    )
  })

  test("when timecodes match exactly w/o hours", async () => {
    expect(getIsSimilarTimecode("1:20", "1:20")).toBe(true)
  })

  test("when timecodes don't match exactly w/o hours", async () => {
    expect(getIsSimilarTimecode("1:20", "1:21")).toBe(false)
  })

  test("where timecodes are off by 2", async () => {
    const fixedOffset = 2

    expect(
      getIsSimilarTimecode("1:20", "1:22", {
        fixedOffset,
      }),
    ).toBe(true)

    expect(
      getIsSimilarTimecode("1:20", "1:20", {
        fixedOffset,
      }),
    ).toBe(false)

    expect(
      getIsSimilarTimecode("1:20", "1:21", {
        fixedOffset,
      }),
    ).toBe(false)

    expect(
      getIsSimilarTimecode("1:20", "1:23", {
        fixedOffset,
      }),
    ).toBe(false)
  })

  test("where timecodes are off by +/-1", async () => {
    const timecodePaddingAmount = 1

    expect(
      getIsSimilarTimecode("1:20", "1:20", {
        timecodePaddingAmount,
      }),
    ).toBe(true)

    expect(
      getIsSimilarTimecode("1:20", "1:21", {
        timecodePaddingAmount,
      }),
    ).toBe(true)

    expect(
      getIsSimilarTimecode("1:20", "1:19", {
        timecodePaddingAmount,
      }),
    ).toBe(true)

    expect(
      getIsSimilarTimecode("1:20", "1:22", {
        timecodePaddingAmount,
      }),
    ).toBe(false)

    expect(
      getIsSimilarTimecode("1:20", "1:18", {
        timecodePaddingAmount,
      }),
    ).toBe(false)
  })
})

describe(applySpecialFeatureSuffix.name, () => {
  test("routes 'Extended Scene' to -deleted (regression: previously stripped 'Scene' and produced 'Extended -scene')", () => {
    expect(
      applySpecialFeatureSuffix({ text: "Extended Scene" }),
    ).toBe("Extended Scene -deleted")
  })

  test("routes plural 'Extended Scenes' to -deleted", () => {
    expect(
      applySpecialFeatureSuffix({
        text: "Extended Scenes",
      }),
    ).toBe("Extended Scenes -deleted")
  })

  test("routes 'Alternate Scene' to -deleted (symmetric with 'Alternate Version')", () => {
    expect(
      applySpecialFeatureSuffix({
        text: "Alternate Scene",
      }),
    ).toBe("Alternate Scene -deleted")
  })

  test("routes plural 'Alternate Scenes' to -deleted", () => {
    expect(
      applySpecialFeatureSuffix({
        text: "Alternate Scenes",
      }),
    ).toBe("Alternate Scenes -deleted")
  })

  test("still strips trailing ' Scene' on unrelated names via the generic -scene rule", () => {
    expect(
      applySpecialFeatureSuffix({ text: "Opening Scene" }),
    ).toBe("Opening -scene")
  })

  test("'extended version' continues to route to -deleted (no regression on the original pattern)", () => {
    expect(
      applySpecialFeatureSuffix({
        text: "Extended Version",
      }),
    ).toBe("Extended Version -deleted")
  })

  test("routes a hyphenated 'behind-the-scenes' title to -behindthescenes (regression: previously matched 'scene' and produced -scene)", () => {
    expect(
      applySpecialFeatureSuffix({
        text: "VFX Before and After 2025 behind-the-scenes look at how the film's special effects were created",
        type: "behindthescenes",
      }),
    ).toBe(
      "VFX Before and After 2025 behind-the-scenes look at how the film's special effects were created -behindthescenes",
    )
  })

  test("routes an underscore-separated 'behind_the_scenes' title to -behindthescenes", () => {
    expect(
      applySpecialFeatureSuffix({
        text: "Some Title behind_the_scenes look",
        type: "behindthescenes",
      }),
    ).toBe(
      "Some Title behind_the_scenes look -behindthescenes",
    )
  })

  test("prepends 'Interview with ' to a lowercase-starting child whose parentType is interview", () => {
    expect(
      applySpecialFeatureSuffix({
        text: "actor Gary Busey",
        type: "interview",
        parentType: "interview",
      }),
    ).toBe("Interview with actor Gary Busey -interview")
  })

  test("prepends 'Interview with ' when only parentType is interview (child's own type is unknown)", () => {
    expect(
      applySpecialFeatureSuffix({
        text: "director Paul W.S. Anderson",
        type: "unknown",
        parentType: "interview",
      }),
    ).toBe(
      "Interview with director Paul W.S. Anderson -interview",
    )
  })

  test("capitalizes a lowercase-starting fragment when the category is not interview", () => {
    expect(
      applySpecialFeatureSuffix({
        text: "actor Jason Scott Lee",
        type: "featurette",
      }),
    ).toBe("Actor Jason Scott Lee -featurette")
  })

  test("leaves already-capitalized titles untouched", () => {
    expect(
      applySpecialFeatureSuffix({
        text: "Interview with Kurt Russell",
        type: "interview",
      }),
    ).toBe("Interview with Kurt Russell -interview")
  })
})
