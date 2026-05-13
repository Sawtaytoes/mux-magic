import { vol } from "memfs"
import { afterEach, vi } from "vitest"

// Always mock `fs` because the file-system helpers in this package use it
// pervasively, and we never want unit tests to hit the real disk. memfs
// replaces both `node:fs` (sync API) and `node:fs/promises` (async API).
vi.mock("node:fs")
vi.mock("node:fs/promises")

// Reset the in-memory filesystem after each test so state doesn't bleed
// across test files.
afterEach(() => {
  vol.reset()
})
