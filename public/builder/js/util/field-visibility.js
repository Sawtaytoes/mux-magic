/**
 * @param {{ fieldName: string, value: unknown } | undefined} visibleWhen
 * @param {Record<string, unknown> | undefined} params
 * @returns {boolean}
 */
export function isFieldVisible(visibleWhen, params) {
  if (!visibleWhen) return true
  return (
    params?.[visibleWhen.fieldName] === visibleWhen.value
  )
}
