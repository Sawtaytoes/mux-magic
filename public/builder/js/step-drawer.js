// ─── Step drawer (sidebar / bottom-sheet) ─────────────────────────────────────
//
// Experiment: opt-in via localStorage.useDrawerStepCards = 'true'.
//
// Wide screens (>= 640px): slides in from the right as a fixed sidebar.
// Narrow screens (< 640px): slides up from the bottom as a sheet.
//
// One drawer at a time — opening another step swaps content in place.
// Closes via: close button, Escape key, or click on the backdrop.
// Does NOT close on backdrop click while the user interacts with a form
// input or a picker popover (checked via document.activeElement).

import { COMMANDS } from './commands.js'
import { flattenSteps } from './sequence-state.js'
import { renderFields, esc } from './step-renderer.js'

// commandLabel is injected by /command-labels.js as a global script.
const commandLabel = (name) =>
  typeof window.commandLabel === 'function' ? window.commandLabel(name) : name

// ─── State ────────────────────────────────────────────────────────────────────

let _openStepId = null
let _drawerEl = null
let _backdropEl = null
let _pointerDownOnBackdrop = false

// ─── DOM bootstrap ────────────────────────────────────────────────────────────

function ensureDrawerDOM() {
  if (_drawerEl) {
    return
  }

  // Backdrop
  _backdropEl = document.createElement('div')
  _backdropEl.id = 'step-drawer-backdrop'
  _backdropEl.className = 'step-drawer-backdrop'
  _backdropEl.setAttribute('aria-hidden', 'true')

  // Track pointer-down on backdrop separately so we can ignore drags that
  // start outside and land on the backdrop (e.g. resizing a textarea).
  _backdropEl.addEventListener('pointerdown', () => {
    _pointerDownOnBackdrop = true
  })
  _backdropEl.addEventListener('pointerup', () => {
    if (_pointerDownOnBackdrop) {
      _pointerDownOnBackdrop = false
      _maybeCloseOnBackdropClick()
    }
  })
  _backdropEl.addEventListener('pointercancel', () => {
    _pointerDownOnBackdrop = false
  })

  // Drawer panel
  _drawerEl = document.createElement('div')
  _drawerEl.id = 'step-drawer'
  _drawerEl.className = 'step-drawer'
  _drawerEl.setAttribute('role', 'complementary')
  _drawerEl.setAttribute('aria-label', 'Step details')

  document.body.appendChild(_backdropEl)
  document.body.appendChild(_drawerEl)
}

function _maybeCloseOnBackdropClick() {
  // Don't close if focus is inside a form input or picker popover.
  const activeElement = document.activeElement
  const isFocusInsideInteractive = activeElement && (
    activeElement.tagName === 'INPUT' ||
    activeElement.tagName === 'TEXTAREA' ||
    activeElement.tagName === 'SELECT' ||
    (activeElement.closest?.('.hidden') === null && activeElement.closest?.('[id$="-popover"]'))
  )
  if (isFocusInsideInteractive) {
    return
  }
  closeStepDrawer()
}

// ─── Escape key handler ───────────────────────────────────────────────────────

