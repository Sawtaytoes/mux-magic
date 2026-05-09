// ─── Sequence editor ─────────────────────────────────────────────────────────
//
// URL persistence, undo/redo, step + group CRUD, param mutation, link
// helpers, and the animated render wrapper. These are the "actions" that
// the HTML onclick handlers and other modules call into.

import { COMMANDS } from './commands.js'
import {
  steps, paths, setSteps,
  findStepById, findStepLocation, flattenSteps,
  makeStep, makeGroup, initPaths, isGroup, randomHex,
  mainSrcField, getLinkedValue,
  undoStack, redoStack, lastSnapshot, isApplyingSnapshot,
  pushUndoSnapshot, refreshUndoRedoButtons,
  setIsApplyingSnapshot, setLastSnapshot,
} from './sequence-state.js'

// Bridge to the module side for toYamlStr / loadYamlFromText / renderAll.
// These live in other modules but are needed here for URL persistence and
// the applySnapshot cycle. We call them via window.mediaTools to keep the
// import graph acyclic during the migration.
const bridge = () => window.mediaTools

// ─── URL persistence ──────────────────────────────────────────────────────────

export function updateUrl() {
  const params = new URLSearchParams()
  const yaml = bridge().toYamlStr()
  if (yaml !== '# No steps yet') {
    params.set('seq', btoa(unescape(encodeURIComponent(yaml))))
  }
  const query = params.toString()
  history.replaceState(null, '', window.location.pathname + (query ? '?' + query : ''))
  pushUndoSnapshot(yaml)
}

const updateUrlState = { timeoutId: null }

export function scheduleUpdateUrl() {
  if (updateUrlState.timeoutId) {
    clearTimeout(updateUrlState.timeoutId)
  }
  updateUrlState.timeoutId = setTimeout(() => {
    updateUrlState.timeoutId = null
    updateUrl()
  }, 300)
}

export function flushScheduledUpdateUrl() {
  if (updateUrlState.timeoutId) {
    clearTimeout(updateUrlState.timeoutId)
    updateUrlState.timeoutId = null
    updateUrl()
  }
}

export function restoreFromUrl() {
  const params = new URLSearchParams(window.location.search)
  const seq = params.get('seq')
  const base = params.get('base')  // old format backward compat
  if (seq) {
    try {
      const yaml = decodeURIComponent(escape(atob(seq)))
      bridge().loadYamlFromText(yaml)
      if (base && paths.length > 0 && !paths[0].value) {
        paths[0].value = base
      }
    } catch {}
  } else if (base) {
    initPaths()
    paths[0].value = base
  }
}

// ─── Undo / redo ──────────────────────────────────────────────────────────────

export function applySnapshot(snapshotYaml) {
  setIsApplyingSnapshot(true)
  try {
    // Reset arrays via setters so extracted modules that hold references
    // to the module-level bindings pick up the new values.
    setSteps([])
    window.mediaTools.paths = []
    if (snapshotYaml === '# No steps yet') {
      initPaths()
    } else {
      bridge().loadYamlFromText(snapshotYaml)
    }
    bridge().renderAll()
    updateUrl()
  } finally {
    setIsApplyingSnapshot(false)
  }
  refreshUndoRedoButtons()
}

export function undo() {
  flushScheduledUpdateUrl()
  if (undoStack.length === 0) {
    return
  }
  const previous = undoStack.pop()
  redoStack.push(lastSnapshot)
  setLastSnapshot(previous)
  applySnapshot(previous)
}

export function redo() {
  if (redoStack.length === 0) {
    return
  }
  const next = redoStack.pop()
  undoStack.push(lastSnapshot)
  setLastSnapshot(next)
  applySnapshot(next)
}

// ─── New sequence / restore ───────────────────────────────────────────────────

export function startNewSequence() {
  flushScheduledUpdateUrl()
  const hasContent = (
    flattenSteps().some((entry) => entry.step.command !== null)
    || paths.some((path) => path.value)
  )
  if (hasContent && !window.confirm('Clear the current sequence and start fresh? Ctrl+Z will bring it back.')) {
    return
  }
  setSteps([])
  window.mediaTools.paths = []
  initPaths()
  bridge().renderAll()
  updateUrl()
}

// ─── Step / group CRUD ────────────────────────────────────────────────────────

