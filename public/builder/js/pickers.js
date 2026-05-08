// ─── Popover pickers ──────────────────────────────────────────────────────────
//
// Shared popover-picker shell (createPopoverPicker) plus four concrete
// instances: command picker, enum picker, link/location picker, and path
// filesystem typeahead.

import { COMMANDS, TAG_ORDER } from './commands.js'
import { findStepById, flattenSteps, paths } from './sequence-state.js'
import { stepOutput } from './sequence-state.js'
import { setParam, setLink, refreshLinkedInputs, scheduleUpdateUrl } from './sequence-editor.js'
import { esc } from './step-renderer.js'

// commandLabel is provided by /command-labels.js global.
const commandLabel = (name) => (typeof window.commandLabel === 'function' ? window.commandLabel(name) : name)

// ─── Shared popover-picker shell ──────────────────────────────────────────────

export function createPopoverPicker(config) {
  let state = null

  function getPopover() { return document.getElementById(config.popoverId) }
  function getInput()   { return document.getElementById(config.inputId)   }
  function getList()    { return document.getElementById(config.listId)    }

  function isSameAnchor(a, b) {
    return config.isSameAnchor ? config.isSameAnchor(a, b) : JSON.stringify(a) === JSON.stringify(b)
  }

  function open(anchor, anchorElement) {
    if (state && isSameAnchor(state.anchor, anchor)) { close(); return }
    const items = config.buildItems(anchor)
    const initialActiveIndex = config.findInitialActive ? config.findInitialActive(items, anchor) : 0
    state = { anchor, items, filtered: items, query: '', activeIndex: initialActiveIndex }
    positionPopover(anchorElement)
    getPopover().classList.remove('hidden')
    const input = getInput()
    input.value = ''
    render()
    setTimeout(() => input?.focus(), 0)
  }

  function close() {
    getPopover()?.classList.add('hidden')
    state = null
  }

  function positionPopover(anchorElement) {
    const popover = getPopover()
    const triggerRect = anchorElement.getBoundingClientRect()
    const margin = 8
    let left = config.alignSide === 'right'
      ? triggerRect.right - config.width
      : triggerRect.left
    if (left + config.width > window.innerWidth - margin) left = window.innerWidth - config.width - margin
    if (left < margin) left = margin
    const spaceBelow = window.innerHeight - triggerRect.bottom - margin
    const spaceAbove = triggerRect.top - margin
    const isFlippedAbove = spaceBelow < 200 && spaceAbove > spaceBelow
    // Always use `top` (not `bottom`) so the popover is positioned in
    // viewport-relative terms that stay correct regardless of scroll offset.
    // Clamp into the visible viewport so the popover never drifts off-screen.
    popover.style.bottom = ''
    let top, height
    if (isFlippedAbove) {
      height = Math.min(config.maxHeight, Math.max(0, spaceAbove))
      top = triggerRect.top - height - 4
    } else {
      height = Math.min(config.maxHeight, Math.max(0, spaceBelow))
      top = triggerRect.bottom + 4
    }
    top = Math.max(margin, Math.min(top, window.innerHeight - height - margin))
    popover.style.top = `${top}px`
    popover.style.left = `${left}px`
    popover.style.maxHeight = `${height}px`
  }

  function filter(query) {
    if (!state) return
    state.query = query
    state.activeIndex = 0
    render()
  }

  function render() {
    if (!state) return
    const list = getList()
    const query = state.query.trim().toLowerCase()
    const filtered = query ? state.items.filter((item) => config.matchesQuery(item, query)) : state.items
    state.filtered = filtered
    if (state.activeIndex >= filtered.length) state.activeIndex = 0
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
    if (!state) return
    const item = state.filtered[index]
    if (!item) return
    const anchor = state.anchor
    close()
    config.onSelect(item, anchor)
  }

  function keydown(event) {
    if (!state) return
    if (event.key === 'Escape') { event.preventDefault(); close(); return }
    if (!state.filtered?.length) return
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
    if (!list) return
    list.addEventListener('mousedown', (event) => {
      if (event.target.closest('[data-picker-idx]')) event.preventDefault()
    })
    list.addEventListener('click', (event) => {
      const button = event.target.closest('[data-picker-idx]')
      if (!button) return
      selectAtIndex(Number(button.dataset.pickerIdx))
    })
  }
  attachListDelegation()

  document.addEventListener('mousedown', (event) => {
    if (!state) return
    if (getPopover().contains(event.target)) return
    if (event.target.closest(config.triggerSelector)) return
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
  buildItems: () => (
    TAG_ORDER.flatMap((tag) => (
      Object.entries(COMMANDS)
        .filter(([, command]) => command.tag === tag)
        .map(([name]) => ({ name, tag }))
    ))
  ),
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
  if (!link) return { label: '— manual —' }
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
  return { label: '— manual —' }
}

function buildLinkPickerItems(stepId, fieldName) {
  const flatOrder = flattenSteps()
  const currentIndex = flatOrder.findIndex((entry) => entry.step.id === stepId)
  if (currentIndex < 0) return []
  const items = [{ kind: 'manual', value: '', label: '— manual —', detail: '' }]
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
    setLink(anchor.stepId, anchor.fieldName, item.value)
    refreshLinkPickerTrigger(anchor.stepId, anchor.fieldName)
  },
})

