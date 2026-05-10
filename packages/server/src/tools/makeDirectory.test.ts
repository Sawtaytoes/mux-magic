import { vol } from "memfs"
import { dirname } from "node:path"
import { firstValueFrom } from "rxjs"
import { beforeEach, describe, expect, test } from "vitest"

import { makeDirectory } from "./makeDirectory.js"

describe(makeDirectory.name, () => {
  beforeEach(() => {
    vol
    .fromJSON({
      "/movies/Star Wars (1977)/Star Wars (1977).mkv": "",
    })
  })

  test("creates the parent directory when caller passes dirname of a file path", async () => {
    const filePath = "/movies/Super Mario Bros (1993)/Super Mario Bros (1993).mkv"

    await firstValueFrom(makeDirectory(dirname(filePath)))

    await expect(
      new Promise((
        resolve,
        reject,
      ) => {
        vol
        .readdir(
          "/movies",
          (error, data) => {
            if (error) {
              reject(error)
            }
            else {
              resolve(data)
            }
          },
        )
      })
    )
    .resolves
    .toEqual([
      "Star Wars (1977)",
      "Super Mario Bros (1993)",
    ])
  })

  test("creates the directory itself given a path with no file extension", async () => {
    const folderPath = "/movies/Super Mario Bros (1993)"

    await firstValueFrom(makeDirectory(folderPath))

    await expect(
      new Promise((
        resolve,
        reject,
      ) => {
        vol
        .readdir(
          "/movies",
          (error, data) => {
            if (error) {
              reject(error)
            }
            else {
              resolve(data)
            }
          },
        )
      })
    )
    .resolves
    .toEqual([
      "Star Wars (1977)",
      "Super Mario Bros (1993)",
    ])
  })
})
