import { dump, load } from "js-yaml"

import { buildParams } from "../commands/buildParams"
import type { Commands } from "../commands/types"
import { makeStepId } from "../state/idAllocator"
import type {
  Group,
  PathVariable,
  SequenceItem,
  Step,
  Variable,
} from "../types"
import { isGroup } from "./sequenceUtils"

const RENAMED_COMMANDS: Record<string, string> = {
  nameSpecialFeatures: "nameSpecialFeaturesDvdCompareTmdb",
  // `mergeTracks` only ever muxed in subtitles (with optional chapters);
  // it never touched audio/video. Renamed to surface what it actually does.
  mergeTracks: "addSubtitles",
}

// ─── Serializer ───────────────────────────────────────────────────────────────

const buildParamsForStep = (
  step: Step,
  commands: Commands,
): Record<string, unknown> => {
  const commandDefinition = commands[step.command]
  if (!commandDefinition) return step.params
  return buildParams(step, commandDefinition)
}

// Blank steps (command: "") are persisted explicitly so undo/redo,
// paste, and `?seq=` round-trips don't silently drop them. The
// runner side-channels them as no-ops; see sequenceRunner.ts.
const stepToObject = (step: Step, commands: Commands) => ({
  id: step.id,
  ...(step.alias ? { alias: step.alias } : {}),
  command: step.command,
  params: step.command
    ? buildParamsForStep(step, commands)
    : {},
  ...(step.isCollapsed ? { isCollapsed: true } : {}),
})

const groupToObject = (
  group: Group,
  commands: Commands,
) => ({
  kind: "group" as const,
  ...(group.id ? { id: group.id } : {}),
  ...(group.label ? { label: group.label } : {}),
  ...(group.isParallel ? { isParallel: true } : {}),
  ...(group.isCollapsed ? { isCollapsed: true } : {}),
  steps: group.steps.map((step) =>
    stepToObject(step, commands),
  ),
})

export type SequenceObject = {
  variables?: Record<string, unknown>
  steps: unknown[]
}

// Builds the canonical { variables, steps } object that loadYamlFromText
// reads back. Pure shape — no YAML or JSON involvement. Both toYamlStr
// (YAML clipboard / save flow) and encodeSeqJsonParam (the live ?seqJson=
// URL writer) round-trip through this so the loader sees identical input
// regardless of which encoder produced the URL.
export const buildSequenceObject = (
  steps: SequenceItem[],
  paths: Variable[],
  commands: Commands,
): SequenceObject => {
  // Worker 28: threadCount is no longer a side-channel — it flows through
  // `paths` (really `variables`) like every other type. The on-disk envelope
  // remains `variables: { tc: { type: "threadCount", value: ... } }` because
  // the registration declares canonicalId "tc".
  const variablesObj = Object.fromEntries(
    paths.map((variable) => [
      variable.id,
      {
        label: variable.label,
        value: variable.value,
        type: variable.type,
      },
    ]),
  )

  return {
    ...(Object.keys(variablesObj).length > 0
      ? { variables: variablesObj }
      : {}),
    steps: steps.map((item) =>
      isGroup(item)
        ? groupToObject(item, commands)
        : stepToObject(item, commands),
    ),
  }
}

export const toYamlStr = (
  steps: SequenceItem[],
  paths: Variable[],
  commands: Commands,
): string => {
  const hasSomething =
    steps.length > 0 ||
    paths.some((variable) => variable.value)

  if (!hasSomething) return "# No steps yet"

  return dump(buildSequenceObject(steps, paths, commands), {
    lineWidth: -1,
    flowLevel: 3,
    indent: 2,
  })
}

// ─── Loader ───────────────────────────────────────────────────────────────────

// Per-command legacy field renames (worker 24 — source path abstraction).
// Keyed as `command -> { newFieldName: oldFieldName }`. When loading a step's
// params, if the canonical field name is missing but its legacy alias is
// present, the value is migrated over and a one-time deprecation warning is
// emitted per (command, legacyName) pair within the load call. The write
// path always emits the canonical name — there is no codec setting to opt
// out, because YAML templates round-trip through here.
const legacyFieldRenames: Record<
  string,
  Record<string, string>
> = {
  getAudioOffsets: { sourcePath: "sourceFilesPath" },
  // Keyed by the post-rename canonical name. Command-name rewrites in
  // RENAMED_COMMANDS run first, so a legacy `command: mergeTracks` step
  // becomes `addSubtitles` before this map is consulted.
  addSubtitles: { sourcePath: "mediaFilesPath" },
  replaceAttachments: { sourcePath: "sourceFilesPath" },
  replaceTracks: { sourcePath: "sourceFilesPath" },
  deleteFolder: { sourcePath: "folderPath" },
  makeDirectory: { sourcePath: "filePath" },
  deleteCopiedOriginals: {
    pathsToDelete: "sourcePaths",
  },
}

