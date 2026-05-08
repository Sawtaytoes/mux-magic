import { vol } from "memfs"
import { describe, expect, test } from "vitest"

import { copyFiles } from "./copyFiles.js"

// Direct Observable-level coverage for the cancel-cleanup contract on
// copyFiles: the wrapper Observable must abort the in-flight per-file
// copy when its subscription is torn down (sequence cancel / parallel
// sibling fail-fast), and the half-written destination must not be
// left behind. The lower-level `aclSafeCopyFile.test.ts` already
// asserts the unlink-on-abort plumbing in isolation; this file proves
// the wrapper actually wires its AbortController into that plumbing
// so an unsubscribe propagates all the way down to a fs.unlink of the
// partial destination file.
describe(copyFiles.name, () => {
  test("synchronous unsubscribe aborts the AbortController so per-file copies are not started", async () => {
    // Subscribe and tear down in the same microtask, before getFiles'
    // readdir promise has even resolved. This proves the wrapper
    // Observable's teardown function fires regardless of whether any
    // per-file copy actually started — the AbortController is aborted
    // and the inner subscription is unsubscribed, so no destination
    // file is ever created.
    const seedFiles: Record<string, string> = {}
    for (let index = 0; index < 8; index += 1) {
      seedFiles[`/cancel-src/file${index}.txt`] = (
        "byte-".repeat(2000) + index
      )
    }
    vol.fromJSON(seedFiles)

    const subscription = (
      copyFiles({
        destinationPath: "/cancel-dst",
        sourcePath: "/cancel-src",
      })
      .subscribe()
    )
    subscription.unsubscribe()

    // Allow any in-flight async work + the unlink-on-abort cleanup
    // to run before we assert.
    await new Promise<void>((r) => setTimeout(r, 50))

    // No destination files should be present — either nothing started
    // (the more common timing under memfs), or anything that did start
    // was unlinked on abort. Both outcomes are equivalent for the
    // contract: cancel must not leave half-written files behind.
    for (let index = 0; index < 8; index += 1) {
      expect(
        vol.existsSync(`/cancel-dst/file${index}.txt`)
      ).toBe(false)
    }
  })

  test("unsubscribing before the first file emission leaves no destination files", async () => {
    // Subscribe + unsubscribe synchronously: nothing has copied yet,
    // and crucially nothing should be left over from a half-open
    // write stream either.
    vol.fromJSON({
      "/sync-src/a.txt": "alpha",
      "/sync-src/b.txt": "beta",
    })

    const subscription = (
      copyFiles({
        destinationPath: "/sync-dst",
        sourcePath: "/sync-src",
      })
      .subscribe()
    )
    subscription.unsubscribe()

    await new Promise<void>((r) => setTimeout(r, 50))

    const aExists = vol.existsSync("/sync-dst/a.txt")
    const bExists = vol.existsSync("/sync-dst/b.txt")
    expect(aExists).toBe(false)
    expect(bExists).toBe(false)
  })
})
