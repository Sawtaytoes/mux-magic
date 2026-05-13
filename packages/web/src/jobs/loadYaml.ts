import yaml from "js-yaml"
import type { Commands } from "../commands/types"
import type {
  Group,
  PathVariable,
  SequenceItem,
  Step,
  Variable,
} from "../types"

type LoadContext = {
  commands: Commands
  currentPaths: Variable[]
  currentStepCounter: number
  seenIds: Set<string>
}

// eslint-disable-next-line no-restricted-syntax -- return type of a web-only YAML parsing utility; not an API response shape
export type LoadYamlResult = {
  steps: SequenceItem[]
  paths: Variable[]
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

const ensureBasePath = (): Variable[] => [
  { id: "basePath", label: "basePath", value: "", type: "path" },
]

const parseLegacyPathsBlock = (
  rawPaths: Record<string, Record<string, string>>,
): Variable[] =>
  Object.entries(rawPaths).map(([id, entry]) => ({
    id,
    label: entry.label || id,
    value: entry.value || "",
    type: "path" as const,
  }))

const parseVariablesBlock = (
  rawVariables: Record<string, Record<string, string>>,
): Variable[] =>
  Object.entries(rawVariables).map(([id, entry]) => ({
    id,
    label: entry.label || id,
    value: entry.value || "",
    type: (entry.type || "path") as Variable["type"],
  }))

// Merges two variable arrays; entries in `winner` override `loser` by id.
const mergeVariables = (
  loser: Variable[],
  winner: Variable[],
): Variable[] => {
  const winnerIds = new Set(winner.map((v) => v.id))
  return [
    ...loser.filter((v) => !winnerIds.has(v.id)),
    ...winner,
  ]
}

// Parses YAML text and returns the new sequence state. Accepted formats:
//   - New canonical: { variables: {...}, steps: [...] }
//   - Legacy canonical: { paths: {...}, steps: [...] }  (still readable)
//   - Mixed: both blocks present — variables: wins per-id
//   - Array: plain array of steps (oldest legacy format)
// Throws on parse errors; caller is responsible for surfacing the message.
export const loadYamlFromText = (
  text: string,
  commands: Commands,
  currentPaths: PathVariable[],
  _currentStepCounter: number,
  existingIds?: Set<string>,
): LoadYamlResult => {
  const data = yaml.load(text)

  let paths: Variable[] = currentPaths
  let stepsData: unknown[]

  if (
    data &&
    typeof data === "object" &&
    !Array.isArray(data)
  ) {
    const dataObj = data as Record<string, unknown>
    if (dataObj.steps !== undefined) {
      const hasLegacyPaths =
        dataObj.paths && typeof dataObj.paths === "object"
      const hasVariables =
        dataObj.variables &&
        typeof dataObj.variables === "object"

      if (hasLegacyPaths || hasVariables) {
        const fromPaths = hasLegacyPaths
          ? parseLegacyPathsBlock(
              dataObj.paths as Record<
                string,
                Record<string, string>
              >,
            )
          : []
        const fromVariables = hasVariables
          ? parseVariablesBlock(
              dataObj.variables as Record<
                string,
                Record<string, string>
              >,
            )
          : []
        // variables: wins over paths: when both present for the same id
        paths =
          hasLegacyPaths && hasVariables
            ? mergeVariables(fromPaths, fromVariables)
            : hasVariables
              ? fromVariables
              : fromPaths
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
