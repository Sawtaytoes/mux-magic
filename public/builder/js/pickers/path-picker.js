import { findStepById } from '../sequence-state.js'
import { esc } from '../util/html-escape.js'
import { setParam } from '../sequence-editor.js'
import { COMMANDS } from '../commands.js'

const pathPickerState = { current: null }

// Stores field value at focus time so onPathFieldBlur can compare to detect
// real path changes (onPathFieldInput updates the param on every keystroke,
// making a direct param comparison always equal at blur time).
const pathFocusValues = new Map()

function clearDependentFolderFields({ stepId, sourceFieldName }) {
  const step = findStepById(stepId)
  if (!step) { return }
  const commandDef = COMMANDS[step.command]
  if (!commandDef) { return }
  const cleared = commandDef.fields.filter(
    (field) => field.type === 'folderMultiSelect' && field.sourceField === sourceFieldName
  )
  cleared.forEach((field) => { delete step.params[field.name] })
  if (cleared.length > 0) {
    window.mediaTools?.renderAll?.()
  }
}

// Re-open the path picker on focus/click of an input that already
// has a value. Without this, after blur the picker is closed and
// clicking back into the field shows nothing — the user has to type
// a character to wake it up. Now: focus → if there's a value, kick
// the lookup again so the dropdown reappears for the same path.
export function onPathFieldFocus(inputElement, stepId, fieldName, value) {
  const focusKey = `${stepId}:${fieldName}`
  pathFocusValues.set(focusKey, value ?? '')
  if (!value) {
    return
  }
  schedulePathLookup(inputElement, { mode: 'step', stepId, fieldName }, value)
}

// Trim trailing path separator on blur. Also clears folder fields that
// reference this path if the path changed since focus.
export function onPathFieldBlur(inputElement, stepId, fieldName, value) {
  const focusKey = `${stepId}:${fieldName}`
  const hasFocusSnapshot = pathFocusValues.has(focusKey)
  const valueAtFocus = hasFocusSnapshot ? (pathFocusValues.get(focusKey) ?? '') : null
  pathFocusValues.delete(focusKey)
  const trimmed = (value ?? '').replace(/[\\/]+$/, '')
  if (hasFocusSnapshot && valueAtFocus !== (trimmed || '')) {
    clearDependentFolderFields({ stepId, sourceFieldName: fieldName })
  }
  if (trimmed === value) {
    return
  }
  inputElement.value = trimmed
  setParam(stepId, fieldName, trimmed || undefined)
}

export function onPathFieldInput(inputElement, stepId, fieldName, value) {
  // If the field is currently linked to a path variable (string link),
  // typing in it is an override — clear the link so the user's value
  // sticks instead of being overwritten by the next render reading
  // `getLinkedValue` from the still-set link. Step-output links
  // (object form) stay readonly in the renderer, so we won't reach
  // here for them; the typeof guard is defence-in-depth anyway.
  const step = findStepById(stepId)
  if (step?.links?.[fieldName] && typeof step.links[fieldName] === 'string') {
    delete step.links[fieldName]
  }
  setParam(stepId, fieldName, value || undefined)
  schedulePathLookup(inputElement, { mode: 'step', stepId, fieldName }, value)
}

export function schedulePathLookup(inputElement, target, value) {
  const trimmed = (value ?? '').trim()
  if (!trimmed) {
    closePathPicker()
    return
  }
  const trailingSlash = /[\\/]$/.test(trimmed)
  const lastSeparatorIndex = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))
  const parentPath = lastSeparatorIndex <= 0 ? trimmed : trimmed.slice(0, lastSeparatorIndex) || '/'
  const query = trailingSlash
    ? ''
    : (lastSeparatorIndex < 0 ? trimmed : trimmed.slice(lastSeparatorIndex + 1))

  const existing = pathPickerState.current
  if (!existing || existing.inputElement !== inputElement) {
    pathPickerState.current = {
      inputElement, target, parentPath, query,
      entries: null, activeIndex: 0, requestToken: 0, debounceTimerId: null,
    }
  } else {
    existing.target = target
    existing.query = query
  }
  const state = pathPickerState.current

  if (state.debounceTimerId) {
    clearTimeout(state.debounceTimerId)
  }
  positionPathPicker(inputElement)

  if (state.cachedParentPath === parentPath && state.entries) {
    state.parentPath = parentPath
    state.activeIndex = 0
    renderPathPickerList()
    return
  }

  state.parentPath = parentPath
  state.debounceTimerId = setTimeout(() => {
    state.debounceTimerId = null
    runPathLookup(parentPath)
  }, 250)
}

