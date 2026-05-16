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
// (`/work`, `/seq-root`, `/media`). Default `getPlatform` to "linux" so
// platform-gated guards in production code (notably the drive-relative
// path check in `pathSafety.ts`) treat the fixtures as legitimate
// absolute paths instead of rejecting them when the runner happens to be
// a Windows host. Tests that need win32-specific behavior re-stub
// `getPlatform` locally via `vi.mocked(getPlatform).mockReturnValue(...)`.
// Tools that read `os.platform()` (`isNetworkPath`, `openInExternalApp`,
// `appPaths`) are unaffected — they go through `node:os`, not this shim.
vi.mock("./src/tools/currentEnvironment.js", () => ({
  getCwd: vi.fn(() => "/work"),
  getPlatform: vi.fn(() => "linux"),
}))

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
