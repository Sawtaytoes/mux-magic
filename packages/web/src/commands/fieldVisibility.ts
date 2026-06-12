import type { CommandField } from "../commands/types"

export const isFieldVisible = (
  visibleWhen: CommandField["visibleWhen"],
  params: Record<string, unknown> | undefined,
) => {
  if (!visibleWhen) return true
  return (
    params?.[visibleWhen.fieldName as string] ===
    visibleWhen.value
  )
}