export function addPicked() {
  const step = makeStep(null)
  steps.push(step)
  renderAllAnimated((behavior) => scrollStepIntoView(step.id, behavior))
}

export function insertAt(index) {
  const step = makeStep(null)
  steps.splice(index, 0, step)
  renderAllAnimated((behavior) => scrollStepIntoView(step.id, behavior))
}

export function addGroupBlock(isParallel) {
  const group = makeGroup({ isParallel })
  steps.push(group)
  renderAllAnimated((behavior) => scrollStepIntoView(group.steps[0].id, behavior))
}

export function insertGroupAt(index, isParallel) {
  const group = makeGroup({ isParallel })
  steps.splice(index, 0, group)
  renderAllAnimated((behavior) => scrollStepIntoView(group.steps[0].id, behavior))
}

export function addStepToGroup(groupId) {
  const group = steps.find((item) => isGroup(item) && item.id === groupId)
  if (!group) {
    return
  }
  if (group.isCollapsed) {
    group.isCollapsed = false
  }
  const step = makeStep(null)
  group.steps.push(step)
  renderAllAnimated((behavior) => scrollStepIntoView(step.id, behavior))
}

export function removeStep(id) {
  const finishRemoval = () => {
    const location = findStepLocation(id)
    if (!location) {
      return
    }
    if (location.parentGroup) {
      const group = location.parentGroup
      group.steps.splice(location.indexInParent, 1)
      if (group.steps.length === 0) {
        const groupItemIndex = steps.indexOf(group)
        if (groupItemIndex >= 0) {
          steps.splice(groupItemIndex, 1)
        }
      }
    } else {
      steps.splice(location.itemIndex, 1)
    }
    flattenSteps().forEach((entry) => {
      Object.entries(entry.step.links).forEach(([field, source]) => {
        if (source && typeof source === 'object' && source.linkedTo === id) {
          delete entry.step.links[field]
        }
      })
    })
    renderAllAnimated()
  }
  const card = document.getElementById(`step-${id}`)
  if (card) {
    card.classList.add('step-leave')
    setTimeout(finishRemoval, 200)
  } else {
    finishRemoval()
  }
}

export function removeGroup(groupId) {
  const groupItemIndex = steps.findIndex((item) => isGroup(item) && item.id === groupId)
  if (groupItemIndex < 0) {
    return
  }
  const group = steps[groupItemIndex]
  const innerIds = new Set(group.steps.map((step) => step.id))
  steps.splice(groupItemIndex, 1)
  flattenSteps().forEach((entry) => {
    Object.entries(entry.step.links).forEach(([field, source]) => {
      if (source && typeof source === 'object' && innerIds.has(source.linkedTo)) {
        delete entry.step.links[field]
      }
    })
  })
  renderAllAnimated()
}

export function moveStep(id, direction) {
  const location = findStepLocation(id)
  if (!location) {
    return
  }
  if (location.parentGroup) {
    const siblings = location.parentGroup.steps
    const localIndex = location.indexInParent
    const targetLocalIndex = localIndex + direction
    if (targetLocalIndex < 0 || targetLocalIndex >= siblings.length) {
      return
    }
    ;[siblings[localIndex], siblings[targetLocalIndex]] = [siblings[targetLocalIndex], siblings[localIndex]]
  } else {
    const localIndex = location.itemIndex
    const targetLocalIndex = localIndex + direction
    if (targetLocalIndex < 0 || targetLocalIndex >= steps.length) {
      return
    }
    ;[steps[localIndex], steps[targetLocalIndex]] = [steps[targetLocalIndex], steps[localIndex]]
  }
  clearStaleStepLinksAfterMove()
  renderAllAnimated()
}

export function moveGroup(groupId, direction) {
  const groupItemIndex = steps.findIndex((item) => isGroup(item) && item.id === groupId)
  if (groupItemIndex < 0) {
    return
  }
  const targetIndex = groupItemIndex + direction
  if (targetIndex < 0 || targetIndex >= steps.length) {
    return
  }
  ;[steps[groupItemIndex], steps[targetIndex]] = [steps[targetIndex], steps[groupItemIndex]]
  clearStaleStepLinksAfterMove()
  renderAllAnimated()
}

