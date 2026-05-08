// /jobs/stream SSE consumer.
// Receives whole-job update events and drives upsertJob to keep the
// DOM in sync. Depends on the global `createTolerantEventSource`
// (sse-utils.js) loaded as a plain <script> tag before the module entry.

import { jobsById, renderJob } from "/jobs/job-card.js";
import { progressByJobId } from "/jobs/log-stream.js";
import { setConnected, setUnstable } from "/jobs/status-bar.js";

const jobsEl = document.getElementById("jobs");

function renderTopLevel(job) {
  const existing = jobsEl.querySelector(`[data-id="${job.id}"]`);
  const card = renderJob(job);
  if (existing) {
    existing.replaceWith(card);
  } else {
    jobsEl.prepend(card);
  }
}

function upsertJob(job) {
  jobsById.set(job.id, job);

  // Drop any cached progress snapshot once the job reaches a terminal
  // state — the bar is gated on running status so it'd disappear from
  // the DOM either way, but clearing the map prevents unbounded growth.
  if (job.status !== "running" && job.status !== "pending") {
    progressByJobId.delete(job.id);
  }

  // Children are rendered inside their parent's card. If the event is
  // for a child, find its parent and re-render the whole parent card so
  // the Steps section refreshes. If the parent isn't in the map yet
  // (out-of-order delivery), bail — we'll catch it when the parent's
  // own event lands and getChildren picks the now-stored child up.
  if (job.parentJobId) {
    const parent = jobsById.get(job.parentJobId);
    if (parent) renderTopLevel(parent);
    return;
  }

  renderTopLevel(job);
}

export function connect() {
  createTolerantEventSource("/jobs/stream", {
    onConnected: () => setConnected(),
    // Only fires after the connection has been actively reconnecting
    // for graceMs (default 5s). Most short blips never surface.
    onPossiblyDisconnected: () => setUnstable(),
    onMessage: (job) => upsertJob(job),
  });
}