type LoadContext = {
  commands: Commands
  currentPaths: Variable[]
  seenIds: Set<string>
  warnedLegacyFields: Set<string>
}

// eslint-disable-next-line no-restricted-syntax -- return type of a web-only YAML parsing utility; not an API response shape
export type LoadYamlResult = {
  steps: SequenceItem[]
  paths: Variable[]
}

const isGroupItem = (item: unknown): boolean =>
  !!(
    item &&
    typeof item === "object" &&
    (item as Record<string, unknown>).kind === "group"
  )

// Creates a bare step shell — params and links are empty; loadStepItem fills
// them from the YAML. Mints a fresh random id and reserves it in seenIds
// so subsequent autos and explicit-id collision suffixes can't reuse it.
const createStep = (
  commandName: string,
  context: LoadContext,
): Step => {
  const autoId = makeStepId(context.seenIds)
  context.seenIds.add(autoId)
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

  let commandName =
    typeof raw.command === "string" ? raw.command : ""
  if (commandName && !commands[commandName]) {
    const renamedTo = RENAMED_COMMANDS[commandName]
    if (renamedTo && commands[renamedTo]) {
      // Transparent shim: rewrite the legacy command name to its
      // current registered name so saved YAML / `?seq=` URLs keep
      // loading after a rename. Mirrors the legacy field-rename
      // warning style above (one-time per (command) pair per load).
      const warnKey = `__cmd:${commandName}`
      if (!context.warnedLegacyFields.has(warnKey)) {
        context.warnedLegacyFields.add(warnKey)
        console.warn(
          `[mux-magic] YAML template uses renamed command "${commandName}"; remapped to "${renamedTo}". Resave the template to silence this warning.`,
        )
      }
      commandName = renamedTo
    } else if (renamedTo) {
      throw new Error(
        `Command "${commandName}" was renamed to "${renamedTo}", but "${renamedTo}" is not registered.`,
      )
    } else {
      throw new Error(`Unknown command: ${commandName}`)
    }
  }

  const step = createStep(commandName, context)

  if (typeof raw.id === "string" && raw.id) {
    // YAML pinned a literal id — preserve it for back-compat with
    // saved templates, but if it collides with something already
    // present (paste-into-existing-sequence, two YAML files merged)
    // suffix it to keep ids unique. The auto id we minted in
    // createStep is discarded in that case; seenIds keeps the
    // stale slot, which is harmless given the 1.68M id space.
    let candidateId = raw.id
    let suffix = 2
    while (context.seenIds.has(candidateId)) {
      candidateId = `${raw.id}_${suffix++}`
    }
    step.id = candidateId
    context.seenIds.add(step.id)
  }

  if (typeof raw.alias === "string") step.alias = raw.alias
  if (raw.isCollapsed === true) step.isCollapsed = true

  // Blank placeholder step — no command definition to look up.
  if (!commandName) return step

  const commandDefinition = commands[commandName]
  const rawParams = raw.params as
    | Record<string, unknown>
    | undefined

  const legacyRenamesForCommand =
    legacyFieldRenames[commandName] ?? {}

  for (const field of commandDefinition.fields) {
    const legacyName = legacyRenamesForCommand[field.name]
    const canonicalValue = rawParams?.[field.name]
    const legacyValue =
      legacyName !== undefined
        ? rawParams?.[legacyName]
        : undefined
    const isUsingLegacy =
      canonicalValue === undefined &&
      legacyValue !== undefined
    const value = isUsingLegacy
      ? legacyValue
      : canonicalValue

    if (isUsingLegacy && legacyName !== undefined) {
      const warnKey = `${commandName}.${legacyName}`
      if (!context.warnedLegacyFields.has(warnKey)) {
        context.warnedLegacyFields.add(warnKey)
        // Intentional console.warn — surfaces template-load deprecation to
        // anyone watching the dev-tools console. No UI surface today; can be
        // promoted to a structured warning channel later if needed.
        console.warn(
          `[mux-magic] YAML template uses deprecated field "${legacyName}" on command "${commandName}"; remapped to "${field.name}". Resave the template to silence this warning.`,
        )
      }
    }

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
  {
    id: "basePath",
    label: "basePath",
    value: "",
    type: "path",
  },
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
  const winnerIds = new Set(
    winner.map((variable) => variable.id),
  )
  return [
    ...loser.filter(
      (variable) => !winnerIds.has(variable.id),
    ),
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
  existingIds?: Set<string>,
): LoadYamlResult => {
  const data = load(text)

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
    // Pre-seed seenIds with the caller's existing ids so paste/auto-load
    // can't mint a random id that collides with a step already on the page.
    seenIds: new Set<string>(existingIds),
    warnedLegacyFields: new Set<string>(),
  }

  const steps = stepsData.map((item) =>
    isGroupItem(item)
      ? loadGroupItem(item, context)
      : loadStepItem(item, context),
  )

  return {
    steps,
    paths,
  }
}
