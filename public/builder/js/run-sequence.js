// ─── Run sequence ─────────────────────────────────────────────────────────────
//
// Client-side step execution, job SSE tailing, the prompt modal, and
// the "Run via API" umbrella-job modal. Also owns per-step UI mutation
// (status badge, run/stop morph, log display, results display).
//
// Run modes:
//   runSequence()   — top-level "Run" button → POST /sequences/run (full YAML)
//   runGroup(id)    — group ▶ button        → POST /sequences/run (partial YAML)
//   runStep(stepId) — individual step ▶      → POST /commands/:cmd (per-job API)

import { flattenSteps, findStepById, isGroup, steps, paths } from './sequence-state.js'
import { buildParams } from './sequence-editor.js'
import { groupToYaml } from './components/yaml-modal.js'
import { handleStepCardProgressEvent, unmountStepCardProgress } from './render-all.js'

import { showPromptModal, closePromptModal } from './run-sequence/prompt-modal.js'
import { postSequenceYaml } from './run-sequence/api-run-modal.js'
import { updateStepUI, updateStepLogs } from './run-sequence/step-results.js'

export { closePromptModal } from './run-sequence/prompt-modal.js'
export {
  openApiRunModal,
  closeApiRunModal,
  cancelApiRun,
  copyApiRunLogs,
  runViaApi,
} from './run-sequence/api-run-modal.js'
export { updateStepUI, attachCopyButtonListener } from './run-sequence/step-results.js'

let running = false
const stepLogs = new Map()

// ─── Dry-run mode ─────────────────────────────────────────────────────────────

function isDryRun() {
  return localStorage.getItem('isDryRun') === '1'
}

function isDryRunFailure() {
  return localStorage.getItem('dryRunScenario') === 'failure'
}

function getDryRunFakeParam() {
  return isDryRunFailure() ? 'failure' : '1'
}

export function toggleDryRun() {
  localStorage.setItem('isDryRun', isDryRun() ? '0' : '1')
  syncDryRunUI()
}

export function toggleFailureMode() {
  localStorage.setItem('dryRunScenario', isDryRunFailure() ? '' : 'failure')
  syncDryRunUI()
}

export function syncDryRunUI() {
  const active = isDryRun()
  const failure = isDryRunFailure()
  const track = document.getElementById('dry-run-track')
  const thumb = document.getElementById('dry-run-thumb')
  const btn = document.getElementById('dry-run-btn')
  const badge = document.getElementById('dry-run-badge')
  if (!track || !thumb || !btn) return
  // Track: w-8 (32px) with 1px border each side = 30px inner width.
  // Thumb: w-3 (12px), top-px left-px (1px offset). On: 30 - 12 - 2×1 = 16px = 1rem travel.
  track.className = `relative shrink-0 inline-flex w-8 h-4 rounded-full overflow-hidden border transition-colors ${
    active ? 'bg-amber-500 border-amber-400' : 'bg-slate-600 border-slate-500'
  }`
  thumb.style.transform = active ? 'translateX(1rem)' : ''
  if (badge) badge.classList.toggle('hidden', !active)
  btn.title = active
    ? 'Dry run ON — simulate commands without touching files (click to disable)'
    : 'Toggle dry-run mode — simulate commands without touching files'
  const failureBtn = document.getElementById('failure-mode-btn')
  const failureTrack = document.getElementById('failure-mode-track')
  const failureThumb = document.getElementById('failure-mode-thumb')
  if (failureBtn) failureBtn.classList.toggle('hidden', !active)
  if (failureTrack) {
    failureTrack.className = `relative shrink-0 inline-flex w-8 h-4 rounded-full overflow-hidden border transition-colors ${
      failure ? 'bg-red-600 border-red-500' : 'bg-slate-600 border-slate-500'
    }`
  }
  if (failureThumb) failureThumb.style.transform = failure ? 'translateX(1rem)' : ''
}

// ─── Step cancellation ────────────────────────────────────────────────────────

async function cancelStep(stepId) {
  const step = findStepById(stepId)
  if (!step?.jobId) return
  try {
    await fetch(`/jobs/${step.jobId}`, { method: 'DELETE' })
  } catch (err) {
    console.error('cancelStep failed', err)
  }
}

