// Smart-suggestion mapping modal for the nameSpecialFeatures result
// card (Option C from docs/options/specials-checkbox-list.md).
//
// Mounted only when there are leftover unrenamed files AND DVDCompare
// candidate names that could plausibly correspond to them. The modal
// fetches per-file durations from /files/list?includeDuration=1, ranks
// each file's possible matches via util/specials-fuzzy.js, and renders
// a confirmation table where each row is independently confirmable.
// Rows below LOW_CONFIDENCE_THRESHOLD get a yellow highlight prompting
// explicit review.
//
// This component owns its own DOM — it injects a backdrop + dialog
// container on first open and reuses them on subsequent opens. No
// changes to public/builder/index.html are required.

import { esc } from '../util/esc.js'
import {
  LOW_CONFIDENCE_THRESHOLD,
  rankSuggestions,
} from '../util/specials-fuzzy.js'

const MODAL_ID = 'specials-mapping-modal'

// Private module state — only one mapping modal can be open at a time.
// Held inside a const object so the module never reassigns a `let` (per
// AGENTS.md rule 2). The current context is the wrapped object's
// `.value`, swapped in/out as the modal opens and closes.
const moduleState = { activeContext: null }

const getModal = () => document.getElementById(MODAL_ID)

const ensureModalMounted = () => {
  if (getModal()) {
    return getModal()
  }
  const modal = document.createElement('div')
  modal.id = MODAL_ID
  modal.className = 'hidden fixed inset-0 z-50 flex items-center justify-center bg-black/70'
  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      closeSpecialsMappingModal()
    }
  })
  document.body.appendChild(modal)
  return modal
}

// Format a 0..1 score as a percentage badge string. Picks a tailwind
// color class based on the threshold so the row's confidence is
// glanceable.
const renderConfidenceBadge = (confidence) => {
  const percent = Math.round(confidence * 100)
  const isLowConfidence = confidence < LOW_CONFIDENCE_THRESHOLD
  const colorClass = isLowConfidence
    ? 'bg-amber-700 text-amber-100'
    : 'bg-emerald-700 text-emerald-100'
  return (
    `<span class="inline-block ${colorClass} text-[10px] font-mono px-1.5 py-0.5 rounded">`
    + `${percent}%`
    + '</span>'
  )
}

// Pretty-print a per-row file timecode for the file column. Falls back
// to "—" when the duration probe couldn't resolve one (mediainfo
// failure or non-video file slipping through).
const renderFileTimecode = (timecode) => (
  timecode
    ? `<span class="text-slate-400 text-[10px] font-mono">(${esc(timecode)})</span>`
    : '<span class="text-slate-500 text-[10px] italic">(no duration)</span>'
)

// Build the <option> list for the per-row dropdown. The currently-
// selected candidate is marked `selected` so the native <select>
// reflects state without extra JS.
const renderCandidateOptions = ({ rankedCandidates, selectedName }) => (
  rankedCandidates.map(({ candidate, confidence }) => {
    const percent = Math.round(confidence * 100)
    const isSelected = candidate.name === selectedName
    return (
      `<option value="${esc(candidate.name)}"${isSelected ? ' selected' : ''}>`
      + `${esc(candidate.name)} — ${percent}%`
      + '</option>'
    )
  }).join('')
)

