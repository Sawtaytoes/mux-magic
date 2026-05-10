/**
 * @param {{ isCollapsed: boolean }} props
 * @returns {string}
 */
export function renderCollapseChevron({ isCollapsed }) {
  const rotateClass = isCollapsed ? "-rotate-90" : ""
  return `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5 transition-transform ${rotateClass}">
    <polyline points="5,8 10,13 15,8" />
  </svg>`
}
