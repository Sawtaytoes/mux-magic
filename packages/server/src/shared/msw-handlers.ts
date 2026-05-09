// Node-side MSW request handlers for the vitest setupServer harness.
//
// Phase 1 wrote the browser-side handlers as plain JS at
// public/api/mocks/handlers.js, importing MSW from a CDN URL
// (https://esm.sh/msw@2.14.4) so the public/ tree can stay
// build-step-free. Node tests can't follow that URL — they import MSW
// from node_modules — so this file mirrors the browser handler
// surface using the npm package.
//
// We deliberately keep this minimal for now: the real fixtures + SSE
// builders live in JS form (handlers.js / fixtures.js) and porting
// them to TS will happen in a later phase when the first Node test
// actually exercises a route. For Phase 2 the handler list is empty;
// `setupServer(...handlers)` with an empty list is a perfectly valid
// no-op server that asserts every request is unhandled (useful as a
// canary so we notice if something accidentally hits the network).
//
// Import surface kept ergonomic: the next phase can drop fixtures and
// http handlers in here without retouching the harness file.
import { http, HttpResponse, passthrough } from "msw"

export const handlers = [
  // Intentionally empty — Phase 2 ships the harness; Phase 3 (or first
  // Node test) will populate this with the relevant routes.
]

// Re-exports so test files can import these helpers from a single
// place when they start adding bespoke handlers in tests.
export {
  http,
  HttpResponse,
  passthrough,
}
