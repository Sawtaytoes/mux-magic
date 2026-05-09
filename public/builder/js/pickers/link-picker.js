import { findStepById, flattenSteps, paths, stepOutput } from '../sequence-state.js'
import { esc } from '../util/html-escape.js'
import { describeLinkTarget } from '../util/describe-link-target.js'
import { setLink } from '../sequence-editor.js'
import { createPopoverPicker } from '../util/popover-picker.js'

function makePathBreakable(text) {
  return text.replace(/([/\\])/g, "​$1")
}

function buildLinkPickerItems(stepId, fieldName) {
  const flatOrder = flattenSteps()
  const currentIndex = flatOrder.findIndex((entry) => entry.step.id === stepId)
  if (currentIndex < 0) return []
  // No '— custom —' item: closing the picker and typing in the path
  // input itself is now the way to enter a new path. The footer hint in
  // the popover (index.html) tells the user this. The path-input handler
  // (onPathFieldInput) clears any existing link on first keystroke and
  // promotePathToPathVar (on blur) saves the typed value as a new path
  // var (or reuses an existing one with the same value).
  const items = []
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
      label: `Step ${entry.flatIndex + 1}: ${window.commandLabel ? window.commandLabel(previousStep.command) : previousStep.command}`,
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
