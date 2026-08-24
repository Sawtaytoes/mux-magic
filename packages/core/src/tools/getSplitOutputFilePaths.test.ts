import { join } from "node:path"
import { describe, expect, test } from "vitest"
import { getSplitOutputFilePaths } from "./getSplitOutputFilePaths.js"

const outputFilePath = join(
  "/media",
  "SPLITS",
  "Gintama S01.mkv",
)

describe("getSplitOutputFilePaths", () => {
  test("returns the numbered parts mkvmerge wrote for the output path", () => {
    expect(
      getSplitOutputFilePaths({
        fileNames: [
          "Gintama S01-001.mkv",
          "Gintama S01-002.mkv",
          "Gintama S01-003.mkv",
        ],
        outputFilePath,
      }),
    ).toEqual([
      join("/media", "SPLITS", "Gintama S01-001.mkv"),
      join("/media", "SPLITS", "Gintama S01-002.mkv"),
      join("/media", "SPLITS", "Gintama S01-003.mkv"),
    ])
  })

  test("orders parts numerically, not by directory-listing order", () => {
    expect(
      getSplitOutputFilePaths({
        fileNames: [
          "Gintama S01-010.mkv",
          "Gintama S01-002.mkv",
          "Gintama S01-001.mkv",
        ],
        outputFilePath,
      }),
    ).toEqual([
      join("/media", "SPLITS", "Gintama S01-001.mkv"),
      join("/media", "SPLITS", "Gintama S01-002.mkv"),
      join("/media", "SPLITS", "Gintama S01-010.mkv"),
    ])
  })

  test("ignores the parts belonging to another source file in the same folder", () => {
    expect(
      getSplitOutputFilePaths({
        fileNames: [
          "Gintama S01-001.mkv",
          "Gintama S02-001.mkv",
          "Gintama S02-002.mkv",
        ],
        outputFilePath,
      }),
    ).toEqual([
      join("/media", "SPLITS", "Gintama S01-001.mkv"),
    ])
  })

  test("ignores a same-stem file whose suffix is not a number", () => {
    expect(
      getSplitOutputFilePaths({
        fileNames: [
          "Gintama S01-001.mkv",
          "Gintama S01-extras.mkv",
          "Gintama S01-.mkv",
        ],
        outputFilePath,
      }),
    ).toEqual([
      join("/media", "SPLITS", "Gintama S01-001.mkv"),
    ])
  })

  test("ignores a part with a different extension", () => {
    expect(
      getSplitOutputFilePaths({
        fileNames: [
          "Gintama S01-001.mkv",
          "Gintama S01-002.mp4",
        ],
        outputFilePath,
      }),
    ).toEqual([
      join("/media", "SPLITS", "Gintama S01-001.mkv"),
    ])
  })

  test("returns nothing when mkvmerge wrote no parts", () => {
    expect(
      getSplitOutputFilePaths({
        fileNames: ["Some Other Show-001.mkv"],
        outputFilePath,
      }),
    ).toEqual([])
  })

  test("keeps a source stem that itself ends in a number apart from its parts", () => {
    expect(
      getSplitOutputFilePaths({
        fileNames: [
          "Volume 2-001.mkv",
          "Volume 2-002.mkv",
          "Volume 2.mkv",
        ],
        outputFilePath: join(
          "/media",
          "SPLITS",
          "Volume 2.mkv",
        ),
      }),
    ).toEqual([
      join("/media", "SPLITS", "Volume 2-001.mkv"),
      join("/media", "SPLITS", "Volume 2-002.mkv"),
    ])
  })
})
