// Stub retained for card-clipboard.js and the URL-restore bridge.
// LoadModal UI is now the React component in packages/web/src/components/LoadModal.tsx.
// Remove this file in the Final wave when card-clipboard.js is superseded by the React DragAndDrop.

import {
  getPaths,
  getStepCounter,
  setPaths,
  setStepCounter,
  setSteps,
} from "../state.js"

const bridge = () => window.mediaTools

export const isGroupItem = (item) =>
  !!(
    item &&
    typeof item === "object" &&
    item.kind === "group"
  )

export function loadStepItem(item, COMMANDS) {
  if (!item.command)
    throw new Error('Each step must have a "command" key')
  if (!COMMANDS[item.command])
    throw new Error(`Unknown command: ${item.command}`)

  const step = bridge().makeStep(item.command)

  if (typeof item.id === "string" && item.id) {
    step.id = item.id
    const match = /^step(\d+)$/.exec(item.id)
    if (match) {
      const restoredCount = Number(match[1])
      if (restoredCount > getStepCounter())
        setStepCounter(restoredCount)
    }
  }
  if (typeof item.alias === "string")
    step.alias = item.alias
  if (item.isCollapsed === true) step.isCollapsed = true

  const commandDefinition = COMMANDS[item.command]
  commandDefinition.fields.forEach((field) => {
    const value = item.params?.[field.name]
    if (value !== undefined) {
      if (
        typeof value === "string" &&
        value.startsWith("@")
      ) {
        const pathVarId = value.slice(1)
        if (
          getPaths().find((path) => path.id === pathVarId)
        ) {
          step.links[field.name] = pathVarId
        } else {
          step.params[field.name] = value
        }
      } else if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        typeof value.linkedTo === "string"
      ) {
        step.links[field.name] = {
          linkedTo: value.linkedTo,
          output: value.output || "folder",
        }
      } else {
        step.params[field.name] = value
      }
    }
    if (field.companionNameField) {
      const companionValue =
        item.params?.[field.companionNameField]
      if (companionValue !== undefined)
        step.params[field.companionNameField] =
          companionValue
    }
  })

  if (Array.isArray(commandDefinition.persistedKeys)) {
    commandDefinition.persistedKeys.forEach(
      (persistedKey) => {
        const persistedValue = item.params?.[persistedKey]
        if (persistedValue !== undefined)
          step.params[persistedKey] = persistedValue
      },
    )
  }
  return step
}

export function loadGroupItem(item, COMMANDS) {
  if (!Array.isArray(item.steps) || item.steps.length === 0)
    throw new Error(
      'A group must have a non-empty "steps" array',
    )

  const innerSteps = item.steps.map((inner) => {
    if (isGroupItem(inner))
      throw new Error(
        "Groups cannot be nested — a group's inner steps must each be a bare step",
      )
    return loadStepItem(inner, COMMANDS)
  })

  return {
    kind: "group",
    id:
      typeof item.id === "string" && item.id
        ? item.id
        : `group_${Math.random().toString(36).slice(2, 8)}`,
    label: typeof item.label === "string" ? item.label : "",
    isParallel: item.isParallel === true,
    isCollapsed: item.isCollapsed === true,
    steps: innerSteps,
  }
}

// Parse YAML text and load it into the global sequence state. Called by
// restoreFromUrl() in sequence-editor.js and by the bridge during undo/redo.
// Paths must be loaded before steps so @pathVarId links can be resolved.
export function loadYamlFromText(text) {
  const parsed = window.jsyaml.load(text) || {}
  const COMMANDS = window.mediaTools?.COMMANDS || {}

  // Load paths: preserve the basePath placeholder if no paths in YAML.
  const pathsObj = parsed.paths || {}
  const pathEntries = Object.entries(pathsObj)
  if (pathEntries.length > 0) {
    setPaths(
      pathEntries.map(([id, data]) => ({
        id,
        label:
          data &&
          typeof data === "object" &&
          typeof data.label === "string"
            ? data.label
            : id,
        value:
          data &&
          typeof data === "object" &&
          typeof data.value === "string"
            ? data.value
            : "",
      })),
    )
  } else {
    setPaths([
      { id: "basePath", label: "basePath", value: "" },
    ])
  }

  // Load steps (bare + groups).
  const stepsData = Array.isArray(parsed.steps)
    ? parsed.steps
    : []
  const loadedSteps = stepsData.map((item) =>
    isGroupItem(item)
      ? loadGroupItem(item, COMMANDS)
      : loadStepItem(item, COMMANDS),
  )
  setSteps(loadedSteps)
}
