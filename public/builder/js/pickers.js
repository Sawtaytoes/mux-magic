// ─── Popover pickers ──────────────────────────────────────────────────────────
//
// Shared popover-picker shell (createPopoverPicker) plus four concrete
// instances: command picker, enum picker, link/location picker, and path
// filesystem typeahead.

import { COMMANDS, TAG_ORDER } from './commands.js'
import { findStepById, flattenSteps, paths, randomHex } from './sequence-state.js'
import { stepOutput } from './sequence-state.js'
import { setParam, setLink, refreshLinkedInputs, scheduleUpdateUrl } from './sequence-editor.js'
import { esc } from './step-renderer.js'

// commandLabel is provided by /command-labels.js global.
const commandLabel = (name) => (typeof window.commandLabel === 'function' ? window.commandLabel(name) : name)

// ─── Shared popover-picker shell ──────────────────────────────────────────────

export function createPopoverPicker(config) {
  const pickerState = { current: null }

  function getPopover() {
    return document.getElementById(config.popoverId)
  }
  function getInput() {
    return document.getElementById(config.inputId)
  }
  function getList() {
    return document.getElementById(config.listId)
  }

  function isSameAnchor(firstAnchor, secondAnchor) {
    return config.isSameAnchor
      ? config.isSameAnchor(firstAnchor, secondAnchor)
      : JSON.stringify(firstAnchor) === JSON.stringify(secondAnchor)
  }

  function open(anchor, anchorElement) {
    if (pickerState.current && isSameAnchor(pickerState.current.anchor, anchor)) {
      close()
      return
    }
    const items = config.buildItems(anchor)
    const initialActiveIndex = config.findInitialActive ? config.findInitialActive(items, anchor) : 0
    pickerState.current = { anchor, items, filtered: items, query: '', activeIndex: initialActiveIndex }
    positionPopover(anchorElement)
    getPopover().classList.remove('hidden')
    const input = getInput()
    input.value = ''
    render()
    setTimeout(() => input?.focus(), 0)
  }

  function close() {
    getPopover()?.classList.add('hidden')
    pickerState.current = null
  }

  function positionPopover(anchorElement) {
    const popover = getPopover()
    const triggerRect = anchorElement.getBoundingClientRect()
    const margin = 8
    const initialLeft = config.alignSide === 'right'
      ? triggerRect.right - config.width
      : triggerRect.left
    const clampedLeft = (() => {
      if (initialLeft + config.width > window.innerWidth - margin) {
        return Math.max(margin, window.innerWidth - config.width - margin)
      }
      if (initialLeft < margin) {
        return margin
      }
      return initialLeft
    })()
    const spaceBelow = window.innerHeight - triggerRect.bottom - margin
    const spaceAbove = triggerRect.top - margin
    const isFlippedAbove = spaceBelow < 200 && spaceAbove > spaceBelow
    // Always use `top` (not `bottom`) so the popover is positioned in
    // viewport-relative terms that stay correct regardless of scroll offset.
    // Clamp into the visible viewport so the popover never drifts off-screen.
    popover.style.bottom = ''
    const { top, height } = (() => {
      if (isFlippedAbove) {
        const flippedHeight = Math.min(config.maxHeight, Math.max(0, spaceAbove))
        return { top: triggerRect.top - flippedHeight - 4, height: flippedHeight }
      }
      const droppedHeight = Math.min(config.maxHeight, Math.max(0, spaceBelow))
      return { top: triggerRect.bottom + 4, height: droppedHeight }
    })()
    const clampedTop = Math.max(margin, Math.min(top, window.innerHeight - height - margin))
    popover.style.top = `${clampedTop}px`
    popover.style.left = `${clampedLeft}px`
    popover.style.maxHeight = `${height}px`
  }

  function filter(query) {
    const state = pickerState.current
    if (!state) {
      return
    }
    state.query = query
    state.activeIndex = 0
    render()
  }

  function render() {
    const state = pickerState.current
    if (!state) {
      return
    }
    const list = getList()
    const query = state.query.trim().toLowerCase()
    const filtered = query ? state.items.filter((item) => config.matchesQuery(item, query)) : state.items
    state.filtered = filtered
    if (state.activeIndex >= filtered.length) {
      state.activeIndex = 0
    }
    const emptyHtml = config.emptyHtml ?? '<p class="text-xs text-slate-500 text-center py-4">No matches.</p>'
    list.innerHTML = filtered.length === 0
      ? emptyHtml
      : filtered.map((item, index) => (
          `<button type="button" data-picker-idx="${index}" class="${config.itemClass(item, index === state.activeIndex)}">`
          + config.renderItem(item, index === state.activeIndex)
          + `</button>`
        )).join('')
    const activeElement = list.querySelector(`[data-picker-idx="${state.activeIndex}"]`)
    activeElement?.scrollIntoView({ block: 'nearest' })
  }

  function selectAtIndex(index) {
    const state = pickerState.current
    if (!state) {
      return
    }
    const item = state.filtered[index]
    if (!item) {
      return
    }
    const anchor = state.anchor
    close()
    config.onSelect(item, anchor)
  }

  function keydown(event) {
    const state = pickerState.current
    if (!state) {
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }
    if (!state.filtered?.length) {
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      state.activeIndex = (state.activeIndex + 1) % state.filtered.length
      render()
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      state.activeIndex = (state.activeIndex - 1 + state.filtered.length) % state.filtered.length
      render()
    } else if (event.key === 'Enter') {
      event.preventDefault()
      selectAtIndex(state.activeIndex)
    }
  }

  function attachListDelegation() {
    const list = getList()
    if (!list) {
      return
    }
    list.addEventListener('mousedown', (event) => {
      if (event.target.closest('[data-picker-idx]')) {
        event.preventDefault()
      }
    })
    list.addEventListener('click', (event) => {
      const button = event.target.closest('[data-picker-idx]')
      if (!button) {
        return
      }
      selectAtIndex(Number(button.dataset.pickerIdx))
    })
  }
  attachListDelegation()

  document.addEventListener('mousedown', (event) => {
    if (!pickerState.current) {
      return
    }
    if (getPopover().contains(event.target)) {
      return
    }
    if (event.target.closest(config.triggerSelector)) {
      return
    }
    close()
  }, true)

  return { open, close, filter, keydown, render }
}