function _onKeydown(event) {
  if (event.key === 'Escape' && _openStepId !== null) {
    // Only close if no picker/modal is open above us (they have higher z-index
    // and handle Escape themselves; we check for open modals as a safety net).
    const openModal = document.querySelector(
      '.fixed.z-50:not(.hidden), .fixed.z-\\[60\\]:not(.hidden)'
    )
    if (!openModal) {
      closeStepDrawer()
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function openStepDrawer(stepId) {
  ensureDrawerDOM()

  _openStepId = stepId

  // Find step in flat list
  const allFlatSteps = flattenSteps()
  const entry = allFlatSteps.find((flatEntry) => flatEntry.step.id === stepId)
  if (!entry) {
    closeStepDrawer()
    return
  }

  const { step, flatIndex } = entry

  _drawerEl.innerHTML = _renderDrawerContent(step, flatIndex)
  _drawerEl.classList.add('open')
  _backdropEl.classList.add('open')

  // Focus the close button for keyboard users
  _drawerEl.querySelector('.step-drawer-close')?.focus()

  // Attach Escape once
  document.removeEventListener('keydown', _onKeydown)
  document.addEventListener('keydown', _onKeydown)
}

export function closeStepDrawer() {
  if (!_drawerEl) {
    return
  }
  _openStepId = null
  _drawerEl.classList.remove('open')
  _backdropEl.classList.remove('open')
  document.removeEventListener('keydown', _onKeydown)
}

export function getOpenStepId() {
  return _openStepId
}

// ─── Drawer content renderer ──────────────────────────────────────────────────

function _renderDrawerContent(step, flatIndex) {
  const commandDefinition = step.command ? COMMANDS[step.command] : null
  const operationLabel = step.command ? commandLabel(step.command) : '— none —'
  const alias = step.alias || step.command || 'Unnamed Step'

  const summaryHtml = commandDefinition
    ? `<p class="text-xs text-slate-400 mb-2">${esc(commandDefinition.summary)}</p>
       ${commandDefinition.note ? `<p class="text-xs text-amber-300 bg-amber-950/40 border border-amber-800/50 rounded px-2 py-1 mb-2">${esc(commandDefinition.note)}</p>` : ''}
       ${commandDefinition.outputFolderName ? `<p class="text-xs text-amber-500/80 mb-2">→ outputs to <code class="text-amber-400 bg-slate-900 px-1 rounded">${esc(commandDefinition.outputFolderName)}/</code> subfolder</p>` : ''}`
    : ''

  const errorHtml = step.error
    ? `<p class="text-xs text-red-400 bg-red-950/40 rounded px-2 py-1 mb-2 font-mono">${esc(step.error)}</p>`
    : ''

  const fieldsHtml = commandDefinition
    ? `<div class="space-y-2">${renderFields(step, flatIndex)}</div>`
    : `<p class="text-xs text-slate-500 italic">No command selected — choose one from the dropdown.</p>`

  return `
<div class="step-drawer-inner flex flex-col h-full">
  <!-- Header -->
  <div class="shrink-0 flex items-start justify-between gap-3 px-4 py-3 border-b border-slate-700">
    <div class="min-w-0">
      <p class="text-xs font-mono text-slate-500 mb-0.5">Step ${flatIndex + 1}</p>
      <h2 class="text-sm font-semibold text-slate-100 truncate">${esc(alias)}</h2>
      <p class="text-xs text-slate-400 mt-0.5">${esc(operationLabel)}</p>
    </div>
    <button class="step-drawer-close shrink-0 w-7 h-7 flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-slate-700 text-base leading-none"
      onclick="closeStepDrawer()" title="Close (Esc)">✕</button>
  </div>

  <!-- Alias editor -->
  <div class="shrink-0 px-4 py-2 border-b border-slate-700/50">
    <label class="block text-xs text-slate-500 mb-1">Alias</label>
    <input type="text" value="${esc(step.alias)}"
      placeholder="${esc(step.command || 'Click to name this step')}"
      data-step-alias="${step.id}"
      onfocus="stepAliasFocus(this)"
      onkeydown="stepAliasKeydown(event,'${step.id}')"
      onblur="stepAliasBlur(this,'${step.id}')"
      class="w-full bg-slate-700 text-sm font-medium text-slate-200 px-2 py-1.5 rounded border border-slate-600 focus:outline-none focus:border-blue-500 placeholder:text-slate-400" />
  </div>

  <!-- Command picker -->
  <div class="shrink-0 px-4 py-2 border-b border-slate-700/50">
    <label class="block text-xs text-slate-500 mb-1">Command</label>
    <button onclick="commandPicker.open({stepId: '${step.id}'}, this)" data-cmd-picker-trigger
      class="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 text-left flex items-center gap-2 cursor-pointer">
      <span class="flex-1 min-w-0 truncate">${step.command ? esc(operationLabel) : '<span class="text-slate-400 italic">— pick a command —</span>'}</span>
      <span class="text-slate-400 shrink-0">▾</span>
    </button>
  </div>

  <!-- Scrollable params body -->
  <div class="flex-1 overflow-y-auto px-4 py-3">
    ${summaryHtml}
    ${errorHtml}
    ${fieldsHtml}
  </div>

  <!-- Footer actions -->
  <div class="shrink-0 flex items-center gap-2 px-4 py-2 border-t border-slate-700 bg-slate-900/60">
    <button onclick="runOrStopStep('${step.id}')" ${step.command ? '' : 'disabled'}
      title="${step.status === 'running' && step.jobId ? 'Cancel this step' : 'Run this step only'}"
      data-step-run-stop="${step.id}"
      class="step-run-stop ${step.status === 'running' && step.jobId ? 'is-running' : ''}">
      <span class="step-run-stop-icon step-run-stop-play">▶</span>
      <span class="step-run-stop-icon step-run-stop-stop">⏹</span>
    </button>
    <button onclick="copyStepYaml('${step.id}', this)" title="Copy YAML"
      class="text-xs text-slate-400 hover:text-emerald-400 px-2 py-1 rounded border border-slate-700 hover:border-emerald-500/40">Copy YAML</button>
    <button onclick="removeStep('${step.id}'); closeStepDrawer()"
      class="ml-auto text-xs text-slate-500 hover:text-red-400 px-2 py-1 rounded border border-slate-700 hover:border-red-500/40">Delete step</button>
  </div>
</div>`
}