const renderRow = ({ index, suggestion }) => {
  const topCandidate = suggestion.rankedCandidates[0]
  if (!topCandidate) {
    return ''
  }
  const isLowConfidence = topCandidate.confidence < LOW_CONFIDENCE_THRESHOLD
  const rowClass = isLowConfidence
    ? 'border border-amber-600/50 bg-amber-900/20'
    : 'border border-slate-700 bg-slate-800/40'
  return (
    `<tr data-mapping-row data-mapping-index="${index}" class="${rowClass}">`
    + `<td class="px-1.5 py-1.5 align-top">`
    + `<button type="button" data-mapping-play class="text-cyan-400 hover:text-cyan-300 text-[13px] leading-none font-medium px-1.5" title="Preview this file">▶</button>`
    + `</td>`
    + `<td class="px-2 py-1.5 align-top">`
    + `<div class="font-mono text-xs text-slate-100 break-words">${esc(suggestion.filename)}</div>`
    + `<div class="mt-0.5">${renderFileTimecode(suggestion.fileTimecode)}</div>`
    + `</td>`
    + `<td class="px-2 py-1.5 align-top w-[40%]">`
    + `<select data-mapping-select class="w-full text-xs font-mono bg-slate-950 text-slate-100 border border-slate-600 rounded px-1.5 py-1 focus:outline-none focus:border-blue-500">`
    + renderCandidateOptions({
        rankedCandidates: suggestion.rankedCandidates,
        selectedName: topCandidate.candidate.name,
      })
    + `</select>`
    + `</td>`
    + `<td class="px-2 py-1.5 align-top text-center">${renderConfidenceBadge(topCandidate.confidence)}</td>`
    + `<td class="px-2 py-1.5 align-top text-right">`
    + `<label class="inline-flex items-center gap-1 text-xs text-slate-200 cursor-pointer">`
    + `<input type="checkbox" data-mapping-include checked class="w-3.5 h-3.5 cursor-pointer" />`
    + `Include`
    + `</label>`
    + `<p data-mapping-row-status class="hidden text-[10px] font-mono mt-1"></p>`
    + `</td>`
    + `</tr>`
  )
}

const renderModalHtml = ({ suggestions }) => {
  const rowsHtml = suggestions.map((suggestion, index) => renderRow({ index, suggestion })).join('')
  const lowConfidenceCount = suggestions.filter((suggestion) => {
    const top = suggestion.rankedCandidates[0]
    return top && top.confidence < LOW_CONFIDENCE_THRESHOLD
  }).length
  const lowConfidenceLine = lowConfidenceCount > 0
    ? (
      `<p class="text-[11px] text-amber-300 mb-2">`
      + `${lowConfidenceCount} row${lowConfidenceCount === 1 ? '' : 's'} below ${Math.round(LOW_CONFIDENCE_THRESHOLD * 100)}% confidence — please review the dropdown selection before renaming.`
      + `</p>`
    )
    : ''
  return (
    `<div class="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">`
    + `<div class="px-4 py-3 border-b border-slate-700 flex items-center justify-between">`
    + `<h2 class="text-base font-semibold text-slate-100">Smart-match leftover files</h2>`
    + `<button type="button" data-mapping-close class="text-slate-400 hover:text-slate-200 text-xl leading-none px-1">×</button>`
    + `</div>`
    + `<div class="px-4 py-3 flex-1 overflow-y-auto">`
    + `<p class="text-xs text-slate-300 mb-2">`
    + `Each leftover file is paired with the highest-scoring DVDCompare candidate. `
    + `Adjust the dropdown for any row that looks wrong, uncheck "Include" to skip a row, then click Rename to apply.`
    + `</p>`
    + lowConfidenceLine
    + `<table class="w-full border-separate border-spacing-y-1.5 text-xs">`
    + `<thead><tr class="text-left text-slate-400 text-[10px] uppercase tracking-wider">`
    + `<th class="px-2 py-1">File</th>`
    + `<th class="px-2 py-1">Suggested name</th>`
    + `<th class="px-2 py-1 text-center">Confidence</th>`
    + `<th class="px-2 py-1 text-right">Action</th>`
    + `</tr></thead>`
    + `<tbody>${rowsHtml}</tbody>`
    + `</table>`
    + `</div>`
    + `<div class="px-4 py-3 border-t border-slate-700 flex items-center justify-end gap-2">`
    + `<p data-mapping-status class="text-xs text-slate-300 mr-auto"></p>`
    + `<button type="button" data-mapping-cancel class="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded">Cancel</button>`
    + `<button type="button" data-mapping-confirm class="text-xs bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded font-medium">Rename selected</button>`
    + `</div>`
    + `</div>`
  )
}