// ─── Command picker ───────────────────────────────────────────────────────────

export const commandPicker = createPopoverPicker({
  popoverId: 'cmd-picker-popover',
  inputId: 'cmd-picker-input',
  listId: 'cmd-picker-list',
  triggerSelector: '[data-cmd-picker-trigger]',
  alignSide: 'left',
  width: 340,
  maxHeight: 400,
  isSameAnchor: (anchorA, anchorB) => anchorA.stepId === anchorB.stepId,
  // Sectioned by API tag (TAG_ORDER preserves the API's logical
  // grouping — File Operations, Subtitle Operations, Track Operations,
  // etc.) and alphabetical by friendly label WITHIN each section.
  // Friendly label is what the user sees, so sort by that rather than
  // the camelCase command id.
  buildItems: () => (
    TAG_ORDER.flatMap((tag) => (
      Object.entries(COMMANDS)
        .filter(([, command]) => command.tag === tag)
        .map(([name]) => ({ name, tag }))
        .sort((leftItem, rightItem) => (
          commandLabel(leftItem.name).localeCompare(commandLabel(rightItem.name))
        ))
    ))
  ),
  findInitialActive: (items, anchor) => {
    const step = findStepById(anchor.stepId)
    const currentCommand = step?.command
    const idx = items.findIndex((item) => item.name === currentCommand)
    return idx >= 0 ? idx : 0
  },
  matchesQuery: (item, query) => (
    item.name.toLowerCase().includes(query)
    || commandLabel(item.name).toLowerCase().includes(query)
    || item.tag.toLowerCase().includes(query)
  ),
  itemClass: (item, isActive) => (
    `w-full text-left px-3 py-1.5 flex items-start gap-2 ${isActive ? 'bg-blue-700 text-white' : 'text-slate-200 hover:bg-slate-800'}`
  ),
  renderItem: (item, isActive) => (
    `<span class="flex-1 min-w-0 flex flex-col">`
    + `<span class="text-xs truncate">${esc(commandLabel(item.name))}</span>`
    + `<span class="font-mono text-[10px] ${isActive ? 'text-blue-200' : 'text-slate-500'} truncate">${esc(item.name)}</span>`
    + `</span>`
    + `<span class="text-[10px] ${isActive ? 'text-blue-200' : 'text-slate-500'} shrink-0 mt-0.5">${esc(item.tag)}</span>`
  ),
  emptyHtml: '<p class="text-xs text-slate-500 text-center py-4">No commands match.</p>',
  onSelect: (item, anchor) => {
    window.changeCommand(anchor.stepId, item.name)
  },
})

// ─── Enum picker ──────────────────────────────────────────────────────────────