// ─── Path typeahead (filesystem autocomplete) ─────────────────────────────────

let pathPickerState = null

export function onPathFieldInput(inputElement, stepId, fieldName, value) {
  setParam(stepId, fieldName, value || undefined)
  schedulePathLookup(inputElement, { mode: 'step', stepId, fieldName }, value)
}

export function schedulePathLookup(inputElement, target, value) {
  const trimmed = (value ?? '').trim()
  if (!trimmed) { closePathPicker(); return }
  const trailingSlash = /[\\/]$/.test(trimmed)
  const lastSep = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))
  const parentPath = lastSep <= 0 ? trimmed : trimmed.slice(0, lastSep) || '/'
  const query = trailingSlash ? '' : (lastSep < 0 ? trimmed : trimmed.slice(lastSep + 1))

  if (!pathPickerState || pathPickerState.inputElement !== inputElement) {
    pathPickerState = {
      inputElement, target, parentPath, query,
      entries: null, activeIndex: 0, requestToken: 0, debounceTimerId: null,
    }
  } else {
    pathPickerState.target = target
    pathPickerState.query = query
  }

  if (pathPickerState.debounceTimerId) clearTimeout(pathPickerState.debounceTimerId)
  positionPathPicker(inputElement)

  if (pathPickerState.cachedParentPath === parentPath && pathPickerState.entries) {
    pathPickerState.parentPath = parentPath
    pathPickerState.activeIndex = 0
    renderPathPickerList()
    return
  }

  pathPickerState.parentPath = parentPath
  pathPickerState.debounceTimerId = setTimeout(() => {
    pathPickerState.debounceTimerId = null
    runPathLookup(parentPath)
  }, 250)
}

async function runPathLookup(parentPath) {
  if (!pathPickerState) return
  const myToken = ++pathPickerState.requestToken
  try {
    const response = await fetch('/queries/listDirectoryEntries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: parentPath }),
    })
    const data = await response.json()
    if (!pathPickerState || pathPickerState.requestToken !== myToken) return
    if (data.separator) pathPickerState.separator = data.separator
    if (data.error) {
      pathPickerState.entries = []; pathPickerState.error = data.error
    } else {
      pathPickerState.entries = data.entries ?? []
      pathPickerState.error = null
      pathPickerState.cachedParentPath = parentPath
    }
    pathPickerState.activeIndex = 0
    renderPathPickerList()
  } catch (err) {
    if (!pathPickerState || pathPickerState.requestToken !== myToken) return
    pathPickerState.entries = []
    pathPickerState.error = err?.message ?? String(err)
    renderPathPickerList()
  }
}

function positionPathPicker(inputElement) {
  const popover = document.getElementById('path-picker-popover')
  const rect = inputElement.getBoundingClientRect()
  const popoverWidth = 380
  const popoverMaxHeight = 280
  const margin = 8
  let left = rect.left
  if (left + popoverWidth > window.innerWidth - margin) left = window.innerWidth - popoverWidth - margin
  if (left < margin) left = margin
  const spaceBelow = window.innerHeight - rect.bottom - margin
  const spaceAbove = rect.top - margin
  const flipAbove = spaceBelow < 160 && spaceAbove > spaceBelow
  // Clear `bottom` so it never conflicts with the `top` we set below.
  popover.style.bottom = ''
  let top, height
  if (flipAbove) {
    height = Math.min(popoverMaxHeight, Math.max(0, spaceAbove))
    top = rect.top - height - 4
  } else {
    height = Math.min(popoverMaxHeight, Math.max(0, spaceBelow))
    top = rect.bottom + 4
  }
  top = Math.max(margin, Math.min(top, window.innerHeight - height - margin))
  popover.style.left = `${left}px`
  popover.style.top = `${top}px`
  popover.style.maxHeight = `${height}px`
  popover.classList.remove('hidden')
}

