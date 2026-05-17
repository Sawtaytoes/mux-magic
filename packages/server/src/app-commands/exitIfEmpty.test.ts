import { vol } from "memfs"
import { firstValueFrom } from "rxjs"
import { describe, expect, test } from "vitest"

import { exitIfEmpty } from "./exitIfEmpty.js"

describe(exitIfEmpty.name, () => {
  test("emits { isExiting: true } when sourcePath does not exist", async () => {
    const result = await firstValueFrom(
      exitIfEmpty({ sourcePath: "/missing" }),
    )

    expect(result.isExiting).toBe(true)
    expect(result.exitReason).toContain("does not exist")
  })

  test("emits { isExiting: true } when sourcePath exists but contains zero entries", async () => {
    vol.fromJSON({ "/empty/.keep": "" })
    vol.unlinkSync("/empty/.keep")

    const result = await firstValueFrom(
      exitIfEmpty({ sourcePath: "/empty" }),
    )

    expect(result.isExiting).toBe(true)
    expect(result.exitReason).toContain("is empty")
  })

  test("emits { isExiting: false } when sourcePath contains at least one entry", async () => {
    vol.fromJSON({ "/work/some.mkv": "data" })

    const result = await firstValueFrom(
      exitIfEmpty({ sourcePath: "/work" }),
    )

    expect(result.isExiting).toBe(false)
    expect(result.exitReason).toBe("")
  })

  test("rejects with a clear message when sourcePath points at a file (caller mistake — fail, do not paper over)", async () => {
    vol.fromJSON({ "/work/some.mkv": "data" })

    await expect(
      firstValueFrom(
        exitIfEmpty({ sourcePath: "/work/some.mkv" }),
      ),
    ).rejects.toThrow(/is not a directory/)
  })
})
