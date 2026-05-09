import { COMMANDS } from '../commands.js'
import { steps, isGroup } from '../sequence-state.js'
import { esc } from '../util/html-escape.js'
import { commandLabel } from '../util/command-label.js'
import { renderCollapseChevron } from './collapse-chevron.js'
import { renderCopyIcon } from './copy-icon.js'
import { renderStatusBadge } from './status-badge.js'
import { renderFields } from '../fields/render-fields.js'

/** @typedef {import('../step-renderer.js').Step} Step */
/** @typedef {import('../step-renderer.js').StepContext} StepContext */

/**
 * @param {{ step: Step, index: number, context?: StepContext }} props
 * @returns {string}
 */
export function renderStepCard({ step, index, context = {} }) {
  const cmd = /** @type {any} */ (step.command ? COMMANDS[/** @type {keyof typeof COMMANDS} */ (step.command)] : null)
  const statusBadge = step.status ? renderStatusBadge({ status: step.status }) : ''
  const siblings = context.parentGroupId
    ? (steps.find((item) => isGroup(item) && item.id === context.parentGroupId)?.steps ?? [])
    : steps
  const localIndex = siblings.indexOf(step)
  const isFirst = localIndex <= 0
  const isLast = localIndex < 0 || localIndex >= siblings.length - 1

  const triggerLabel = cmd
    ? `<span>${esc(commandLabel(step.command ?? ''))}</span><span class="text-[10px] text-slate-500 ml-2 truncate">${esc(cmd.tag)}</span>`
    : `<span class="text-slate-400 italic">— pick a command —</span>`

  const body = cmd
    ? `<p class="text-xs text-slate-500 mb-2">${esc(cmd.summary)}</p>
       ${cmd.note ? `<p class="text-xs text-amber-300 bg-amber-950/40 border border-amber-800/50 rounded px-2 py-1 mb-2">${esc(cmd.note)}</p>` : ''}
       ${cmd.outputFolderName ? `<p class="text-xs text-amber-500/80 mb-2">→ outputs to <code class="text-amber-400 bg-slate-900 px-1 rounded">${esc(cmd.outputFolderName)}/</code> subfolder</p>` : ''}
       ${step.error ? `<p class="text-xs text-red-400 bg-red-950/40 rounded px-2 py-1 mb-2 font-mono">${esc(step.error)}</p>` : ''}
       <div class="space-y-2">${renderFields({ step, stepIndex: index })}</div>`
    : `<p class="text-xs text-slate-500 italic">No command selected — choose one from the dropdown above.</p>`

  return `
<div id="step-${step.id}" data-sortable-item data-step-card="${step.id}" style="view-transition-name: step-${step.id}" class="step-card bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
  <div class="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-slate-700 bg-slate-800/80">
    <button data-drag-handle title="Drag to reorder"
      class="w-5 h-5 flex items-center justify-center rounded text-slate-500 hover:text-slate-200 hover:bg-slate-700 shrink-0 select-none">⠿</button>
    <button onclick="toggleStepCollapsed('${step.id}')" title="${step.isCollapsed ? 'Expand step' : 'Collapse step'}"
      class="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700 shrink-0">
      ${renderCollapseChevron({ isCollapsed: step.isCollapsed ?? false })}
    </button>
    <span class="text-xs font-mono text-slate-500 shrink-0 w-5 text-center">${index + 1}</span>
    <input type="text" value="${esc(step.alias)}"
      placeholder="${esc(step.command ? commandLabel(step.command) : 'Click to name this step')}"
      data-step-alias="${step.id}"
      onfocus="stepAliasFocus(this)"
      onkeydown="stepAliasKeydown(event,'${step.id}')"
      onblur="stepAliasBlur(this,'${step.id}')"
      class="step-alias bg-transparent text-sm font-medium text-slate-200 px-1.5 py-0.5 rounded border-0 focus:outline-none focus:bg-slate-900/40 placeholder:text-slate-200 placeholder:font-medium" />
    <button onclick="commandPicker.open({stepId: '${step.id}'}, this)" data-cmd-picker-trigger
      class="flex-1 min-w-0 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600 focus:outline-none focus:border-blue-500 text-left flex items-center gap-2 cursor-pointer">
      <span class="flex-1 min-w-0 truncate flex items-center">${triggerLabel}</span>
      <span class="text-slate-400 shrink-0">▾</span>
    </button>
    ${statusBadge}
    ${step.command ? `<button onclick="openCommandHelpModal({commandName: '${step.command}'})" title="Show docs for this command's settings"
      class="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-blue-300 hover:bg-slate-700 text-xs">ⓘ</button>` : ''}
    <button onclick="toggleStepActions('${step.id}')" title="Step actions"
      class="step-hamburger-btn w-6 h-6 items-center justify-center rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700 text-base leading-none">≡</button>
    <div class="step-actions" data-step-actions="${step.id}">
      <button onclick="runOrStopStep('${step.id}')" ${step.command ? '' : 'disabled'}
        title="${step.status === 'running' && step.jobId ? 'Cancel this step' : 'Run this step only'}"
        data-step-run-stop="${step.id}"
        class="step-run-stop ${step.status === 'running' && step.jobId ? 'is-running' : ''}">
        <span class="step-run-stop-icon step-run-stop-play">▶</span>
        <span class="step-run-stop-icon step-run-stop-stop">⏹</span>
      </button>
      <button onclick="moveStep('${step.id}',-1)" ${isFirst ? 'disabled' : ''}
        class="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700 disabled:opacity-30 text-xs">↑</button>
      <button onclick="moveStep('${step.id}',1)" ${isLast ? 'disabled' : ''}
        class="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700 disabled:opacity-30 text-xs">↓</button>
      ${step.command ? `<button onclick="copyStepYaml('${step.id}', this)" title="Copy this step's YAML"
        class="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-emerald-400 hover:bg-slate-700 text-xs border border-transparent">${renderCopyIcon()}</button>` : ''}
      <button onclick="removeStep('${step.id}')"
        class="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-red-400 hover:bg-slate-700 text-xs">✕</button>
    </div>
  </div>
  ${step.isCollapsed ? '' : `<div class="px-3 py-2">
    ${body}
  </div>`}
</div>`
}
