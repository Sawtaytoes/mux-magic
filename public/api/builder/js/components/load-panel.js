import {
  getPaths,
  getStepCounter,
  setPaths,
  setStepCounter,
  setSteps,
} from '../state.js'

// Helpers still living in the inline <script>: the COMMANDS registry,
// makeStep (wires defaults from a command's field schema), the URL
// persistence write, and the global render. They migrate out alongside
// step-card, at which point those bridge entries collapse.
const bridge = () => window.mediaTools

// ─── Panel toggle ────────────────────────────────────────────────────────────

// Show/hide the paste-YAML panel. Always clears any previously-displayed
// parse error so reopening the panel doesn't leave a stale red message.
export function toggleLoad() {
  document.getElementById('load-panel').classList.toggle('hidden')
  document.getElementById('load-error').classList.add('hidden')
}

// ─── YAML → state ────────────────────────────────────────────────────────────

// Replaces `paths` and `steps` with the contents of a saved YAML
// document. Two formats are accepted: the canonical `{ paths, steps }`
// object form emitted by toYamlStr, and the legacy plain-array-of-steps
// form. Errors propagate to the caller (loadYaml renders them in the
// panel; restoreFromUrl swallows them).
export function loadYamlFromText(text) {
  const data = window.jsyaml.load(text)
  const COMMANDS = bridge().COMMANDS

  let stepsData
  if (data && typeof data === 'object' && !Array.isArray(data) && data.steps !== undefined) {
    if (data.paths && typeof data.paths === 'object') {
      setPaths(Object.entries(data.paths).map(([id, pv]) => ({
        id,
        label: pv.label || id,
        value: pv.value || '',
      })))
    }
    if (!getPaths().length) bridge().initPaths()
    stepsData = data.steps || []
  } else if (Array.isArray(data)) {
    bridge().initPaths()
    stepsData = data
  } else {
    throw new Error('Expected a YAML sequence or object with "steps" key')
  }

  // Reset the step counter for this load so we don't keep bumping it across
  // reloads. Each loaded step's explicit `id` (when present) is preserved;
  // anything missing falls through to the generated `step{N}` form. After
  // the loop, advance the counter past every step{N}-shaped ID we restored
  // so future makeStep calls won't collide with a loaded ID.
  const newSteps = []
  setStepCounter(0)
  for (const item of stepsData) {
    if (!item.command) throw new Error('Each step must have a "command" key')
    if (!COMMANDS[item.command]) throw new Error(`Unknown command: ${item.command}`)
    const step = bridge().makeStep(item.command)
    if (typeof item.id === 'string' && item.id) {
      step.id = item.id
      const match = /^step(\d+)$/.exec(item.id)
      if (match) {
        const restoredCount = Number(match[1])
        if (restoredCount > getStepCounter()) setStepCounter(restoredCount)
      }
    }
    if (typeof item.alias === 'string') step.alias = item.alias
    const cmd = COMMANDS[item.command]
    for (const field of cmd.fields) {
      const value = item.params?.[field.name]
      if (value !== undefined) {
        if (typeof value === 'string' && value.startsWith('@')) {
          // Path-variable reference — restore as a string link if the path
          // exists, otherwise keep the literal so the user can fix it.
          const pathVarId = value.slice(1)
          if (getPaths().find((path) => path.id === pathVarId)) {
            step.links[field.name] = pathVarId
          } else {
            step.params[field.name] = value
          }
        } else if (
          value && typeof value === 'object' && !Array.isArray(value) &&
          typeof value.linkedTo === 'string'
        ) {
          // Step-output reference — restore as the object form. We do not
          // verify that the referenced step+output exists here; that happens
          // at run/resolve time so partial sequences keep loading.
          step.links[field.name] = {
            linkedTo: value.linkedTo,
            output: value.output || 'folder',
          }
        } else {
          step.params[field.name] = value
        }
      }
      // Companion display-name field (purely visual)
      if (field.companionNameField) {
        const companionValue = item.params?.[field.companionNameField]
        if (companionValue !== undefined) step.params[field.companionNameField] = companionValue
      }
    }
    newSteps.push(step)
  }
  setSteps(newSteps)
}

// ─── Click handler for the panel's Load button ──────────────────────────────

export function loadYaml() {
  const text = document.getElementById('load-input').value.trim()
  const errorElement = document.getElementById('load-error')
  errorElement.classList.add('hidden')
  try {
    loadYamlFromText(text)
    document.getElementById('load-panel').classList.add('hidden')
    bridge().renderAll()
    bridge().updateUrl()
  } catch (error) {
    errorElement.textContent = error.message
    errorElement.classList.remove('hidden')
  }
}
