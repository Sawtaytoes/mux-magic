import { getPaths, getSteps, getStepCounter, setStepCounter } from '../state.js'
import { esc } from '../util/esc.js'
import {
  groupToYaml,
  isGroup,
  stepToYaml,
} from './yaml-modal.js'
import {
  isGroupItem,
  loadGroupItem,
  loadStepItem,
} from './load-modal.js'

// Per-card YAML clipboard helpers. The whole-sequence Copy lives in
// yaml-modal.js (`copyYaml`); this module is the single-card analogue,
// plus the matching paste path that turns a clipboard YAML payload back
// into a step or group inserted at a chosen position.
//
// The bridge points still living in the inline <script>: the COMMANDS
// registry, makeStep (used indirectly via loadStepItem), generateStepId
// (read off the step counter), randomHex (group ID generator),
// renderAllAnimated (post-mutation re-render with view transitions),
// scrollStepIntoView, and updateUrl. They migrate out alongside the
// step-card extraction in a later stage.
const bridge = () => window.mediaTools

// ─── Copy ────────────────────────────────────────────────────────────────────

// Walks an item collecting the path-var IDs it references via
// string-form `step.links` (`@pathId` in YAML). Object-form
// `{linkedTo, output}` step-output refs don't reference paths and are
// ignored. Returns a Set so the caller can dedupe across a group.
function collectPathIdsUsed(item) {
  const stepsToWalk = isGroup(item) ? item.steps : [item]
  const pathIds = new Set()
  for (const step of stepsToWalk) {
    for (const linkValue of Object.values(step.links ?? {})) {
      if (typeof linkValue === 'string') {
        pathIds.add(linkValue)
      }
    }
  }
  return pathIds
}

// Serialize a single step or group to the canonical
// `{ paths, steps: [...] }` shape so the paste path can reuse the
// existing whole-sequence loader. Only the path-vars referenced by the
// item are emitted — copying a step into a fresh builder reproduces
// just the inputs that step actually depends on, without dragging
// every unrelated path along.
export function cardToYamlStr(item) {
  const usedPathIds = collectPathIdsUsed(item)
  const pathsObj = {}
  for (const pathVar of getPaths()) {
    if (usedPathIds.has(pathVar.id)) {
      pathsObj[pathVar.id] = { label: pathVar.label, value: pathVar.value }
    }
  }
  const itemYaml = isGroup(item) ? groupToYaml(item) : stepToYaml(item)
  return window.jsyaml.dump(
    { paths: pathsObj, steps: [itemYaml] },
    { lineWidth: -1, flowLevel: 3, indent: 2 },
  )
}

// Briefly flash an emerald ring + label swap on the source button so
// the user sees their click landed. Mirrors the pattern in copyYaml.
function flashCopySuccess(buttonElement) {
  if (!buttonElement) {
    return
  }
  buttonElement.classList.add('!text-emerald-400', '!border-emerald-500')
  setTimeout(() => {
    buttonElement.classList.remove('!text-emerald-400', '!border-emerald-500')
  }, 2000)
}

function findStepItem(stepId) {
  for (const item of getSteps()) {
    if (isGroup(item)) {
      const innerStep = item.steps.find((step) => step.id === stepId)
      if (innerStep) {
        return innerStep
      }
    } else if (item.id === stepId) {
      return item
    }
  }
  return null
}

function findGroupItem(groupId) {
  return getSteps().find((item) => isGroup(item) && item.id === groupId) ?? null
}

export function copyStepYaml(stepId, buttonElement) {
  const step = findStepItem(stepId)
  if (!step) {
    return
  }
  const yamlStr = cardToYamlStr(step)
  navigator.clipboard.writeText(yamlStr).then(() => {
    flashCopySuccess(buttonElement)
  })
}

export function copyGroupYaml(groupId, buttonElement) {
  const group = findGroupItem(groupId)
  if (!group) {
    return
  }
  const yamlStr = cardToYamlStr(group)
  navigator.clipboard.writeText(yamlStr).then(() => {
    flashCopySuccess(buttonElement)
  })
}

// ─── Paste ───────────────────────────────────────────────────────────────────

// Normalize the parsed clipboard payload into an array of items. We
// accept the canonical `{ paths, steps: [...] }` shape (what
// cardToYamlStr emits), the legacy `{ steps: [...] }` shape, plus a
// bare item dict (single step OR `kind: group`) so users who hand-copy
// a step from a YAML doc still get a useful paste.
function extractItemsAndPaths(parsed) {
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.steps !== undefined) {
    return {
      items: Array.isArray(parsed.steps) ? parsed.steps : [],
      paths: parsed.paths && typeof parsed.paths === 'object' ? parsed.paths : null,
    }
  }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return { items: [parsed], paths: null }
  }
  if (Array.isArray(parsed)) {
    return { items: parsed, paths: null }
  }
  throw new Error('Expected a YAML object or sequence describing a step or group')
}

