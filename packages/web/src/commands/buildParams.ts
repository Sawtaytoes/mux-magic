import type { CommandDefinition, Step } from "../types"

// ─── buildParams ──────────────────────────────────────────────────────────────
// Ported verbatim from scripts/capture-parity-fixtures.ts (which was ported
// from sequence-editor.js ~line 723). The capture script validated this
// implementation against all 36 parity fixtures — do not diverge.

export const buildParams = (
  step: Step,
  commandDefinition: CommandDefinition,
): Record<string, unknown> => {
  const result: Record<string, unknown> = {}

  commandDefinition.fields.forEach((field) => {
    const baseValue = step.params[field.name]
    const link = step.links?.[field.name]
    const resolvedValue = (() => {
      if (!link) {
        return baseValue
      }
      if (typeof link === "string") {
        return `@${link}`
      }
      if (
        link &&
        typeof link === "object" &&
        typeof (link as { linkedTo: string }).linkedTo ===
          "string"
      ) {
        return {
          linkedTo: (
            link as { linkedTo: string; output: string }
          ).linkedTo,
          output:
            (link as { linkedTo: string; output: string })
              .output || "folder",
        }
      }
      return baseValue
    })()

    const skipPrimary =
      resolvedValue === undefined ||
      resolvedValue === null ||
      resolvedValue === "" ||
      (Array.isArray(resolvedValue) &&
        resolvedValue.length === 0) ||
      (!field.required &&
        field.default !== undefined &&
        resolvedValue === field.default)

    if (!skipPrimary) {
      result[field.name] = resolvedValue
    }

    if (field.companionNameField) {
      const companionValue =
        step.params[field.companionNameField]
      if (
        companionValue !== undefined &&
        companionValue !== null &&
        companionValue !== ""
      ) {
        result[field.companionNameField] = companionValue
      }
    }
  })

  if (Array.isArray(commandDefinition.persistedKeys)) {
    commandDefinition.persistedKeys.forEach(
      (persistedKey) => {
        const persistedValue = step.params[persistedKey]
        if (
          persistedValue !== undefined &&
          persistedValue !== null &&
          persistedValue !== ""
        ) {
          result[persistedKey] = persistedValue
        }
      },
    )
  }

  return result
}
