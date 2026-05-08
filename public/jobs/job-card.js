// Renders a single job card and its step sub-tree.
// Depends on the global `commandLabel` (command-labels.js) loaded as a
// plain <script> tag before the module entry point.

import {
  logsByJobId,
  progressByJobId,
  mountProgressBar,
  ensureLogStream,
} from "/jobs/log-stream.js";

// Authoritative client-side mirror of every job seen over /jobs/stream.
// Indexed by id — children are NOT rendered as standalone cards, they
// appear inside their parent's Steps section.
export const jobsById = new Map();

// Per-sequence Steps disclosure state. Re-renders preserve open/closed
// state because we track explicit user toggles here. Absent entry →
// "use default for current status" (open while running, collapsed once
// terminal).
const stepsOpenByJobId = new Map();

function defaultStepsOpen(job) {
  return job.status === "running" || job.status === "pending";
}

function makeEl(tag, className) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  return el;
}

// Build a "📋 Copy" button that writes `getText()` to the clipboard on
// click. Text is fetched lazily so callers can capture a closure over a
// live reference. Click also stopPropagates so the surrounding <summary>
// doesn't toggle its <details>.
function makeCopyButton(getText) {
  const btn = makeEl("button", "copy-btn");
  btn.type = "button";
  btn.textContent = "📋 Copy";
  btn.addEventListener("click", (event) => {
    event.stopPropagation();
    event.preventDefault();
    const text = getText() ?? "";
    navigator.clipboard.writeText(text).then(() => {
      btn.classList.add("copied");
      btn.textContent = "✓ Copied";
      setTimeout(() => {
        btn.classList.remove("copied");
        btn.textContent = "📋 Copy";
      }, 2000);
    }).catch((error) => {
      console.error("Copy failed", error);
      btn.textContent = "Copy failed";
      setTimeout(() => { btn.textContent = "📋 Copy"; }, 2000);
    });
  });
  return btn;
}

function getChildren(parentId) {
  // Stable order: children are pre-created in step order by sequenceRunner
  // and Map preserves insertion order, so iterating and filtering gives
  // steps 1..N in the right order.
  const out = [];
  for (const job of jobsById.values()) {
    if (job.parentJobId === parentId) out.push(job);
  }
  return out;
}

// Encodes a sequence-shaped object as the base64 payload the builder's
// ?seq= URL parameter expects. The builder loads via jsyaml.load which
// accepts JSON natively (YAML is a superset of JSON).
function buildBuilderUrl(sequenceBody) {
  const json = JSON.stringify(sequenceBody);
  // unescape(encodeURIComponent(...)) is the standard browser idiom for
  // turning a Unicode string into a Latin-1 byte string that btoa can accept.
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return `/builder?seq=${b64}`;
}

function builderUrlForJob(job) {
  if (job.commandName === "sequence" && job.params && typeof job.params === "object") {
    // Sequence umbrella — params is already the {paths, steps} body.
    return buildBuilderUrl(job.params);
  }
  // Single-command job — synthesize a 1-step sequence so the builder
  // opens with this command preloaded.
  return buildBuilderUrl({
    paths: {},
    steps: [{
      id: "step1",
      command: job.commandName,
      params: (job.params && typeof job.params === "object") ? job.params : {},
    }],
  });
}

function renderCancelButton(jobId) {
  const cancelBtn = makeEl("button", "cancel-btn");
  cancelBtn.textContent = "⏹ Cancel";
  cancelBtn.title = `Cancel this job (DELETE /jobs/${jobId})`;
  cancelBtn.onclick = async () => {
    cancelBtn.disabled = true;
    try {
      await fetch(`/jobs/${jobId}`, { method: "DELETE" });
    } catch (err) {
      console.error("cancel failed", err);
      cancelBtn.disabled = false;
    }
  };
  return cancelBtn;
}

// Mounts a logs <details> for the given job. Re-renders existing
// accumulated lines on every render so whole-card swaps don't lose
// scrollback. Opens by default while the job is running. Lazy-opens
// the SSE for terminal jobs on first disclosure-toggle.
function mountLogsDisclosure(parent, jobId, jobStatus, openByDefault) {
  const details = makeEl("details");
  if (openByDefault && jobStatus === "running") details.open = true;
  const summary = makeEl("summary");
  const summaryText = document.createTextNode("Logs");
  // Lazy getter — captures the live logsByJobId entry so a copy issued
  // mid-run grabs every line accumulated up to the click.
  const copyBtn = makeCopyButton(() => (logsByJobId.get(jobId) || []).join("\n"));
  summary.append(summaryText, copyBtn);
  const pane = makeEl("div", "log-pane");
  pane.dataset.logId = jobId;
  const lines = logsByJobId.get(jobId);
  if (lines && lines.length) {
    for (const line of lines) {
      const node = document.createElement("div");
      node.textContent = line;
      pane.append(node);
    }
  } else {
    const empty = makeEl("div", "log-empty");
    empty.textContent = "Waiting for log lines…";
    pane.append(empty);
  }
  details.append(summary, pane);
  parent.append(details);
  queueMicrotask(() => { pane.scrollTop = pane.scrollHeight; });
  if (jobStatus === "running") {
    ensureLogStream(jobId);
  } else {
    details.addEventListener("toggle", () => {
      if (details.open) ensureLogStream(jobId);
    }, { once: true });
  }
}

