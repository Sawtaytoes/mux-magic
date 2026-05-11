import type { CommandField } from "../types"

export const isFieldVisible = (
  visibleWhen: CommandField["visibleWhen"],
  params: Record<string, unknown> | undefined,
): boolean => {
  if (!visibleWhen) return true
  return (
    params?.[visibleWhen.fieldName as string] ===
    visibleWhen.value
  )
}