export const enumPicker = createPopoverPicker({
  popoverId: 'enum-picker-popover',
  inputId: 'enum-picker-input',
  listId: 'enum-picker-list',
  triggerSelector: '[data-enum-picker-trigger]',
  alignSide: 'left',
  width: 300,
  maxHeight: 400,
  isSameAnchor: (a, b) => a.stepId === b.stepId && a.fieldName === b.fieldName,
  buildItems: (anchor) => {
    const step = findStepById(anchor.stepId)
    if (!step) return []
    const command = COMMANDS[step.command]
    const field = command?.fields?.find((candidate) => candidate.name === anchor.fieldName)
    return field?.options ?? []
  },
  findInitialActive: (items, anchor) => {
    const step = findStepById(anchor.stepId)
    const currentValue = step?.params?.[anchor.fieldName]
    const command = step ? COMMANDS[step.command] : null
    const field = command?.fields?.find((candidate) => candidate.name === anchor.fieldName)
    const effectiveValue = currentValue ?? field?.default
    const idx = items.findIndex((item) => item.value === effectiveValue)
    return idx >= 0 ? idx : 0
  },
  matchesQuery: (item, query) => (
    item.label.toLowerCase().includes(query)
    || String(item.value).toLowerCase().includes(query)
  ),
  itemClass: (item, isActive) => (
    `w-full text-left px-3 py-1.5 text-xs ${isActive ? 'bg-blue-700 text-white' : 'text-slate-200 hover:bg-slate-800'}`
  ),
  renderItem: (item) => esc(item.label),
  emptyHtml: '<p class="text-xs text-slate-500 text-center py-4">No options match.</p>',
  onSelect: (item, anchor) => {
    setParam(anchor.stepId, anchor.fieldName, item.value)
    window.mediaTools.renderAll()
  },
})

// ─── Link / location picker ───────────────────────────────────────────────────

function makePathBreakable(text) {
  return text.replace(/([/\\])/g, "​$1")
}

function describeLinkTarget(step, fieldName) {
  const link = step.links?.[fieldName]
  if (!link) return { label: '— custom —' }
  if (typeof link === 'string') {
    const pathVar = paths.find((candidate) => candidate.id === link)
    if (!pathVar) return { label: '(missing path)' }
    return { label: pathVar.label || pathVar.value || 'path variable', pathVarId: pathVar.id }
  }
  if (typeof link === 'object' && link.linkedTo) {
    const sourceLocation = flattenSteps().find((e) => e.step.id === link.linkedTo) ?? null
    if (!sourceLocation) return { label: '(missing step)' }
    return {
      label: `Step ${sourceLocation.flatIndex + 1}: ${commandLabel(sourceLocation.step.command) || '?'}`,
      sourceStepId: sourceLocation.step.id,
    }
  }
  return { label: '— custom —' }
}

function buildLinkPickerItems(stepId, fieldName) {
  const flatOrder = flattenSteps()
  const currentIndex = flatOrder.findIndex((entry) => entry.step.id === stepId)
  if (currentIndex < 0) return []
  // '— Custom Path —' creates a new independent path variable from whatever
  // the user has currently typed. This lets them branch: e.g. two steps that
  // started from the same base path can diverge without editing each other's
  // path variable.
  const items = [
    { kind: 'custom', value: 'custom', label: '— Custom Path —', detail: 'Create a new independent path variable' },
  ]
  paths.forEach((pathVar) => {
    items.push({
      kind: 'path',
      value: `path:${pathVar.id}`,
      label: pathVar.label || '(unnamed)',
      detail: pathVar.value || '',
      pathVarId: pathVar.id,
    })
  })
  flatOrder.slice(0, currentIndex).forEach((entry) => {
    const previousStep = entry.step
    if (previousStep.command === null) return
    const folderOutput = stepOutput(previousStep)
    items.push({
      kind: 'step',
      value: `step:${previousStep.id}:folder`,
      label: `Step ${entry.flatIndex + 1}: ${commandLabel(previousStep.command)}`,
      detail: folderOutput || '',
      sourceStepId: previousStep.id,
    })
  })
  return items
}

export function refreshLinkPickerTrigger(stepId, fieldName) {
  const trigger = document.querySelector(`[data-link-picker-trigger][data-step="${stepId}"][data-field="${fieldName}"]`)
  if (!trigger) return
  const step = findStepById(stepId)
  if (!step) return
  const target = describeLinkTarget(step, fieldName)
  const labelElement = trigger.querySelector('[data-link-trigger-label]')
  if (labelElement) labelElement.textContent = target.label
  if (target.pathVarId) { trigger.dataset.pvId = target.pathVarId } else { delete trigger.dataset.pvId }
  if (target.sourceStepId) { trigger.dataset.linkedStep = target.sourceStepId } else { delete trigger.dataset.linkedStep }
}