function renderStepRow(child, index) {
  const row = makeEl("div", "step");

  const header = makeEl("div", "step-header");
  const title = makeEl("div", "step-title");
  const idx = makeEl("span", "step-index");
  idx.textContent = `${index + 1}.`;
  const cmdName = document.createElement("strong");
  cmdName.textContent = commandLabel(child.commandName);
  title.append(idx, cmdName);
  if (child.stepId) {
    const sid = makeEl("span", "step-id");
    sid.textContent = child.stepId;
    title.append(sid);
  }

  const actions = makeEl("div", "step-actions");
  const badge = makeEl("div", `status ${child.status}`);
  badge.textContent = child.status;
  actions.append(badge);
  if (child.status === "running") {
    actions.append(renderCancelButton(child.id));
  }

  header.append(title, actions);
  row.append(header);

  if (child.error) {
    const err = makeEl("div", "error");
    err.textContent = child.error;
    row.append(err);
  }

  // Progress bar only while the step is actively running.
  if (child.status === "running") {
    mountProgressBar(row, child.id);
  }

  // Skipped/pending steps have no logs and no params beyond what the
  // parent shows — keep them as single-row placeholders.
  if (child.status !== "skipped" && child.status !== "pending") {
    mountLogsDisclosure(row, child.id, child.status, true);
  }

  return row;
}

export function renderJob(job) {
  const card = makeEl("div", "job");
  card.dataset.id = job.id;

  const header = makeEl("div", "job-header");
  const cmd = makeEl("div", "command");
  cmd.textContent = commandLabel(job.commandName ?? job.command ?? "unknown");
  const badge = makeEl("div", `status ${job.status}`);
  badge.textContent = job.status;
  header.append(cmd, badge);

  const meta = makeEl("div", "meta");
  const started = job.startedAt ? new Date(job.startedAt).toLocaleString() : "—";
  meta.textContent = `ID: ${job.id}`;
  meta.append(document.createElement("br"), document.createTextNode(`Started: ${started}`));
  if (job.completedAt) {
    meta.append(document.createElement("br"), document.createTextNode(`Completed: ${new Date(job.completedAt).toLocaleString()}`));
  }

  card.append(header, meta);

  // Progress bar only on running cards. For sequence umbrellas the bar
  // typically stays hidden (the runner doesn't emit progress — child
  // steps do on their own ids).
  if (job.status === "running") {
    mountProgressBar(card, job.id);
  }

  const sourcePath = job.params?.sourcePath;
  if (sourcePath) {
    const path = makeEl("div", "path");
    path.textContent = sourcePath;
    card.append(path);
  }

  if (job.params && typeof job.params === "object" && Object.keys(job.params).length) {
    const details = makeEl("details");
    const summary = makeEl("summary");
    const summaryText = document.createTextNode("Params");
    const copyBtn = makeCopyButton(() => JSON.stringify(job.params, null, 2));
    summary.append(summaryText, copyBtn);
    const params = makeEl("div", "result");
    params.textContent = JSON.stringify(job.params, null, 2);
    details.append(summary, params);
    card.append(details);
  }

  if (job.error) {
    const err = makeEl("div", "error");
    err.textContent = job.error;
    card.append(err);
  }

  if (job.results?.length) {
    const details = makeEl("details");
    const summary = makeEl("summary");
    summary.textContent = `Results (${job.results.length})`;
    details.append(summary);
    for (const r of job.results) {
      const result = makeEl("div", "result");
      result.textContent = JSON.stringify(r, null, 2);
      details.append(result);
    }
    card.append(details);
  }

  // Live log pane for the job's own log stream.
  mountLogsDisclosure(card, job.id, job.status, true);

  // Steps — children of this job (only present when this is a sequence
  // umbrella). Rendered as a <details>/<summary> disclosure so the user
  // can collapse the per-step subtree. Default is open while the
  // umbrella is running; collapses once terminal. Explicit user toggles
  // persist across re-renders via stepsOpenByJobId.
  const children = getChildren(job.id);
  if (children.length > 0) {
    const stepsBox = makeEl("details", "steps");
    const initialOpen = stepsOpenByJobId.has(job.id)
      ? stepsOpenByJobId.get(job.id)
      : defaultStepsOpen(job);
    // .open defaults to false; assigning true queues an async toggle
    // event before any user interaction. Skip recording that one event
    // so bootstrap doesn't get persisted as a user toggle.
    let ignoreSelfToggle = initialOpen !== false;
    stepsBox.open = initialOpen;
    const heading = makeEl("summary", "steps-heading");
    heading.textContent = `Steps (${children.length})`;
    stepsBox.append(heading);
    children.forEach((child, index) => {
      stepsBox.append(renderStepRow(child, index));
    });
    stepsBox.addEventListener("toggle", () => {
      if (ignoreSelfToggle) {
        ignoreSelfToggle = false;
        return;
      }
      stepsOpenByJobId.set(job.id, stepsBox.open);
    });
    card.append(stepsBox);
  }

  // Action footer: Open-in-Builder for every job + Cancel when running.
  const footer = makeEl("div", "job-footer");
  const builderLink = makeEl("a", "builder-btn");
  builderLink.textContent = "✎ Open in Sequence Builder";
  builderLink.href = builderUrlForJob(job);
  builderLink.target = "_blank";
  builderLink.rel = "noopener";
  footer.append(builderLink);
  if (job.status === "running") {
    footer.append(renderCancelButton(job.id));
  }
  card.append(footer);

  return card;
}
