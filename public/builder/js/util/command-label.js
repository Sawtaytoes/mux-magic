/**
 * @param {string} name
 * @returns {string}
 */
export function commandLabel(name) {
  return typeof window.commandLabel === 'function' ? window.commandLabel(name) : name
}
