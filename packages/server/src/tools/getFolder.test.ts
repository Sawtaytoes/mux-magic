import { join } from "node:path"
import { vol } from "memfs"
import { EmptyError, firstValueFrom, toArray } from "rxjs"
import { beforeEach, describe, expect, test } from "vitest"
import { captureLogMessage } from "./captureLogMessage.js"
import {
  type FolderInfo,
  filterFolderAtPath,
  getFolder,
} from "./getFolder.js"
import { getOperatorValue } from "./test-runners.js"

describe(filterFolderAtPath.name, () => {
  beforeEach(() => {
    vol.fromJSON({
      "/movies/Super Mario Bros (1993)/Super Mario Bros (1993).mkv":
        "",
    })
  })

  test("emits if path is a directory", async () => {
    const inputValue = "/movies/Super Mario Bros (1993)"

    await expect(
      getOperatorValue(
        filterFolderAtPath((filePath) => filePath),
        inputValue,
      ),
    ).resolves.toBe(inputValue)
  })

  test("throws an error if path is a file", async () => {
    const inputValue =
      "/movies/Super Mario Bros (1993)/Super Mario Bros (1993).mkv"

    await expect(
      getOperatorValue(
        filterFolderAtPath((filePath) => filePath),
        inputValue,
      ),
    ).rejects.toThrow(EmptyError)
  })
})

describe(getFolder.name, () => {
  test("errors if source path can't be found", async () => {
    await captureLogMessage("error", async () => {
      await expect(
        firstValueFrom(
          getFolder({
            sourcePath: "non-existent-path",
          }),
        ),
      ).rejects.toThrow("ENOENT")
    })
  })

  test("emits folders from source path", async () => {
    vol.fromJSON({
      "/movies/Star Wars (1977)/Star Wars (1977).mkv": "",
      "/movies/Star Wars (1977)/Star Wars (1977) {edition-4K77}.mkv":
        "",
      "/movies/Super Mario Bros (1993)/Super Mario Bros (1993).mkv":
        "",
    })

    await expect(
      firstValueFrom(
        getFolder({
          sourcePath: "/movies",
        }).pipe(toArray()),
      ),
    ).resolves.toEqual([
      {
        folderName: "Star Wars (1977)",
        fullPath: join("/movies", "Star Wars (1977)"),
        renameFolder: expect.any(Function),
      },
      {
        folderName: "Super Mario Bros (1993)",
        fullPath: join(
          "/movies",
          "Super Mario Bros (1993)",
        ),
        renameFolder: expect.any(Function),
      },
    ] satisfies FolderInfo[])
  })
})
