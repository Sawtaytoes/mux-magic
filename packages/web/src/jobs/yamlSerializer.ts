import { dump } from "js-yaml"

import { buildParams } from "../commands/buildParams"
import type { Commands } from "../commands/types"
import type {
  Group,
  SequenceItem,
  Step,
  Variable,
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
    .filter((step) => Boolean(step.command))
    .map((step) => stepToYaml(step, commands)),
})

const hasContent = (item: SequenceItem): boolean =>
  "command" in item
    ? Boolean(item.command)
    : item.steps.some((step) => Boolean(step.command))

export const toYamlStr = (
  steps: SequenceItem[],
  paths: Variable[],
  commands: Commands,
  threadCount?: string | null,
): string => {
  const filledItems = steps.filter(hasContent)
  const hasSomething =
    filledItems.length > 0 ||
    paths.some((variable) => variable.value)

  if (!hasSomething) return "# No steps yet"

  const variablesObj = {
    ...Object.fromEntries(
      paths.map((variable) => [
        variable.id,
        {
          label: variable.label,
          value: variable.value,
          type: variable.type,
        },
      ]),
    ),
    ...(threadCount != null
      ? { tc: { type: "threadCount", value: threadCount } }
      : {}),
  }

  return dump(
    {
      ...(Object.keys(variablesObj).length > 0
        ? { variables: variablesObj }
        : {}),
      steps: filledItems.map((item) =>
        isGroup(item)
          ? groupToYaml(item, commands)
          : stepToYaml(item, commands),
      ),
    },
    { lineWidth: -1, flowLevel: 3, indent: 2 },
  )
}
