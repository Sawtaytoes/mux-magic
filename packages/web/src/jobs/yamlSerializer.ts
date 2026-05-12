import { dump } from "js-yaml"

import { buildParams } from "../commands/buildParams"
import type { Commands } from "../commands/types"
import type {
  Group,
  PathVariable,
  SequenceItem,
  Step,
} from "../types"
import { isGroup } from "./sequenceUtils"

const buildParamsForStep = (
  step: Step,
  commands: Commands,
): Record<string, unknown> => {
  const commandDefinition = commands[step.command]
  if (!commandDefinition) return step.params
  return buildParams(step, commandDefinition)
}

const stepToYaml = (step: Step, commands: Commands) => ({
  id: step.id,
  ...(step.alias ? { alias: step.alias } : {}),
  command: step.command,
  params: buildParamsForStep(step, commands),
  ...(step.isCollapsed ? { isCollapsed: true } : {}),
})

const groupToYaml = (group: Group, commands: Commands) => ({
  kind: "group" as const,
  ...(group.id ? { id: group.id } : {}),
  ...(group.label ? { label: group.label } : {}),
  ...(group.isParallel ? { isParallel: true } : {}),
  ...(group.isCollapsed ? { isCollapsed: true } : {}),
  steps: group.steps
    .filter((step) => step.command !== null)
    .map((step) => stepToYaml(step, commands)),
})

const hasContent = (item: SequenceItem): boolean =>
  isGroup(item)
    ? item.steps.some((step) => step.command !== null)
    : item.command !== null

export const toYamlStr = (
  steps: SequenceItem[],
  paths: PathVariable[],
  commands: Commands,
): string => {
  const filledItems = steps.filter(hasContent)
  const hasSomething =
    filledItems.length > 0 ||
    paths.some((pathVariable) => pathVariable.value)

  if (!hasSomething) return "# No steps yet"

  const pathsObj = Object.fromEntries(
    paths.map((pathVariable) => [
      pathVariable.id,
      {
        label: pathVariable.label,
        value: pathVariable.value,
      },
    ]),
  )

  return dump(
    {
      paths: pathsObj,
      steps: filledItems.map((item) =>
        isGroup(item)
          ? groupToYaml(item, commands)
          : stepToYaml(item, commands),
      ),
    },
    { lineWidth: -1, flowLevel: 3, indent: 2 },
  )
}