const fetchDurationsForFolder = async ({ filenames, sourcePath }) => {
  // Build a set of stems from the input filenames for matching against disk entries.
  const filenameStems = new Set(filenames.map((f) => {
    const dot = f.lastIndexOf('.')
    return dot > 0 ? f.slice(0, dot) : f
  }))
  try {
    const url = new URL('/files/list', window.location.origin)
    url.searchParams.set('path', sourcePath)
    url.searchParams.set('includeDuration', '1')
    const response = await fetch(url)
    if (!response.ok) {
      return { durationByFilename: new Map(), existingFilenames: null, stemToFullName: null }
    }
    const data = await response.json()
    if (!Array.isArray(data?.entries)) {
      return { durationByFilename: new Map(), existingFilenames: null, stemToFullName: null }
    }
    const durationByFilename = new Map()
    const existingFilenames = new Set()
    const stemToFullName = new Map()
    data.entries.forEach((entry) => {
      if (typeof entry?.name === 'string') {
        existingFilenames.add(entry.name)
        const dot = entry.name.lastIndexOf('.')
        const stem = dot > 0 ? entry.name.slice(0, dot) : entry.name
        if (filenameStems.has(stem)) {
          if (typeof entry?.duration === 'string') {
            durationByFilename.set(stem, entry.duration)
          }
          stemToFullName.set(stem, entry.name)
        }
      }
    })
    return { durationByFilename, existingFilenames, stemToFullName }
  }
  catch {
    return { durationByFilename: new Map(), existingFilenames: null, stemToFullName: null }
  }
}

const setStatusMessage = ({ kind, message }) => {
  const statusElement = getModal()?.querySelector('[data-mapping-status]')
  if (!statusElement) {
    return
  }
  const colorByKind = {
    error: 'text-red-300',
    info: 'text-slate-300',
    success: 'text-emerald-300',
  }
  statusElement.className = `text-xs mr-auto ${colorByKind[kind] ?? 'text-slate-300'}`
  statusElement.textContent = message
}

const joinSourcePath = ({ folder, filename }) => {
  const trimmedFolder = folder.replace(/[\\/]+$/, '')
  const separator = trimmedFolder.includes('\\') ? '\\' : '/'
  return `${trimmedFolder}${separator}${filename}`
}

const ensureExtension = ({ desiredName, originalFilename }) => {
  const extensionMatch = originalFilename.match(/\.[^.\\/]+$/)
  const extension = extensionMatch ? extensionMatch[0] : ''
  if (extension && desiredName.toLowerCase().endsWith(extension.toLowerCase())) {
    return desiredName
  }
  return `${desiredName}${extension}`
}