export function runOrStopStep(stepId) {
  const step = findStepById(stepId)
  if (!step) return
  if (step.status === 'running' && step.jobId) {
    cancelStep(stepId)
  } else {
    runStep(stepId)
  }
}

// ─── Single step run ──────────────────────────────────────────────────────────

async function runOneStep(step) {
  step.status = 'running'
  updateStepUI(step)

  const params = buildParams(step, { resolveLinks: true })
  let response
  try {
    response = await fetch(`/commands/${step.command}${isDryRun() ? `?fake=${getDryRunFakeParam()}` : ''}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
  } catch (error) {
    step.status = 'failed'
    step.error = error.message
    updateStepUI(step)
    return false
  }

  if (!response.ok) {
    step.status = 'failed'
    step.error = `HTTP ${response.status}: ${await response.text()}`
    updateStepUI(step)
    return false
  }

  const { jobId, outputFolderName } = await response.json()
  step.jobId = jobId
  if (outputFolderName) step.runtimeOutputFolderName = outputFolderName
  updateStepUI(step)

  try {
    const finalStatus = await waitForJob(jobId, step.id)
    step.status = finalStatus
  } catch (error) {
    step.status = 'failed'
    step.error = String(error)
  }
  updateStepUI(step)
  return step.status === 'completed'
}

// ─── Build partial YAML for a single group ────────────────────────────────────

function buildGroupYaml(group) {
  const pathsObj = Object.fromEntries(
    paths.map((pathVar) => [pathVar.id, { label: pathVar.label, value: pathVar.value }])
  )
  const data = {
    paths: pathsObj,
    steps: [groupToYaml(group)],
  }
  return window.jsyaml.dump(data, { lineWidth: -1, flowLevel: 3, indent: 2 })
}

// ─── Top-level sequence run (main "Run" button) ───────────────────────────────

export async function runSequence() {
  const yaml = window.mediaTools.toYamlStr()
  if (yaml === '# No steps yet') return
  const runBtn = document.getElementById('run-btn')
  if (runBtn) runBtn.disabled = true
  await postSequenceYaml(yaml, () => {
    if (runBtn) runBtn.disabled = false
  })
}

// ─── Group run (group ▶ button) ───────────────────────────────────────────────

export async function runGroup(groupId) {
  const group = steps.find((item) => isGroup(item) && item.id === groupId)
  if (!group) return
  const hasContent = group.steps.some((s) => s.command !== null)
  if (!hasContent) return
  const yaml = buildGroupYaml(group)
  await postSequenceYaml(yaml, () => {})
}

export async function runStep(stepId) {
  if (running) return
  const step = findStepById(stepId)
  if (!step || !step.command) return
  running = true
  stepLogs.clear()
  document.getElementById('run-btn').disabled = true

  step.status = 'pending'
  step.error = null
  step.results = null
  step._smartMatchAutoOpened = undefined
  step.logs = null
  step.outputs = null
  updateStepUI(step)

  await runOneStep(step)

  running = false
  document.getElementById('run-btn').disabled = false
}

// ─── Job SSE tailing ──────────────────────────────────────────────────────────

function waitForJob(jobId, stepId) {
  stepLogs.set(stepId, [])
  return new Promise((resolve, reject) => {
    const handle = createTolerantEventSource(`/jobs/${jobId}/logs`, {
      onMessage: (data) => {
        if (data.done) {
          closePromptModal()
          handle.close()
          unmountStepCardProgress(stepId)
          const step = findStepById(stepId)
          if (step && Array.isArray(data.results) && data.results.length > 0) step.results = data.results
          if (step && data.outputs && typeof data.outputs === 'object') step.outputs = data.outputs
          if (data.status === 'completed' || data.status === 'cancelled') resolve(data.status)
          else reject(`Job ended with status: ${data.status}`)
        } else if (data.type === 'prompt') {
          showPromptModal(jobId, data)
        } else if (data.type === 'progress') {
          handleStepCardProgressEvent(stepId, data)
        } else if (data.line) {
          const logs = stepLogs.get(stepId) ?? []
          logs.push(data.line)
          stepLogs.set(stepId, logs)
          updateStepLogs(stepId, logs)
        }
      },
      onPossiblyDisconnected: () => {
        closePromptModal()
        handle.close()
        unmountStepCardProgress(stepId)
        reject('SSE connection error')
      },
    })
  })
}