export function clearStaleStepLinksAfterMove() {
  const flatOrder = flattenSteps()
  flatOrder.forEach((entry, flatIndex) => {
    Object.entries(entry.step.links).forEach(([field, source]) => {
      if (!source || typeof source !== 'object' || !source.linkedTo) {
        return
      }
      const sourceFlatIndex = flatOrder.findIndex((flatEntry) => flatEntry.step.id === source.linkedTo)
      if (sourceFlatIndex < 0 || sourceFlatIndex >= flatIndex) {
        delete entry.step.links[field]
      }
    })
  })
}

export function toggleStepCollapsed(id) {
  const step = findStepById(id)
  if (!step) {
    return
  }
  step.isCollapsed = !step.isCollapsed
  bridge().renderAll()
}

export function toggleGroupCollapsed(id) {
  const group = steps.find((item) => isGroup(item) && item.id === id)
  if (!group) {
    return
  }
  group.isCollapsed = !group.isCollapsed
  bridge().renderAll()
}

export function setGroupChildrenCollapsed(id, isCollapsed) {
  const group = steps.find((item) => isGroup(item) && item.id === id)
  if (!group) {
    return
  }
  group.steps.forEach((step) => {
    step.isCollapsed = isCollapsed
  })
  bridge().renderAll()
}

export function setAllCollapsed(isCollapsed) {
  steps.forEach((item) => {
    if (isGroup(item)) {
      item.isCollapsed = isCollapsed
      item.steps.forEach((step) => {
        step.isCollapsed = isCollapsed
      })
    } else {
      item.isCollapsed = isCollapsed
    }
  })
  bridge().renderAll()
}

export function setGroupLabel(groupId, label) {
  const group = steps.find((item) => isGroup(item) && item.id === groupId)
  if (!group) {
    return
  }
  group.label = label
  bridge().updateYaml()
  scheduleUpdateUrl()
}

// ─── Step alias editing ───────────────────────────────────────────────────────

export function stepAliasFocus(input) {
  input.dataset.original = input.value
  delete input.dataset.revert
  input.select()
}

export function stepAliasKeydown(event, stepId) {
  if (event.key === 'Enter') {
    event.preventDefault()
    event.target.blur()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    event.target.dataset.revert = '1'
    event.target.value = event.target.dataset.original ?? ''
    event.target.blur()
  }
}

export function stepAliasBlur(input, stepId) {
  if (input.dataset.revert) {
    delete input.dataset.revert
    return
  }
  setStepAlias(stepId, input.value)
}

export function setStepAlias(stepId, alias) {
  const step = findStepById(stepId)
  if (!step) {
    return
  }
  const trimmed = alias.trim()
  if (step.alias === trimmed) {
    return
  }
  step.alias = trimmed
  bridge().updateYaml()
  scheduleUpdateUrl()
}

export function toggleStepActions(stepId) {
  const actions = document.querySelector(`[data-step-actions="${stepId}"]`)
  if (actions) {
    actions.classList.toggle('open')
  }
}

// ─── Param / link mutation ────────────────────────────────────────────────────

export function setParam(id, fieldName, value) {
  const step = findStepById(id)
  if (!step) {
    return
  }
  step.params[fieldName] = value
  refreshLinkedInputs()
  bridge().updateYaml()
  updateUrl()
}

// Like setParam, but also triggers a full re-render so that fields with
// visibleWhen conditions (e.g. Depth shown only when Recursive is checked)
// update immediately. Only use for fields whose change should affect
// other fields' visibility — not for free-text inputs where re-rendering
// on every keystroke destroys cursor position.
export function setParamAndRender(id, fieldName, value) {
  setParam(id, fieldName, value)
  bridge().renderAll?.()
}

export function setParamJson(id, field, raw) {
  const step = findStepById(id)
  if (!step) {
    return
  }
  try {
    step.params[field] = JSON.parse(raw)
  }
  catch {
    step.params[field] = raw
  }
  bridge().updateYaml()
  scheduleUpdateUrl()
}