function renderPathPickerList() {
  const list = document.getElementById('path-picker-list')
  if (!pathPickerState) { list.innerHTML = ''; return }
  if (pathPickerState.entries === null) {
    list.innerHTML = '<p class="text-xs text-slate-500 text-center py-3">Loading…</p>'; return
  }
  if (pathPickerState.error) {
    list.innerHTML = `<p class="text-xs text-red-400 text-center py-3 break-words px-3">${esc(pathPickerState.error)}</p>`; return
  }
  const queryLower = pathPickerState.query.toLowerCase()
  const matches = pathPickerState.entries
    .filter(e => e.isDirectory)
    .filter(e => !queryLower || e.name.toLowerCase().startsWith(queryLower))
    .sort((a, b) => a.name.localeCompare(b.name))
  pathPickerState.matches = matches
  if (pathPickerState.activeIndex >= matches.length) pathPickerState.activeIndex = 0
  if (matches.length === 0) {
    list.innerHTML = '<p class="text-xs text-slate-500 text-center py-3">No matching entries.</p>'; return
  }
  list.innerHTML = matches.map((entry, index) => {
    const active = index === pathPickerState.activeIndex
    return `<button onmousedown="event.preventDefault()" onclick="pathPickerSelectByIndex(${index})"
      data-path-idx="${index}"
      class="w-full text-left px-3 py-1 flex items-center gap-2 ${active ? 'bg-blue-700 text-white' : 'text-slate-200 hover:bg-slate-800'}">
      <span class="shrink-0 text-slate-400">📁</span>
      <span class="font-mono text-xs flex-1 min-w-0 truncate">${esc(entry.name)}</span>
    </button>`
  }).join('')
  const activeEl = list.querySelector(`[data-path-idx="${pathPickerState.activeIndex}"]`)
  activeEl?.scrollIntoView({ block: 'nearest' })
}

export function pathPickerSelectByIndex(index) {
  if (!pathPickerState?.matches) return
  const entry = pathPickerState.matches[index]
  if (!entry) return
  applyPathPickerSelection(entry)
}

function applyPathPickerSelection(entry) {
  if (!pathPickerState) return
  const { inputElement, target, parentPath } = pathPickerState
  const separator = pathPickerState.separator || '/'
  const base = parentPath.endsWith('/') || parentPath.endsWith('\\')
    ? parentPath.slice(0, -1) : parentPath
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
  if (!pathPickerState) return
  const { inputElement, target } = pathPickerState
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
  if (!pathPickerState) return
  if (event.key === 'Escape') { event.preventDefault(); commitTrimmedPath(); return }
  const matches = pathPickerState.matches
  if (!matches?.length) {
    if (event.key === 'Enter' || event.key === 'Tab') { event.preventDefault(); commitTrimmedPath() }
    return
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    pathPickerState.activeIndex = (pathPickerState.activeIndex + 1) % matches.length
    renderPathPickerList()
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    pathPickerState.activeIndex = (pathPickerState.activeIndex - 1 + matches.length) % matches.length
    renderPathPickerList()
  } else if (event.key === 'Tab' || event.key === 'Enter') {
    event.preventDefault()
    pathPickerSelectByIndex(pathPickerState.activeIndex)
  }
}

export function closePathPicker() {
  document.getElementById('path-picker-popover')?.classList.add('hidden')
  if (pathPickerState?.debounceTimerId) clearTimeout(pathPickerState.debounceTimerId)
  pathPickerState = null
}

export function attachPathPickerDismissal() {
  document.addEventListener('mousedown', (event) => {
    if (!pathPickerState) return
    const popover = document.getElementById('path-picker-popover')
    if (popover.contains(event.target)) return
    if (event.target === pathPickerState.inputElement) return
    closePathPicker()
  }, true)
}