async function runPathLookup(parentPath) {
  if (!pathPickerState.current) {
    return
  }
  const requestToken = ++pathPickerState.current.requestToken
  try {
    const response = await fetch('/queries/listDirectoryEntries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: parentPath }),
    })
    const data = await response.json()
    const state = pathPickerState.current
    if (!state || state.requestToken !== requestToken) {
      return
    }
    if (data.separator) {
      state.separator = data.separator
    }
    if (data.error) {
      state.entries = []
      state.error = data.error
    } else {
      state.entries = data.entries ?? []
      state.error = null
      state.cachedParentPath = parentPath
    }
    state.activeIndex = 0
    renderPathPickerList()
  } catch (error) {
    const state = pathPickerState.current
    if (!state || state.requestToken !== requestToken) {
      return
    }
    state.entries = []
    state.error = error?.message ?? String(error)
    renderPathPickerList()
  }
}

function positionPathPicker(inputElement) {
  const popover = document.getElementById('path-picker-popover')
  const rect = inputElement.getBoundingClientRect()
  const popoverWidth = 380
  const popoverMaxHeight = 280
  const margin = 8
  const initialLeft = rect.left
  const clampedLeft = (() => {
    if (initialLeft + popoverWidth > window.innerWidth - margin) {
      return Math.max(margin, window.innerWidth - popoverWidth - margin)
    }
    if (initialLeft < margin) {
      return margin
    }
    return initialLeft
  })()
  const spaceBelow = window.innerHeight - rect.bottom - margin
  const spaceAbove = rect.top - margin
  const flipAbove = spaceBelow < 160 && spaceAbove > spaceBelow
  // Clear `bottom` so it never conflicts with the `top` we set below.
  popover.style.bottom = ''
  const { top, height } = (() => {
    if (flipAbove) {
      const flippedHeight = Math.min(popoverMaxHeight, Math.max(0, spaceAbove))
      return { top: rect.top - flippedHeight - 4, height: flippedHeight }
    }
    const droppedHeight = Math.min(popoverMaxHeight, Math.max(0, spaceBelow))
    return { top: rect.bottom + 4, height: droppedHeight }
  })()
  const clampedTop = Math.max(margin, Math.min(top, window.innerHeight - height - margin))
  popover.style.left = `${clampedLeft}px`
  popover.style.top = `${clampedTop}px`
  popover.style.maxHeight = `${height}px`
  popover.classList.remove('hidden')
}