// Allocate a new step ID that doesn't collide with anything already
// alive in the builder. We reuse the existing `step{N}` counter so
// pasted IDs follow the same naming as user-added ones, keeping the
// YAML diffable.
function allocateStepId() {
  setStepCounter(getStepCounter() + 1)
  return `step${getStepCounter()}`
}

function allocateGroupId() {
  return 'group_' + bridge().randomHex()
}

// Walks every pasted step and rewrites object-form step-output links
// whose `linkedTo` points at an old pasted step ID. Refs to steps
// OUTSIDE the pasted set stay literal — they may dangle, which matches
// the existing whole-sequence loader: dangling refs surface at
// run/resolve time, not at load time.
function remapInternalLinks(pastedSteps, oldToNewStepId) {
  for (const step of pastedSteps) {
    for (const [field, source] of Object.entries(step.links ?? {})) {
      if (source && typeof source === 'object' && typeof source.linkedTo === 'string') {
        const newId = oldToNewStepId.get(source.linkedTo)
        if (newId) {
          step.links[field] = { linkedTo: newId, output: source.output }
        }
      }
    }
  }
}

// Hydrate one pasted top-level item, give it (and any inner steps) a
// fresh ID, and remap inter-step links so a copied group whose inner
// steps reference each other keeps its internal wiring after paste.
function hydratePastedItem(rawItem, COMMANDS) {
  const oldToNewStepId = new Map()
  if (isGroupItem(rawItem)) {
    const group = loadGroupItem(rawItem, COMMANDS)
    for (const innerStep of group.steps) {
      const oldId = innerStep.id
      innerStep.id = allocateStepId()
      oldToNewStepId.set(oldId, innerStep.id)
    }
    group.id = allocateGroupId()
    remapInternalLinks(group.steps, oldToNewStepId)
    return { item: group, firstStepId: group.steps[0]?.id ?? null }
  }
  const step = loadStepItem(rawItem, COMMANDS)
  const oldId = step.id
  step.id = allocateStepId()
  oldToNewStepId.set(oldId, step.id)
  remapInternalLinks([step], oldToNewStepId)
  return { item: step, firstStepId: step.id }
}

// Pull `paths:` entries from the clipboard payload into the builder's
// path-var registry without trampling the user's working values: if a
// path with that ID already exists, we keep the existing one (its
// value is whatever the user typed); only brand-new path IDs append.
function mergePastedPaths(pastedPaths) {
  if (!pastedPaths) {
    return
  }
  const paths = getPaths()
  for (const [pathId, pathVar] of Object.entries(pastedPaths)) {
    if (paths.find((existing) => existing.id === pathId)) {
      continue
    }
    paths.push({
      id: pathId,
      label: pathVar?.label || pathId,
      value: pathVar?.value || '',
    })
  }
}

