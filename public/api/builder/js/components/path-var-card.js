import { esc } from '../util/esc.js'
import { getPaths, getSteps } from '../state.js'
import { refreshPathVarOptions } from '../util/path-var-options.js'

// Helpers that still live in the inline <script> in index.html.
// Accessed lazily through window.mediaTools so the bridge can be set
// up after this module is parsed.
const bridge = () => window.mediaTools

// ─── Render ───────────────────────────────────────────────────────────────────

export function renderPathVarCard(pv, isFirst) {
  // Every path-variable's name is editable. The first card is still
  // not removable (delete button is gated on isFirst) so the base path
  // can be renamed freely without accidentally being deleted. Matches
  // YAML-upload semantics: the path key is whatever the user types.
  const labelHtml = `<input type="text" value="${esc(pv.label)}"
        data-action="set-path-label" data-pv-id="${pv.id}"
        class="text-xs font-medium text-slate-300 bg-transparent border-b border-slate-600 focus:outline-none focus:border-blue-500 flex-1 min-w-0" />`
  const deleteBtn = !isFirst
    ? `<button data-action="remove-path" data-pv-id="${pv.id}"
        title="Remove path variable" aria-label="Remove path variable"
        class="text-xs text-slate-500 hover:text-red-400 w-5 h-5 flex items-center justify-center rounded hover:bg-slate-700">✕</button>`
    : ''
  // Replaces the static folder emoji with a clickable trigger that opens
  // the file-explorer modal scoped to this variable's value. Read-only
  // mode (no pickerOnSelect) — the user is just browsing a folder they
  // already named. Disabled when the value is empty so we don't pop a
  // modal pointed at nothing.
  const browseBtn = `<button data-action="browse-path-var" data-pv-id="${pv.id}"
        title="${pv.value ? 'Browse files in this folder' : 'Set a path value to enable Browse'}"
        aria-label="Browse files in this folder"
        ${pv.value ? '' : 'disabled'}
        class="text-xs text-slate-500 hover:text-slate-300 disabled:cursor-not-allowed disabled:hover:text-slate-500 w-5 h-5 flex items-center justify-center rounded hover:bg-slate-700 shrink-0">📁</button>`
  return `<div data-path-var="${pv.id}" class="col-span-full bg-slate-800/40 rounded-xl border border-dashed border-slate-600 px-4 py-3">
    <div class="flex items-center gap-2 mb-2">
      ${browseBtn}
      ${labelHtml}
      <span class="text-xs text-slate-600 font-mono shrink-0">path variable</span>
      ${deleteBtn}
    </div>
    <input type="text" value="${esc(pv.value)}" placeholder="/mnt/media or D:\\Media"
      data-action="set-path-value" data-pv-id="${pv.id}"
      data-keydown="path-picker"
      class="w-full bg-slate-900 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono" />
  </div>`
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function setPathValue(pvId, value) {
  const pv = getPaths().find((p) => p.id === pvId)
  if (!pv) return
  pv.value = value
  bridge().refreshLinkedInputs()
  refreshPathVarOptions()
  bridge().updateYaml()
  bridge().scheduleUpdateUrl()
}

export function setPathLabel(pvId, label) {
  const pv = getPaths().find((p) => p.id === pvId)
  if (!pv) return
  pv.label = label
  refreshPathVarOptions()
  bridge().updateYaml()
  bridge().scheduleUpdateUrl()
}

export function removePath(pvId) {
  const paths = getPaths()
  const i = paths.findIndex((p) => p.id === pvId)
  if (i <= 0) return // can't remove Base Path (index 0)
  paths.splice(i, 1)
  // Drop any step links pointing at the removed path id.
  for (const s of getSteps()) {
    for (const [k, v] of Object.entries(s.links)) {
      if (v === pvId) delete s.links[k]
    }
  }
  bridge().renderAll()
}

export function addPath() {
  const paths = getPaths()
  const newPath = {
    id: 'path_' + bridge().randomHex(),
    label: 'Path ' + paths.length,
    value: '',
  }
  paths.push(newPath)
  bridge().renderAll()
  // Defer one frame so layout is current before scroll.
  requestAnimationFrame(() => bridge().scrollPathVarIntoView(newPath.id))
}

// Path-var value input also drives the path-picker autocomplete (a
// shared helper that lives in the inline script for now).
function onPathVarInput(inputElement, pathVarId, value) {
  setPathValue(pathVarId, value)
  bridge().schedulePathLookup(inputElement, { mode: 'pathVar', pathVarId }, value)
}

// ─── Listeners ────────────────────────────────────────────────────────────────

// One-time delegated listeners on the steps-list parent. Each rendered
// card carries data-action="..." attributes; this dispatcher reads them
// and routes to the right handler. Survives every renderAll because
// the listeners are bound to the parent, not the per-card markup.
export function attachPathVarListeners(container) {
  container.addEventListener('input', (event) => {
    const t = event.target
    if (!t?.dataset?.action) return
    if (t.dataset.action === 'set-path-label') {
      setPathLabel(t.dataset.pvId, t.value)
    } else if (t.dataset.action === 'set-path-value') {
      onPathVarInput(t, t.dataset.pvId, t.value)
    }
  })
  container.addEventListener('click', (event) => {
    const btn = event.target.closest?.('[data-action]')
    if (!btn) return
    if (btn.dataset.action === 'remove-path') {
      removePath(btn.dataset.pvId)
    } else if (btn.dataset.action === 'browse-path-var') {
      const pv = getPaths().find((p) => p.id === btn.dataset.pvId)
      if (pv && pv.value) {
        // Read-only browse — no pickerOnSelect callback. The user is
        // inspecting a folder they already named, not assigning a new
        // path to this variable.
        window.openFileExplorer(pv.value)
      }
    }
  })
  container.addEventListener('keydown', (event) => {
    if (event.target?.dataset?.keydown === 'path-picker') {
      bridge().pathPickerKeydown(event)
    }
  })
}
