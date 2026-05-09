import { COMMANDS } from './commands.js'
import { steps, isGroup } from './sequence-state.js'
import { esc } from './util/html-escape.js'
import { commandLabel } from './util/command-label.js'
import { renderCollapseChevron } from './components/collapse-chevron.js'
import { renderCopyIcon } from './components/copy-icon.js'
import { renderDoubleChevron } from './components/double-chevron.js'
import { renderStatusBadge } from './components/status-badge.js'
import { renderFields } from './fields/render-fields.js'

export { esc, renderCollapseChevron, renderCopyIcon, renderDoubleChevron, renderStatusBadge }
export { renderInsertDivider } from './components/insert-divider.js'
export { renderSequenceEndCard } from './components/sequence-end-card.js'
export { LOOKUP_LINKS } from './util/lookup-links.js'

/**
 * @typedef {{ id: string, command: string | null, params: Record<string, unknown>, links: Record<string, unknown>, status?: string, alias?: string, isCollapsed?: boolean, jobId?: string, error?: string }} Step
 * @typedef {{ id: string, isParallel?: boolean, isCollapsed?: boolean, label: string, steps: Step[] }} Group
 * @typedef {{ parentGroupId?: string }} StepContext
 */

// ─── Group renderer ───────────────────────────────────────────────────────────

/**
 * @param {Group} group
 * @param {number} itemIndex
 * @param {number} startingFlatIndex
 * @returns {string}
 */
export function renderGroup(group, itemIndex, startingFlatIndex) {
  const isParallel = group.isParallel === true
  const stepCount = group.steps.length
  const parallelBadge = isParallel
    ? '<span class="text-[10px] uppercase tracking-wide font-semibold text-blue-300 bg-blue-950/60 border border-blue-700/50 rounded px-1.5 py-0.5">parallel</span>'
    : '<span class="text-[10px] uppercase tracking-wide font-semibold text-slate-400 bg-slate-800 border border-slate-600 rounded px-1.5 py-0.5">sequential</span>'
  const innerStepsHtml = (
    group.isCollapsed
    ? ''
    : group.steps
        .map((step, idx) => renderStep(step, startingFlatIndex + idx, { parentGroupId: group.id }))
        .join('')
  )
  const containerClasses = isParallel
    ? 'parallel-group flex flex-row flex-wrap gap-3'
    : 'serial-group flex flex-col gap-3'
  const isFirstItem = itemIndex === 0
  const isLastItem = itemIndex === steps.length - 1

  return `
<div data-group="${group.id}" data-sortable-item class="group-card ${isParallel ? 'group-card-parallel' : 'group-card-serial'} bg-slate-900/50 rounded-xl border border-slate-700/70 overflow-hidden">
  <div class="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-slate-700/70 bg-slate-900/70">
    <button data-drag-handle title="Drag to reorder"
      class="w-5 h-5 flex items-center justify-center rounded text-slate-500 hover:text-slate-200 hover:bg-slate-700 select-none">⠿</button>
    <button onclick="toggleGroupCollapsed('${group.id}')" title="${group.isCollapsed ? 'Expand group' : 'Collapse group'}"
      class="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700">
      ${renderCollapseChevron({ isCollapsed: group.isCollapsed ?? false })}
    </button>
    <input type="text" value="${esc(group.label)}"
      placeholder="${isParallel ? 'Parallel group' : 'Group'} (${stepCount} step${stepCount === 1 ? '' : 's'})"
      data-group-label="${group.id}"
      oninput="setGroupLabel('${group.id}', this.value)"
      class="flex-1 min-w-0 bg-transparent text-sm font-medium text-slate-200 px-1.5 py-0.5 rounded border-0 focus:outline-none focus:bg-slate-900/40 placeholder:text-slate-300 placeholder:font-medium" />
    ${parallelBadge}
    <button onclick="setGroupChildrenCollapsed('${group.id}', true)" title="Collapse all inner steps"
      class="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700">${renderDoubleChevron({ isCollapsed: true })}</button>
    <button onclick="setGroupChildrenCollapsed('${group.id}', false)" title="Expand all inner steps"
      class="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700">${renderDoubleChevron({ isCollapsed: false })}</button>
    <button onclick="addStepToGroup('${group.id}')" title="Add a step inside this group"
      class="text-[10px] text-slate-400 hover:text-slate-200 px-2 py-0.5 rounded border border-slate-700 hover:border-slate-500">+ Step</button>
    <button onclick="pasteCardAt({parentGroupId: '${group.id}'}, this)" title="Paste a copied step into this group"
      class="text-[10px] text-slate-400 hover:text-emerald-400 px-2 py-0.5 rounded border border-slate-700 hover:border-emerald-500/40">📋 Paste</button>
    <!-- Group move arrows -->
    <button onclick="moveGroup('${group.id}',-1)" title="Move group up" ${isFirstItem ? 'disabled' : ''}
      class="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700 disabled:opacity-30 text-xs">↑</button>
    <button onclick="moveGroup('${group.id}',1)" title="Move group down" ${isLastItem ? 'disabled' : ''}
      class="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700 disabled:opacity-30 text-xs">↓</button>
    <button onclick="copyGroupYaml('${group.id}', this)" title="Copy this group's YAML"
      class="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-emerald-400 hover:bg-slate-700 text-xs border border-transparent">${renderCopyIcon()}</button>
    <button onclick="runGroup('${group.id}')" title="Run this group via /sequences/run"
      class="text-[10px] text-emerald-500 hover:text-emerald-300 px-2 py-0.5 rounded border border-emerald-700/50 hover:border-emerald-500 hover:bg-emerald-950/30">▶ Run</button>
    <button onclick="removeGroup('${group.id}')" title="Remove this group (its inner steps go too)"
      class="text-[10px] text-slate-500 hover:text-red-400 px-2 py-0.5 rounded border border-slate-700 hover:border-red-500/40">✕</button>
  </div>
  ${group.isCollapsed ? '' : `<div class="${containerClasses} p-3" data-group-body="${group.id}">
    ${innerStepsHtml}
  </div>`}
</div>`
}

