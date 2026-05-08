// Node-side MSW server harness for vitest. Wired into vitest.config.ts
// under the `node` project's `setupFiles` so every Node test file
// inherits the lifecycle hooks below — `server.listen()` once before
// the suite, `resetHandlers()` after each test (so per-test
// `server.use(...)` overrides don't leak), and `server.close()` once
// at teardown.
//
// Phase 2 ships the harness only — there are no Node tests using MSW
// yet, and `handlers` from src/__shared__/msw-handlers.ts is
// intentionally empty. The harness loads cleanly so adding the first
// real test in a future phase is a one-file change.
import {
  afterAll,
  afterEach,
  beforeAll,
} from "vitest"
import { setupServer } from "msw/node"

import { handlers } from "../../__shared__/msw-handlers.js"

export const server = setupServer(...handlers)

// `onUnhandledRequest: "bypass"` keeps the harness silent for routes
// nobody has mocked yet — the existing src/**/*.test.ts suites
// (jobRoutes, queryRoutes, etc.) start their own Hono servers and
// hit them over real loopback, and we don't want MSW logging a
// warning for every one of those. When Phase 3 starts adding tests
// that DO want to assert against MSW, those tests can flip this to
// "error" via `server.listen({ onUnhandledRequest: "error" })` in a
// targeted `beforeAll`.
beforeAll(() => {
  server.listen({ onUnhandledRequest: "bypass" })
})

afterEach(() => {
  server.resetHandlers()
})

afterAll(() => {
  server.close()
})
