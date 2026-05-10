import { vol } from "memfs"
import { afterEach, beforeEach, vi } from "vitest"

import {
  __resetTaskSchedulerForTests,
  initTaskScheduler,
} from "./src/tools/taskScheduler.js"

// Always mock `fs` because it's used everywhere, and we never want to hit the filesystem.
vi.mock("node:fs")
vi.mock("node:fs/promises")

// Initialize the global Task scheduler with unbounded concurrency for
// tests — they don't care about concurrency caps, they just need the
// `runTask` plumbing to be live so `withFileProgress` doesn't throw.
beforeEach(() => {
  initTaskScheduler(Infinity)
})

// Reset the in-memory filesystem and scheduler after each test so state
// doesn't bleed across files.
afterEach(() => {
  vol.reset()

  __resetTaskSchedulerForTests()
})
