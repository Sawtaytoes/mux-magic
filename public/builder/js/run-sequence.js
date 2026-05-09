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
import { buildParams, setParam } from './sequence-editor.js'
import { groupToYaml } from './components/yaml-modal.js'
import { openSpecialsMappingModal } from './components/specials-mapping-modal.js'
import { renderStatusBadge, esc, LOOKUP_LINKS } from './step-renderer.js'
import {
  handleStepCardProgressEvent,
  unmountStepCardProgress,
} from './render-all.js'
import { attachAutocomplete } from './util/name-autocomplete.js'

let running = false
const stepLogs = new Map()

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
    response = await fetch(`/commands/${step.command}`, {
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

// ─── Shared /sequences/run helper ────────────────────────────────────────────

// Posts `yaml` to /sequences/run, opens the api-run modal, and streams the
// SSE log. `onDone` is called (with no args) when the stream closes.
async function postSequenceYaml(yaml, onDone) {
  let response
  try {
    response = await fetch('/sequences/run', {
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

// ─── Prompt modal ─────────────────────────────────────────────────────────────

function showPromptModal(jobId, promptData) {
  document.getElementById('prompt-message').textContent = promptData.message
  const previewEl = document.getElementById('prompt-preview')
  previewEl.innerHTML = ''
  if (promptData.filePath) {
    const playBtn = document.createElement('button')
    playBtn.className = 'text-[10px] bg-emerald-700 hover:bg-emerald-600 text-white px-2 py-0.5 rounded font-medium leading-none'
    playBtn.textContent = '▶ Play'
    playBtn.onclick = () => {
      if (typeof window.openVideoModal === 'function') window.openVideoModal(promptData.filePath)
    }
    previewEl.appendChild(playBtn)
    previewEl.classList.remove('hidden')
  } else {
    previewEl.classList.add('hidden')
  }
  // Phase B / W10-N2: per-option file paths drive a per-row ▶ Play
  // button on the duplicate-pick modal. Build a lookup so the rendering
  // loop below can decide row-by-row whether to attach a button.
  const filePathsByIndex = new Map()
  if (Array.isArray(promptData.filePaths)) {
    promptData.filePaths.forEach((entry) => {
      if (entry && typeof entry.index === 'number' && typeof entry.path === 'string') {
        filePathsByIndex.set(entry.index, entry.path)
      }
    })
  }
  const optionsEl = document.getElementById('prompt-options')
  optionsEl.innerHTML = ''
  const sortedOptions = [...promptData.options].sort((a, b) => {
    const isSkipA = a.index < 0
    const isSkipB = b.index < 0
    if (isSkipA && isSkipB) return 0
    if (isSkipA) return 1
    if (isSkipB) return -1
    const rankA = a.index === 0 ? 9.5 : a.index
    const rankB = b.index === 0 ? 9.5 : b.index
    return rankA - rankB
  })
  sortedOptions.forEach((option) => {
    const isSkip = option.index === -1
    const rowFilePath = filePathsByIndex.get(option.index) ?? null
    if (rowFilePath) {
      // Multi-file row: option button on the left, ▶ Play on the right.
      // Wrapper div keeps both controls in one row without nesting a
      // button-inside-a-button.
      const rowElement = document.createElement('div')
      rowElement.className = (
        'flex items-stretch gap-2 rounded-lg border border-slate-600'
        + ' hover:border-blue-500 transition-colors'
      )
      const pickButton = document.createElement('button')
      pickButton.className = (
        'flex-1 text-left text-sm px-4 py-2.5 rounded-l-lg'
        + ' text-slate-200 hover:bg-blue-700'
      )
      const keyHintMulti = option.index >= 0 && option.index <= 9
        ? `<span class="text-xs font-mono bg-slate-700 px-1.5 py-0.5 rounded mr-2">${option.index}</span>`
        : ''
      pickButton.innerHTML = `${keyHintMulti}${esc(option.label)}`
      pickButton.onclick = () => {
        submitPromptChoice(jobId, promptData.promptId, option.index)
      }
      const playButton = document.createElement('button')
      playButton.className = (
        'shrink-0 text-xs px-3 rounded-r-lg bg-emerald-700 hover:bg-emerald-600 text-white font-medium'
      )
      playButton.textContent = '▶ Play'
      playButton.title = 'Preview this file before picking'
      playButton.onclick = (event) => {
        event.preventDefault()
        event.stopPropagation()
        if (typeof window.openVideoModal === 'function') {
          window.openVideoModal(rowFilePath)
        }
      }
      rowElement.appendChild(pickButton)
      rowElement.appendChild(playButton)
      optionsEl.appendChild(rowElement)
      return
    }
    const btn = document.createElement('button')
    btn.className = `text-left text-sm px-4 py-2.5 rounded-lg border transition-colors ${
      isSkip
        ? 'border-slate-600 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
        : 'border-slate-600 text-slate-200 hover:bg-blue-700 hover:border-blue-500'
    }`
    const keyHint = option.index >= 0 && option.index <= 9
      ? `<span class="text-xs font-mono bg-slate-700 px-1.5 py-0.5 rounded mr-2">${option.index}</span>`
      : ''
    btn.innerHTML = `${keyHint}${esc(option.label)}`
    btn.onclick = () => submitPromptChoice(jobId, promptData.promptId, option.index)
    optionsEl.appendChild(btn)
  })
  document.getElementById('prompt-modal').classList.remove('hidden')
  document._promptKeyHandler = e => {
    const num = parseInt(e.key, 10)
    if (!isNaN(num)) {
      const match = promptData.options.find(o => o.index === num)
      if (match) submitPromptChoice(jobId, promptData.promptId, match.index)
      return
    }
    if (e.key === ' ' || e.key === 'Spacebar') {
      const skipOpt = promptData.options.find(o => o.index === -1)
      if (skipOpt) { e.preventDefault(); submitPromptChoice(jobId, promptData.promptId, -1) }
      return
    }
    if (e.key === 'Escape' || e.key === '-') {
      const cancelOpt = promptData.options.find(o => o.index === -2)
      if (cancelOpt) { e.preventDefault(); submitPromptChoice(jobId, promptData.promptId, -2); return }
      const skipOpt = promptData.options.find(o => o.index === -1)
      if (skipOpt) { e.preventDefault(); submitPromptChoice(jobId, promptData.promptId, -1) }
    }
  }
  document.addEventListener('keydown', document._promptKeyHandler)
}

export function closePromptModal() {
  document.getElementById('prompt-modal').classList.add('hidden')
  if (document._promptKeyHandler) {
    document.removeEventListener('keydown', document._promptKeyHandler)
    document._promptKeyHandler = null
  }
}

async function submitPromptChoice(jobId, promptId, selectedIndex) {
  closePromptModal()
  try {
    await fetch(`/jobs/${jobId}/input`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ promptId, selectedIndex }),
    })
  } catch (err) {
    console.error('Failed to submit prompt response', err)
  }
}

// ─── Run-via-API modal ────────────────────────────────────────────────────────

let apiRunEventSource = null
let apiRunCurrentJobId = null
let apiRunChildEventSource = null
let apiRunChildJobId = null
let apiRunChildSnapshot = null
let apiRunChildStepId = null

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

// ─── Step UI mutation (status, logs, results) ─────────────────────────────────

function updateStepLogs(stepId, logs) {
  const card = document.getElementById(`step-${stepId}`)
  if (!card) return
  const step = findStepById(stepId)
  if (step) step.logs = logs.slice()
  let logEl = card.querySelector('.step-logs')
  const text = logs.slice(-8).join('\n')
  if (!logEl) {
    const fieldsEl = card.querySelector('.space-y-2')
    if (fieldsEl) {
      fieldsEl.insertAdjacentHTML('beforebegin',
        `<pre class="step-logs text-xs text-slate-400 bg-slate-950 rounded px-2 py-1.5 mb-2 font-mono max-h-24 overflow-y-auto whitespace-pre-wrap">${esc(text)}</pre>`)
    }
  } else if (logEl.tagName === 'PRE') {
    logEl.textContent = text
    logEl.scrollTop = logEl.scrollHeight
  }
}

export function updateStepUI(step) {
  const card = document.getElementById(`step-${step.id}`)
  if (!card) return

  // Status badge
  let badge = card.querySelector('.status-badge')
  if (step.status) {
    const html = renderStatusBadge(step.status)
    if (badge) {
      badge.outerHTML = html
    } else {
      const btns = card.querySelector('.flex.items-center.gap-1.shrink-0')
      if (btns) btns.insertAdjacentHTML('beforebegin', html)
    }
  }

  // Run/stop button morph
  const runStopBtn = card.querySelector(`[data-step-run-stop="${step.id}"]`)
  if (runStopBtn) {
    const isRunningStep = step.status === 'running' && step.jobId
    runStopBtn.classList.toggle('is-running', isRunningStep)
    runStopBtn.title = isRunningStep ? 'Cancel this step' : 'Run this step only'
  }

  // Error
  let errEl = card.querySelector('.step-error')
  if (step.error) {
    if (errEl) {
      errEl.textContent = step.error
    } else {
      const fieldsEl = card.querySelector('.space-y-2')
      if (fieldsEl) {
        fieldsEl.insertAdjacentHTML('beforebegin',
          `<p class="step-error text-xs text-red-400 bg-red-950/40 rounded px-2 py-1 mb-2 font-mono">${esc(step.error)}</p>`)
      }
    }
  } else if (errEl) {
    errEl.remove()
  }

  // Empty-completion banner
  let emptyEl = card.querySelector('.step-empty')
  const hasResults = step.results && step.results.length > 0
  const hasLogs = Array.isArray(step.logs) && step.logs.length > 0
  const isCompletedEmpty = step.status === 'completed' && !hasResults && !step.error
  if (isCompletedEmpty) {
    const detail = hasLogs
      ? 'No items reported — see logs above for detail.'
      : 'No matching files (or no work needed for this step).'
    if (!emptyEl) {
      const fieldsEl = card.querySelector('.space-y-2')
      if (fieldsEl) {
        fieldsEl.insertAdjacentHTML('beforebegin',
          `<p class="step-empty text-xs text-sky-300 bg-sky-950/40 rounded px-2 py-1 mb-2 font-mono">Step completed — ${detail}</p>`)
      }
    } else {
      emptyEl.textContent = `Step completed — ${detail}`
    }
  } else if (emptyEl) {
    emptyEl.remove()
  }

  // Logs collapse
  const logEl = card.querySelector('.step-logs')
  if (logEl && step.status !== 'running') {
    const fullLog = (step.logs || []).join('\n')
    if (fullLog) {
      const isOpen = step.status === 'failed'
      const fieldsEl = card.querySelector('.space-y-2')
      logEl.remove()
      if (fieldsEl) {
        fieldsEl.insertAdjacentHTML('beforebegin', `
          <details class="step-logs text-xs mb-2"${isOpen ? ' open' : ''}>
            <summary class="cursor-pointer text-slate-400 hover:text-slate-300 select-none flex items-center gap-2">
              <span>Logs</span>
              <button type="button" class="copy-btn ml-auto text-[10px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300" title="Copy logs to clipboard">📋 Copy</button>
            </summary>
            <pre class="text-slate-400 bg-slate-950 rounded px-2 py-1.5 mt-1 font-mono max-h-64 overflow-y-auto whitespace-pre-wrap">${esc(fullLog)}</pre>
          </details>`)
      }
    } else {
      logEl.remove()
    }
  }

  // Results
  let resultsEl = card.querySelector('.step-results')
  const formatted = step.results && step.results.length > 0 ? formatStepResults(step) : ''
  const formattedHtml = formatted && typeof formatted === 'object' && formatted.html ? formatted.html : null
  const formattedText = !formattedHtml && typeof formatted === 'string' && formatted ? formatted : ''
  if (formattedHtml || formattedText) {
    if (resultsEl) {
      const wantsHtml = !!formattedHtml
      const isHtml = !resultsEl.querySelector('pre')
      if (wantsHtml !== isHtml) { resultsEl.remove(); resultsEl = null }
    }
    if (!resultsEl) {
      const fieldsEl = card.querySelector('.space-y-2')
      if (fieldsEl) {
        const innerEl = formattedHtml
          ? `<div class="results-body text-xs bg-slate-950 rounded px-2 py-1.5 mt-1 break-words"></div>`
          : `<pre class="text-emerald-300 bg-slate-950 rounded px-2 py-1.5 mt-1 font-mono whitespace-pre-wrap break-words"></pre>`
        fieldsEl.insertAdjacentHTML('beforebegin',
          `<details class="step-results text-xs mb-2" open>
            <summary class="cursor-pointer text-emerald-400 hover:text-emerald-300 select-none flex items-center gap-2">
              <span>Results</span>
              <button type="button" class="copy-btn ml-auto text-[10px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300" title="Copy results to clipboard">📋 Copy</button>
            </summary>
            ${innerEl}
          </details>`)
        resultsEl = card.querySelector('.step-results')
      }
    }
    if (resultsEl) {
      if (formattedHtml) {
        const body = resultsEl.querySelector('.results-body')
        if (body) {
          body.innerHTML = formattedHtml
          if (formatted && typeof formatted.wire === 'function') {
            formatted.wire(body)
          }
        }
      } else {
        resultsEl.querySelector('pre').textContent = formattedText
      }
    }
  } else if (resultsEl) {
    resultsEl.remove()
  }
}

// ─── Result formatting ────────────────────────────────────────────────────────

function getLookupLinkData(step) {
  const cmd = step.command ? (window.mediaTools.COMMANDS?.[step.command] ?? null) : null
  if (!cmd) return null
  const lookupField = cmd.fields?.find((candidate) => (
    candidate.type === 'numberWithLookup'
    && LOOKUP_LINKS[candidate.lookupType]
  ))
  if (lookupField) {
    const id = step.params[lookupField.name]
    if (id !== undefined && id !== null && id !== '') {
      const lookup = LOOKUP_LINKS[lookupField.lookupType]
      return { url: lookup.buildUrl(id, step.params), label: lookup.label }
    }
  }
  if (step.command === 'nameSpecialFeatures' && step.params.url) {
    return { url: step.params.url, label: 'open URL on DVDCompare' }
  }
  return null
}

function getLinkedValueForStep(step, fieldName) {
  return typeof window.mediaTools?.getLinkedValue === 'function'
    ? window.mediaTools.getLinkedValue(step, fieldName)
    : null
}

function formatStepResults(step) {
  const commandName = step.command
  const results = step.results

  if (commandName === 'getAudioOffsets') {
    return results.flat().map(item => `${item?.offsetInMilliseconds}ms`).join('\n')
  }

  if (commandName === 'nameSpecialFeatures') {
    const summaryRecord = results.find((item) => (
      item && typeof item === 'object' && Array.isArray(item.unrenamedFilenames)
    ))
    const renamePairs = summaryRecord ? results.filter((item) => item !== summaryRecord) : results
    // Strip collision entries (no oldName/newName — they appear in unrenamedFilenames already).
    const validRenamePairs = renamePairs.filter((item) => (
      item && typeof item === 'object'
      && typeof item.oldName === 'string'
      && typeof item.newName === 'string'
    ))
    if (validRenamePairs.length > 0 || summaryRecord) {
      return {
        html: renderNameSpecialFeaturesResultsHtml(step, validRenamePairs, summaryRecord),
        wire: (body) => wireNameSpecialFeaturesResults({ body, step, summaryRecord }),
      }
    }
  }

  const renameLikeFields = [['source', 'destination'], ['oldName', 'newName'], ['from', 'to']]
  const renameField = results.length > 0 && renameLikeFields.find(([fromKey, toKey]) => (
    results.every((item) => (
      item && typeof item === 'object'
      && typeof item[fromKey] === 'string'
      && typeof item[toKey] === 'string'
    ))
  ))
  if (renameField) {
    const [fromKey, toKey] = renameField
    return results.map((item) => `${item[fromKey]} → ${item[toKey]}`).join('\n')
  }

  if (results.every((item) => typeof item === 'string')) return results.join('\n')

  const value = results.length === 1 ? results[0] : results
  try { return JSON.stringify(value, null, 2) } catch { return String(value) }
}

function getNameSpecialFeaturesSourcePath(step) {
  if (step.params?.sourcePath && !String(step.params.sourcePath).startsWith('@')) {
    return String(step.params.sourcePath)
  }
  return getLinkedValueForStep(step, 'sourcePath') ?? ''
}

function renderNameSpecialFeaturesResultsHtml(step, renamePairs, summaryRecord) {
  const unrenamed = Array.isArray(summaryRecord?.unrenamedFilenames) ? summaryRecord.unrenamedFilenames : []
  const possibleNamesRaw = Array.isArray(summaryRecord?.possibleNames) ? summaryRecord.possibleNames : []
  const counts = `Renamed ${renamePairs.length}. Files not renamed: ${unrenamed.length}.`
  const sourcePath = getNameSpecialFeaturesSourcePath(step)
  const browseBtnBlock = sourcePath
    ? `<button onclick="openFileExplorer(${JSON.stringify(sourcePath).replace(/"/g, '&quot;')})"
        class="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-2 py-1 rounded border border-slate-600 ml-2"
        title="Open the file explorer scoped to this step's source folder">📁 Browse files</button>`
    : ''
  // Smart-match button — only mounts when both lists have content per
  // the design doc's mount condition. Wired via a data-attribute that
  // wireNameSpecialFeaturesResults picks up after innerHTML is set
  // (avoids the `onclick=` inline-handler pattern for closure access).
  const hasSmartMatchData = (
    sourcePath
    && unrenamed.length > 0
    && possibleNamesRaw.length > 0
  )
  const smartMatchBtnBlock = hasSmartMatchData
    ? `<button type="button" data-specials-smart-match
        class="text-xs bg-blue-700 hover:bg-blue-600 text-white px-2 py-1 rounded border border-blue-600 ml-2"
        title="Open the modal to rename unnamed files">✨ Fix Unnamed</button>`
    : ''
  const countsBlock = `<div class="flex items-center mb-2" data-rename-counts><p class="text-slate-300" data-rename-counts-label>${esc(counts)}</p>${browseBtnBlock}${smartMatchBtnBlock}</div>`
  const renameRowsHtml = renamePairs.map((item) => `<div>${esc(item.oldName)} → ${esc(item.newName)}</div>`).join('')
  const renameBlock = renamePairs.length > 0
    ? `<div class="text-emerald-300 font-mono mb-2 break-words">${renameRowsHtml}</div>`
    : ''
  const linkData = getLookupLinkData(step)
  const linkBlock = linkData
    ? `<a href="${esc(linkData.url)}" target="_blank" rel="noopener" class="text-blue-300 hover:text-blue-200 underline inline-flex items-center gap-1 mt-1">↗ ${esc(linkData.label)}</a>`
    : ''
  const leftoversBlock = unrenamed.length > 0
    ? renderInteractiveRenameBlock({ filenames: unrenamed, linkBlock })
    : ''
  return `${countsBlock}${renameBlock}${leftoversBlock}`
}

// Simple list of unrenamed files with Play buttons. Users can rename
// these via the "Fix Unnamed" modal instead of inline.
function renderInteractiveRenameBlock({ filenames, linkBlock }) {
  const rowsHtml = filenames.map((filename, index) => `
    <div class="flex items-start gap-2 py-1 border-b border-yellow-700/30 last:border-b-0" data-rename-row data-rename-index="${index}" data-rename-filename="${esc(filename)}">
      <div class="font-mono text-xs break-words text-yellow-100 flex-1">${esc(filename)}</div>
      <button type="button" data-rename-play class="text-[10px] bg-emerald-700 hover:bg-emerald-600 text-white px-2 py-0.5 rounded font-medium leading-none shrink-0" title="Preview this file">▶ Play</button>
    </div>
  `).join('')
  return (
    '<div class="bg-yellow-900/30 border border-yellow-700 text-yellow-100 rounded px-2 py-1.5" data-rename-list-block>'
    + '<p class="font-medium mb-1">Files not renamed:</p>'
    + `<div data-rename-rows>${rowsHtml}</div>`
    + linkBlock
    + '</div>'
  )
}

// Wire up event listeners on the rendered interactive renamer rows.
// Receives the body element holding the rendered HTML so each call
// scopes its queries — important because step cards re-render on every
// rename and the listener teardown lives implicitly in DOM removal.
function wireNameSpecialFeaturesResults({ body, step, summaryRecord }) {
  const sourcePath = getNameSpecialFeaturesSourcePath(step)
  const allKnownNames = Array.isArray(summaryRecord?.allKnownNames) ? summaryRecord.allKnownNames : []
  // The wire-format `possibleNames` is `{ name, timecode? }[]` per the
  // smart-suggestion modal contract. The autocomplete dropdown only
  // needs the name labels, so flatten to strings here at the boundary
  // and leave name-autocomplete.js consuming `string[]` as before.
  const possibleNamesRaw = Array.isArray(summaryRecord?.possibleNames) ? summaryRecord.possibleNames : []
  const possibleNames = possibleNamesRaw.map((entry) => (
    typeof entry === 'string' ? entry : entry?.name ?? ''
  )).filter(Boolean)
  const possibleNameObjects = possibleNamesRaw.map((entry) => (
    typeof entry === 'string'
      ? { name: entry, timecode: undefined }
      : { name: entry?.name ?? '', timecode: entry?.timecode }
  )).filter((entry) => entry.name.length > 0)

  const openSmartMatchModal = () => {
    const unrenamedFilenames = Array.isArray(summaryRecord?.unrenamedFilenames)
      ? summaryRecord.unrenamedFilenames
      : []
    openSpecialsMappingModal({
      onRenameApplied: (successfulRenames) => {
        handleSmartMatchRenames({ step, successfulRenames, summaryRecord })
      },
      onRunStep: () => runStep(step.id),
      possibleNames: possibleNameObjects,
      sourcePath,
      unrenamedFilenames,
    })
  }

  const smartMatchButton = body.querySelector('[data-specials-smart-match]')
  if (smartMatchButton) {
    smartMatchButton.addEventListener('click', openSmartMatchModal)
  }

  // Auto-open once per step completion so the user can't miss unmatched files.
  // The flag is reset in runStep so it fires again on the next run.
  const unrenamedForAutoOpen = Array.isArray(summaryRecord?.unrenamedFilenames)
    ? summaryRecord.unrenamedFilenames
    : []
  const hasSmartMatchDataForAutoOpen = (
    !!sourcePath
    && unrenamedForAutoOpen.length > 0
    && possibleNameObjects.length > 0
  )
  if (hasSmartMatchDataForAutoOpen && !step._smartMatchAutoOpened) {
    step._smartMatchAutoOpened = true
    openSmartMatchModal()
  }

  const rows = body.querySelectorAll('[data-rename-row]')
  rows.forEach((row) => {
    const playButton = row.querySelector('[data-rename-play]')
    const filename = row.getAttribute('data-rename-filename') ?? ''
    if (playButton) {
      if (sourcePath && typeof window.openVideoModal === 'function') {
        playButton.addEventListener('click', () => {
          window.openVideoModal(joinSourcePath(sourcePath, filename))
        })
      } else {
        playButton.remove()
      }
    }
  })
}

// Apply the smart-match modal's batch of successful renames back into
// the step card's in-memory state. Mirrors the per-row interactive
// flow's "drop renamed entry from the summary, push the {oldName,
// newName} pair into step.results" pattern so the counts tick up and
// the leftover list shrinks in lockstep with the modal.
function handleSmartMatchRenames({ step, successfulRenames, summaryRecord }) {
  if (!Array.isArray(successfulRenames) || successfulRenames.length === 0) {
    return
  }
  if (Array.isArray(summaryRecord?.unrenamedFilenames)) {
    const renamedSet = new Set(successfulRenames.map(({ oldFilename }) => oldFilename))
    summaryRecord.unrenamedFilenames = summaryRecord.unrenamedFilenames.filter((name) => (
      !renamedSet.has(name)
    ))
  }
  if (Array.isArray(step.results)) {
    successfulRenames.forEach(({ newFilename, oldFilename }) => {
      step.results.push({ newName: newFilename, oldName: oldFilename })
    })
  }
  updateStepUI(step)
}

async function handleInteractiveRenameClick({
  filename,
  inputElement,
  sourcePath,
  statusElement,
  step,
  submitButton,
  summaryRecord,
}) {
  const desiredName = inputElement.value.trim()
  if (desiredName.length === 0) {
    return
  }
  if (!sourcePath) {
    showRenameStatus(statusElement, 'error', 'Cannot determine source folder for this step.')
    return
  }
  submitButton.disabled = true
  const originalText = submitButton.textContent
  submitButton.textContent = '⏳ Renaming…'
  showRenameStatus(statusElement, 'info', '')
  try {
    const oldPath = joinSourcePath(sourcePath, filename)
    const extensionMatch = filename.match(/\.[^.\\/]+$/)
    const extension = extensionMatch ? extensionMatch[0] : ''
    const newFilename = (
      desiredName.toLowerCase().endsWith(extension.toLowerCase())
        ? desiredName
        : `${desiredName}${extension}`
    )
    const newPath = joinSourcePath(sourcePath, newFilename)
    const response = await fetch('/files/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPath, newPath }),
    })
    const data = await response.json()
    if (!response.ok || data.ok !== true) {
      const message = data?.error ?? `HTTP ${response.status}`
      showRenameStatus(statusElement, 'error', message)
      submitButton.disabled = false
      submitButton.textContent = originalText
      return
    }
    // Success — drop the renamed entry from the summary and re-render
    // the step. Per the design doc this avoids a round-trip refetch:
    // mutate the in-memory results then let updateStepUI rebuild from
    // the same `step.results` reference. The renamePairs list is also
    // appended so the user sees the rename count tick up.
    if (Array.isArray(summaryRecord?.unrenamedFilenames)) {
      summaryRecord.unrenamedFilenames = summaryRecord.unrenamedFilenames.filter((name) => name !== filename)
    }
    if (Array.isArray(step.results)) {
      step.results.push({ oldName: filename, newName: newFilename })
    }
    showRenameStatus(statusElement, 'success', `Renamed → ${newFilename}`)
    updateStepUI(step)
  }
  catch (error) {
    showRenameStatus(statusElement, 'error', String(error?.message ?? error))
    submitButton.disabled = false
    submitButton.textContent = originalText
  }
}

function showRenameStatus(statusElement, kind, message) {
  if (!statusElement) {
    return
  }
  if (!message) {
    statusElement.classList.add('hidden')
    statusElement.textContent = ''
    return
  }
  statusElement.classList.remove('hidden')
  statusElement.textContent = message
  const colorByKind = {
    error: 'text-red-300',
    info: 'text-slate-300',
    success: 'text-emerald-300',
  }
  statusElement.className = `text-[11px] font-mono ${colorByKind[kind] ?? 'text-slate-300'}`
}

// Join a folder path and a filename using the OS-appropriate separator.
// Mirrors the heuristic the file-explorer modal uses: backslash if the
// folder already contains one (Windows), forward slash otherwise.
function joinSourcePath(folder, filename) {
  const trimmedFolder = folder.replace(/[\\/]+$/, '')
  const separator = trimmedFolder.includes('\\') ? '\\' : '/'
  return `${trimmedFolder}${separator}${filename}`
}

// ─── Copy buttons (delegated) ─────────────────────────────────────────────────

async function copyDetailsContent(button) {
  const details = button.closest('details')
  const body = details?.querySelector('pre, .results-body')
  if (!body) return
  const original = button.textContent
  try {
    await navigator.clipboard.writeText(body.innerText || body.textContent || '')
    button.textContent = '✓ Copied'
  } catch {
    button.textContent = '✗ Failed'
  }
  setTimeout(() => { button.textContent = original }, 1200)
}

export function attachCopyButtonListener() {
  document.addEventListener('click', (event) => {
    const button = event.target.closest('.copy-btn')
    if (!button) return
    event.preventDefault()
    event.stopPropagation()
    copyDetailsContent(button)
  })
}