// ─── Drawer-experiment feature flag ──────────────────────────────────────────

export function isDrawerMode() {
  try { return localStorage.getItem('useDrawerStepCards') === 'true' } catch { return false }
}

// ─── Compact step card (drawer experiment mode) ───────────────────────────────

/**
 * @param {Step} step
 * @param {number} index
 * @param {StepContext} [context]
 * @returns {string}
 */
export function renderStepCompact(step, index, context = {}) {
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
    <!-- Clickable info area opens the drawer -->
    <button
      onclick="window.openStepDrawer && openStepDrawer('${step.id}')"
      title="Open step details"
      class="step-compact-open flex-1 min-w-0 flex items-center gap-2 text-left hover:bg-slate-700/40 rounded px-1.5 py-0.5 transition-colors">
      <span class="text-sm font-medium text-slate-200 truncate min-w-0">${aliasText}</span>
      <span class="text-xs text-slate-400 shrink-0 truncate hidden sm:block">${operationLabel}</span>
    </button>
    ${statusBadge}
    <!-- Actions always visible in compact mode -->
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

// ─── Step renderer ────────────────────────────────────────────────────────────

/**
 * @param {Step} step
 * @param {number} index
 * @param {StepContext} [context]
 * @returns {string}
 */
export function renderStep(step, index, context = {}) {
  const cmd = /** @type {any} */ (step.command ? COMMANDS[/** @type {keyof typeof COMMANDS} */ (step.command)] : null)
  const statusBadge = step.status ? renderStatusBadge({ status: step.status }) : ''
  const siblings = context.parentGroupId
    ? (steps.find((item) => isGroup(item) && item.id === context.parentGroupId)?.steps ?? [])
    : steps
  const localIndex = siblings.indexOf(step)
  const isFirst = localIndex <= 0
  const isLast = localIndex < 0 || localIndex >= siblings.length - 1

  const triggerLabel = step.command
    ? `<span>${esc(commandLabel(step.command))}</span><span class="text-[10px] text-slate-500 ml-2 truncate">${esc(cmd.tag)}</span>`
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