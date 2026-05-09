import { vol } from "memfs"
import { EmptyError, firstValueFrom, toArray } from "rxjs"
import { beforeEach, describe, expect, test } from "vitest"

import { FileInfo, filterFileAtPath, getFiles } from "./getFiles.js"
import { getOperatorValue } from "./test-runners.js"
import { captureLogMessage } from "./captureLogMessage.js"

describe(filterFileAtPath.name, () => {
  beforeEach(() => {
    vol
    .fromJSON({
      "G:\\Movies\\Super Mario Bros (1993)\\Super Mario Bros (1993).mkv": "",
    })
  })

  test("emits if path is a file", async () => {
    const inputValue = "G:\\Movies\\Super Mario Bros (1993)\\Super Mario Bros (1993).mkv"

    expect(
      getOperatorValue(
        filterFileAtPath((
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

  test("throws an error if path is a directory", async () => {
    const inputValue = "G:\\Movies\\Super Mario Bros (1993)"

    expect(
      getOperatorValue(
        filterFileAtPath((
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

describe(getFiles.name, () => {
  test("errors if source path can't be found", async () => {
    captureLogMessage(
      "error",
      async () => {
        expect(
          firstValueFrom(
            getFiles({
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

  test("emits files from source path", async () => {
    vol
    .fromJSON({
      "G:\\Movies\\Star Wars (1977)\\Star Wars (1977).mkv": "",
      "G:\\Movies\\Star Wars (1977)\\Star Wars (1977) {edition-4K77}.mkv": "",
      "G:\\Movies\\Super Mario Bros (1993)\\Super Mario Bros (1993).mkv": "",
    })

    await expect(
      firstValueFrom(
        getFiles({
          sourcePath: "G:\\Movies\\Star Wars (1977)",
        })
        .pipe(
          toArray(),
        )
      )
    )
    .resolves
    .toEqual([
      {
        filename: "Star Wars (1977)",
        fullPath: "G:\\Movies\\Star Wars (1977)\\Star Wars (1977).mkv",
        renameFile: expect.any(Function),
      },
      {
        filename: "Star Wars (1977) {edition-4K77}",
        fullPath: "G:\\Movies\\Star Wars (1977)\\Star Wars (1977) {edition-4K77}.mkv",
        renameFile: expect.any(Function),
      },
    ] satisfies (
      FileInfo[]
    ))
  })
})
