import { esc } from '../util/html-escape.js'
import { renderFieldLabel } from './field-label.js'
import { renderStepOutputPicker } from './step-output-picker.js'

/**
 * @param {{ step: object, field: object, stepIndex: number }} props
 * @returns {string}
 */
export function renderJsonField({ step, field, stepIndex }) {
  const label = renderFieldLabel({ command: step.command, field })
  const val = step.params[field.name]
  const str = val !== undefined ? (typeof val === 'string' ? val : JSON.stringify(val, null, 2)) : ''
  const link = step.links?.[field.name]
  const isLinked = link && typeof link === 'object' && link.linkedTo
  const pickerHtml = field.linkable ? renderStepOutputPicker({ step, field, stepIndex, link }) : ''
  if (isLinked) {
    return `<div>${label}${pickerHtml}<div class="text-xs text-slate-400 bg-slate-900 rounded px-2 py-1.5 border border-slate-700 italic font-mono">Linked → ${esc(link.linkedTo)}.${esc(link.output ?? 'folder')}</div></div>`
  }
  return `<div>${label}${pickerHtml}<textarea rows="3" placeholder="${esc(field.placeholder ?? '[]')}"
    oninput="setParamJson('${step.id}','${field.name}',this.value)"
    class="w-full bg-slate-900 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono resize-y">${esc(str)}</textarea></div>`
}
