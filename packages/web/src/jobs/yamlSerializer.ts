import { dump } from "js-yaml"
import type {
  Group,
  PathVar,
  SequenceItem,
  Step,
} from "../types"

const isGroup = (item: SequenceItem): item is Group =>
  !!(
    item &&
    typeof item === "object" &&
    "kind" in item &&
    item.kind === "group"
  )

// During the transition, buildParams lives in legacy sequence-editor.js.
// We call it through the bridge; fall back to step.params if not yet wired.
const buildParamsForStep = (
  step: Step,
): Record<string, unknown> =>
  typeof window.mediaTools?.buildParams === "function"
    ? (window.mediaTools.buildParams(step) as Record<
        string,
        unknown
      >)
    : step.params

const stepToYaml = (step: Step) => ({
  id: step.id,
  ...(step.alias ? { alias: step.alias } : {}),
  command: step.command,
  params: buildParamsForStep(step),
  ...(step.isCollapsed ? { isCollapsed: true } : {}),
})

const groupToYaml = (group: Group) => ({
  kind: "group" as const,
  ...(group.id ? { id: group.id } : {}),
  ...(group.label ? { label: group.label } : {}),
  ...(group.isParallel ? { isParallel: true } : {}),
  ...(group.isCollapsed ? { isCollapsed: true } : {}),
  steps: group.steps
    .filter((step) => step.command !== null)
    .map(stepToYaml),
})

const hasContent = (item: SequenceItem): boolean =>
  isGroup(item)
    ? item.steps.some((step) => step.command !== null)
    : item.command !== null

export const toYamlStr = (
  steps: SequenceItem[],
  paths: PathVar[],
): string => {
  const filledItems = steps.filter(hasContent)
  const hasSomething =
    filledItems.length > 0 ||
    paths.some((pathVar) => pathVar.value)

  if (!hasSomething) return "# No steps yet"

  const pathsObj = Object.fromEntries(
    paths.map((pathVar) => [
      pathVar.id,
      { label: pathVar.label, value: pathVar.value },
    ]),
  )

  return dump(
    {
      paths: pathsObj,
      steps: filledItems.map((item) =>
        isGroup(item)
          ? groupToYaml(item)
          : stepToYaml(item),
      ),
    },
    { lineWidth: -1, flowLevel: 3, indent: 2 },
  )
}
