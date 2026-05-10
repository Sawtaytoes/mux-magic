/**
 * @param {{ isCollapsed: boolean }} props
 * @returns {string}
 */
export function renderDoubleChevron({ isCollapsed }) {
  const rotateClass = isCollapsed ? "-rotate-90" : ""
  return `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5 transition-transform ${rotateClass}">
    <polyline points="5,5 10,10 15,5" />
    <polyline points="5,11 10,16 15,11" />
  </svg>`
}
