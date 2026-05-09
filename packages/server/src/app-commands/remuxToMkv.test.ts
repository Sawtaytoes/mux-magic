import { stat } from "node:fs/promises"
import { vol } from "memfs"
import { firstValueFrom, of, toArray } from "rxjs"
import { beforeEach, describe, expect, test, vi } from "vitest"

import { captureConsoleMessage } from "../tools/captureConsoleMessage.js"
import { remuxToMkv } from "./remuxToMkv.js"

// mkvmerge isn't a thing in memfs, so the spawn wrapper is mocked out.
// The fake honors the real contract — emit { inputFilePath, outputFilePath }
// once and complete — and writes a stub output file so per-file unlink
// assertions still mean something.
vi.mock("../cli-spawn-operations/remuxMkvMerge.js", () => ({
  remuxMkvMerge: vi.fn(),
}))

// Re-import after the mock is set up so the test sees the mocked symbol.
const { remuxMkvMerge } = await import("../cli-spawn-operations/remuxMkvMerge.js")

const setSuccessfulRemux = () => {
  vi.mocked(remuxMkvMerge).mockImplementation(({ inputFilePath }) => {
    const outputFilePath = inputFilePath.replace(/\.[^.]+$/u, ".mkv")
    vol.writeFileSync(outputFilePath, "")
    return of({ inputFilePath, outputFilePath })
  })
}

describe(remuxToMkv.name, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setSuccessfulRemux()
    vol.fromJSON({
      "G:\\TS\\episode-01.ts": "stream-1",
      "G:\\TS\\episode-02.ts": "stream-2",
      "G:\\TS\\readme.txt": "ignore-me",
    })
  })

  test("emits the new mkv path for every source file matching the requested extension", async () => {
    const results = await firstValueFrom(
      remuxToMkv({
        extensions: [".ts"],
        isRecursive: false,
        isSourceDeletedOnSuccess: false,
        sourcePath: "G:\\TS",
      })
      .pipe(toArray()),
    )
    expect(results.sort()).toEqual([
      "G:\\TS\\episode-01.mkv",
      "G:\\TS\\episode-02.mkv",
    ])
  })

  test("leaves source files in place when isSourceDeletedOnSuccess is false", async () => {
    await firstValueFrom(
      remuxToMkv({
        extensions: [".ts"],
        isRecursive: false,
        isSourceDeletedOnSuccess: false,
        sourcePath: "G:\\TS",
      })
      .pipe(toArray()),
    )
    await expect(stat("G:\\TS\\episode-01.ts")).resolves.toBeDefined()
    await expect(stat("G:\\TS\\episode-02.ts")).resolves.toBeDefined()
  })

  test("deletes the source after each per-file success when isSourceDeletedOnSuccess is true", async () => {
    await firstValueFrom(
      remuxToMkv({
        extensions: [".ts"],
        isRecursive: false,
        isSourceDeletedOnSuccess: true,
        sourcePath: "G:\\TS",
      })
      .pipe(toArray()),
    )
    await expect(stat("G:\\TS\\episode-01.ts")).rejects.toThrow()
    await expect(stat("G:\\TS\\episode-02.ts")).rejects.toThrow()
    await expect(stat("G:\\TS\\episode-01.mkv")).resolves.toBeDefined()
    await expect(stat("G:\\TS\\episode-02.mkv")).resolves.toBeDefined()
  })

  test("ignores files whose extension is outside the requested set", async () => {
    await firstValueFrom(
      remuxToMkv({
        extensions: [".ts"],
        isRecursive: false,
        isSourceDeletedOnSuccess: true,
        sourcePath: "G:\\TS",
      })
      .pipe(toArray()),
    )
    // .txt sibling is left untouched.
    await expect(stat("G:\\TS\\readme.txt")).resolves.toBeDefined()
    expect(vi.mocked(remuxMkvMerge)).toHaveBeenCalledTimes(2)
  })

  test("normalizes extensions case-insensitively and tolerates leading dots", async () => {
    vol.reset()
    vol.fromJSON({
      "G:\\TS\\one.TS": "upper",
      "G:\\TS\\two.ts": "lower",
    })
    const results = await firstValueFrom(
      remuxToMkv({
        // Mixed forms: with-dot, without-dot, uppercase.
        extensions: ["TS"],
        isRecursive: false,
        isSourceDeletedOnSuccess: false,
        sourcePath: "G:\\TS",
      })
      .pipe(toArray()),
    )
    expect(results).toHaveLength(2)
  })

  test("refuses to clobber a same-named .mkv that already exists; the rest of the directory still processes", async () => (
    captureConsoleMessage("error", async () => {
      vol.reset()
      vol.fromJSON({
        "G:\\TS\\episode-01.ts": "stream-1",
        "G:\\TS\\episode-01.mkv": "pre-existing",   // collision target
        "G:\\TS\\episode-02.ts": "stream-2",
      })

      const results = await firstValueFrom(
        remuxToMkv({
          extensions: [".ts"],
          isRecursive: false,
          isSourceDeletedOnSuccess: true,
          sourcePath: "G:\\TS",
        })
        .pipe(toArray()),
      )

      // Only episode-02 should have been remuxed; episode-01 was skipped
      // because of the collision and its .ts must survive.
      expect(results).toEqual(["G:\\TS\\episode-02.mkv"])
      await expect(stat("G:\\TS\\episode-01.ts")).resolves.toBeDefined()
      // Pre-existing .mkv content stays put — we never touched it.
      expect(vol.readFileSync("G:\\TS\\episode-01.mkv", "utf8")).toBe("pre-existing")
    })
  ))
})
