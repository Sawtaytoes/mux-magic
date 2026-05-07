import {
  getPaths,
  getStepCounter,
  setPaths,
  setStepCounter,
  setSteps,
} from '../state.js'

// Helpers still living in the inline <script>: the COMMANDS registry,
// makeStep (wires defaults from a command's field schema), the URL
// persistence write, and the global render. They migrate out alongside
// step-card, at which point those bridge entries collapse.
const bridge = () => window.mediaTools

// ─── Modal lifecycle ─────────────────────────────────────────────────────────

// Paste-driven load: open the modal, attach a document-level paste
// listener, and let any Ctrl+V / ⌘+V anywhere on the page hydrate the
// builder. The modal itself is intentionally text-only (no textarea,
// no Load button) — the user's clipboard is the only input. This
// matches what they actually do today (paste a saved sequence) and
// drops the dead-weight textarea path.
//
// The paste listener is scoped to the modal's open state. We attach
// it on open, detach on close; a stray paste with no modal open is a
// no-op.
let isPasteListenerAttached = false

function attachPasteListener() {
  if (isPasteListenerAttached) {
    return
  }
  document.addEventListener('paste', onDocumentPaste)
  isPasteListenerAttached = true
}

function detachPasteListener() {
  if (!isPasteListenerAttached) {
    return
  }
  document.removeEventListener('paste', onDocumentPaste)
  isPasteListenerAttached = false
}

function onDocumentPaste(event) {
  const text = event.clipboardData?.getData('text/plain') ?? ''
  if (!text.trim()) {
    return
  }
  // Suppress default insertion: if focus had been left in some input
  // when the modal opened, the paste would otherwise dump into it.
  event.preventDefault()
  handlePastedYaml(text)
}

// Hydrate the builder from the pasted YAML. On parse error keep the
// modal open and surface the message into #load-error so the user
// can read what failed without losing their clipboard payload.
function handlePastedYaml(text) {
  const errorElement = document.getElementById('load-error')
  errorElement.classList.add('hidden')
  try {
    loadYamlFromText(text)
    bridge().renderAll()
    bridge().updateUrl()
    closeLoadModal()
  } catch (error) {
    errorElement.textContent = error.message
    errorElement.classList.remove('hidden')
  }
}

export function openLoadModal() {
  document.getElementById('load-error').classList.add('hidden')
  document.getElementById('load-modal').classList.remove('hidden')
  attachPasteListener()
}

// Closes when called programmatically (event omitted) or when the
// user clicks the modal backdrop. Clicks bubbling up from the inner
// panel won't match the backdrop element so the modal stays open.
// Mirrors closeYamlModal's guard pattern.
export function closeLoadModal(event) {
  if (event && event.target !== document.getElementById('load-modal')) {
    return
  }
  document.getElementById('load-modal').classList.add('hidden')
  detachPasteListener()
}

// ─── YAML → state ────────────────────────────────────────────────────────────

export const isGroupItem = (item) => !!(item && typeof item === 'object' && item.kind === 'group')

// Hydrate a single bare-step item from YAML into the in-memory step
// shape. Captures id, alias, isCollapsed, and walks the command's
// fields to assign params or restore links. Same logic the old loader
// applied to every top-level entry — extracted so it can be reused for
// inner steps inside a group.
export function loadStepItem(item, COMMANDS) {
  if (!item.command) throw new Error('Each step must have a "command" key')
  if (!COMMANDS[item.command]) throw new Error(`Unknown command: ${item.command}`)
  const step = bridge().makeStep(item.command)
  if (typeof item.id === 'string' && item.id) {
    step.id = item.id
    const match = /^step(\d+)$/.exec(item.id)
    if (match) {
      const restoredCount = Number(match[1])
      if (restoredCount > getStepCounter()) setStepCounter(restoredCount)
    }
  }
  if (typeof item.alias === 'string') step.alias = item.alias
  if (item.isCollapsed === true) step.isCollapsed = true
  const cmd = COMMANDS[item.command]
  for (const field of cmd.fields) {
    const value = item.params?.[field.name]
    if (value !== undefined) {
      if (typeof value === 'string' && value.startsWith('@')) {
        // Path-variable reference — restore as a string link if the path
        // exists, otherwise keep the literal so the user can fix it.
        const pathVarId = value.slice(1)
        if (getPaths().find((path) => path.id === pathVarId)) {
          step.links[field.name] = pathVarId
        } else {
          step.params[field.name] = value
        }
      } else if (
        value && typeof value === 'object' && !Array.isArray(value) &&
        typeof value.linkedTo === 'string'
      ) {
        // Step-output reference — restore as the object form. We do not
        // verify that the referenced step+output exists here; that happens
        // at run/resolve time so partial sequences keep loading.
        step.links[field.name] = {
          linkedTo: value.linkedTo,
          output: value.output || 'folder',
        }
      } else {
        step.params[field.name] = value
      }
    }
    // Companion display-name field (purely visual)
    if (field.companionNameField) {
      const companionValue = item.params?.[field.companionNameField]
      if (companionValue !== undefined) step.params[field.companionNameField] = companionValue
    }
  }
  // persistedKeys mirror buildParams: restore auto-resolved values
  // (e.g. nameSpecialFeatures' tmdbId/tmdbName) so a shared seq URL
  // keeps pointing at the same matched film without re-firing the
  // resolution on load.
  if (Array.isArray(cmd.persistedKeys)) {
    for (const persistedKey of cmd.persistedKeys) {
      const persistedValue = item.params?.[persistedKey]
      if (persistedValue !== undefined) {
        step.params[persistedKey] = persistedValue
      }
    }
  }
  return step
}