const handleConfirmClick = async () => {
  if (!moduleState.activeContext) {
    return
  }
  const modal = getModal()
  if (!modal) {
    return
  }
  const { onRenameApplied, sourcePath, stemToFullName, suggestions } = moduleState.activeContext
  const rows = Array.from(modal.querySelectorAll('[data-mapping-row]'))
  const renamePlan = rows
    .map((row) => {
      const indexAttribute = row.getAttribute('data-mapping-index') ?? '-1'
      const index = Number(indexAttribute)
      const suggestion = suggestions[index]
      if (!suggestion) {
        return null
      }
      const includeInput = row.querySelector('[data-mapping-include]')
      const selectElement = row.querySelector('[data-mapping-select]')
      const desiredName = String(selectElement?.value ?? '').trim()
      if (!includeInput?.checked || desiredName.length === 0) {
        return null
      }
      // Look up the actual filename with extension from the stem mapping
      const actualFilename = stemToFullName?.get(suggestion.filename) ?? suggestion.filename
      return {
        desiredName,
        filename: suggestion.filename,
        actualFilename,
        row,
      }
    })
    .filter(Boolean)

  if (renamePlan.length === 0) {
    setStatusMessage({ kind: 'error', message: 'Nothing selected to rename.' })
    return
  }

  const confirmButton = modal.querySelector('[data-mapping-confirm]')
  const cancelButton = modal.querySelector('[data-mapping-cancel]')
  if (confirmButton) {
    confirmButton.disabled = true
  }
  if (cancelButton) {
    cancelButton.disabled = true
  }
  setStatusMessage({ kind: 'info', message: `Renaming 0 / ${renamePlan.length}…` })

  const successfulRenames = await renamePlan.reduce(async (previousPromise, plan, planIndex) => {
    const accumulator = await previousPromise
    setStatusMessage({ kind: 'info', message: `Renaming ${planIndex} / ${renamePlan.length}…` })
    const oldPath = joinSourcePath({ folder: sourcePath, filename: plan.actualFilename })
    const newFilename = ensureExtension({
      desiredName: plan.desiredName,
      originalFilename: plan.actualFilename,
    })
    const newPath = joinSourcePath({ folder: sourcePath, filename: newFilename })
    const rowStatusElement = plan.row.querySelector('[data-mapping-row-status]')
    try {
      const response = await fetch('/files/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPath, newPath }),
      })
      const data = await response.json()
      if (!response.ok || data?.ok !== true) {
        const message = data?.error ?? `HTTP ${response.status}`
        if (rowStatusElement) {
          rowStatusElement.classList.remove('hidden')
          rowStatusElement.textContent = message
          rowStatusElement.className = 'text-[10px] font-mono mt-1 text-red-300'
        }
        return accumulator
      }
      if (rowStatusElement) {
        rowStatusElement.classList.remove('hidden')
        rowStatusElement.textContent = `Renamed → ${newFilename}`
        rowStatusElement.className = 'text-[10px] font-mono mt-1 text-emerald-300'
      }
      const includeInput = plan.row.querySelector('[data-mapping-include]')
      if (includeInput) {
        includeInput.checked = false
        includeInput.disabled = true
      }
      return accumulator.concat({
        newFilename,
        oldFilename: plan.filename,
      })
    }
    catch (error) {
      const message = String(error?.message ?? error)
      if (rowStatusElement) {
        rowStatusElement.classList.remove('hidden')
        rowStatusElement.textContent = message
        rowStatusElement.className = 'text-[10px] font-mono mt-1 text-red-300'
      }
      return accumulator
    }
  }, Promise.resolve([]))

  if (cancelButton) {
    cancelButton.disabled = false
  }
  if (successfulRenames.length === renamePlan.length) {
    setStatusMessage({
      kind: 'success',
      message: `Renamed ${successfulRenames.length} / ${renamePlan.length}.`,
    })
  }
  else {
    setStatusMessage({
      kind: 'error',
      message: `Renamed ${successfulRenames.length} / ${renamePlan.length} (see per-row errors).`,
    })
  }

  if (typeof onRenameApplied === 'function' && successfulRenames.length > 0) {
    onRenameApplied(successfulRenames)
  }

  if (confirmButton) {
    confirmButton.disabled = successfulRenames.length === renamePlan.length
  }
}

const handleEscapeKey = (event) => {
  if (event.key !== 'Escape') {
    return
  }
  const modal = getModal()
  if (modal && !modal.classList.contains('hidden')) {
    event.preventDefault()
    closeSpecialsMappingModal()
  }
}

document.addEventListener('keydown', handleEscapeKey)

export const closeSpecialsMappingModal = () => {
  const modal = getModal()
  if (!modal) {
    return
  }
  modal.classList.add('hidden')
  modal.innerHTML = ''
  moduleState.activeContext = null
}

