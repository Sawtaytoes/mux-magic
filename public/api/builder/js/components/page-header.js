// Page-header behavior: the two responsive popover menus
// (#page-actions-nav, #page-actions-controls), their open/close
// toggles, click-outside dismissal, and the global Esc handler that
// also closes any open application modals.
//
// Header markup itself stays in index.html. This module wires the
// behavior — header buttons that previously called inline functions
// keep working through the existing forwarders; the one button that
// reached into window.mediaTools directly (Add Path) becomes a
// delegated [data-action] click here.

const bridge = () => window.mediaTools

// ─── Menu toggle ─────────────────────────────────────────────────────────────

// Toggle one of the two page-header popovers (#page-actions-nav,
// #page-actions-controls). Only one is open at a time — clicking the
// other toggle closes the first. Only meaningful at viewport widths
// < 900px; at wider widths the toggle buttons are hidden via CSS, so a
// stale .open class is harmless.
export function togglePageMenu(menuId) {
  const target = document.getElementById(menuId)
  if (!target) return
  const wasOpen = target.classList.contains('open')
  closeAllPageMenus()
  if (!wasOpen) target.classList.add('open')
}

function closeAllPageMenus() {
  document.querySelectorAll('.page-menu.open').forEach((menu) => menu.classList.remove('open'))
}

// ─── Listeners ───────────────────────────────────────────────────────────────

// Bound once at startup. Three concerns:
//   1. Header-scoped [data-action] clicks (currently just `add-path`,
//      which previously was an inline `onclick="window.mediaTools.addPath()"`).
//   2. Document-level click-outside that dismisses any open page-menu
//      popover. Skips clicks on the toggles (their own onclick already
//      toggles state) and clicks on the popover contents (so users can
//      hit a button inside without the popover dismissing first).
//   3. Document-level Esc that closes the YAML modal, the API-run
//      modal, and any open page-menu. The modal close calls go through
//      the bridge — yaml-modal owns closeYamlModal, api-run-modal
//      (still inline) exposes closeApiRunModal via the outbound bridge.
export function attachPageHeaderListeners() {
  const header = document.getElementById('page-header')
  if (header) {
    header.addEventListener('click', (event) => {
      const button = event.target.closest?.('[data-action]')
      if (!button || !header.contains(button)) return
      if (button.dataset.action === 'add-path') {
        bridge().addPath()
      }
    })
  }

  document.addEventListener('click', (event) => {
    const openMenus = document.querySelectorAll('.page-menu.open')
    if (!openMenus.length) return
    const navToggle = document.getElementById('page-nav-toggle')
    const controlsToggle = document.getElementById('page-controls-toggle')
    if (navToggle?.contains(event.target) || controlsToggle?.contains(event.target)) return
    for (const menu of openMenus) {
      if (menu.contains(event.target)) return
    }
    closeAllPageMenus()
  })

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    bridge().closeYamlModal()
    bridge().closeApiRunModal()
    closeAllPageMenus()
  })
}
