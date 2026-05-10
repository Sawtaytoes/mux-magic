import { esc } from "../util/html-escape.js"
import { renderFieldLabel } from "./field-label.js"

/**
 * @param {{ step: object, field: object }} props
 * @returns {string}
 */
export function renderNumberArrayField({ step, field }) {
  const label = renderFieldLabel({
    command: step.command,
    field,
  })
  const val = step.params[field.name]
  const str = Array.isArray(val)
    ? val.join(", ")
    : (val ?? "")
  return `<div>${label}<input type="text" value="${esc(str)}" placeholder="${esc(field.placeholder ?? "0, 100")}"
    oninput="setParam('${step.id}','${field.name}',this.value.split(',').map(s=>s.trim()).filter(Boolean).map(Number).filter(n=>!isNaN(n)))"
    class="w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono" /></div>`
}
