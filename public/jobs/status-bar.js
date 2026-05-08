// Connection-state display for the #status-bar element.
// Consumes the onConnected / onPossiblyDisconnected callbacks from the
// tolerant EventSource wrapper (sse-utils.js) and updates the bar text + class.

const el = document.getElementById("status-bar");

export function setConnected() {
  el.textContent = "Connected";
  el.className = "";
}

export function setUnstable() {
  el.textContent = "Connection unstable — retrying…";
  el.className = "error";
}
