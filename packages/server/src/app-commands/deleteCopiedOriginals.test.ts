import { stat } from "node:fs/promises"
import { join } from "node:path"
import { vol } from "memfs"
import { firstValueFrom, toArray } from "rxjs"
import { beforeEach, describe, expect, test } from "vitest"

import { deleteCopiedOriginals } from "./deleteCopiedOriginals.js"

describe(deleteCopiedOriginals.name, () => {
  beforeEach(() => {
    vol.reset()
  })

  test("deletes every path in the pathsToDelete list", async () => {
    vol.fromJSON({
      "/staging/ep01.mkv": "ep1",
      "/staging/ep02.mkv": "ep2",
    })

    await firstValueFrom(
      deleteCopiedOriginals({
        pathsToDelete: [
          join("/staging", "ep01.mkv"),
          join("/staging", "ep02.mkv"),
        ],
      }).pipe(toArray()),
    )

    await expect(
      stat(join("/staging", "ep01.mkv")),
    ).rejects.toThrow()
    await expect(
      stat(join("/staging", "ep02.mkv")),
    ).rejects.toThrow()
  })

  test("emits one deleted path string per file removed", async () => {
    vol.fromJSON({
      "/staging/ep01.mkv": "ep1",
      "/staging/ep02.mkv": "ep2",
    })

    const results = await firstValueFrom(
      deleteCopiedOriginals({
        pathsToDelete: [
          join("/staging", "ep01.mkv"),
          join("/staging", "ep02.mkv"),
        ],
      }).pipe(toArray()),
    )

    expect(results.sort()).toEqual(
      [
        join("/staging", "ep01.mkv"),
        join("/staging", "ep02.mkv"),
      ].sort(),
    )
  })

  test("is a no-op and emits nothing when pathsToDelete is empty", async () => {
    const results = await firstValueFrom(
      deleteCopiedOriginals({ pathsToDelete: [] }).pipe(
        toArray(),
      ),
    )

    expect(results).toEqual([])
  })

  test("deletes folder entries (directories) as well as files", async () => {
    vol.fromJSON({
      "/staging/ShowFolder/ep01.mkv": "ep1",
    })

    await firstValueFrom(
      deleteCopiedOriginals({
        pathsToDelete: [join("/staging", "ShowFolder")],
      }).pipe(toArray()),
    )

    await expect(
      stat(join("/staging", "ShowFolder")),
    ).rejects.toThrow()
  })
})