export const linkPicker = createPopoverPicker({
  popoverId: 'link-picker-popover',
  inputId: 'link-picker-input',
  listId: 'link-picker-list',
  triggerSelector: '[data-link-picker-trigger]',
  alignSide: 'right',
  width: 360,
  maxHeight: 400,
  isSameAnchor: (anchorA, anchorB) => (
    anchorA.stepId === anchorB.stepId && anchorA.fieldName === anchorB.fieldName
  ),
  buildItems: (anchor) => buildLinkPickerItems(anchor.stepId, anchor.fieldName),
  findInitialActive: (items, anchor) => {
    const step = findStepById(anchor.stepId)
    if (!step) return 0
    const link = step.links?.[anchor.fieldName]
    if (typeof link === 'string') {
      const matchIndex = items.findIndex((item) => item.kind === 'path' && item.pathVarId === link)
      return matchIndex >= 0 ? matchIndex : 0
    }
    if (link && typeof link === 'object' && link.linkedTo) {
      const matchIndex = items.findIndex((item) => item.kind === 'step' && item.sourceStepId === link.linkedTo)
      return matchIndex >= 0 ? matchIndex : 0
    }
    return 0
  },
  matchesQuery: (item, query) => (
    item.label.toLowerCase().includes(query)
    || (item.detail || '').toLowerCase().includes(query)
  ),
  itemClass: (item, isActive) => (
    `w-full text-left px-3 py-1.5 ${isActive ? 'bg-blue-700' : 'hover:bg-slate-800'}`
  ),
  renderItem: (item, isActive) => {
    const labelClass = `text-xs ${isActive ? 'text-white' : 'text-slate-200'} ${item.kind === 'path' ? 'font-medium' : 'font-mono'}`
    const detailClass = `path-detail font-mono text-[11px] pl-4 ${isActive ? 'text-blue-100' : 'text-slate-400'}`
    const detail = item.detail
      ? `<div class="${detailClass}">${makePathBreakable(esc(item.detail))}</div>`
      : ''
    return `<div class="${labelClass}">${esc(item.label)}</div>${detail}`
  },
  onSelect: (item, anchor) => {
    if (item.kind === 'custom') {
      // Read the current field value (may be in a linked path var or the raw param).
      const step = findStepById(anchor.stepId)
      const currentRaw = step?.params?.[anchor.fieldName] ?? ''
      const currentLinked = (() => {
        const link = step?.links?.[anchor.fieldName]
        if (typeof link === 'string') {
          return paths.find((p) => p.id === link)?.value ?? ''
        }
        return ''
      })()
      const currentValue = (currentLinked || currentRaw).trim()
      const newPath = { id: 'path_' + randomHex(), label: 'Path ' + paths.length, value: currentValue }
      paths.push(newPath)
      setLink(anchor.stepId, anchor.fieldName, `path:${newPath.id}`)
      refreshLinkPickerTrigger(anchor.stepId, anchor.fieldName)
      window.mediaTools?.renderAll?.()
      return
    }
    setLink(anchor.stepId, anchor.fieldName, item.value)
    refreshLinkPickerTrigger(anchor.stepId, anchor.fieldName)
  },
})

// ─── Path typeahead (filesystem autocomplete) ─────────────────────────────────

const pathPickerState = { current: null }
// Stores the path value each step/field had at the moment of focus so that
// updateLinkedPathVar can compare against it (not against pathVar.value which
// onPathFieldInput already updates on every keystroke).
const pathFocusValues = new Map()

// Re-open the path picker on focus/click of an input that already
// has a value. Without this, after blur the picker is closed and
// clicking back into the field shows nothing — the user has to type
// a character to wake it up. Now: focus → if there's a value, kick
// the lookup again so the dropdown reappears for the same path.
export function onPathFieldFocus(inputElement, stepId, fieldName, value) {
  pathFocusValues.set(`${stepId}:${fieldName}`, value ?? '')
  if (!value) {
    return
  }
  schedulePathLookup(inputElement, { mode: 'step', stepId, fieldName }, value)
}

