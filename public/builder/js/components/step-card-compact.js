import { steps, isGroup } from '../sequence-state.js'
import { esc } from '../util/html-escape.js'
import { commandLabel } from '../util/command-label.js'
import { renderStatusBadge } from './status-badge.js'

/** @typedef {import('../step-renderer.js').Step} Step */
/** @typedef {import('../step-renderer.js').StepContext} StepContext */

/**
 * @param {{ step: Step, index: number, context?: StepContext }} props
 * @returns {string}
 */
export function renderStepCompactCard({ step, index, context = {} }) {
  const statusBadge = step.status ? renderStatusBadge({ status: step.status }) : ''
  const siblings = context.parentGroupId
    ? (steps.find((item) => isGroup(item) && item.id === context.parentGroupId)?.steps ?? [])
    : steps
  const localIndex = siblings.indexOf(step)
  const isFirst = localIndex <= 0
  const isLast = localIndex < 0 || localIndex >= siblings.length - 1

  const operationLabel = step.command
    ? esc(commandLabel(step.command))
    : '<span class="text-slate-500 italic">— none —</span>'

  const aliasText = step.alias
    ? esc(step.alias)
    : `<span class="text-slate-500 italic">${esc(step.command ? commandLabel(step.command) : 'unnamed')}</span>`

  return `
<div id="step-${step.id}" data-sortable-item data-step-card="${step.id}" style="view-transition-name: step-${step.id}"
  class="step-card-compact step-card bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
  <div class="flex items-center gap-2 px-3 py-2">
    <button data-drag-handle title="Drag to reorder"
      class="w-5 h-5 flex items-center justify-center rounded text-slate-500 hover:text-slate-200 hover:bg-slate-700 shrink-0 select-none">⠿</button>
    <span class="text-xs font-mono text-slate-500 shrink-0 w-5 text-center">${index + 1}</span>
    <button
      onclick="window.openStepDrawer && openStepDrawer('${step.id}')"
      title="Open step details"
      class="step-compact-open flex-1 min-w-0 flex items-center gap-2 text-left hover:bg-slate-700/40 rounded px-1.5 py-0.5 transition-colors">
      <span class="text-sm font-medium text-slate-200 truncate min-w-0">${aliasText}</span>
      <span class="text-xs text-slate-400 shrink-0 truncate hidden sm:block">${operationLabel}</span>
    </button>
    ${statusBadge}
    <div class="flex items-center gap-1 shrink-0">
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
      <button onclick="removeStep('${step.id}')"
        class="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-red-400 hover:bg-slate-700 text-xs">✕</button>
    </div>
  </div>
</div>`
}
