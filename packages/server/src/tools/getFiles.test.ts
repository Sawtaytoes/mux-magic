import { join } from "node:path"
import { vol } from "memfs"
import { EmptyError, firstValueFrom, toArray } from "rxjs"
import { beforeEach, describe, expect, test } from "vitest"
import { captureLogMessage } from "./captureLogMessage.js"
import {
  type FileInfo,
  filterFileAtPath,
  getFiles,
} from "./getFiles.js"
import { getOperatorValue } from "./test-runners.js"

describe(filterFileAtPath.name, () => {
  beforeEach(() => {
    vol.fromJSON({
      "/movies/Super Mario Bros (1993)/Super Mario Bros (1993).mkv":
        "",
    })
  })

  test("emits if path is a file", async () => {
    const inputValue =
      "/movies/Super Mario Bros (1993)/Super Mario Bros (1993).mkv"

    await expect(
      getOperatorValue(
        filterFileAtPath((filePath) => filePath),
        inputValue,
      ),
    ).resolves.toBe(inputValue)
  })

  test("throws an error if path is a directory", async () => {
    const inputValue = "/movies/Super Mario Bros (1993)"

    await expect(
      getOperatorValue(
        filterFileAtPath((filePath) => filePath),
        inputValue,
      ),
    ).rejects.toThrow(EmptyError)
  })
})

describe(getFiles.name, () => {
  test("errors if source path can't be found", async () => {
    await captureLogMessage("error", async () => {
      await expect(
        firstValueFrom(
          getFiles({
            sourcePath: "non-existent-path",
          }),
        ),
      ).rejects.toThrow("ENOENT")
    })
  })

  test("emits files from source path", async () => {
    vol.fromJSON({
      "/movies/Star Wars (1977)/Star Wars (1977) {edition-4K77}.mkv":
        "",
      "/movies/Star Wars (1977)/Star Wars (1977).mkv": "",
      "/movies/Super Mario Bros (1993)/Super Mario Bros (1993).mkv":
        "",
    })

    const expected: FileInfo[] = [
      {
        filename: "Star Wars (1977) {edition-4K77}",
        fullPath: join(
          "/movies/Star Wars (1977)",
          "Star Wars (1977) {edition-4K77}.mkv",
        ),
        renameFile: expect.any(Function),
      },
      {
        filename: "Star Wars (1977)",
        fullPath: join(
          "/movies/Star Wars (1977)",
          "Star Wars (1977).mkv",
        ),
        renameFile: expect.any(Function),
      },
    ]
    const actual = await firstValueFrom(
      getFiles({
        sourcePath: "/movies/Star Wars (1977)",
      }).pipe(toArray()),
    )
    expect(actual).toEqual(expect.arrayContaining(expected))
    expect(actual).toHaveLength(expected.length)
  })
})
