// Browser-side MSW bootstrap. Lives next to handlers.js so the toggle
// helper and the worker setup share the same module import graph (the
// CDN-pinned MSW version flows through both).
//
// `enableMocksIfRequested()` is a noop unless one of the opt-in signals
// is present:
//   - URL query param `?mock=1` (or any truthy value)
//   - `localStorage.useMocks` set to a truthy string
//
// We deliberately do NOT auto-start in the absence of these signals so
// the page loads exactly as it would against the real server when no
// developer has asked for mocks. The opt-in check runs synchronously
// at the very top of each page's bootstrap script and `await`s the
// service worker registration BEFORE any fetch/EventSource fires —
// this is required for MSW to intercept the first request, since SW
// registration is async and unhandled requests fall through to the
// network.
//
// MSW and its handlers are loaded lazily (dynamic import) so the CDN
// fetch only fires when mocks are actually requested. Non-mock page
// loads never touch esm.sh.

// Reuse a single worker instance across calls so a stray double-invoke
// from a refactor doesn't try to register the SW twice.
let workerInstance = null
let startPromise = null

const isTruthy = (
  value,
) => (
  value !== null
  && value !== undefined
  && value !== ""
  && value !== "0"
  && value !== "false"
)

const isMocksRequested = () => {
  try {
    const params = new URLSearchParams(location.search)
    if (isTruthy(params.get("mock"))) return true
  }
  catch {
    // Defensive: location.search is always present in a real browser,
    // but if this module ever loads in an exotic context we don't want
    // a thrown URLSearchParams to take the page down with it.
  }
  try {
    if (isTruthy(localStorage.getItem("useMocks"))) return true
  }
  catch {
    // localStorage can throw in private-browsing contexts on some
    // browsers — treat that as "not requested" rather than aborting.
  }
  return false
}

// Lazy: only fetches esm.sh and handlers.js when mocks are needed.
export const getWorker = async () => {
  if (!workerInstance) {
    const [{ setupWorker }, { handlers }] = await Promise.all([
      import("https://esm.sh/msw@2.14.4/browser"),
      import("./handlers.js"),
    ])
    workerInstance = setupWorker(...handlers)
  }
  return workerInstance
}

// Idempotent — once the worker has started for this page load, repeat
// callers get the cached promise. The promise resolves to `true` when
// the worker is live, `false` when mocks weren't requested.
export const enableMocksIfRequested = () => {
  if (startPromise) return startPromise
  if (!isMocksRequested()) {
    startPromise = Promise.resolve(false)
    return startPromise
  }
  startPromise = getWorker()
    .then((worker) => worker.start({
      serviceWorker: {
        // Phase 1 wrote the worker to /api/mockServiceWorker.js (the
        // server statically serves the public/api/ tree at the root).
        // If W1's flatten merges, this path will need to drop /api/.
        url: "/mockServiceWorker.js",
      },
      // Quiet the default 'request not handled' warnings — the existing
      // page code makes calls (e.g. /files/default-path) that aren't in
      // the canned handler list, and warning-spamming makes the [mocks
      // enabled] confirmation harder to spot. Real bypass requests still
      // fall through to the network.
      onUnhandledRequest: "bypass",
    }))
    .then(() => {
      // eslint-disable-next-line no-console
      console.info("[mocks] enabled")
      return true
    })
  return startPromise
}