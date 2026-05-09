import { renderStatusBadge, esc, LOOKUP_LINKS } from '../step-renderer.js'
import { findStepById } from '../sequence-state.js'
import { openSpecialsMappingModal } from '../components/specials-mapping-modal.js'

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

function getNameSpecialFeaturesSourcePath(step) {
  if (step.params?.sourcePath && !String(step.params.sourcePath).startsWith('@')) {
    return String(step.params.sourcePath)
  }
  return getLinkedValueForStep(step, 'sourcePath') ?? ''
}

// Join a folder path and a filename using the OS-appropriate separator.
// Mirrors the heuristic the file-explorer modal uses: backslash if the
// folder already contains one (Windows), forward slash otherwise.
function joinSourcePath(folder, filename) {
  const trimmedFolder = folder.replace(/[\\/]+$/, '')
  const separator = trimmedFolder.includes('\\') ? '\\' : '/'
  return `${trimmedFolder}${separator}${filename}`
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

// Wire up event listeners on the rendered interactive renamer rows.
// Receives the body element holding the rendered HTML so each call
// scopes its queries — important because step cards re-render on every
// rename and the listener teardown lives implicitly in DOM removal.
function wireNameSpecialFeaturesResults({ body, step, summaryRecord }) {
  const sourcePath = getNameSpecialFeaturesSourcePath(step)
  const possibleNamesRaw = Array.isArray(summaryRecord?.possibleNames) ? summaryRecord.possibleNames : []
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
      // Use window.runOrStopStep (assigned in main.js) to re-run with the
      // same running-guard logic as the step card's ▶ button.
      onRunStep: () => window.runOrStopStep?.(step.id),
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

export function updateStepLogs(stepId, logs) {
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
    const html = renderStatusBadge({ status: step.status })
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
