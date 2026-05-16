import {
  __resetTaskSchedulerForTests,
  initTaskScheduler,
} from "@mux-magic/tools"
import { vol } from "memfs"
import { afterEach, beforeEach, vi } from "vitest"

// Always mock `fs` because it's used everywhere, and we never want to hit the filesystem.
vi.mock("node:fs")
vi.mock("node:fs/promises")

// memfs is POSIX-only, and the test fixtures all use POSIX paths
// (`/work`, `/seq-root`, `/media`). Force `process.platform` to "linux"
// per-test so platform-gated guards in production code (notably the
// drive-relative path check in `pathSafety.ts`) treat the fixtures as
// legitimate absolute paths instead of rejecting them when the runner
// happens to be a Windows host. Done in `beforeEach` (not at module
// load) because vitest's own module resolver reads `process.platform`
// during startup, and clobbering it pre-init confuses Windows path
// resolution inside vitest internals. Tests that need win32-specific
// behavior stub `process.platform` locally and restore in their own
// `afterEach`. Tools that read `os.platform()` (`isNetworkPath`,
// `openInExternalApp`, `appPaths`) are unaffected — they go through
// `node:os`, not `process`.
const originalPlatformDescriptor =
  Object.getOwnPropertyDescriptor(
    process,
    "platform",
  ) as PropertyDescriptor

// Initialize the global Task scheduler with unbounded concurrency for
// tests — they don't care about concurrency caps, they just need the
// `runTask` plumbing to be live so `withFileProgress` doesn't throw.
beforeEach(() => {
  Object.defineProperty(process, "platform", {
    configurable: true,
    value: "linux",
  })
  initTaskScheduler(Infinity)
})

// Reset the in-memory filesystem and scheduler after each test so state
// doesn't bleed across files.
afterEach(() => {
  Object.defineProperty(
    process,
    "platform",
    originalPlatformDescriptor,
  )
  vol.reset()

  __resetTaskSchedulerForTests()
})