function renderPathPickerList() {
  const list = document.getElementById('path-picker-list')
  const state = pathPickerState.current
  if (!state) {
    list.innerHTML = ''
    return
  }
  if (state.entries === null) {
    list.innerHTML = '<p class="text-xs text-slate-500 text-center py-3">Loading…</p>'
    return
  }
  if (state.error) {
    list.innerHTML = `<p class="text-xs text-red-400 text-center py-3 break-words px-3">${esc(state.error)}</p>`
    return
  }
  const queryLower = state.query.toLowerCase()
  const matches = state.entries
    .filter((entry) => entry.isDirectory)
    .filter((entry) => !queryLower || entry.name.toLowerCase().startsWith(queryLower))
    .sort((firstEntry, secondEntry) => firstEntry.name.localeCompare(secondEntry.name))
  state.matches = matches
  if (state.activeIndex >= matches.length) {
    state.activeIndex = 0
  }
  if (matches.length === 0) {
    list.innerHTML = '<p class="text-xs text-slate-500 text-center py-3">No matching entries.</p>'
    return
  }
  list.innerHTML = matches.map((entry, index) => {
    const isActive = index === state.activeIndex
    // tabindex="-1" so the input's keydown handler's preventDefault
    // on Tab actually keeps focus on the input — without this, Tab
    // would focus the first button in the dropdown (default
    // tabindex=0 on <button>) and the user would lose the input.
    return `<button onmousedown="event.preventDefault()" onclick="pathPickerSelectByIndex(${index})"
      data-path-idx="${index}" tabindex="-1"
      class="w-full text-left px-3 py-1 flex items-center gap-2 ${isActive ? 'bg-blue-700 text-white' : 'text-slate-200 hover:bg-slate-800'}">
      <span class="shrink-0 text-slate-400">📁</span>
      <span class="font-mono text-xs flex-1 min-w-0 truncate">${esc(entry.name)}</span>
    </button>`
  }).join('')
  const activeElement = list.querySelector(`[data-path-idx="${state.activeIndex}"]`)
  activeElement?.scrollIntoView({ block: 'nearest' })
}

export function pathPickerSelectByIndex(index) {
  const state = pathPickerState.current
  if (!state?.matches) {
    return
  }
  const entry = state.matches[index]
  if (!entry) {
    return
  }
  applyPathPickerSelection(entry)
}

function applyPathPickerSelection(entry) {
  const state = pathPickerState.current
  if (!state) {
    return
  }
  const { inputElement, target, parentPath } = state
  const separator = state.separator || '/'
  const base = parentPath.endsWith('/') || parentPath.endsWith('\\')
    ? parentPath.slice(0, -1)
    : parentPath
  const newValue = `${base}${separator}${entry.name}${separator}`
  inputElement.value = newValue
  if (target.mode === 'step') {
    setParam(target.stepId, target.fieldName, newValue)
  } else {
    window.mediaTools.setPathValue(target.pathVarId, newValue)
  }
  schedulePathLookup(inputElement, target, newValue)
  inputElement.focus()
}

function commitTrimmedPath() {
  const state = pathPickerState.current
  if (!state) {
    return
  }
  const { inputElement, target } = state
  const current = inputElement.value
  const trimmed = current.replace(/[\\/]+$/, '')
  if (trimmed !== current) {
    inputElement.value = trimmed
    if (target.mode === 'step') {
      setParam(target.stepId, target.fieldName, trimmed || undefined)
    } else {
      window.mediaTools.setPathValue(target.pathVarId, trimmed)
    }
  }
  closePathPicker()
}

export function pathPickerKeydown(event) {
  const state = pathPickerState.current
  if (!state) {
    return
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    commitTrimmedPath()
    return
  }
  const matches = state.matches
  if (!matches?.length) {
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault()
      commitTrimmedPath()
    }
    return
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    state.activeIndex = (state.activeIndex + 1) % matches.length
    renderPathPickerList()
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    state.activeIndex = (state.activeIndex - 1 + matches.length) % matches.length
    renderPathPickerList()
  } else if (event.key === 'Tab' || event.key === 'Enter') {
    event.preventDefault()
    pathPickerSelectByIndex(state.activeIndex)
  }
}

export function closePathPicker() {
  document.getElementById('path-picker-popover')?.classList.add('hidden')
  const state = pathPickerState.current
  if (state?.debounceTimerId) {
    clearTimeout(state.debounceTimerId)
  }
  pathPickerState.current = null
}

export function attachPathPickerDismissal() {
  document.addEventListener('mousedown', (event) => {
    const state = pathPickerState.current
    if (!state) {
      return
    }
    const popover = document.getElementById('path-picker-popover')
    if (popover.contains(event.target)) {
      return
    }
    if (event.target === state.inputElement) {
      return
    }
    closePathPicker()
  }, true)
}
