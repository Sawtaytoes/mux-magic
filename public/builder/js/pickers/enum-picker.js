import { COMMANDS } from '../commands.js'
import { findStepById } from '../sequence-state.js'
import { esc } from '../util/html-escape.js'
import { setParam } from '../sequence-editor.js'
import { createPopoverPicker } from '../util/popover-picker.js'

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
