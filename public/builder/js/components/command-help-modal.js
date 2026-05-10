// Per-command help modal — opened from the ⓘ button on each step
// card header. Lists every field's schema description plus the
// command's summary, so the user gets the full picture in one place
// instead of having to hover each label individually.
//
// The content lives in window.commandDescriptions (auto-generated at
// prebuild from src/api/schemas.ts), with a fallback to the static
// labels in commands.js for fields that don't (yet) have a schema
// description.

import { COMMANDS } from "../commands.js"
import { esc } from "../step-renderer.js"

const MODAL_ELEMENT_ID = "command-help-modal"
const TITLE_ELEMENT_ID = "command-help-title"
const BODY_ELEMENT_ID = "command-help-body"

const commandLabel = (commandName) =>
  typeof window.commandLabel === "function"
    ? window.commandLabel(commandName)
    : commandName

const renderFieldEntry = ({ commandName, field }) => {
  const description = window.getCommandFieldDescription
    ? window.getCommandFieldDescription({
        commandName,
        fieldName: field.name,
      })
    : ""
  const descriptionHtml = description
    ? `<p class="text-xs text-slate-300 leading-relaxed">${esc(description)}</p>`
    : `<p class="text-xs text-slate-500 italic">No description yet — add one in <code class="text-slate-400 bg-slate-950 px-1 rounded">src/api/schemas.ts</code>.</p>`
  const requiredBadge = field.required
    ? '<span class="text-[10px] uppercase tracking-wide font-semibold text-red-300 bg-red-950/60 border border-red-700/50 rounded px-1.5 py-0.5">required</span>'
    : ""
  const typeBadge = `<span class="text-[10px] uppercase tracking-wide text-slate-400 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5">${esc(field.type)}</span>`

  return `<div class="border-b border-slate-800 pb-3 last:border-b-0">
    <div class="flex items-baseline flex-wrap gap-2 mb-1">
      <span class="text-sm font-semibold text-slate-100">${esc(field.label)}</span>
      <code class="text-[11px] text-slate-500 font-mono">${esc(field.name)}</code>
      ${typeBadge}
      ${requiredBadge}
    </div>
    ${descriptionHtml}
  </div>`
}

export function openCommandHelpModal({ commandName }) {
  if (!commandName) {
    return
  }

  const commandConfig = COMMANDS[commandName]

  if (!commandConfig) {
    return
  }

  const titleElement = document.getElementById(
    TITLE_ELEMENT_ID,
  )
  const bodyElement =
    document.getElementById(BODY_ELEMENT_ID)
  const modalElement = document.getElementById(
    MODAL_ELEMENT_ID,
  )

  if (!titleElement || !bodyElement || !modalElement) {
    return
  }

  const summary =
    (window.getCommandSummary
      ? window.getCommandSummary({ commandName })
      : "") ||
    commandConfig.summary ||
    ""

  titleElement.textContent = `Help: ${commandLabel(commandName)}`

  const summaryHtml = summary
    ? `<p class="text-sm text-slate-300 leading-relaxed mb-4">${esc(summary)}</p>`
    : ""
  const noteHtml = commandConfig.note
    ? `<p class="text-xs text-amber-300 bg-amber-950/40 border border-amber-800/50 rounded px-2 py-1 mb-4">${esc(commandConfig.note)}</p>`
    : ""
  const outputHtml = commandConfig.outputFolderName
    ? `<p class="text-xs text-amber-500/80 mb-4">→ outputs to <code class="text-amber-400 bg-slate-950 px-1 rounded">${esc(commandConfig.outputFolderName)}/</code> subfolder</p>`
    : ""
  const fieldsHtml = commandConfig.fields.length
    ? `<div class="space-y-3">
        <h3 class="text-xs uppercase tracking-wide font-semibold text-slate-500 mb-2">Fields</h3>
        ${commandConfig.fields.map((field) => renderFieldEntry({ commandName, field })).join("")}
      </div>`
    : '<p class="text-xs text-slate-500 italic">This command has no configurable fields.</p>'

  bodyElement.innerHTML = `${summaryHtml}${noteHtml}${outputHtml}${fieldsHtml}`
  modalElement.classList.remove("hidden")
}

// Closes when called programmatically (event omitted) or when the user
// clicks the modal backdrop. Clicks bubbling up from the inner panel
// won't match the backdrop element so the modal stays open. Mirrors
// the closeYamlModal contract.
export function closeCommandHelpModal(event) {
  const modalElement = document.getElementById(
    MODAL_ELEMENT_ID,
  )

  if (!modalElement) {
    return
  }

  if (!event || event.target === modalElement) {
    modalElement.classList.add("hidden")
  }
}
