import { disableJobPersistenceForTests } from "@mux-magic/core/src/api/jobStore.js"
import { resetProviderCircuitsForTests } from "@mux-magic/core/src/provider-cache/providerCircuitBreaker.js"
import {
  closeSharedProviderCache,
  setSharedProviderCacheDatabasePathForTests,
} from "@mux-magic/core/src/tools/sharedProviderCache.js"
import {
  __resetTaskSchedulerForTests,
  initTaskScheduler,
} from "@mux-magic/tools"
import { vol } from "memfs"
import { afterEach, beforeEach, vi } from "vitest"

// Always mock `fs` because it's used everywhere, and we never want to hit the filesystem.
vi.mock("node:fs")
vi.mock("node:fs/promises")

// The `trash` package shells out to the real OS trash, outside memfs.
// Commands such as deleteFolder delete through it by default, so a test
// must never reach the real one. This stand-in removes the path from
// memfs instead. Tests that inspect trash calls mock it again locally.
vi.mock("trash", () => ({
  default: vi.fn((paths: string[]) => {
    paths.forEach((path) => {
      vol.rmSync(path, { recursive: true, force: true })
    })
    return Promise.resolve()
  }),
}))

// memfs is POSIX-only, and the test fixtures all use POSIX paths
// (`/work`, `/seq-root`, `/media`). Default `getPlatform` to "linux" so
// platform-gated guards in production code (notably the drive-relative
// path check in `pathSafety.ts`) treat the fixtures as legitimate
// absolute paths instead of rejecting them when the runner happens to be
// a Windows host. Tests that need win32-specific behavior re-stub
// `getPlatform` locally via `vi.mocked(getPlatform).mockReturnValue(...)`.
// Tools that read `os.platform()` (`isNetworkPath`, `openInExternalApp`,
// `appPaths`) are unaffected — they go through `node:os`, not this shim.
vi.mock(
  "@mux-magic/core/src/tools/currentEnvironment.js",
  () => ({
    getCwd: vi.fn(() => "/work"),
    getPlatform: vi.fn(() => "linux"),
  }),
)

// Every provider read (TMDB, TVDB, Jikan, …) goes through the shared
// provider cache. `node:sqlite` does not go through the memfs mock, so
// without this a route test would write a real `provider-cache.sqlite`,
// and one test's stored answer would be the next test's fallback.
setSharedProviderCacheDatabasePathForTests(":memory:")

// Initialize the global Task scheduler with unbounded concurrency for
// tests — they don't care about concurrency caps, they just need the
// `runTask` plumbing to be live so `withFileProgress` doesn't throw.
beforeEach(() => {
  initTaskScheduler(Infinity)
  disableJobPersistenceForTests()
  closeSharedProviderCache()
  resetProviderCircuitsForTests()
})

// Reset the in-memory filesystem and scheduler after each test so state
// doesn't bleed across files.
afterEach(() => {
  vol.reset()

  __resetTaskSchedulerForTests()
})
