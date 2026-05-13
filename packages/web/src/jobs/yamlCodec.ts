import { dump, load } from "js-yaml"

import { buildParams } from "../commands/buildParams"
import type { Commands } from "../commands/types"
import type {
  Group,
  PathVariable,
  SequenceItem,
  Step,
} from "../types"
import { isGroup } from "./sequenceUtils"

// ─── Serializer ───────────────────────────────────────────────────────────────

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

// ─── Loader ───────────────────────────────────────────────────────────────────

type LoadContext = {
  commands: Commands
  currentPaths: PathVariable[]
  currentStepCounter: number
  seenIds: Set<string>
}

// eslint-disable-next-line no-restricted-syntax -- return type of a web-only YAML parsing utility; not an API response shape
export type LoadYamlResult = {
  steps: SequenceItem[]
  paths: PathVariable[]
  stepCounter: number
}

const isGroupItem = (item: unknown): boolean =>
  !!(
    item &&
    typeof item === "object" &&
    (item as Record<string, unknown>).kind === "group"
  )

// Creates a bare step shell — params and links are empty; loadStepItem fills
// them from the YAML. The counter is advanced here so every step gets a
// unique auto-generated ID even when the YAML omits explicit ids.
const createStep = (
  commandName: string,
  context: LoadContext,
): Step => {
  context.currentStepCounter++
  const autoId = `step${context.currentStepCounter}`
  return {
    id: autoId,
    alias: "",
    command: commandName,
    params: {},
    links: {},
    status: null,
    error: null,
    isCollapsed: false,
  }
}

const loadStepItem = (
  item: unknown,
  context: LoadContext,
): Step => {
  const { commands, currentPaths } = context
  const raw = item as Record<string, unknown>

  const commandName =
    typeof raw.command === "string" ? raw.command : ""
  if (commandName && !commands[commandName])
    throw new Error(`Unknown command: ${commandName}`)

  const step = createStep(commandName, context)

  if (typeof raw.id === "string" && raw.id) {
    let candidateId = raw.id
    let suffix = 2
    while (context.seenIds.has(candidateId)) {
      candidateId = `${raw.id}_${suffix++}`
    }
    step.id = candidateId
    const match = /^step(\d+)$/.exec(raw.id)
    if (match) {
      const restoredCount = Number(match[1])
      if (restoredCount > context.currentStepCounter) {
        context.currentStepCounter = restoredCount
      }
    }
  }
  context.seenIds.add(step.id)

  if (typeof raw.alias === "string") step.alias = raw.alias
  if (raw.isCollapsed === true) step.isCollapsed = true

  // Blank placeholder step — no command definition to look up.
  if (!commandName) return step

  const commandDefinition = commands[commandName]
  const rawParams = raw.params as
    | Record<string, unknown>
    | undefined

  for (const field of commandDefinition.fields) {
    const value = rawParams?.[field.name]
    if (value !== undefined) {
      if (
        typeof value === "string" &&
        value.startsWith("@")
      ) {
        // Path-variable reference — restore as a string link if the path
        // var exists, otherwise keep the literal so the user can fix it.
        const pathVariableId = value.slice(1)
        if (
          currentPaths.find(
            (pathVariable) =>
              pathVariable.id === pathVariableId,
          )
        ) {
          step.links[field.name] = pathVariableId
        } else {
          step.params[field.name] = value
        }
      } else if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        typeof (value as Record<string, unknown>)
          .linkedTo === "string"
      ) {
        // Step-output reference — restore as the object form without
        // validating the referenced step (partial sequences must still load).
        const linkObj = value as Record<string, unknown>
        step.links[field.name] = {
          linkedTo: linkObj.linkedTo as string,
          output:
            typeof linkObj.output === "string"
              ? linkObj.output
              : "folder",
        }
      } else {
        step.params[field.name] = value
      }
    }

    if (field.companionNameField) {
      const companionValue =
        rawParams?.[field.companionNameField]
      if (companionValue !== undefined) {
        step.params[field.companionNameField] =
          companionValue
      }
    }
  }

  // Restore auto-resolved values (e.g. tmdbId/tmdbName) so a shared URL
  // keeps pointing at the same matched film without re-firing resolution.
  if (Array.isArray(commandDefinition.persistedKeys)) {
    for (const persistedKey of commandDefinition.persistedKeys) {
      const persistedValue = rawParams?.[persistedKey]
      if (persistedValue !== undefined) {
        step.params[persistedKey] = persistedValue
      }
    }
  }

  return step
}

const loadGroupItem = (
  item: unknown,
  context: LoadContext,
): Group => {
  const raw = item as Record<string, unknown>
  if (!Array.isArray(raw.steps) || raw.steps.length === 0) {
    throw new Error(
      'A group must have a non-empty "steps" array',
    )
  }
  const innerSteps = (raw.steps as unknown[]).map(
    (inner) => {
      if (isGroupItem(inner)) {
        throw new Error(
          "Groups cannot be nested — a group's inner steps must each be a bare step",
        )
      }
      return loadStepItem(inner, context)
    },
  )
  return {
    kind: "group",
    id: (() => {
      const base =
        typeof raw.id === "string" && raw.id
          ? raw.id
          : `group_${Math.random().toString(36).slice(2, 8)}`
      let candidate = base
      let suffix = 2
      while (context.seenIds.has(candidate)) {
        candidate = `${base}_${suffix++}`
      }
      context.seenIds.add(candidate)
      return candidate
    })(),
    label: typeof raw.label === "string" ? raw.label : "",
    isParallel: raw.isParallel === true,
    isCollapsed: raw.isCollapsed === true,
    steps: innerSteps,
  }
}

const ensureBasePath = (): PathVariable[] => [
  { id: "basePath", label: "basePath", value: "" },
]

// Parses YAML text and returns the new sequence state. Two formats accepted:
//   - Canonical: { paths: {...}, steps: [...] }  (emitted by toYamlStr)
//   - Legacy:    plain array of steps
// Throws on parse errors; caller is responsible for surfacing the message.
export const loadYamlFromText = (
  text: string,
  commands: Commands,
  currentPaths: PathVariable[],
  _currentStepCounter: number,
  existingIds?: Set<string>,
): LoadYamlResult => {
  const data = load(text)

  let paths = currentPaths
  let stepsData: unknown[]

  if (
    data &&
    typeof data === "object" &&
    !Array.isArray(data)
  ) {
    const dataObj = data as Record<string, unknown>
    if (dataObj.steps !== undefined) {
      if (
        dataObj.paths &&
        typeof dataObj.paths === "object"
      ) {
        paths = Object.entries(
          dataObj.paths as Record<
            string,
            Record<string, string>
          >,
        ).map(([id, pathVariable]) => ({
          id,
          label: pathVariable.label || id,
          value: pathVariable.value || "",
        }))
      }
      if (!paths.length) paths = ensureBasePath()
      stepsData = (dataObj.steps as unknown[]) || []
    } else {
      throw new Error(
        'Expected a YAML sequence or object with "steps" key',
      )
    }
  } else if (Array.isArray(data)) {
    paths = ensureBasePath()
    stepsData = data
  } else {
    throw new Error(
      'Expected a YAML sequence or object with "steps" key',
    )
  }

  const context: LoadContext = {
    commands,
    currentPaths: paths,
    currentStepCounter: 0,
    seenIds: new Set<string>(existingIds),
  }

  const steps = stepsData.map((item) =>
    isGroupItem(item)
      ? loadGroupItem(item, context)
      : loadStepItem(item, context),
  )

  return {
    steps,
    paths,
    stepCounter: context.currentStepCounter,
  }
}
