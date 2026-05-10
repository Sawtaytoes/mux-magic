import { flattenSteps, paths } from "../sequence-state.js"
import { commandLabel } from "./command-label.js"

/**
 * @param {object} step
 * @param {string} fieldName
 * @returns {{ label: string, pathVarId?: string, sourceStepId?: string }}
 */
export function describeLinkTarget(step, fieldName) {
  const link = step.links?.[fieldName]
  if (!link) return { label: "— custom —" }
  if (typeof link === "string") {
    const pathVar = paths.find(
      (candidate) => candidate.id === link,
    )
    if (!pathVar) return { label: "(missing path)" }
    return {
      label:
        pathVar.label || pathVar.value || "path variable",
      pathVarId: pathVar.id,
    }
  }
  if (typeof link === "object" && link.linkedTo) {
    const flatOrder = flattenSteps()
    const sourceLocation =
      flatOrder.find((e) => e.step.id === link.linkedTo) ??
      null
    if (!sourceLocation) return { label: "(missing step)" }
    return {
      label: `Step ${sourceLocation.flatIndex + 1}: ${commandLabel(sourceLocation.step.command) || "?"}`,
      sourceStepId: sourceLocation.step.id,
    }
  }
  return { label: "— custom —" }
}
