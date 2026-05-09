import { vol } from "memfs"
import { EmptyError, firstValueFrom, toArray } from "rxjs"
import { beforeEach, describe, expect, test } from "vitest"

import { FolderInfo, filterFolderAtPath, getFolder } from "./getFolder.js"
import { getOperatorValue } from "./test-runners.js"
import { captureLogMessage } from "./captureLogMessage.js"

describe(filterFolderAtPath.name, () => {
  beforeEach(() => {
    vol
    .fromJSON({
      "G:\\Movies\\Super Mario Bros (1993)\\Super Mario Bros (1993).mkv": "",
    })
  })

  test("emits if path is a directory", async () => {
    const inputValue = "G:\\Movies\\Super Mario Bros (1993)"

    expect(
      getOperatorValue(
        filterFolderAtPath((
          filePath
        ) => (
          filePath
        )),
        inputValue,
      )
    )
    .resolves
    .toBe(
      inputValue
    )
  })

  test("throws an error if path is a file", async () => {
    const inputValue = "G:\\Movies\\Super Mario Bros (1993)\\Super Mario Bros (1993).mkv"

    expect(
      getOperatorValue(
        filterFolderAtPath((
          filePath
        ) => (
          filePath
        )),
        inputValue,
      )
    )
    .rejects
    .toThrow(
      EmptyError
    )
  })
})

describe(getFolder.name, () => {
  test("errors if source path can't be found", async () => {
    captureLogMessage(
      "error",
      async () => {
        expect(
          firstValueFrom(
            getFolder({
              sourcePath: "non-existent-path",
            })
          )
        )
        .rejects
        .toThrow(
          "ENOENT"
        )
      }
    )
  })

  test("emits folders from source path", async () => {
    vol
    .fromJSON({
      "G:\\Movies\\Star Wars (1977)\\Star Wars (1977).mkv": "",
      "G:\\Movies\\Star Wars (1977)\\Star Wars (1977) {edition-4K77}.mkv": "",
      "G:\\Movies\\Super Mario Bros (1993)\\Super Mario Bros (1993).mkv": "",
    })

    await expect(
      firstValueFrom(
        getFolder({
          sourcePath: "G:\\Movies",
        })
        .pipe(
          toArray(),
        )
      )
    )
    .resolves
    .toEqual([
      {
        folderName: "Star Wars (1977)",
        fullPath: "G:\\Movies\\Star Wars (1977)",
        renameFolder: expect.any(Function),
      },
      {
        folderName: "Super Mario Bros (1993)",
        fullPath: "G:\\Movies\\Super Mario Bros (1993)",
        renameFolder: expect.any(Function),
      },
    ] satisfies (
      FolderInfo[]
    ))
  })
})