// If the field is linked to a path variable, update the path var's value
// directly instead of writing step.params (which would be overwritten by
// refreshLinkedInputs back to the old path var value). Returns true if the
// update was handled via the path var.
// When a source-path field is committed with a new value, delete any
// folderMultiSelect params in the same step whose sourceField points to it —
// previously-selected folders are meaningless under a different source path.
function clearDependentFolderFields({ stepId, sourceFieldName }) {
  const step = findStepById(stepId)
  if (!step) {
    return
  }
  const commandDef = COMMANDS[step.command]
  if (!commandDef) {
    return
  }
  const cleared = commandDef.fields.filter(
    (field) => field.type === 'folderMultiSelect' && field.sourceField === sourceFieldName
  )
  cleared.forEach((field) => { delete step.params[field.name] })
  if (cleared.length > 0) {
    window.mediaTools?.renderAll?.()
  }
}

function updateLinkedPathVar(stepId, fieldName, newValue) {
  const step = findStepById(stepId)
  const link = step?.links?.[fieldName]
  if (typeof link !== 'string') {
    return false
  }
  const pathVar = paths.find((pathVariable) => pathVariable.id === link)
  if (!pathVar) {
    return false
  }
  pathVar.value = newValue || ''
  refreshLinkedInputs()
  scheduleUpdateUrl()
  return true
}

// Trim trailing path separator on blur. Typing through the picker
// leaves a trailing `\` or `/` so the next segment can be typed —
// once the user moves on, the trailing separator is just visual
// clutter (and would confuse downstream consumers expecting a clean
// path). Updates both the input value and the underlying step param.
export function onPathFieldBlur(inputElement, stepId, fieldName, value) {
  const focusKey = `${stepId}:${fieldName}`
  const hasFocusSnapshot = pathFocusValues.has(focusKey)
  const valueAtFocus = hasFocusSnapshot ? (pathFocusValues.get(focusKey) ?? '') : null
  pathFocusValues.delete(focusKey)

  const trimmed = (value ?? '').replace(/[\\/]+$/, '')

  // Detect path change using the focus-time snapshot. pathVar.value is already
  // equal to the current value (updated by onPathFieldInput on every keystroke),
  // so comparing against pathVar.value here would always show no change.
  if (hasFocusSnapshot && valueAtFocus !== (trimmed || '')) {
    clearDependentFolderFields({ stepId, sourceFieldName: fieldName })
  }

  if (trimmed === value) {
    return
  }

  inputElement.value = trimmed
  if (!updateLinkedPathVar(stepId, fieldName, trimmed)) {
    setParam(stepId, fieldName, trimmed || undefined)
  }
}

export function onPathFieldInput(inputElement, stepId, fieldName, value) {
  const step = findStepById(stepId)
  if (!step) {
    schedulePathLookup(inputElement, { mode: 'step', stepId, fieldName }, value)
    return
  }

  const link = step.links?.[fieldName]

  if (link && typeof link === 'string') {
    // Already linked to a path variable — update its value in-place so all
    // other steps that reference the same path variable see the change too,
    // without needing a full re-render (which would destroy the cursor).
    const pathVar = paths.find((p) => p.id === link)
    if (pathVar) {
      pathVar.value = value || ''
      scheduleUpdateUrl()
      schedulePathLookup(inputElement, { mode: 'step', stepId, fieldName }, value)
      return
    }
  }

  // Not yet linked — create and link a path variable on the very first
  // keystroke. Subsequent keystrokes hit the branch above and update the
  // same variable. This prevents blur (e.g. clicking the link picker) from
  // triggering promotePathToPathVar and creating a duplicate.
  const trimmed = (value ?? '').trim()
  if (trimmed) {
    const existing = paths.find((p) => p.value === trimmed)
    if (existing) {
      step.links[fieldName] = existing.id
      delete step.params[fieldName]
    } else if (paths.length > 0 && paths[0].id === 'basePath' && !paths[0].value) {
      paths[0].value = trimmed
      step.links[fieldName] = paths[0].id
      delete step.params[fieldName]
    } else {
      const newPath = { id: 'path_' + randomHex(), label: 'Path ' + paths.length, value: trimmed }
      paths.push(newPath)
      step.links[fieldName] = newPath.id
      delete step.params[fieldName]
    }
    // Update the link-picker trigger label in-place so it shows the newly
    // created path variable name without needing a full renderAll.
    refreshLinkPickerTrigger(stepId, fieldName)
    scheduleUpdateUrl()
  } else {
    setParam(stepId, fieldName, undefined)
  }

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
    if (!updateLinkedPathVar(target.stepId, target.fieldName, newValue)) {
      setParam(target.stepId, target.fieldName, newValue)
    }
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
      if (!updateLinkedPathVar(target.stepId, target.fieldName, trimmed)) {
        setParam(target.stepId, target.fieldName, trimmed || undefined)
      }
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
