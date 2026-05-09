import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { replaceRootPath } from "./storeAspectRatioData.js"

describe(replaceRootPath.name, () => {
  describe("Unix File Path", () => {
    test("Replaces with Unix root path.", async () => {
      expect(
        replaceRootPath({
          filePath: "/media/Movies/Super Mario Bros (1993)/Super Mario Bros (1993).mkv",
          fileSeparator: "/",
          newSourcePath: "/mnt/Backup_Drive",
          oldSourcePath: "/media",
        })
      )
      .toBe(
        "/mnt/Backup_Drive/Movies/Super Mario Bros (1993)/Super Mario Bros (1993).mkv"
      )
    })

    test("Replaces with Windows root path.", async () => {
      expect(
        replaceRootPath({
          filePath: "/media/Movies/Super Mario Bros (1993)/Super Mario Bros (1993).mkv",
          fileSeparator: "/",
          newSourcePath: "G:\\",
          oldSourcePath: "/media",
        })
      )
      .toBe(
        "G:\\Movies\\Super Mario Bros (1993)\\Super Mario Bros (1993).mkv"
      )
    })

    test("Handles trailing slashes in root path.", async () => {
      expect(
        replaceRootPath({
          filePath: "/media/Movies/Super Mario Bros (1993)/Super Mario Bros (1993).mkv",
          fileSeparator: "/",
          newSourcePath: "/mnt/Backup_Drive/",
          oldSourcePath: "/media",
        })
      )
      .toBe(
        "/mnt/Backup_Drive/Movies/Super Mario Bros (1993)/Super Mario Bros (1993).mkv"
      )
    })
  })

  describe("Windows File Path", () => {
    test("Replaces with Unix root path.", async () => {
      expect(
        replaceRootPath({
          filePath: "G:\\Movies\\Super Mario Bros (1993)\\Super Mario Bros (1993).mkv",
          fileSeparator: "\\",
          newSourcePath: "/media/Family",
          oldSourcePath: "G:\\",
        })
      )
      .toBe(
        "/media/Family/Movies/Super Mario Bros (1993)/Super Mario Bros (1993).mkv"
      )
    })

    test("Replaces with Windows root path.", async () => {
      expect(
        replaceRootPath({
          filePath: "G:\\Movies\\Super Mario Bros (1993)\\Super Mario Bros (1993).mkv",
          fileSeparator: "\\",
          newSourcePath: "C:\\Users\\Me\\Media",
          oldSourcePath: "G:\\",
        })
      )
      .toBe(
        "C:\\Users\\Me\\Media\\Movies\\Super Mario Bros (1993)\\Super Mario Bros (1993).mkv"
      )
    })

    test("Handles trailing slashes in root path.", async () => {
      expect(
        replaceRootPath({
          filePath: "G:\\Movies\\Super Mario Bros (1993)\\Super Mario Bros (1993).mkv",
          fileSeparator: "\\",
          newSourcePath: "C:\\Users\\Me\\Media\\",
          oldSourcePath: "G:\\",
        })
      )
      .toBe(
        "C:\\Users\\Me\\Media\\Movies\\Super Mario Bros (1993)\\Super Mario Bros (1993).mkv"
      )
    })
  })
})
