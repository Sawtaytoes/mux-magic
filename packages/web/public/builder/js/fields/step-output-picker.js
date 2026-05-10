import { COMMANDS } from "../commands.js"
import { flattenSteps } from "../sequence-state.js"
import { commandLabel } from "../util/command-label.js"
import { esc } from "../util/html-escape.js"

/**
 * @param {{ step: object, field: object, stepIndex: number, link: unknown }} props
 * @returns {string}
 */
export function renderStepOutputPicker({
  step,
  field,
  stepIndex,
  link,
}) {
  const isLinked =
    link && typeof link === "object" && link.linkedTo
  const options = flattenSteps()
    .slice(0, stepIndex)
    .map((entry) => entry.step)
    .filter(
      (s) =>
        s.command &&
        Array.isArray(COMMANDS[s.command]?.outputs) &&
        COMMANDS[s.command].outputs.length > 0,
    )
    .flatMap((s) =>
      COMMANDS[s.command].outputs.map((out) => {
        const value = `step:${s.id}:${out.name}`
        const isSelected =
          isLinked &&
          link.linkedTo === s.id &&
          link.output === out.name
        const lbl = `Step (${esc(commandLabel(s.command))}) → ${esc(out.label ?? out.name)}`
        return `<option value="${value}"${isSelected ? " selected" : ""}>${lbl}</option>`
      }),
    )
    .join("")
  return `<div class="flex items-center gap-2 mb-1">
    <span class="text-xs text-slate-500 shrink-0">Link to:</span>
    <select onchange="setLink('${step.id}','${field.name}',this.value)"
      class="text-xs bg-slate-700 text-slate-300 rounded px-1.5 py-0.5 border border-slate-600 focus:outline-none focus:border-blue-500 max-w-[280px] truncate">
      <option value=""${!isLinked ? " selected" : ""}>— custom —</option>
      ${options}
    </select>
  </div>`
}