// Public API. Mount + open the smart-suggestion modal for a leftover
// file set. No-op when either input list is empty (per the design
// doc's mount condition). The optional `onRenameApplied` callback
// fires after each batch confirm so the caller can refresh its summary
// record / re-render.
export const openSpecialsMappingModal = async ({
  onRenameApplied,
  onRunStep,
  possibleNames,
  sourcePath,
  unrenamedFilenames,
}) => {
  if (!Array.isArray(unrenamedFilenames) || unrenamedFilenames.length === 0) {
    return
  }
  if (!Array.isArray(possibleNames) || possibleNames.length === 0) {
    return
  }
  if (typeof sourcePath !== 'string' || sourcePath.length === 0) {
    return
  }
  const modal = ensureModalMounted()
  modal.innerHTML = (
    `<div class="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-full max-w-md p-6">`
    + `<p class="text-sm text-slate-300">Loading file durations…</p>`
    + `</div>`
  )
  modal.classList.remove('hidden')

  const { durationByFilename, existingFilenames, stemToFullName } = await fetchDurationsForFolder({
    filenames: unrenamedFilenames,
    sourcePath,
  })
  // Filter out filenames no longer on disk (renamed in a prior session).
  // Disk entries include extensions (e.g. "SOLDIER_t00.mkv") while
  // unrenamedFilenames may be bare stems — compare stems to avoid false
  // misses when the extension is missing from one side.
  const existingStems = existingFilenames
    ? new Set(Array.from(existingFilenames).map((name) => {
        const dot = name.lastIndexOf('.')
        return dot > 0 ? name.slice(0, dot) : name
      }))
    : null
  const presentFilenames = existingStems
    ? unrenamedFilenames.filter((f) => {
        if (existingFilenames.has(f)) return true
        const dot = f.lastIndexOf('.')
        const stem = dot > 0 ? f.slice(0, dot) : f
        return existingStems.has(stem)
      })
    : unrenamedFilenames
  if (presentFilenames.length === 0) {
    const gone = unrenamedFilenames.length
    modal.innerHTML = (
      `<div class="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-full max-w-md p-6 flex flex-col gap-3">`
      + `<p class="text-sm font-semibold text-slate-100">No unnamed files remain</p>`
      + `<p class="text-xs text-slate-400">`
      + `The ${gone === 1 ? 'file' : `${gone} files`} from the last run no longer exist at the expected location — `
      + `they were likely renamed in a previous session. `
      + `Re-run the step to refresh the results.`
      + `</p>`
      + `<div class="flex justify-end">`
      + `<button type="button" data-mapping-close class="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded">Close</button>`
      + `</div>`
      + `</div>`
    )
    const closeBtn = modal.querySelector('[data-mapping-close]')
    if (closeBtn) closeBtn.addEventListener('click', closeSpecialsMappingModal)
    return
  }
  const unrenamedFiles = presentFilenames.map((filename) => ({
    filename,
    timecode: durationByFilename.get(filename),
  }))
  const suggestions = rankSuggestions({ possibleNames, unrenamedFiles })

  moduleState.activeContext = {
    onRenameApplied,
    sourcePath,
    stemToFullName,
    suggestions,
  }

  modal.innerHTML = renderModalHtml({ suggestions })

  const closeButton = modal.querySelector('[data-mapping-close]')
  const cancelButton = modal.querySelector('[data-mapping-cancel]')
  const confirmButton = modal.querySelector('[data-mapping-confirm]')
  if (closeButton) {
    closeButton.addEventListener('click', closeSpecialsMappingModal)
  }
  if (cancelButton) {
    cancelButton.addEventListener('click', closeSpecialsMappingModal)
  }
  if (confirmButton) {
    confirmButton.addEventListener('click', handleConfirmClick)
  }

  // Wire Play buttons on each row
  const playButtons = modal.querySelectorAll('[data-mapping-play]')
  playButtons.forEach((button) => {
    const row = button.closest('[data-mapping-row]')
    if (!row) return
    const indexAttribute = row.getAttribute('data-mapping-index') ?? '-1'
    const index = Number(indexAttribute)
    const suggestion = suggestions[index]
    if (suggestion && sourcePath && typeof window.openVideoModal === 'function') {
      button.addEventListener('click', () => {
        // Use the actual filename with extension if available
        const actualFilename = stemToFullName?.get(suggestion.filename) ?? suggestion.filename
        window.openVideoModal(joinSourcePath({ folder: sourcePath, filename: actualFilename }))
      })
    } else {
      button.remove()
    }
  })
}
