// Entry point for the Jobs UI.
// Wires the log-stream first-progress callback (so job-card re-renders
// when the first progress event arrives for a running job), then starts
// the /jobs/stream SSE consumer.

import { setOnFirstProgress, progressByJobId } from "/jobs/log-stream.js";
import { jobsById, renderJob } from "/jobs/job-card.js";
import { connect } from "/jobs/sse-stream.js";

const jobsEl = document.getElementById("jobs");

// When the first progress event arrives for a job id, we need to
// re-render the parent card so mountProgressBar wires up the slot.
// Subsequent events paint in place via paintProgressBar (no full re-render).
setOnFirstProgress((jobId) => {
  // Determine which top-level card to refresh.
  const job = jobsById.get(jobId);
  if (!job) return;

  const topLevelJob = job.parentJobId
    ? jobsById.get(job.parentJobId)
    : job;
  if (!topLevelJob) return;

  const existing = jobsEl.querySelector(`[data-id="${topLevelJob.id}"]`);
  const card = renderJob(topLevelJob);
  if (existing) {
    existing.replaceWith(card);
  } else {
    jobsEl.prepend(card);
  }
});

connect();
