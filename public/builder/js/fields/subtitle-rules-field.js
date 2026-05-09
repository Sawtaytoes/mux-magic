import { esc } from '../util/html-escape.js'
import { renderFieldLabel } from './field-label.js'
import { renderRulesField } from '../components/dsl-rules-builder.js'
import { renderStepOutputPicker } from './step-output-picker.js'

/**
 * @param {{ step: object, field: object, stepIndex: number }} props
 * @returns {string}
 */
export function renderSubtitleRulesField({ step, field, stepIndex }) {
  const label = renderFieldLabel({ command: step.command, field })
  const link = step.links?.[field.name]
  const isLinked = link && typeof link === 'object' && link.linkedTo
  const pickerHtml = field.linkable ? renderStepOutputPicker({ step, field, stepIndex, link }) : ''
  if (isLinked) {
    return `<div>${label}${pickerHtml}<div class="text-xs text-slate-400 bg-slate-900 rounded px-2 py-1.5 border border-slate-700 italic font-mono">Linked → ${esc(link.linkedTo)}.${esc(link.output ?? 'folder')}</div></div>`
  }
  return `<div>${label}${pickerHtml}${renderRulesField({ step })}</div>`
}
