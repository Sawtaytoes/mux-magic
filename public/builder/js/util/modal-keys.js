// Shared Esc-to-close handler for the builder's centered modals.
// Until now, only the YAML view modal had any close affordance and it
// was backdrop-click only — no keyboard. The new load modal makes Esc
// a hard requirement (the modal has no Cancel button), so we
// generalize: one document-level keydown listener finds whichever
// modal is currently visible and closes it.
//
// Modal IDs are listed in *priority order*: the load modal closes
// first if multiple are somehow visible simultaneously (shouldn't
// happen, but the fallback is deterministic). The load modal is
// special-cased to route through closeLoadModal so its paste-listener
// detach runs in one place; the other modals just hide via class
// toggle since they have no side effects on close.

const MODAL_IDS_IN_PRIORITY_ORDER = ['load-modal', 'yaml-modal', 'api-run-modal']

function findVisibleModalId() {
  return MODAL_IDS_IN_PRIORITY_ORDER.find((id) => {
    const element = document.getElementById(id)
    return element && !element.classList.contains('hidden')
  }) ?? null
}

// Guard against double-attach: main.js calls this once at startup,
// but tests may exercise it across cases that share the same document.
// Without the flag, a second call piles a second listener on the
// document and Esc starts firing twice.
let isAttached = false

export function attachModalEscapeListener() {
  if (isAttached) {
    return
  }
  isAttached = true
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') {
      return
    }
    const openModalId = findVisibleModalId()
    if (!openModalId) {
      return
    }
    if (openModalId === 'load-modal') {
      window.mediaTools.closeLoadModal()
      return
    }
    document.getElementById(openModalId).classList.add('hidden')
  })
}