export function promotePathToPathVar(stepId, fieldName, rawValue) {
  const step = findStepById(stepId)
  if (!step) {
    return
  }
  if (step.links?.[fieldName]) {
    return
  }
  const value = (rawValue ?? '').trim()
  if (!value) {
    return
  }
  // Re-use an existing path variable that already holds this value.
  const existing = paths.find((path) => path.value === value)
  if (existing) {
    step.links[fieldName] = existing.id
    delete step.params[fieldName]
    bridge().renderAll()
    return
  }
  // If basePath (paths[0]) is still empty, populate it in-place rather than
  // creating a sibling path variable. This keeps the common case of "user
  // types a path into the very first step" tidy.
  if (paths.length > 0 && paths[0].id === 'basePath' && !paths[0].value) {
    paths[0].value = value
    step.links[fieldName] = paths[0].id
    delete step.params[fieldName]
    bridge().renderAll()
    return
  }
  // basePath is occupied — create a new named path variable.
  const newPath = { id: 'path_' + randomHex(), label: 'Path ' + paths.length, value }
  paths.push(newPath)
  step.links[fieldName] = newPath.id
  delete step.params[fieldName]
  bridge().renderAll()
}

// When a boolean field (e.g. isRecursive) is first enabled, ensure a companion
// numeric field is at least minValue. Used to coerce recursiveDepth from 0→1.
export function initFieldMin(stepId, fieldName, minValue) {
  const step = findStepById(stepId)
  if (!step) return
  const cur = step.params[fieldName]
  if (cur == null || Number(cur) < minValue) {
    step.params[fieldName] = minValue
  }
}

export async function browsePathField(stepId, fieldName, initialPath) {
  if (typeof window.openFileExplorer !== 'function') {
    return
  }
  const startPath = await (async () => {
    if (initialPath) {
      return initialPath
    }
    try {
      const response = await fetch('/files/default-path')
      const data = await response.json()
      return data.path || '/'
    } catch {
      return '/'
    }
  })()
  window.openFileExplorer(startPath, {
    pickerOnSelect: (selectedPath) => {
      setLink(stepId, fieldName, '')
      setParam(stepId, fieldName, selectedPath)
      bridge().renderAll()
    },
  })
}

export function setLink(id, field, choice) {
  const step = findStepById(id)
  if (!step) {
    return
  }
  if (!choice) {
    delete step.links[field]
  } else if (choice.startsWith('path:')) {
    step.links[field] = choice.slice('path:'.length)
  } else if (choice.startsWith('step:')) {
    const after = choice.slice('step:'.length)
    const separatorIndex = after.indexOf(':')
    const linkedStepId = separatorIndex >= 0 ? after.slice(0, separatorIndex) : after
    const output = separatorIndex >= 0 ? after.slice(separatorIndex + 1) : 'folder'
    step.links[field] = { linkedTo: linkedStepId, output }
  } else {
    delete step.links[field]
  }
  const linkedInput = document.querySelector(`[data-step="${id}"][data-field="${field}"].linked-input`)
  const manualInput = document.querySelector(`[data-step="${id}"][data-field="${field}"].manual-input`)
  const linkedValue = getLinkedValue(step, field)
  if (linkedValue !== null) {
    if (linkedInput) {
      linkedInput.value = linkedValue
      linkedInput.classList.remove('hidden')
    }
    if (manualInput) {
      manualInput.classList.add('hidden')
    }
  } else {
    if (linkedInput) {
      linkedInput.classList.add('hidden')
    }
    if (manualInput) {
      manualInput.classList.remove('hidden')
    }
  }
  refreshLinkedInputs()
  bridge().updateYaml()
  scheduleUpdateUrl()
}

export function refreshLinkedInputs() {
  flattenSteps().forEach((entry) => {
    const step = entry.step
    Object.keys(step.links).forEach((field) => {
      const input = document.querySelector(`[data-step="${step.id}"][data-field="${field}"].linked-input`)
      if (input) {
        input.value = getLinkedValue(step, field) ?? ''
      }
    })
  })
}

