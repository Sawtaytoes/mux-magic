import { esc } from '../util/html-escape.js'
import { renderFieldLabel } from './field-label.js'
import { getLinkedValue } from '../sequence-state.js'

/**
 * @param {{ step: object, field: object }} props
 * @returns {string}
 */
export function renderFolderMultiSelectField({ step, field }) {
  const label = renderFieldLabel({ command: step.command, field })
  const folders = Array.isArray(step.params[field.name]) ? step.params[field.name] : []
  const sourceValue = field.sourceField
    ? (getLinkedValue(step, field.sourceField) ?? step.params[field.sourceField] ?? '')
    : ''
  const tags = folders.map((folder) => `
    <span class="inline-flex items-center gap-1 bg-slate-700 text-slate-200 text-xs rounded px-1.5 py-0.5 font-mono">
      📁 ${esc(folder)}
      <button type="button" onclick="folderPicker.removeFolder('${step.id}','${esc(field.name)}','${esc(folder)}')"
        class="text-slate-400 hover:text-red-400 leading-none">✕</button>
    </span>
  `).join('')
  return `<div>${label}
    <div class="flex flex-wrap gap-1 mb-1.5">${tags}</div>
    <button type="button"
      data-step-id="${step.id}"
      data-field-name="${esc(field.name)}"
      data-source-field="${esc(field.sourceField ?? '')}"
      onclick="folderPicker.openFromEl(this)"
      class="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 py-1 rounded border border-slate-600">
      📁 Browse folders…
    </button>
  </div>`
}
