import { esc } from "../util/html-escape.js"

/**
 * @param {{ step: object, field: object }} props
 * @returns {string}
 */
export function renderBooleanField({ step, field }) {
  const tooltipKey = `${step.command}:${field.name}`
  const checked =
    step.params[field.name] ?? field.default ?? false
  const extraOnChange =
    field.name === "isRecursive"
      ? `;if(this.checked)initFieldMin('${step.id}','recursiveDepth',1)`
      : ""
  return `<label class="flex items-center gap-2 cursor-pointer select-none py-0.5" data-tooltip-key="${esc(tooltipKey)}">
    <input type="checkbox" ${checked ? "checked" : ""} onchange="setParamAndRender('${step.id}','${field.name}',this.checked)${extraOnChange}"
      class="w-3.5 h-3.5 rounded bg-slate-700 border-slate-500 accent-blue-500 cursor-pointer" />
    <span class="text-xs text-slate-300">${esc(field.label)}</span>
  </label>`
}
