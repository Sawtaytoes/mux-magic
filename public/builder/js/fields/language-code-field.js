import { esc } from '../util/html-escape.js'
import { renderFieldLabel } from './field-label.js'

/**
 * @param {{ step: object, field: object }} props
 * @returns {string}
 */
export function renderLanguageCodeField({ step, field }) {
  const label = renderFieldLabel({ command: step.command, field })
  const str = step.params[field.name] ?? ''
  return `<div>${label}<input type="text" value="${esc(str)}" placeholder="eng"
    oninput="setParam('${step.id}','${field.name}',this.value||undefined)"
    maxlength="3"
    class="w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono" /></div>`
}
