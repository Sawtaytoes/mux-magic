// ─── renderAll ────────────────────────────────────────────────────────────────
//
// The main rendering orchestrator. Rebuilds #steps-el innerHTML from the
// current in-memory state and re-attaches Sortable instances + progress bars.

import { steps, paths, flattenSteps, isGroup, initPaths } from './sequence-state.js'
import { renderInsertDivider, renderSequenceEndCard, renderGroupCard, renderStepCard, renderStepCompactCard, isDrawerMode } from './step-renderer.js'

// Per-step ProgressEvent snapshot. Keyed by stepId. Cleared on done /
// step-finished / cancel via unmountStepCardProgress.
const progressByStepId = new Map()

export function mountStepCardProgress(stepId) {
  const card = document.getElementById(`step-${stepId}`)
  if (!card) {
    return
  }
  if (card.querySelector(':scope > [data-step-progress]')) {
    return
  }
  const header = card.firstElementChild
  if (!header) {
    return
  }
  const host = document.createElement('div')
  host.dataset.stepProgress = stepId
  host.className = 'px-3 py-2 border-b border-slate-700 bg-slate-800/40'
  host.append(window.ProgressUtils.createProgressRow())
  header.insertAdjacentElement('afterend', host)
}

export function paintStepCardProgress(stepId) {
  const card = document.getElementById(`step-${stepId}`)
  if (!card) {
    return
  }
  const host = card.querySelector('[data-step-progress]')
  if (!host) {
    return
  }
  window.ProgressUtils.paintProgressBar(host, progressByStepId.get(stepId))
}

export function handleStepCardProgressEvent(stepId, event) {
  progressByStepId.set(stepId, window.ProgressUtils.mergeProgress(progressByStepId.get(stepId), event))
  mountStepCardProgress(stepId)
  paintStepCardProgress(stepId)
}

export function unmountStepCardProgress(stepId) {
  progressByStepId.delete(stepId)
  const card = document.getElementById(`step-${stepId}`)
  if (!card) {
    return
  }
  const host = card.querySelector('[data-step-progress]')
  host?.remove()
}

const lastRenderedStepIds = { current: new Set() }

function buildStepsHtmlParts() {
  if (!steps.length) {
    return [`<div class="flex flex-col items-center gap-2 mt-4">
      <p class="text-slate-500 text-xs">No steps yet.</p>
      <div class="flex items-center gap-2">
        <button onclick="addPicked()" class="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2 rounded font-medium">
          + Add your first step
        </button>
        <button onclick="pasteCardAt({itemIndex: 0}, this)" title="Paste a copied step or group"
          class="text-xs text-slate-300 hover:text-emerald-400 px-4 py-2 rounded font-medium border border-slate-700 hover:border-emerald-500/40">
          📋 Paste
        </button>
      </div>
    </div>`]
  }
  const isDrawerModeOn = isDrawerMode()
  const { parts: stepParts } = steps.reduce((accumulator, item, itemIndex) => {
    if (isGroup(item)) {
      accumulator.parts.push(renderGroupCard({
        group: item,
        itemIndex,
        startingFlatIndex: accumulator.flatStepIndex,
        renderStep: (step, index, context) => renderStepCard({ step, index, context }),
      }))
      accumulator.flatStepIndex += item.steps.length
    } else {
      accumulator.parts.push(
        isDrawerModeOn
          ? renderStepCompactCard({ step: item, index: accumulator.flatStepIndex })
          : renderStepCard({ step: item, index: accumulator.flatStepIndex })
      )
      accumulator.flatStepIndex += 1
    }
    accumulator.parts.push(renderInsertDivider({ index: itemIndex + 1 }))
    return accumulator
  }, { parts: [renderInsertDivider({ index: 0 })], flatStepIndex: 0 })
  stepParts.push(renderSequenceEndCard())
  return stepParts
}

function captureFocusSnapshot() {
  const activeElement = document.activeElement
  const isCapturable = (
    activeElement
    && activeElement.tagName === 'INPUT'
    && activeElement.dataset?.step
    && activeElement.dataset?.field
  )
  if (!isCapturable) {
    return null
  }
  const safeSelectionStart = (() => {
    try {
      return activeElement.selectionStart
    } catch {
      return null
    }
  })()
  const safeSelectionEnd = (() => {
    try {
      return activeElement.selectionEnd
    } catch {
      return null
    }
  })()
  return {
    step: activeElement.dataset.step,
    field: activeElement.dataset.field,
    selectionStart: safeSelectionStart,
    selectionEnd: safeSelectionEnd,
  }
}

export function renderAll() {
  initPaths()
  const stepsContainer = document.getElementById('steps-el')
  const pathParts = paths.map((pathVar, pathIndex) => (
    window.mediaTools.renderPathVarCard(pathVar, pathIndex === 0)
  ))
  const parts = pathParts.concat(buildStepsHtmlParts())

  const previousIds = lastRenderedStepIds.current
  const focusSnapshot = captureFocusSnapshot()

  stepsContainer.innerHTML = parts.join('')

  // Fade-in animation for newly inserted step cards
  const allFlatSteps = flattenSteps()
  allFlatSteps.forEach((entry) => {
    if (!previousIds.has(entry.step.id)) {
      const card = document.getElementById(`step-${entry.step.id}`)
      if (card) {
        card.classList.add('step-enter')
      }
    }
  })
  lastRenderedStepIds.current = new Set(allFlatSteps.map((entry) => entry.step.id))

  // Restore focus
  if (focusSnapshot) {
    const restoredInput = document.querySelector(
      `input[data-step="${focusSnapshot.step}"][data-field="${focusSnapshot.field}"]`,
    )
    if (restoredInput) {
      restoredInput.focus()
      if (focusSnapshot.selectionStart !== null) {
        try {
          restoredInput.setSelectionRange(focusSnapshot.selectionStart, focusSnapshot.selectionEnd)
        } catch {}
      }
    }
  }

  // Re-attach Sortable instances
  window.mediaTools.attachSortables?.()

  // In drawer-experiment mode: if a drawer is open, refresh its content so
  // param changes (e.g. from linked inputs) are reflected live.
  if (isDrawerMode()) {
    const openStepId = window.getOpenStepId?.()
    if (openStepId) {
      window.openStepDrawer?.(openStepId)
    }
  }

  // Re-mount per-step progress bars after innerHTML swap
  progressByStepId.forEach((_, stepId) => {
    mountStepCardProgress(stepId)
    paintStepCardProgress(stepId)
  })

  window.mediaTools.updateYaml()
  window.mediaTools.updateUrl()
}
