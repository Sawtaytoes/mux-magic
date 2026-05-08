// ─── renderAll ────────────────────────────────────────────────────────────────
//
// The main rendering orchestrator. Rebuilds #steps-el innerHTML from the
// current in-memory state and re-attaches Sortable instances + progress bars.

import { steps, paths, flattenSteps, isGroup, initPaths } from './sequence-state.js'
import { renderInsertDivider, renderSequenceEndCard, renderStep, renderStepCompact, renderGroup, isDrawerMode } from './step-renderer.js'

// Per-step ProgressEvent snapshot. Keyed by stepId. Cleared on done /
// step-finished / cancel via unmountStepCardProgress.
const progressByStepId = new Map()

export function mountStepCardProgress(stepId) {
  const card = document.getElementById(`step-${stepId}`)
  if (!card) return
  if (card.querySelector(':scope > [data-step-progress]')) return
  const header = card.firstElementChild
  if (!header) return
  const host = document.createElement('div')
  host.dataset.stepProgress = stepId
  host.className = 'px-3 py-2 border-b border-slate-700 bg-slate-800/40'
  host.append(window.ProgressUtils.createProgressRow())
  header.insertAdjacentElement('afterend', host)
}

export function paintStepCardProgress(stepId) {
  const card = document.getElementById(`step-${stepId}`)
  if (!card) return
  const host = card.querySelector('[data-step-progress]')
  if (!host) return
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
  if (!card) return
  const host = card.querySelector('[data-step-progress]')
  host?.remove()
}

let lastRenderedStepIds = new Set()

export function renderAll() {
  initPaths()
  const el = document.getElementById('steps-el')
  const parts = []

  paths.forEach((pv, i) => parts.push(window.mediaTools.renderPathVarCard(pv, i === 0)))

  if (!steps.length) {
    parts.push(`<div class="flex flex-col items-center gap-2 mt-4">
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
    </div>`)
  } else {
    const drawerMode = isDrawerMode()
    parts.push(renderInsertDivider(0))
    let flatStepIndex = 0
    steps.forEach((item, itemIndex) => {
      if (isGroup(item)) {
        parts.push(renderGroup(item, itemIndex, flatStepIndex))
        flatStepIndex += item.steps.length
      } else {
        parts.push(
          drawerMode
            ? renderStepCompact(item, flatStepIndex)
            : renderStep(item, flatStepIndex)
        )
        flatStepIndex += 1
      }
      parts.push(renderInsertDivider(itemIndex + 1))
    })
    parts.push(renderSequenceEndCard())
  }

  const previousIds = lastRenderedStepIds
  // Capture focus snapshot before innerHTML swap
  const activeEl = document.activeElement
  const focusSnapshot = (
    activeEl
    && activeEl.tagName === 'INPUT'
    && activeEl.dataset?.step
    && activeEl.dataset?.field
  )
    ? {
        step: activeEl.dataset.step,
        field: activeEl.dataset.field,
        selectionStart: (() => { try { return activeEl.selectionStart } catch { return null } })(),
        selectionEnd: (() => { try { return activeEl.selectionEnd } catch { return null } })(),
      }
    : null

  el.innerHTML = parts.join('')

  // Fade-in animation for newly inserted step cards
  const allFlatSteps = flattenSteps()
  for (const entry of allFlatSteps) {
    if (!previousIds.has(entry.step.id)) {
      const card = document.getElementById(`step-${entry.step.id}`)
      if (card) card.classList.add('step-enter')
    }
  }
  lastRenderedStepIds = new Set(allFlatSteps.map((e) => e.step.id))

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
    const openId = window.getOpenStepId?.()
    if (openId) window.openStepDrawer?.(openId)
  }

  // Re-mount per-step progress bars after innerHTML swap
  progressByStepId.forEach((_, stepId) => {
    mountStepCardProgress(stepId)
    paintStepCardProgress(stepId)
  })

  window.mediaTools.updateYaml()
  window.mediaTools.updateUrl()
}