export function changeCommand(id, command) {
  if (!command) {
    return
  }
  const step = findStepById(id)
  if (!step) {
    return
  }
  const wasEmpty = step.command === null
  step.command = command
  step.params = {}
  step.links = {}
  step.status = null
  step.error = null
  const commandDefinition = COMMANDS[command]
  commandDefinition.fields.forEach((field) => {
    if (field.default !== undefined) {
      step.params[field.name] = field.default
    }
  })
  if (wasEmpty) {
    const mainSourceFieldName = mainSrcField(command)
    if (mainSourceFieldName) {
      const location = findStepLocation(id)
      const isInsideParallelGroup = !!(location?.parentGroup?.isParallel)
      if (isInsideParallelGroup) {
        if (paths.length) {
          step.links[mainSourceFieldName] = paths[0].id
        }
      } else {
        const flatEntries = flattenSteps()
        const currentFlatIndex = flatEntries.findIndex((entry) => entry.step.id === id)
        const previousStep = currentFlatIndex > 0 ? flatEntries[currentFlatIndex - 1].step : null
        if (previousStep && previousStep.command) {
          step.links[mainSourceFieldName] = { linkedTo: previousStep.id, output: 'folder' }
        } else if (paths.length) {
          step.links[mainSourceFieldName] = paths[0].id
        }
      }
    }
  }
  bridge().renderAll()
}

export function buildParams(step, { resolveLinks = false } = {}) {
  const commandDefinition = COMMANDS[step.command]
  const result = {}
  commandDefinition.fields.forEach((field) => {
    const baseValue = step.params[field.name]
    const link = step.links?.[field.name]
    const resolvedValue = (() => {
      if (!link) {
        return baseValue
      }
      if (resolveLinks) {
        const linkedValue = getLinkedValue(step, field.name)
        return linkedValue !== null ? linkedValue : baseValue
      }
      if (typeof link === 'string') {
        return '@' + link
      }
      if (link && typeof link === 'object' && link.linkedTo) {
        return { linkedTo: link.linkedTo, output: link.output || 'folder' }
      }
      return baseValue
    })()
    const skipPrimary = (
      resolvedValue === undefined || resolvedValue === null || resolvedValue === ''
      || (Array.isArray(resolvedValue) && resolvedValue.length === 0)
      || (!field.required && field.default !== undefined && resolvedValue === field.default)
    )
    if (!skipPrimary) {
      result[field.name] = resolvedValue
    }
    if (field.companionNameField) {
      const companionValue = step.params[field.companionNameField]
      if (companionValue !== undefined && companionValue !== null && companionValue !== '') {
        result[field.companionNameField] = companionValue
      }
    }
  })
  if (Array.isArray(commandDefinition.persistedKeys)) {
    commandDefinition.persistedKeys.forEach((persistedKey) => {
      const persistedValue = step.params[persistedKey]
      if (persistedValue !== undefined && persistedValue !== null && persistedValue !== '') {
        result[persistedKey] = persistedValue
      }
    })
  }
  return result
}

// ─── Scroll helpers ───────────────────────────────────────────────────────────

export function scrollStepIntoView(stepId, behavior = 'smooth') {
  const card = document.getElementById(`step-${stepId}`)
  if (card) {
    card.scrollIntoView({ behavior, block: 'center' })
  }
}

export function scrollPathVarIntoView(pathVarId) {
  const card = document.querySelector(`[data-path-var="${pathVarId}"]`)
  if (card) {
    card.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

// ─── View-transition animated render wrapper ──────────────────────────────────

export function renderAllAnimated(afterRender) {
  if (typeof document.startViewTransition === 'function') {
    document.startViewTransition(() => {
      bridge().renderAll()
      if (afterRender) {
        afterRender('instant')
      }
    })
  } else {
    bridge().renderAll()
    if (afterRender) {
      afterRender('smooth')
    }
  }
}

// ─── Global keyboard shortcuts ────────────────────────────────────────────────

export function attachSequenceKeyboardShortcuts() {
  document.addEventListener('keydown', (event) => {
    const target = event.target
    const isTextField = target && (
      target.tagName === 'INPUT'
      || target.tagName === 'TEXTAREA'
      || target.isContentEditable
    )
    if (isTextField) {
      return
    }
    if (!(event.ctrlKey || event.metaKey)) {
      return
    }
    const key = event.key.toLowerCase()
    if (key === 'z' && !event.shiftKey) {
      event.preventDefault()
      undo()
    } else if ((key === 'z' && event.shiftKey) || key === 'y') {
      event.preventDefault()
      redo()
    }
  })

  window.addEventListener('beforeunload', flushScheduledUpdateUrl)
  window.addEventListener('blur', flushScheduledUpdateUrl, true)
}
