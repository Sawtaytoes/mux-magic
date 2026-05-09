import { handleStepCardProgressEvent, unmountStepCardProgress } from '../render-all.js'

let apiRunEventSource = null
let apiRunCurrentJobId = null
let apiRunChildEventSource = null
let apiRunChildJobId = null
let apiRunChildSnapshot = null
let apiRunChildStepId = null

function isDryRun() {
  return localStorage.getItem('isDryRun') === '1'
}

// Posts `yaml` to /sequences/run, opens the api-run modal, and streams the
// SSE log. `onDone` is called (with no args) when the stream closes.
export async function postSequenceYaml(yaml, onDone) {
  let response
  try {
    response = await fetch(`/sequences/run${isDryRun() ? '?fake=1' : ''}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ yaml }),
    })
  } catch (error) {
    openApiRunModal({ jobId: null, status: 'failed' })
    document.getElementById('api-run-logs').textContent = `Network error: ${error?.message ?? error}`
    onDone?.()
    return
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '(no body)')
    openApiRunModal({ jobId: null, status: 'failed' })
    document.getElementById('api-run-logs').textContent = `HTTP ${response.status}: ${errorText}`
    onDone?.()
    return
  }

  const { jobId } = await response.json()
  openApiRunModal({ jobId, status: 'running' })
  tailApiRunLogs(jobId, onDone)
}

export async function runViaApi() {
  const yaml = window.mediaTools.toYamlStr()
  if (yaml === '# No steps yet') return
  const runApiBtn = document.getElementById('run-api-btn')
  if (runApiBtn) runApiBtn.disabled = true
  await postSequenceYaml(yaml, () => {
    if (runApiBtn) runApiBtn.disabled = false
  })
}

export function openApiRunModal({ jobId, status }) {
  apiRunCurrentJobId = jobId ?? null
  document.getElementById('api-run-jobid').textContent = jobId ? `job ${jobId}` : ''
  setApiRunStatus(status)
  document.getElementById('api-run-logs').textContent = ''
  hideApiRunProgress()
  document.getElementById('api-run-modal').classList.remove('hidden')
}

export function closeApiRunModal(event) {
  if (event && event.target !== document.getElementById('api-run-modal')) return
  document.getElementById('api-run-modal').classList.add('hidden')
  if (apiRunEventSource) { apiRunEventSource.close(); apiRunEventSource = null }
  closeApiRunChildProgressStream()
  hideApiRunProgress()
  apiRunCurrentJobId = null
  document.getElementById('run-api-btn').disabled = false
}

export async function cancelApiRun() {
  if (!apiRunCurrentJobId) return
  try {
    await fetch(`/jobs/${apiRunCurrentJobId}`, { method: 'DELETE' })
  } catch (err) {
    console.error('cancelApiRun failed', err)
  }
}

export function copyApiRunLogs() {
  const text = document.getElementById('api-run-logs').textContent || ''
  const btn = document.getElementById('api-run-copy-btn')
  const original = btn.textContent
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = '✓ Copied'
    setTimeout(() => { btn.textContent = original }, 1200)
  }).catch(() => {
    btn.textContent = '✗ Failed'
    setTimeout(() => { btn.textContent = original }, 1200)
  })
}

function setApiRunStatus(status) {
  const el = document.getElementById('api-run-status')
  el.textContent = status
  el.className = 'text-xs px-2 py-0.5 rounded font-mono ' + ({
    pending:   'bg-slate-700 text-slate-300',
    running:   'bg-amber-700 text-amber-100',
    completed: 'bg-emerald-700 text-emerald-100',
    failed:    'bg-red-700 text-red-100',
    cancelled: 'bg-slate-600 text-slate-100',
  }[status] ?? 'bg-slate-700 text-slate-300')
  const cancelBtn = document.getElementById('api-run-cancel-btn')
  if (cancelBtn) cancelBtn.classList.toggle('hidden', status !== 'running')
}

function tailApiRunLogs(jobId, onDone) {
  if (apiRunEventSource) apiRunEventSource.close()
  const logsEl = document.getElementById('api-run-logs')
  apiRunEventSource = createTolerantEventSource(`/jobs/${jobId}/logs`, {
    onMessage: (data) => {
      if (data.type === 'step-started') {
        openApiRunChildProgressStream(data.childJobId, data.stepId)
        return
      }
      if (data.type === 'step-finished') {
        if (data.childJobId === apiRunChildJobId) {
          closeApiRunChildProgressStream()
          hideApiRunProgress()
        }
        return
      }
      if (data.line) {
        logsEl.textContent += (logsEl.textContent ? '\n' : '') + data.line
        logsEl.scrollTop = logsEl.scrollHeight
        return
      }
      if (data.done) {
        setApiRunStatus(data.status || 'completed')
        apiRunEventSource.close()
        apiRunEventSource = null
        closeApiRunChildProgressStream()
        hideApiRunProgress()
        onDone?.()
      }
    },
    onPossiblyDisconnected: () => {
      setApiRunStatus('failed')
      apiRunEventSource?.close()
      apiRunEventSource = null
      closeApiRunChildProgressStream()
      hideApiRunProgress()
      onDone?.()
    },
  })
}

function openApiRunChildProgressStream(childJobId, stepId) {
  closeApiRunChildProgressStream()
  apiRunChildJobId = childJobId
  apiRunChildStepId = stepId
  apiRunChildSnapshot = {}
  showApiRunProgress(stepId)
  apiRunChildEventSource = createTolerantEventSource(`/jobs/${childJobId}/logs`, {
    onMessage: (data) => {
      if (data.type === 'progress') {
        apiRunChildSnapshot = window.ProgressUtils.mergeProgress(apiRunChildSnapshot, data)
        const host = document.getElementById('api-run-progress-host')
        window.ProgressUtils.paintProgressBar(host, apiRunChildSnapshot)
        if (stepId) handleStepCardProgressEvent(stepId, data)
      }
    },
    onPossiblyDisconnected: () => {},
  })
}

function closeApiRunChildProgressStream() {
  if (apiRunChildEventSource) { apiRunChildEventSource.close(); apiRunChildEventSource = null }
  if (apiRunChildStepId) unmountStepCardProgress(apiRunChildStepId)
  apiRunChildJobId = null
  apiRunChildStepId = null
  apiRunChildSnapshot = null
}

function showApiRunProgress(stepId) {
  const host = document.getElementById('api-run-progress-host')
  const label = document.getElementById('api-run-progress-step-label')
  Array.from(host.querySelectorAll('.progress-row')).forEach((node) => node.remove())
  host.append(window.ProgressUtils.createProgressRow())
  label.textContent = stepId ? `Step ${stepId}` : ''
  host.classList.remove('hidden')
  window.ProgressUtils.paintProgressBar(host, {})
}

function hideApiRunProgress() {
  const host = document.getElementById('api-run-progress-host')
  host.classList.add('hidden')
  Array.from(host.querySelectorAll('.progress-row')).forEach((node) => node.remove())
  const label = document.getElementById('api-run-progress-step-label')
  if (label) label.textContent = ''
}
