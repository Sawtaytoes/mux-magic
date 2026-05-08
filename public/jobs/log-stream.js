// Per-job log and progress SSE consumer.
// Opens /jobs/:id/logs EventSources on demand and feeds accumulated log
// lines + progress snapshots into the shared maps. Depends on the global
// `createTolerantEventSource` (sse-utils.js) and `ProgressUtils`
// (progress-utils.js) — both loaded as plain <script> tags before the
// module entry point, so `window.*` references resolve at call time.

// Accumulated log lines per job id.
export const logsByJobId = new Map();

// Live EventSource handles per job id (closed once done:true arrives).
const logEventSourcesByJobId = new Map();

// Highest SSE `id` seen per job — used to deduplicate the server's
// replay-from-0 on reconnect or re-open.
const lastLogIndexByJobId = new Map();

// Merged progress snapshot per job id.
export const progressByJobId = new Map();

// Callbacks registered by job-card.js so log-stream can trigger a
// re-render when the first progress event for a job arrives.
let onFirstProgressCallbacks = null;
export function setOnFirstProgress(cb) {
  onFirstProgressCallbacks = cb;
}

export function mergeProgress(jobId, event) {
  progressByJobId.set(
    jobId,
    ProgressUtils.mergeProgress(progressByJobId.get(jobId), event)
  );
}

export function paintProgressBar(jobId) {
  const container = document.querySelector(`[data-progress-id="${jobId}"]`);
  if (!container) return;
  ProgressUtils.paintProgressBar(container, progressByJobId.get(jobId));
}

export function mountProgressBar(parent, jobId) {
  // Only mount when there's something to show. Trivially-fast jobs
  // never emit progress (silent-fast rule on the server) so they get
  // no bar at all — keeps the UI quiet for 200ms ops.
  if (!progressByJobId.has(jobId)) return;
  const row = ProgressUtils.createProgressRow();
  row.dataset.progressId = jobId;
  parent.append(row);
  paintProgressBar(jobId);
}

export function appendLogLine(jobId, line) {
  const lines = logsByJobId.get(jobId) ?? [];
  lines.push(line);
  logsByJobId.set(jobId, lines);
  // Direct DOM append on the currently-mounted pane (the card may have
  // been swapped by a status-change upsertJob since we opened the ES).
  const pane = document.querySelector(`[data-log-id="${jobId}"]`);
  if (pane) {
    const empty = pane.querySelector(".log-empty");
    if (empty) empty.remove();
    const node = document.createElement("div");
    node.textContent = line;
    pane.append(node);
    pane.scrollTop = pane.scrollHeight;
  }
}

export function ensureLogStream(jobId) {
  if (logEventSourcesByJobId.has(jobId)) return;
  const handle = createTolerantEventSource(`/jobs/${jobId}/logs`, {
    onMessage: (data, event) => {
      if (typeof data.line === "string") {
        // Dedup: server tags each line with its job.logs index. On a
        // fresh EventSource the server replays from 0; lastLogIndexByJobId
        // remembers the highest index we've already appended, so the
        // replay's first N lines (already in our cache) get dropped.
        const rawId = event && event.lastEventId;
        if (rawId !== "" && rawId !== undefined && rawId !== null) {
          const idNum = Number(rawId);
          if (Number.isFinite(idNum)) {
            const lastSeen = lastLogIndexByJobId.get(jobId);
            if (lastSeen !== undefined && idNum <= lastSeen) {
              return;
            }
            lastLogIndexByJobId.set(jobId, idNum);
          }
        }
        appendLogLine(jobId, data.line);
      } else if (data.type === "progress") {
        // Top-level rollup fields merge field-by-field; currentFiles
        // is whole-array replace (the server snapshot is authoritative).
        const hadEntry = progressByJobId.has(jobId);
        mergeProgress(jobId, data);
        if (!hadEntry) {
          // First progress event for this id — the running card
          // didn't render a bar (no data yet at render time). Trigger
          // one re-render so mountProgressBar wires up the slot;
          // subsequent events paint in place via paintProgressBar.
          if (onFirstProgressCallbacks) onFirstProgressCallbacks(jobId);
        } else {
          paintProgressBar(jobId);
        }
      } else if (data.done) {
        handle.close();
        logEventSourcesByJobId.delete(jobId);
      }
    },
    // Final-only disconnect → close and forget. Transient blips are
    // absorbed by the helper's grace timer (silent auto-reconnect).
    onPossiblyDisconnected: ({ final }) => {
      if (final) {
        handle.close();
        logEventSourcesByJobId.delete(jobId);
      }
    },
  });
  logEventSourcesByJobId.set(jobId, handle);
}
