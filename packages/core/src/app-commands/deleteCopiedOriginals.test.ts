import { stat } from "node:fs/promises"
import { join } from "node:path"
import { captureConsoleMessage } from "@mux-magic/tools/test-helpers"
import { vol } from "memfs"
import { firstValueFrom, toArray } from "rxjs"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

import { deleteCopiedOriginals } from "./deleteCopiedOriginals.js"

// Records which paths went to the trash so tests can tell the trash
// strategy from a permanent delete. Removes the entry from memfs so the
// file system looks the same as after a real trash move.
const trashCalls: string[][] = []
vi.mock("trash", () => ({
  default: vi.fn((paths: string[]) => {
    trashCalls.push(paths.slice())
    paths.forEach((path) => {
      vol.rmSync(path, { recursive: true, force: true })
    })
    return Promise.resolve()
  }),
}))

describe(deleteCopiedOriginals.name, () => {
  const originalDeleteMode = process.env.DELETE_MODE

  beforeEach(() => {
    vol.reset()
    trashCalls.splice(0)
    delete process.env.DELETE_MODE
  })

  afterEach(() => {
    if (originalDeleteMode === undefined) {
      delete process.env.DELETE_MODE
    } else {
      process.env.DELETE_MODE = originalDeleteMode
    }
  })

  test("deletes every original whose copy exists", async () => {
    vol.fromJSON({
      "/staging/ep01.mkv": "ep1",
      "/staging/ep02.mkv": "ep2",
      "/library/ep01.mkv": "ep1",
      "/library/ep02.mkv": "ep2",
    })

    const results = await firstValueFrom(
      deleteCopiedOriginals({
        copiedDestinationPaths: [
          join("/library", "ep01.mkv"),
          join("/library", "ep02.mkv"),
        ],
        pathsToDelete: [
          join("/staging", "ep01.mkv"),
          join("/staging", "ep02.mkv"),
        ],
      }).pipe(toArray()),
    )

    expect(results).toEqual([
      join("/staging", "ep01.mkv"),
      join("/staging", "ep02.mkv"),
    ])
    await expect(
      stat(join("/staging", "ep01.mkv")),
    ).rejects.toThrow()
    await expect(
      stat(join("/staging", "ep02.mkv")),
    ).rejects.toThrow()
    await expect(
      stat(join("/library", "ep01.mkv")),
    ).resolves.toBeDefined()
  })

  test("moves originals to the trash by default", async () => {
    vol.fromJSON({
      "/staging/ep01.mkv": "ep1",
      "/library/ep01.mkv": "ep1",
    })

    await firstValueFrom(
      deleteCopiedOriginals({
        copiedDestinationPaths: ["/library/ep01.mkv"],
        pathsToDelete: ["/staging/ep01.mkv"],
      }).pipe(toArray()),
    )

    expect(trashCalls).toEqual([["/staging/ep01.mkv"]])
  })

  test("deletes permanently when DELETE_MODE is permanent", async () => {
    process.env.DELETE_MODE = "permanent"
    vol.fromJSON({
      "/staging/ep01.mkv": "ep1",
      "/library/ep01.mkv": "ep1",
    })

    await firstValueFrom(
      deleteCopiedOriginals({
        copiedDestinationPaths: ["/library/ep01.mkv"],
        pathsToDelete: ["/staging/ep01.mkv"],
      }).pipe(toArray()),
    )

    expect(trashCalls).toEqual([])
    await expect(
      stat("/staging/ep01.mkv"),
    ).rejects.toThrow()
  })

  test("is a no-op and emits nothing when pathsToDelete is empty", async () => {
    const results = await firstValueFrom(
      deleteCopiedOriginals({ pathsToDelete: [] }).pipe(
        toArray(),
      ),
    )

    expect(results).toEqual([])
  })

  test("deletes a copied folder once every file inside has a copy", async () => {
    vol.fromJSON({
      "/staging/ShowFolder/ep01.mkv": "ep1",
      "/staging/ShowFolder/extras/bonus.mkv": "bonus",
      "/library/ShowFolder/ep01.mkv": "ep1",
      "/library/ShowFolder/extras/bonus.mkv": "bonus",
    })

    await firstValueFrom(
      deleteCopiedOriginals({
        copiedDestinationPaths: [
          join("/library", "ShowFolder"),
        ],
        pathsToDelete: [join("/staging", "ShowFolder")],
      }).pipe(toArray()),
    )

    await expect(
      stat(join("/staging", "ShowFolder")),
    ).rejects.toThrow()
  })

  test("skips an original that is already gone", async () => {
    vol.fromJSON({
      "/library/ep01.mkv": "ep1",
    })

    const results = await firstValueFrom(
      deleteCopiedOriginals({
        copiedDestinationPaths: ["/library/ep01.mkv"],
        pathsToDelete: ["/staging/ep01.mkv"],
      }).pipe(toArray()),
    )

    expect(results).toEqual([])
    expect(trashCalls).toEqual([])
  })

  describe("refuses to delete anything", () => {
    test("when no copied destination paths are given", async () =>
      captureConsoleMessage("error", async () => {
        vol.fromJSON({
          "/staging/ep01.mkv": "ep1",
        })

        await expect(
          firstValueFrom(
            deleteCopiedOriginals({
              pathsToDelete: ["/staging/ep01.mkv"],
            }).pipe(toArray()),
          ),
        ).rejects.toThrow(/copiedDestinationPaths/)

        await expect(
          stat("/staging/ep01.mkv"),
        ).resolves.toBeDefined()
      }))

    test("when one copy is missing, even though the others exist", async () =>
      captureConsoleMessage("error", async () => {
        vol.fromJSON({
          "/staging/ep01.mkv": "ep1",
          "/staging/ep02.mkv": "ep2",
          "/library/ep01.mkv": "ep1",
        })

        await expect(
          firstValueFrom(
            deleteCopiedOriginals({
              copiedDestinationPaths: [
                "/library/ep01.mkv",
                "/library/ep02.mkv",
              ],
              pathsToDelete: [
                "/staging/ep01.mkv",
                "/staging/ep02.mkv",
              ],
            }).pipe(toArray()),
          ),
        ).rejects.toThrow(
          /is missing at "\/library\/ep02.mkv"/,
        )

        await expect(
          stat("/staging/ep01.mkv"),
        ).resolves.toBeDefined()
        await expect(
          stat("/staging/ep02.mkv"),
        ).resolves.toBeDefined()
      }))

    test("when a copy has a different size", async () =>
      captureConsoleMessage("error", async () => {
        vol.fromJSON({
          "/staging/ep01.mkv": "full episode bytes",
          "/library/ep01.mkv": "partial",
        })

        await expect(
          firstValueFrom(
            deleteCopiedOriginals({
              copiedDestinationPaths: ["/library/ep01.mkv"],
              pathsToDelete: ["/staging/ep01.mkv"],
            }).pipe(toArray()),
          ),
        ).rejects.toThrow(/does not match its size/)

        await expect(
          stat("/staging/ep01.mkv"),
        ).resolves.toBeDefined()
      }))

    test("when a copied folder is missing a nested file", async () =>
      captureConsoleMessage("error", async () => {
        vol.fromJSON({
          "/staging/ShowFolder/ep01.mkv": "ep1",
          "/staging/ShowFolder/extras/bonus.mkv": "bonus",
          "/library/ShowFolder/ep01.mkv": "ep1",
        })

        await expect(
          firstValueFrom(
            deleteCopiedOriginals({
              copiedDestinationPaths: [
                "/library/ShowFolder",
              ],
              pathsToDelete: ["/staging/ShowFolder"],
            }).pipe(toArray()),
          ),
        ).rejects.toThrow(
          /is missing at "\/library\/ShowFolder\/extras"/,
        )

        await expect(
          stat("/staging/ShowFolder/extras/bonus.mkv"),
        ).resolves.toBeDefined()
      }))

    test("when the copy is the original itself", async () =>
      captureConsoleMessage("error", async () => {
        vol.fromJSON({
          "/staging/ep01.mkv": "ep1",
        })

        await expect(
          firstValueFrom(
            deleteCopiedOriginals({
              copiedDestinationPaths: ["/staging/ep01.mkv"],
              pathsToDelete: ["/staging/ep01.mkv"],
            }).pipe(toArray()),
          ),
        ).rejects.toThrow(/same path as the original/)

        await expect(
          stat("/staging/ep01.mkv"),
        ).resolves.toBeDefined()
      }))

    test("when the copy is a symbolic link to the original", async () =>
      captureConsoleMessage("error", async () => {
        vol.fromJSON({
          "/staging/ep01.mkv": "ep1",
        })
        vol.mkdirSync("/library", { recursive: true })
        vol.symlinkSync(
          "/staging/ep01.mkv",
          "/library/ep01.mkv",
        )

        await expect(
          firstValueFrom(
            deleteCopiedOriginals({
              copiedDestinationPaths: ["/library/ep01.mkv"],
              pathsToDelete: ["/staging/ep01.mkv"],
            }).pipe(toArray()),
          ),
        ).rejects.toThrow(/which this step would delete/)

        expect(
          vol.readFileSync("/staging/ep01.mkv", "utf8"),
        ).toBe("ep1")
      }))

    test("when the pairs are crossed so each copy is another original", async () =>
      captureConsoleMessage("error", async () => {
        vol.fromJSON({
          "/staging/a.mkv": "same",
          "/staging/b.mkv": "same",
        })

        await expect(
          firstValueFrom(
            deleteCopiedOriginals({
              copiedDestinationPaths: [
                "/staging/b.mkv",
                "/staging/a.mkv",
              ],
              pathsToDelete: [
                "/staging/a.mkv",
                "/staging/b.mkv",
              ],
            }).pipe(toArray()),
          ),
        ).rejects.toThrow(/which this step would delete/)

        expect(vol.existsSync("/staging/a.mkv")).toBe(true)
        expect(vol.existsSync("/staging/b.mkv")).toBe(true)
      }))

    test("when a copied folder links back into the original folder", async () =>
      captureConsoleMessage("error", async () => {
        vol.fromJSON({
          "/staging/Show/ep01.mkv": "ep1",
        })
        vol.mkdirSync("/library/Show", { recursive: true })
        vol.symlinkSync(
          "/staging/Show/ep01.mkv",
          "/library/Show/ep01.mkv",
        )

        await expect(
          firstValueFrom(
            deleteCopiedOriginals({
              copiedDestinationPaths: ["/library/Show"],
              pathsToDelete: ["/staging/Show"],
            }).pipe(toArray()),
          ),
        ).rejects.toThrow(/which this step would delete/)

        expect(
          vol.existsSync("/staging/Show/ep01.mkv"),
        ).toBe(true)
      }))

    test("when the path is relative", async () =>
      captureConsoleMessage("error", async () => {
        vol.fromJSON({
          "/staging/ep01.mkv": "ep1",
          "/library/ep01.mkv": "ep1",
        })

        await expect(
          firstValueFrom(
            deleteCopiedOriginals({
              copiedDestinationPaths: ["/library/ep01.mkv"],
              pathsToDelete: ["staging/ep01.mkv"],
            }).pipe(toArray()),
          ),
        ).rejects.toThrow(/must be absolute/)
      }))
  })
})
