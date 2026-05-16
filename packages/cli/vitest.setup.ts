import { vol } from "memfs"
import { afterEach, vi } from "vitest"

// Always mock `fs` so unit tests can never write to the real disk.
// memfs replaces both `node:fs` (sync API) and `node:fs/promises`
// (async API) via the manual mocks in `__mocks__/fs.cjs` and
// `__mocks__/fs/promises.cjs`.
//
// Note: child processes spawned by tests (e.g. the `tsx cli --help`
// integration check) run in a separate Node process where this mock
// does NOT apply. Tests that spawn the CLI must not pass paths that
// would cause the child to touch the real disk.
vi.mock("node:fs")
vi.mock("node:fs/promises")

afterEach(() => {
  vol.reset()
})
