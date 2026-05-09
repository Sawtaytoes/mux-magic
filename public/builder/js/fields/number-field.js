import { esc } from '../util/html-escape.js'
import { renderFieldLabel } from './field-label.js'

/**
 * @param {{ step: object, field: object }} props
 * @returns {string}
 */
export function renderNumberField({ step, field }) {
  const label = renderFieldLabel({ command: step.command, field })
  const num = step.params[field.name] ?? field.default ?? ''
  const companion = field.companionNameField ? step.params[field.companionNameField] : null
  const onInputBody = field.companionNameField
    ? `setParam('${step.id}','${field.name}',this.value===''?undefined:Number(this.value));scheduleReverseLookup('${step.id}','${field.name}',this.value)`
    : `setParam('${step.id}','${field.name}',this.value===''?undefined:Number(this.value))`
  return `<div>${label}<input type="number" value="${esc(num)}" aria-label="${esc(field.label)}"
    oninput="${onInputBody}"
    onchange="setParam('${step.id}','${field.name}',this.value===''?undefined:Number(this.value))"
    class="w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500" />
    ${field.companionNameField ? `<p data-step="${step.id}" data-companion="${field.name}" class="text-xs text-slate-500 mt-0.5 truncate ${companion ? '' : 'hidden'}" title="${esc(companion ?? '')}">${esc(companion ?? '')}</p>` : ''}
  </div>`
}
