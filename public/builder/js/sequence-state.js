// ─── Sequence state ───────────────────────────────────────────────────────────
//
// Canonical in-memory state for the sequence builder: the `steps` array
// (flat + grouped items), the `paths` path-variable registry, the step-id
// counter, and the undo / redo snapshot stack. All mutation helpers live
// here so the rest of the codebase can import them by name instead of
// routing through the window.mediaTools bridge.
//
// The module also exports the `window.mediaTools` accessor shims that
// extracted-module callers already depend on, keeping the bridge alive
// during the migration while moving the canonical storage here.

import { COMMANDS } from './commands.js'

// ─── Core state ───────────────────────────────────────────────────────────────

export let steps = []
export let paths = []
export let stepCounter = 0

// These setters let modules (load-modal.js, etc.) update the canonical arrays
// from the module side without going through window.mediaTools.
export function setSteps(newSteps) {
  steps = newSteps
}
export function setPaths(newPaths) {
  paths = newPaths
}
export function setStepCounter(newCounter) {
  stepCounter = newCounter
}

export function getPaths() {
  return paths
}
export function getSteps() {
  return steps
}
export function getStepCounter() {
  return stepCounter
}

// ─── Step helpers ─────────────────────────────────────────────────────────────

export const generateStepId = () => `step${++stepCounter}`

export function randomHex() {
  return Math.random().toString(36).slice(2, 8)
}

export function isGroup(item) {
  return !!(item && typeof item === 'object' && item.kind === 'group')
}

// Returns every underlying step in document order with its provenance.
export function flattenSteps() {
  return steps.reduce((accumulator, item, itemIndex) => {
    if (isGroup(item)) {
      item.steps.forEach((step, indexInParent) => {
        accumulator.result.push({
          step,
          parentGroup: item,
          indexInParent,
          flatIndex: accumulator.flatIndex,
          itemIndex,
        })
        accumulator.flatIndex += 1
      })
    } else {
      accumulator.result.push({
        step: item,
        parentGroup: null,
        indexInParent: itemIndex,
        flatIndex: accumulator.flatIndex,
        itemIndex,
      })
      accumulator.flatIndex += 1
    }
    return accumulator
  }, { result: [], flatIndex: 0 }).result
}

export function findStepById(id) {
  const entry = flattenSteps().find((entry) => entry.step.id === id)
  return entry ? entry.step : null
}

export function findStepLocation(id) {
  return flattenSteps().find((entry) => entry.step.id === id) ?? null
}

export function makeStep(command = null) {
  if (!command) {
    return { id: generateStepId(), alias: '', command: null, params: {}, links: {}, status: null, error: null, isCollapsed: false }
  }
  const commandDefinition = COMMANDS[command]
  const params = Object.fromEntries(
    commandDefinition.fields
    .filter((field) => field.default !== undefined)
    .map((field) => [field.name, field.default])
  )
  return { id: generateStepId(), alias: '', command, params, links: {}, status: null, error: null, isCollapsed: false }
}

function generateGroupId() {
  return 'group_' + randomHex()
}

export function makeGroup({ isParallel = false } = {}) {
  return {
    kind: 'group',
    id: generateGroupId(),
    label: '',
    isParallel,
    isCollapsed: false,
    steps: [makeStep(null)],
  }
}

export function initPaths() {
  if (!paths.length) {
    paths = [{ id: 'basePath', label: 'basePath', value: '' }]
  }
}

// ─── Path / link helpers ──────────────────────────────────────────────────────

export function mainSrcField(commandName) {
  const commandDefinition = COMMANDS[commandName]
  if (!commandDefinition) {
    return null
  }
  const preferredFieldName = ['sourcePath', 'sourceFilesPath', 'mediaFilesPath'].find((name) => (
    commandDefinition.fields.some((field) => field.name === name)
  ))
  if (preferredFieldName) {
    return preferredFieldName
  }
  const pathField = commandDefinition.fields.find((field) => field.type === 'path')
  return pathField ? pathField.name : null
}

export function getLinkedValue(step, fieldName) {
  const link = step.links?.[fieldName]
  if (!link) {
    return null
  }
  if (typeof link === 'string') {
    const pathVar = paths.find((path) => path.id === link)
    return pathVar?.value || null
  }
  if (link && typeof link === 'object' && typeof link.linkedTo === 'string') {
    const sourceStep = findStepById(link.linkedTo)
    if (!sourceStep) {
      return null
    }
    if (link.output === 'folder' || !link.output) {
      return stepOutput(sourceStep)
    }
    return sourceStep.outputs?.[link.output] ?? null
  }
  return null
}

export function stepOutput(step) {
  if (!step.command) {
    return ''
  }
  const commandDefinition = COMMANDS[step.command]
  if (!commandDefinition) {
    return ''
  }
  const mainSourceField = mainSrcField(step.command)
  const rawSource = mainSourceField
    ? (getLinkedValue(step, mainSourceField) ?? step.params[mainSourceField] ?? '')
    : ''
  const source = rawSource.replace(/[\\/]$/, '')

  if (commandDefinition.outputComputation === 'parentOfSource') {
    return source ? source.replace(/[\\/][^\\/]*$/, '') : ''
  }
  if (commandDefinition.outputFolderName) {
    const separator = source.includes('\\') ? '\\' : '/'
    return source
      ? source + separator + commandDefinition.outputFolderName
      : commandDefinition.outputFolderName
  }
  const hasField = (name) => commandDefinition.fields.some((field) => field.name === name)
  if (hasField('destinationPath')) {
    const destination = getLinkedValue(step, 'destinationPath') ?? step.params.destinationPath
    if (destination) {
      return destination
    }
  }
  if (hasField('destinationFilesPath')) {
    const destination = getLinkedValue(step, 'destinationFilesPath') ?? step.params.destinationFilesPath
    if (destination) {
      return destination
    }
  }
  return source
}

// ─── Undo / redo (in-memory snapshot stack) ───────────────────────────────────

const UNDO_STACK_LIMIT = 50
export const undoStack = []
export const redoStack = []
export let lastSnapshot = null
export let isApplyingSnapshot = false

export function setIsApplyingSnapshot(value) {
  isApplyingSnapshot = value
}
export function setLastSnapshot(value) {
  lastSnapshot = value
}

export function pushUndoSnapshot(currentYaml) {
  if (isApplyingSnapshot) {
    return
  }
  if (lastSnapshot === null) {
    lastSnapshot = currentYaml
    return
  }
  if (currentYaml === lastSnapshot) {
    return
  }
  undoStack.push(lastSnapshot)
  if (undoStack.length > UNDO_STACK_LIMIT) {
    undoStack.shift()
  }
  lastSnapshot = currentYaml
  redoStack.length = 0
  refreshUndoRedoButtons()
}

export function refreshUndoRedoButtons() {
  const canUndo = undoStack.length > 0
  const canRedo = redoStack.length > 0
  // Notify React atoms when they're available (React SPA path).
  window.mediaTools?.syncUndoRedo?.(canUndo, canRedo)
  // Legacy DOM path — no-ops when buttons don't exist.
  const undoBtn = document.getElementById('undo-btn')
  const redoBtn = document.getElementById('redo-btn')
  if (undoBtn) undoBtn.disabled = !canUndo
  if (redoBtn) redoBtn.disabled = !canRedo
}

// applySnapshot is defined in sequence-editor.js since it calls renderAll.
// The undo()/redo() functions also live there so they can call applySnapshot.
