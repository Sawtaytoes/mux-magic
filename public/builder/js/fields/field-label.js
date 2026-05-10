import { esc } from "../util/html-escape.js"

/**
 * @param {{ command: string, field: { name: string, label: string, required?: boolean } }} props
 * @returns {string}
 */
export function renderFieldLabel({ command, field }) {
  const tooltipKey = `${command}:${field.name}`
  return `<label class="block text-xs text-slate-400 mb-1 cursor-help" data-tooltip-key="${esc(tooltipKey)}">${esc(field.label)}${field.required ? ' <span class="text-red-400">*</span>' : ""}</label>`
}
