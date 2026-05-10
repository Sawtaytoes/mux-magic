import { getLinkedValue } from "../sequence-state.js"
import { describeLinkTarget } from "../util/describe-link-target.js"
import { esc } from "../util/html-escape.js"

/**
 * @param {{ step: object, field: object }} props
 * @returns {string}
 */
export function renderPathField({ step, field }) {
  const val = step.params[field.name] ?? ""
  const link = step.links[field.name]
  const computed = link
    ? (getLinkedValue(step, field.name) ?? "")
    : null
  const target = describeLinkTarget(step, field.name)
  const triggerData = [
    `data-step="${step.id}"`,
    `data-field="${field.name}"`,
    target.pathVarId
      ? `data-pv-id="${target.pathVarId}"`
      : "",
    target.sourceStepId
      ? `data-linked-step="${target.sourceStepId}"`
      : "",
  ]
    .filter(Boolean)
    .join(" ")
  const browsePathArg = JSON.stringify(
    computed ?? val,
  ).replace(/"/g, "&quot;")
  const tooltipKey = `${step.command}:${field.name}`
  return `<div>
    <div class="flex items-center gap-2 mb-1">
      <label class="text-xs text-slate-400 cursor-help" data-tooltip-key="${esc(tooltipKey)}">${esc(field.label)}${field.required ? ' <span class="text-red-400">*</span>' : ""}</label>
      <button type="button" onclick="browsePathField('${step.id}','${field.name}',${browsePathArg})"
        title="Browse to pick a folder for this field"
        class="ml-auto text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded px-1.5 py-0.5 border border-slate-600 focus:outline-none focus:border-blue-500 cursor-pointer">📁</button>
      <button type="button" onclick="linkPicker.open({stepId: '${step.id}', fieldName: '${field.name}'}, this)" data-link-picker-trigger ${triggerData}
        class="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded px-1.5 py-0.5 border border-slate-600 focus:outline-none focus:border-blue-500 min-w-0 max-w-full flex items-center gap-1 cursor-pointer">
        <span class="truncate" data-link-trigger-label>${esc(target.label)}</span>
        <span class="text-slate-400 shrink-0">▾</span>
      </button>
    </div>
    <input type="text" value="${esc(computed ?? val)}" ${link && typeof link === "object" && link.linkedTo ? "readonly" : ""}
      data-step="${step.id}" data-field="${field.name}"
      class="${computed !== null ? "linked-input" : "manual-input"} w-full bg-slate-${computed !== null ? "900" : "700"} text-slate-${computed !== null ? "400" : "200"} text-xs rounded px-2 py-1.5 border border-slate-${computed !== null ? "700" : "600"} focus:outline-none focus:border-blue-500 font-mono"
      oninput="onPathFieldInput(this,'${step.id}','${field.name}',this.value)" onkeydown="pathPickerKeydown(event)" onfocus="onPathFieldFocus(this,'${step.id}','${field.name}',this.value)" onblur="onPathFieldBlur(this,'${step.id}','${field.name}',this.value)" onchange="promotePathToPathVar('${step.id}','${field.name}',this.value)" />
    ${computed !== null && (link && typeof link === "object" && link.linkedTo) ? `<input type="text" value="${esc(val)}" data-step="${step.id}" data-field="${field.name}" class="manual-input hidden w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono" oninput="onPathFieldInput(this,'${step.id}','${field.name}',this.value)" onkeydown="pathPickerKeydown(event)" onfocus="onPathFieldFocus(this,'${step.id}','${field.name}',this.value)" onblur="onPathFieldBlur(this,'${step.id}','${field.name}',this.value)" onchange="promotePathToPathVar('${step.id}','${field.name}',this.value)" />` : ""}
  </div>`
}
