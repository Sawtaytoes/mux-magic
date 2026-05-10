// Auto-reloads the page when the server process restarts.
//
// Connects to /server-id/stream — a tiny SSE endpoint that emits a
// { bootId } event on every connect. The bootId is generated once per
// process, so it stays constant while the server runs and changes on
// every restart. EventSource auto-reconnects after a drop, so:
//   - The first bootId we see is captured as the baseline.
//   - Any later bootId that doesn't match means the server we
//     reconnected to is a different process — reload to pick up the
//     latest HTML/JS.
//
// Loaded as a plain <script src="/reload-on-restart.js"> from each
// page that should pick up server restarts (jobs, builder).
;(() => {
  if (
    typeof window.createTolerantEventSource !== "function"
  ) {
    return
  }

  var firstBootId = null

  window.createTolerantEventSource("/server-id/stream", {
    onMessage: (data) => {
      if (!data || typeof data.bootId !== "string") return
      if (firstBootId === null) {
        firstBootId = data.bootId
        return
      }
      if (data.bootId !== firstBootId) {
        window.location.reload()
      }
    },
  })
})()