// Hydrate a group item: walks its inner `steps` array, refusing nested
// groups (the schema bans nesting; surface it here as a clear error).
export function loadGroupItem(item, COMMANDS) {
  if (!Array.isArray(item.steps) || item.steps.length === 0) {
    throw new Error('A group must have a non-empty "steps" array')
  }
  const innerSteps = item.steps.map((inner) => {
    if (isGroupItem(inner)) {
      throw new Error('Groups cannot be nested — a group\'s inner steps must each be a bare step')
    }
    return loadStepItem(inner, COMMANDS)
  })
  return {
    kind: 'group',
    id: typeof item.id === 'string' && item.id ? item.id : 'group_' + Math.random().toString(36).slice(2, 8),
    label: typeof item.label === 'string' ? item.label : '',
    isParallel: item.isParallel === true,
    isCollapsed: item.isCollapsed === true,
    steps: innerSteps,
  }
}

// Replaces `paths` and `steps` with the contents of a saved YAML
// document. Two formats are accepted: the canonical `{ paths, steps }`
// object form emitted by toYamlStr, and the legacy plain-array-of-steps
// form. Errors propagate to the caller (handlePastedYaml renders them
// into the modal; restoreFromUrl swallows them).
export function loadYamlFromText(text) {
  const data = window.jsyaml.load(text)
  const COMMANDS = bridge().COMMANDS

  let stepsData
  if (data && typeof data === 'object' && !Array.isArray(data) && data.steps !== undefined) {
    if (data.paths && typeof data.paths === 'object') {
      setPaths(Object.entries(data.paths).map(([id, pv]) => ({
        id,
        label: pv.label || id,
        value: pv.value || '',
      })))
    }
    if (!getPaths().length) bridge().initPaths()
    stepsData = data.steps || []
  } else if (Array.isArray(data)) {
    bridge().initPaths()
    stepsData = data
  } else {
    throw new Error('Expected a YAML sequence or object with "steps" key')
  }

  // Reset the step counter for this load so we don't keep bumping it across
  // reloads. Each loaded step's explicit `id` (when present) is preserved
  // by loadStepItem; anything missing falls through to the generated
  // `step{N}` form via makeStep. After the loop the counter has been
  // advanced past every step{N}-shaped ID we restored so future
  // makeStep calls won't collide with a loaded ID.
  setStepCounter(0)
  const newItems = stepsData.map((item) => (
    isGroupItem(item) ? loadGroupItem(item, COMMANDS) : loadStepItem(item, COMMANDS)
  ))
  setSteps(newItems)
  // Re-resolve every numberWithLookup field's companion against the
  // current backend (TVDB English-title code, refreshed MAL/AniDB/TMDB
  // data, etc.) so a stale companion stored in the seq URL doesn't
  // outlive the bug it captured. The kick also chains TMDB resolution
  // for nameSpecialFeatures via runReverseLookup, subsuming most of
  // what kickTmdbResolutions does — kickTmdbResolutions stays as a
  // safety net for the edge case where a seq URL carries dvdCompareName
  // without dvdCompareId.
  bridge().kickReverseLookups?.()
  bridge().kickTmdbResolutions?.()
}
