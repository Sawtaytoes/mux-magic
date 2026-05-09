// ─── Step / group renderer ────────────────────────────────────────────────────
//
// Produces the HTML strings for renderAll: step cards, group containers,
// insert dividers, status badges, field rows, and the sequence-end card.

import { COMMANDS } from './commands.js'
import { renderRulesField } from './components/dsl-rules-builder.js'
import { steps, paths, flattenSteps, isGroup, getLinkedValue } from './sequence-state.js'

// commandLabel is provided by the global /command-labels.js script.
const commandLabel = (name) => (typeof window.commandLabel === 'function' ? window.commandLabel(name) : name)

// ─── HTML escape ──────────────────────────────────────────────────────────────

export function esc(v) {
  return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

// ─── Icon helpers ─────────────────────────────────────────────────────────────

export function renderCollapseChevron(isCollapsed) {
  const rotateClass = isCollapsed ? '-rotate-90' : ''
  return `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5 transition-transform ${rotateClass}">
    <polyline points="5,8 10,13 15,8" />
  </svg>`
}

export function renderCopyIcon() {
  return `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5">
    <rect x="7" y="7" width="9" height="10" rx="1.5" />
    <path d="M4 13V5.5A1.5 1.5 0 0 1 5.5 4H12" />
  </svg>`
}

export function renderDoubleChevron(isCollapsedDirection) {
  const rotateClass = isCollapsedDirection ? '-rotate-90' : ''
  return `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5 transition-transform ${rotateClass}">
    <polyline points="5,5 10,10 15,5" />
    <polyline points="5,11 10,16 15,11" />
  </svg>`
}

// ─── Insert divider ───────────────────────────────────────────────────────────

export function renderInsertDivider(index) {
  return `<div class="col-span-full flex items-center group -my-0.5">
    <div class="flex-1 h-px bg-slate-700/50 group-hover:bg-slate-600 transition-colors"></div>
    <div class="flex items-center gap-1 mx-1">
      <button onclick="insertAt(${index})" title="Insert a step here"
        class="flex items-center gap-1 px-2.5 py-0.5 text-xs text-slate-600 hover:text-blue-400 rounded-full border border-transparent hover:border-blue-500/40 hover:bg-slate-800 transition-all whitespace-nowrap">
        ➕ Step
      </button>
      <button onclick="insertGroupAt(${index}, false)" title="Insert a sequential group here"
        class="flex items-center gap-1 px-2.5 py-0.5 text-xs text-slate-600 hover:text-blue-400 rounded-full border border-transparent hover:border-blue-500/40 hover:bg-slate-800 transition-all whitespace-nowrap">
        ➕ Group
      </button>
      <button onclick="insertGroupAt(${index}, true)" title="Insert a parallel group here"
        class="flex items-center gap-1 px-2.5 py-0.5 text-xs text-slate-600 hover:text-blue-400 rounded-full border border-transparent hover:border-blue-500/40 hover:bg-slate-800 transition-all whitespace-nowrap">
        ➕ Parallel
      </button>
      <button onclick="pasteCardAt({itemIndex: ${index}}, this)" title="Paste a copied step or group here"
        class="flex items-center gap-1 px-2.5 py-0.5 text-xs text-slate-600 hover:text-emerald-400 rounded-full border border-transparent hover:border-emerald-500/40 hover:bg-slate-800 transition-all whitespace-nowrap">
        📋 Paste
      </button>
    </div>
    <div class="flex-1 h-px bg-slate-700/50 group-hover:bg-slate-600 transition-colors"></div>
  </div>`
}

export function renderSequenceEndCard() {
  return `<div class="col-span-full bg-slate-800/30 rounded-xl border border-dashed border-slate-700 px-4 py-2.5 flex items-center justify-center gap-2 select-none">
    <span class="text-slate-600">⏹</span>
    <span class="text-xs font-medium text-slate-500">End of Sequence</span>
  </div>`
}

// ─── Status badge ─────────────────────────────────────────────────────────────

export function renderStatusBadge(status) {
  const map = {
    pending:   'bg-blue-950 text-blue-300',
    running:   'bg-blue-950 text-blue-400 animate-pulse',
    completed: 'bg-emerald-950 text-emerald-400',
    failed:    'bg-red-950 text-red-400',
    cancelled: 'bg-slate-700 text-slate-300',
  }
  return `<span class="status-badge shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${map[status] ?? ''}">${esc(status)}</span>`
}

// ─── Group renderer ───────────────────────────────────────────────────────────

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
      ${renderCollapseChevron(group.isCollapsed)}
    </button>
    <input type="text" value="${esc(group.label)}"
      placeholder="${isParallel ? 'Parallel group' : 'Group'} (${stepCount} step${stepCount === 1 ? '' : 's'})"
      data-group-label="${group.id}"
      oninput="setGroupLabel('${group.id}', this.value)"
      class="flex-1 min-w-0 bg-transparent text-sm font-medium text-slate-200 px-1.5 py-0.5 rounded border-0 focus:outline-none focus:bg-slate-900/40 placeholder:text-slate-300 placeholder:font-medium" />
    ${parallelBadge}
    <button onclick="setGroupChildrenCollapsed('${group.id}', true)" title="Collapse all inner steps"
      class="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700">${renderDoubleChevron(true)}</button>
    <button onclick="setGroupChildrenCollapsed('${group.id}', false)" title="Expand all inner steps"
      class="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700">${renderDoubleChevron(false)}</button>
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
//
// Renders a minimal row: drag handle, index, alias, operation name, actions.
// Clicking the row (not a button) opens the step drawer via openStepDrawer().

export function renderStepCompact(step, index, context = {}) {
  const cmd = step.command ? COMMANDS[step.command] : null
  const statusBadge = step.status ? renderStatusBadge(step.status) : ''
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

export function renderStep(step, index, context = {}) {
  const cmd = step.command ? COMMANDS[step.command] : null
  const statusBadge = step.status ? renderStatusBadge(step.status) : ''
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
       <div class="space-y-2">${renderFields(step, index)}</div>`
    : `<p class="text-xs text-slate-500 italic">No command selected — choose one from the dropdown above.</p>`

  return `
<div id="step-${step.id}" data-sortable-item data-step-card="${step.id}" style="view-transition-name: step-${step.id}" class="step-card bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
  <div class="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-slate-700 bg-slate-800/80">
    <button data-drag-handle title="Drag to reorder"
      class="w-5 h-5 flex items-center justify-center rounded text-slate-500 hover:text-slate-200 hover:bg-slate-700 shrink-0 select-none">⠿</button>
    <button onclick="toggleStepCollapsed('${step.id}')" title="${step.isCollapsed ? 'Expand step' : 'Collapse step'}"
      class="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700 shrink-0">
      ${renderCollapseChevron(step.isCollapsed)}
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

// ─── Field renderers ──────────────────────────────────────────────────────────

function isFieldVisible(visibleWhen, params) {
  if (!visibleWhen) return true
  // visibleWhen format: { fieldName: "fieldToCheck", value: trueValue }
  const fieldValue = params?.[visibleWhen.fieldName]
  return fieldValue === visibleWhen.value
}

export function renderFields(step, stepIndex) {
  const cmd = COMMANDS[step.command]
  const fieldsHtml = []
  const groupedFieldNames = new Set()
  const groupsByFirstField = new Map()

  // Build set of fields that are part of a group, and map first field to group
  if (cmd.groups && Array.isArray(cmd.groups)) {
    cmd.groups.forEach(group => {
      if (Array.isArray(group.fields) && group.fields.length > 0) {
        group.fields.forEach(name => groupedFieldNames.add(name))
        // Map the first field in the group to the group definition
        groupsByFirstField.set(group.fields[0], group)
      }
    })
  }

  // Render fields in order, rendering groups when we hit their first field
  const renderedGroups = new Set()

  cmd.fields.forEach(field => {
    // Check if field should be visible based on condition
    if (field.visibleWhen && !isFieldVisible(field.visibleWhen, step.params)) {
      return
    }

    // If this field is the first in a group, render the whole group
    const group = groupsByFirstField.get(field.name)
    if (group && !renderedGroups.has(group)) {
      renderedGroups.add(group)
      const groupFieldsHtml = group.fields
        .map(fieldName => {
          const f = cmd.fields.find(fld => fld.name === fieldName)
          if (!f) return ''
          // Check visibility for grouped fields too
          if (f.visibleWhen && !isFieldVisible(f.visibleWhen, step.params)) {
            return ''
          }
          return renderFieldHtml(step, f, stepIndex)
        })
        .filter(Boolean)
        .join('')

      if (groupFieldsHtml) {
        fieldsHtml.push(
          `<div class="${group.layout}">${groupFieldsHtml}</div>`
        )
      }
    } else if (!groupedFieldNames.has(field.name)) {
      // Render ungrouped fields normally
      const fieldHtml = renderFieldHtml(step, field, stepIndex)
      if (fieldHtml) {
        fieldsHtml.push(fieldHtml)
      }
    }
  })

  return fieldsHtml.join('')
}

function renderFieldHtml(step, field, stepIndex) {
  const val = step.params[field.name]
  const tooltipKey = `${step.command}:${field.name}`
  const label = `<label class="block text-xs text-slate-400 mb-1 cursor-help" data-tooltip-key="${esc(tooltipKey)}">${esc(field.label)}${field.required ? ' <span class="text-red-400">*</span>' : ''}</label>`

  // `hidden` fields ride along in the params payload but do not render
  // a control. Used by composite editors (e.g. subtitleRules) that own
  // multiple fields under a single UI surface.
  if (field.type === 'hidden') {
    return ''
  }

  // `subtitleRules` is the structured DSL form-builder for
  // modifySubtitleMetadata's rules / predicates / hasDefaultRules.
  // Source: public/builder/js/components/dsl-rules-builder.js.
  if (field.type === 'subtitleRules') {
    const link = step.links?.[field.name]
    const isLinked = link && typeof link === 'object' && link.linkedTo
    const pickerHtml = field.linkable ? renderStepOutputPicker(step, field, stepIndex, link) : ''
    if (isLinked) {
      return `<div>${label}${pickerHtml}<div class="text-xs text-slate-400 bg-slate-900 rounded px-2 py-1.5 border border-slate-700 italic font-mono">Linked → ${esc(link.linkedTo)}.${esc(link.output ?? 'folder')}</div></div>`
    }
    return `<div>${label}${pickerHtml}${renderRulesField({ step })}</div>`
  }

  if (field.type === 'boolean') {
    const checked = val ?? field.default ?? false
    return `<label class="flex items-center gap-2 cursor-pointer select-none py-0.5" data-tooltip-key="${esc(tooltipKey)}">
      <input type="checkbox" ${checked ? 'checked' : ''} onchange="setParam('${step.id}','${field.name}',this.checked)"
        class="w-3.5 h-3.5 rounded bg-slate-700 border-slate-500 accent-blue-500 cursor-pointer" />
      <span class="text-xs text-slate-300">${esc(field.label)}</span>
    </label>`
  }

  if (field.type === 'path') return renderPathField(step, field, stepIndex)

  if (field.type === 'number') {
    const num = val ?? field.default ?? ''
    const companion = field.companionNameField ? step.params[field.companionNameField] : null
    const reverseLookup = field.companionNameField ? `oninput="scheduleReverseLookup('${step.id}','${field.name}',this.value)"` : ''
    return `<div>${label}<input type="number" value="${esc(num)}"
      ${reverseLookup}
      onchange="setParam('${step.id}','${field.name}',this.value===''?undefined:Number(this.value))"
      class="w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500" />
      ${field.companionNameField ? `<p data-step="${step.id}" data-companion="${field.name}" class="text-xs text-slate-500 mt-0.5 truncate ${companion ? '' : 'hidden'}" title="${esc(companion ?? '')}">${esc(companion ?? '')}</p>` : ''}
    </div>`
  }

  if (field.type === 'enum') {
    const selected = val ?? field.default ?? ''
    const selectedOption = (field.options ?? []).find((option) => option.value === selected)
    const triggerLabel = selectedOption?.label ?? selected
    return `<div>${label}<button type="button"
      onclick="enumPicker.open({stepId: '${step.id}', fieldName: '${esc(field.name)}'}, this)"
      data-enum-picker-trigger
      class="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 text-left flex items-center gap-2 cursor-pointer">
      <span class="flex-1 min-w-0 truncate">${esc(triggerLabel)}</span>
      <span class="text-slate-400 shrink-0">▾</span>
    </button></div>`
  }

  if (field.type === 'numberWithLookup') {
      const num = val ?? field.default ?? ''
      const companion = field.companionNameField ? step.params[field.companionNameField] : null
      const lookupConfig = LOOKUP_LINKS[field.lookupType]
      const idValue = step.params[field.name]
      const isNameSpecialFeaturesCard = (
        step.command === 'nameSpecialFeatures'
        && field.lookupType === 'dvdcompare'
      )
      let companionText = companion ?? ''
      let companionHref = lookupConfig?.homeUrl ?? '#'
      // For the nameSpecialFeatures card: the inline companion link
      // (movie name) targets DVDCompare's release page so clicking the
      // title opens the actual disc release. The right-side link
      // becomes "Open on TheMovieDB" — TMDB lookup is auxiliary, not
      // primary, since this command is DVDCompare-driven.
      let tmdbHref = ''
      let tmdbLabel = 'Open on TheMovieDB'
      if (isNameSpecialFeaturesCard) {
        // Movie name on the left → DVDCompare release URL when an ID
        // is set; falls back to the DVDCompare home page otherwise.
        if (idValue) {
          companionHref = lookupConfig.buildUrl(idValue, step.params)
        }
        // TMDB target on the right.
        if (step.params.tmdbId) {
          tmdbHref = `https://www.themoviedb.org/movie/${encodeURIComponent(step.params.tmdbId)}`
        } else if (step.params.tmdbResolutionPending) {
          tmdbHref = 'https://www.themoviedb.org/'
        } else if (companion) {
          const parsedDvdCompare = parseDvdCompareDisplayName(companion)
          const fallbackTitle = parsedDvdCompare?.baseTitle || step.params.searchTerm || null
          if (fallbackTitle) {
            const searchQuery = parsedDvdCompare?.year
              ? `${fallbackTitle} y:${parsedDvdCompare.year}`
              : fallbackTitle
            tmdbHref = `https://www.themoviedb.org/search/movie?query=${encodeURIComponent(searchQuery)}`
          } else {
            tmdbHref = 'https://www.themoviedb.org/'
          }
        } else {
          tmdbHref = 'https://www.themoviedb.org/'
        }
      } else if (lookupConfig && idValue) {
        companionHref = lookupConfig.buildUrl(idValue, step.params)
      }
      const companionLink = lookupConfig
        ? `<div class="flex-1 min-w-0 truncate"><a data-step="${step.id}" data-companion="${field.name}" href="${esc(companionHref)}" target="_blank" rel="noopener" class="text-xs text-blue-400 hover:text-blue-300 hover:underline ${companionText ? '' : 'hidden'}" title="${esc(companionText)}">${esc(companionText)}</a></div>`
        : `<p data-step="${step.id}" data-companion="${field.name}" class="flex-1 min-w-0 text-xs text-slate-500 truncate ${companionText ? '' : 'hidden'}" title="${esc(companionText)}">${esc(companionText)}</p>`
      let rightSideLink = ''
      if (isNameSpecialFeaturesCard) {
        rightSideLink = `<a data-step="${step.id}" data-right-link="${field.name}" href="${esc(tmdbHref)}" target="_blank" rel="noopener" class="shrink-0 text-xs text-blue-400 hover:text-blue-300 inline-flex items-center gap-1">↗ ${esc(tmdbLabel)}</a>`
      } else if (field.lookupType === 'dvdcompare' && lookupConfig) {
        const releaseHref = idValue
          ? lookupConfig.buildUrl(idValue, step.params)
          : lookupConfig.homeUrl
        rightSideLink = `<a data-step="${step.id}" data-right-link="${field.name}" href="${esc(releaseHref)}" target="_blank" rel="noopener" class="shrink-0 text-xs text-blue-400 hover:text-blue-300 inline-flex items-center gap-1">↗ ${esc(lookupConfig.label)}</a>`
      }
      return `<div>${label}<div class="flex items-center gap-2">
        <input type="number" data-step="${step.id}" data-field="${field.name}" value="${esc(num)}" placeholder="${esc(field.placeholder ?? '')}"
          oninput="setParam('${step.id}','${field.name}',this.value===''?undefined:Number(this.value)); scheduleReverseLookup('${step.id}','${field.name}',this.value); updateLookupLinks('${step.id}','${field.name}',this.value)"
          class="flex-1 min-w-0 bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500" />
        <button onclick="openLookup('${field.lookupType}','${step.id}','${field.name}')"
          title="Look up ${esc(field.label)}"
          class="shrink-0 text-xs bg-slate-700 hover:bg-blue-700 text-slate-200 hover:text-white px-2.5 py-1.5 rounded border border-slate-600 hover:border-blue-500">🔍</button>
      </div>
      <div class="flex items-start gap-2 mt-0.5">
        ${companionLink}
        ${rightSideLink}
      </div>
      </div>`
    }

    if (field.type === 'languageCode') {
      const str = val ?? ''
      return `<div>${label}<input type="text" value="${esc(str)}" placeholder="eng"
        oninput="setParam('${step.id}','${field.name}',this.value||undefined)"
        maxlength="3"
        class="w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono" /></div>`
    }

    if (field.type === 'languageCodes') {
      const str = Array.isArray(val) ? val.join(', ') : (val ?? '')
      return `<div>${label}<input type="text" value="${esc(str)}" placeholder="${esc(field.placeholder ?? 'eng, jpn')}"
        oninput="setParam('${step.id}','${field.name}',this.value.split(',').map(s=>s.trim()).filter(Boolean))"
        class="w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono" /></div>`
    }

    if (field.type === 'stringArray') {
      const str = Array.isArray(val) ? val.join(', ') : (val ?? '')
      return `<div>${label}<input type="text" value="${esc(str)}" placeholder="${esc(field.placeholder ?? '')}"
        oninput="setParam('${step.id}','${field.name}',this.value.split(',').map(s=>s.trim()).filter(Boolean))"
        class="w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono" /></div>`
    }

    if (field.type === 'numberArray') {
      const str = Array.isArray(val) ? val.join(', ') : (val ?? '')
      return `<div>${label}<input type="text" value="${esc(str)}" placeholder="${esc(field.placeholder ?? '0, 100')}"
        oninput="setParam('${step.id}','${field.name}',this.value.split(',').map(s=>s.trim()).filter(Boolean).map(Number).filter(n=>!isNaN(n)))"
        class="w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono" /></div>`
    }

    if (field.type === 'json') {
      const str = val !== undefined ? (typeof val === 'string' ? val : JSON.stringify(val, null, 2)) : ''
      const link = step.links?.[field.name]
      const isLinked = link && typeof link === 'object' && link.linkedTo
      const pickerHtml = field.linkable ? renderStepOutputPicker(step, field, stepIndex, link) : ''
      if (isLinked) {
        return `<div>${label}${pickerHtml}<div class="text-xs text-slate-400 bg-slate-900 rounded px-2 py-1.5 border border-slate-700 italic font-mono">Linked → ${esc(link.linkedTo)}.${esc(link.output ?? 'folder')}</div></div>`
      }
      return `<div>${label}${pickerHtml}<textarea rows="3" placeholder="${esc(field.placeholder ?? '[]')}"
        oninput="setParamJson('${step.id}','${field.name}',this.value)"
        class="w-full bg-slate-900 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono resize-y">${esc(str)}</textarea></div>`
    }

    // string
    const str = val ?? ''
    return `<div>${label}<input type="text" value="${esc(str)}" placeholder="${esc(field.placeholder ?? '')}"
      oninput="setParam('${step.id}','${field.name}',this.value||undefined)"
      class="w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500" /></div>`
}

// ─── Step-output link picker ──────────────────────────────────────────────────

function renderStepOutputPicker(step, field, stepIndex, link) {
  const isLinked = link && typeof link === 'object' && link.linkedTo
  const options = (
    flattenSteps()
    .slice(0, stepIndex)
    .map((entry) => entry.step)
    .filter((s) => s.command && Array.isArray(COMMANDS[s.command]?.outputs) && COMMANDS[s.command].outputs.length > 0)
    .flatMap((s) => (
      COMMANDS[s.command].outputs.map((out) => {
        const value = `step:${s.id}:${out.name}`
        const isSelected = isLinked && link.linkedTo === s.id && link.output === out.name
        const lbl = `Step (${esc(commandLabel(s.command))}) → ${esc(out.label ?? out.name)}`
        return `<option value="${value}"${isSelected ? ' selected' : ''}>${lbl}</option>`
      })
    ))
    .join('')
  )
  return `<div class="flex items-center gap-2 mb-1">
    <span class="text-xs text-slate-500 shrink-0">Link to:</span>
    <select onchange="setLink('${step.id}','${field.name}',this.value)"
      class="text-xs bg-slate-700 text-slate-300 rounded px-1.5 py-0.5 border border-slate-600 focus:outline-none focus:border-blue-500 max-w-[280px] truncate">
      <option value=""${!isLinked ? ' selected' : ''}>— custom —</option>
      ${options}
    </select>
  </div>`
}

// ─── Path field renderer ──────────────────────────────────────────────────────

function describeLinkTarget(step, fieldName) {
  const link = step.links?.[fieldName]
  if (!link) return { label: '— custom —' }
  if (typeof link === 'string') {
    const pathVar = paths.find((candidate) => candidate.id === link)
    if (!pathVar) return { label: '(missing path)' }
    return { label: pathVar.label || pathVar.value || 'path variable', pathVarId: pathVar.id }
  }
  if (typeof link === 'object' && link.linkedTo) {
    // Import flattenSteps inline to avoid circular dep issues at render time
    const flatOrder = flattenSteps()
    const sourceLocation = flatOrder.find((e) => e.step.id === link.linkedTo) ?? null
    if (!sourceLocation) return { label: '(missing step)' }
    return {
      label: `Step ${sourceLocation.flatIndex + 1}: ${commandLabel(sourceLocation.step.command) || '?'}`,
      sourceStepId: sourceLocation.step.id,
    }
  }
  return { label: '— custom —' }
}

function renderPathField(step, field, stepIndex) {
  const val = step.params[field.name] ?? ''
  const link = step.links[field.name]
  const computed = link ? (getLinkedValue(step, field.name) ?? '') : null
  const target = describeLinkTarget(step, field.name)
  const triggerData = [
    `data-step="${step.id}"`,
    `data-field="${field.name}"`,
    target.pathVarId ? `data-pv-id="${target.pathVarId}"` : '',
    target.sourceStepId ? `data-linked-step="${target.sourceStepId}"` : '',
  ].filter(Boolean).join(' ')
  const browsePathArg = JSON.stringify(computed ?? val).replace(/"/g, '&quot;')
  const tooltipKey = `${step.command}:${field.name}`
  return `<div>
    <div class="flex items-center gap-2 mb-1">
      <label class="text-xs text-slate-400 cursor-help" data-tooltip-key="${esc(tooltipKey)}">${esc(field.label)}${field.required ? ' <span class="text-red-400">*</span>' : ''}</label>
      <button type="button" onclick="browsePathField('${step.id}','${field.name}',${browsePathArg})"
        title="Browse to pick a folder for this field"
        class="ml-auto text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded px-1.5 py-0.5 border border-slate-600 focus:outline-none focus:border-blue-500 cursor-pointer">📁</button>
      <button type="button" onclick="linkPicker.open({stepId: '${step.id}', fieldName: '${field.name}'}, this)" data-link-picker-trigger ${triggerData}
        class="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded px-1.5 py-0.5 border border-slate-600 focus:outline-none focus:border-blue-500 min-w-0 max-w-full flex items-center gap-1 cursor-pointer">
        <span class="truncate" data-link-trigger-label>${esc(target.label)}</span>
        <span class="text-slate-400 shrink-0">▾</span>
      </button>
    </div>
    <input type="text" value="${esc(computed ?? val)}" ${(link && typeof link === 'object' && link.linkedTo) ? 'readonly' : ''}
      data-step="${step.id}" data-field="${field.name}"
      class="${computed !== null ? 'linked-input' : 'manual-input'} w-full bg-slate-${computed !== null ? '900' : '700'} text-slate-${computed !== null ? '400' : '200'} text-xs rounded px-2 py-1.5 border border-slate-${computed !== null ? '700' : '600'} focus:outline-none focus:border-blue-500 font-mono"
      oninput="onPathFieldInput(this,'${step.id}','${field.name}',this.value)" onkeydown="pathPickerKeydown(event)" onfocus="onPathFieldFocus(this,'${step.id}','${field.name}',this.value)" onblur="onPathFieldBlur(this,'${step.id}','${field.name}',this.value)" onchange="promotePathToPathVar('${step.id}','${field.name}',this.value)" />
    ${computed !== null && (link && typeof link === 'object' && link.linkedTo) ? `<input type="text" value="${esc(val)}" data-step="${step.id}" data-field="${field.name}" class="manual-input hidden w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono" oninput="onPathFieldInput(this,'${step.id}','${field.name}',this.value)" onkeydown="pathPickerKeydown(event)" onfocus="onPathFieldFocus(this,'${step.id}','${field.name}',this.value)" onblur="onPathFieldBlur(this,'${step.id}','${field.name}',this.value)" onchange="promotePathToPathVar('${step.id}','${field.name}',this.value)" />` : ''}
  </div>`
}

// ─── LOOKUP_LINKS (needed by renderFields for numberWithLookup) ───────────────
// This data also lives in lookup-modal.js; the renderer needs it to build
// the href on the companion anchor. Centralise it here and re-export.

export const LOOKUP_LINKS = {
  mal: {
    label: 'open on MyAnimeList',
    homeUrl: 'https://myanimelist.net/',
    buildUrl: (id) => `https://myanimelist.net/anime/${id}`,
  },
  anidb: {
    label: 'open on AniDB',
    homeUrl: 'https://anidb.net/',
    buildUrl: (id) => `https://anidb.net/anime/${id}`,
  },
  tvdb: {
    label: 'open on TVDB',
    homeUrl: 'https://thetvdb.com/',
    buildUrl: (id) => `https://thetvdb.com/?tab=series&id=${id}`,
  },
  dvdcompare: {
    label: 'open release on DVDCompare',
    homeUrl: 'https://www.dvdcompare.net/',
    buildUrl: (id, params) => (
      `https://www.dvdcompare.net/comparisons/film.php?fid=${id}#${params?.dvdCompareReleaseHash ?? 1}`
    ),
  },
}

// Needed by renderFields for numberWithLookup (nameSpecialFeatures branch)
function parseDvdCompareDisplayName(displayName) {
  if (!displayName) return null
  const yearMatch = displayName.match(/\s*\((\d{4})\)\s*$/)
  const withoutYear = yearMatch
    ? displayName.slice(0, yearMatch.index).trim()
    : displayName.trim()
  const variantMatch = withoutYear.match(/\s*\((?:UHD Blu-ray|Blu-ray 4K|Blu-ray|DVD)\)\s*$/i)
  const baseTitle = variantMatch
    ? withoutYear.slice(0, variantMatch.index).trim()
    : withoutYear
  return { baseTitle, year: yearMatch?.[1] || '' }
}
