import { COMMANDS, TAG_ORDER } from '../commands.js'
import { findStepById } from '../sequence-state.js'
import { esc } from '../util/html-escape.js'
import { commandLabel } from '../util/command-label.js'
import { createPopoverPicker } from '../util/popover-picker.js'

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