// Paste handler invoked by the per-divider button. Reads the clipboard,
// parses the YAML, hydrates each pasted item with fresh IDs, and
// splices it into the right container at the chosen position.
//
// `parentGroupId` set ⇒ insert into that group's `steps` at
// `indexInParent`. Otherwise ⇒ insert into the top-level `steps`
// array at `itemIndex`. Pasting a `kind: group` payload into a group
// is rejected (matches the existing no-nesting rule).
export async function pasteCardAt({ itemIndex, parentGroupId = null, indexInParent = null } = {}, anchorElement = null) {
  const showError = (message, options) => showClipboardToast(message, { severity: 'error', ...options })
  if (!navigator.clipboard || typeof navigator.clipboard.readText !== 'function') {
    showError(
      'Your browser does not expose clipboard read here. Try a Chromium- or Firefox-based browser on a secure (https / localhost) page.',
      { durationMs: 12000 },
    )
    return
  }
  let text
  try {
    text = await navigator.clipboard.readText()
  } catch (error) {
    // Chrome / Edge prompt for permission on first call. If the user
    // dismisses the prompt or has previously denied, the call rejects
    // with NotAllowedError. Spell out the recovery path so the user
    // doesn't have to guess what to do next.
    if (error?.name === 'NotAllowedError') {
      showError(
        'Browser blocked clipboard access. Click the clipboard icon in the address bar (or open Site settings) and allow clipboard read for this page, then click Paste again.',
        { durationMs: 12000 },
      )
      return
    }
    showError('Could not read clipboard: ' + (error?.message || 'unknown error'), { durationMs: 8000 })
    return
  }
  if (!text || !text.trim()) {
    showError('Clipboard is empty.')
    return
  }
  let parsed
  try {
    parsed = window.jsyaml.load(text)
  } catch (error) {
    showError('Could not parse clipboard YAML: ' + error.message)
    return
  }
  let normalized
  try {
    normalized = extractItemsAndPaths(parsed)
  } catch (error) {
    showError(error.message)
    return
  }
  if (!normalized.items.length) {
    showError('No steps in clipboard YAML.')
    return
  }
  if (parentGroupId && normalized.items.some(isGroupItem)) {
    showError('Groups cannot be nested — paste a group at the top level instead.')
    return
  }

  // Path merge runs before hydration so loadStepItem's `@pathId` lookup
  // (in load-modal.js) can find the pasted paths and keep them as
  // string-form links rather than dropping them to literal strings.
  mergePastedPaths(normalized.paths)

  const COMMANDS = bridge().COMMANDS
  let hydrated
  try {
    hydrated = normalized.items.map((rawItem) => hydratePastedItem(rawItem, COMMANDS))
  } catch (error) {
    showError(error.message)
    return
  }

  const steps = getSteps()
  if (parentGroupId) {
    const group = findGroupItem(parentGroupId)
    if (!group) {
      showError('Target group no longer exists.')
      return
    }
    const insertAt = indexInParent ?? group.steps.length
    group.steps.splice(insertAt, 0, ...hydrated.map((entry) => entry.item))
  } else {
    const insertAt = itemIndex ?? steps.length
    steps.splice(insertAt, 0, ...hydrated.map((entry) => entry.item))
  }

  bridge().renderAllAnimated(() => {
    const firstStepId = hydrated[0]?.firstStepId
    if (firstStepId) {
      bridge().scrollStepIntoView(firstStepId)
    }
  })
}

// Top-of-viewport banner for clipboard / paste feedback. The previous
// implementation hid a tiny chip under the divider's button; users
// missed it because the divider chrome is squeezed and the chip blends
// into the dim background. A fixed centered banner with a manual
// dismiss × is impossible to miss — and survives long enough for the
// user to read a permission-recovery message without racing the timer.
//
// Single shared element (#clipboard-toast) keyed off document.body so
// rapid retries stack onto the same banner instead of piling up DOM.
function showClipboardToast(message, { severity = 'error', durationMs = 6000 } = {}) {
  // Test environments (Vitest + happy-dom / jsdom) sometimes mount
  // without a body — bail and log so test runs stay quiet but
  // assertions can still spy on console.
  if (typeof document === 'undefined' || !document.body) {
    console.error('[card-clipboard] toast (' + severity + '): ' + message)
    return
  }
  let toast = document.getElementById('clipboard-toast')
  if (!toast) {
    toast = document.createElement('div')
    toast.id = 'clipboard-toast'
    toast.setAttribute('role', 'status')
    toast.setAttribute('aria-live', 'polite')
    toast.style.position = 'fixed'
    toast.style.top = '0.75rem'
    toast.style.left = '50%'
    toast.style.transform = 'translateX(-50%)'
    toast.style.zIndex = '100'
    toast.style.maxWidth = 'min(90vw, 36rem)'
    document.body.appendChild(toast)
  }
  const colorClass = severity === 'error'
    ? 'bg-red-950/95 border-red-700 text-red-200'
    : 'bg-amber-950/95 border-amber-700 text-amber-200'
  toast.className = `${colorClass} border rounded-lg px-4 py-2.5 text-sm shadow-lg flex items-start gap-3`
  toast.innerHTML = `
    <span class="flex-1 leading-relaxed">${esc(message)}</span>
    <button type="button" data-toast-close
      class="text-current opacity-70 hover:opacity-100 leading-none text-base shrink-0">✕</button>
  `
  toast.style.display = 'flex'
  const closeButton = toast.querySelector('[data-toast-close]')
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      toast.style.display = 'none'
    })
  }
  // Stash the timer ID on the element so a second toast clears the
  // first one's pending dismiss instead of inheriting it (which would
  // hide the new message early).
  if (toast._dismissTimer) {
    clearTimeout(toast._dismissTimer)
  }
  if (durationMs > 0) {
    toast._dismissTimer = setTimeout(() => {
      toast.style.display = 'none'
    }, durationMs)
  }
}
