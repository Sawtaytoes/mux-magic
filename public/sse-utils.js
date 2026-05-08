// Shared SSE client helpers. Loaded as a plain <script src="/sse-utils.js">
// so any page served from public/ can use it without bundling.
(function (global) {
  'use strict'

  // EventSource has a built-in auto-reconnect (3s default delay) when the
  // connection drops. The catch is that `onerror` fires every time it
  // enters that reconnecting window — so showing a "Connection lost"
  // banner directly from `onerror` flashes for every transient blip,
  // even ones the browser recovers from in a couple of seconds.
  //
  // createTolerantEventSource wraps EventSource so:
  //   - onConnected fires on the initial open AND on every successful
  //     reconnect (so the caller can clear any "lost" UI).
  //   - onPossiblyDisconnected fires only after the connection has been
  //     in CONNECTING state for graceMs (default 5s). Most real-world
  //     reconnects land well under this — the user sees nothing at all.
  //     If it fires, it's a "this is probably actually unhealthy now" signal.
  //   - onMessage is called with the parsed JSON payload (if the data
  //     parses) — saves callers from rewriting the same try/catch.
  //
  // The returned object has .close() to tear the underlying EventSource
  // down; call it when the consumer (modal, card, etc.) is removed from
  // the DOM. graceMs can be tuned per call site.
  function createTolerantEventSource(url, opts) {
    opts = opts || {}
    var onMessage = opts.onMessage
    var onConnected = opts.onConnected
    var onPossiblyDisconnected = opts.onPossiblyDisconnected
    var graceMs = typeof opts.graceMs === 'number' ? opts.graceMs : 5000

    var es = new EventSource(url)
    var lostTimer = null
    var closedByCaller = false

    function clearLostTimer() {
      if (lostTimer) {
        clearTimeout(lostTimer)
        lostTimer = null
      }
    }

    es.onopen = function () {
      clearLostTimer()
      if (onConnected) onConnected()
    }

    if (onMessage) {
      es.onmessage = function (event) {
        var data
        try { data = JSON.parse(event.data) } catch (_) { return }
        onMessage(data, event)
      }
    }

    es.onerror = function () {
      if (closedByCaller) return

      // CLOSED means the browser has given up reconnecting — usually a
      // non-retryable HTTP status from the server, or the caller closed
      // the source. No grace period: signal final disconnect immediately.
      if (es.readyState === EventSource.CLOSED) {
        clearLostTimer()
        if (onPossiblyDisconnected) onPossiblyDisconnected({ final: true })
        return
      }

      // CONNECTING — auto-reconnect is in progress. Defer the alert so
      // typical 3s reconnects don't flash any UI at all.
      if (lostTimer) return
      lostTimer = setTimeout(function () {
        lostTimer = null
        if (onPossiblyDisconnected) onPossiblyDisconnected({ final: false })
      }, graceMs)
    }

    return {
      close: function () {
        closedByCaller = true
        clearLostTimer()
        es.close()
      },
      // Exposed mainly for tests / introspection. Callers should use the
      // onConnected / onPossiblyDisconnected callbacks for state UX.
      get readyState() { return es.readyState },
      raw: es,
    }
  }

  global.createTolerantEventSource = createTolerantEventSource
})(window)
