import { esc } from "../util/html-escape.js"
import { renderFieldLabel } from "./field-label.js"

/**
 * @param {{ step: object, field: object }} props
 * @returns {string}
 */
export function renderEnumField({ step, field }) {
  const label = renderFieldLabel({
    command: step.command,
    field,
  })
  const selected =
    step.params[field.name] ?? field.default ?? ""
  const selectedOption = (field.options ?? []).find(
    (option) => option.value === selected,
  )
  const triggerLabel = selectedOption?.label ?? selected
  return `<div>${label}<button type="button"
    onclick="enumPicker.open({stepId: '${step.id}', fieldName: '${esc(field.name)}'}, this)"
    data-enum-picker-trigger
    class="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 text-left flex items-center gap-2 cursor-pointer">
    <span class="flex-1 min-w-0 truncate">${esc(triggerLabel)}</span>
    <span class="text-slate-400 shrink-0">▾</span>
  </button></div>`
}
