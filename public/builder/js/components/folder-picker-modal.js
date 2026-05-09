// Multi-select folder picker modal for fields like storeAspectRatioData.folders.
//
// Opens a modal listing all subdirectories found at a given sourcePath, lets
// the user click to toggle selections, and confirms into a string[] param.
// Self-mounts its own DOM on first open — no HTML edits needed.
//
// Public API:
//   folderPicker.open({ stepId, fieldName, sourceValue })
//   folderPicker.close()
//   folderPicker.toggleFolder(name)
//   folderPicker.selectAll()
//   folderPicker.confirm()

const MODAL_ID = 'folder-picker-modal'

const state = {
  stepId: null,
  fieldName: null,
  selected: new Set(),
  entries: [],
  isLoading: false,
  error: null,
}

const getModal = () => document.getElementById(MODAL_ID)

function ensureModalMounted() {
  if (getModal()) {
    return getModal()
  }

  const modal = document.createElement('div')
  modal.id = MODAL_ID
  modal.className = 'hidden fixed inset-0 z-[60] flex items-center justify-center bg-black/70'
  modal.innerHTML = `
    <div class="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[80vh]">
      <div class="flex items-center justify-between px-4 py-3 border-b border-slate-700 shrink-0">
        <h2 class="text-sm font-medium text-slate-200" id="folder-picker-title">Select Folders</h2>
        <button onclick="folderPicker.close()"
          class="text-slate-400 hover:text-slate-200 text-lg leading-none px-1">✕</button>
      </div>

      <div id="folder-picker-body" class="flex-1 overflow-y-auto px-4 py-3 space-y-1 min-h-0">
        <p class="text-xs text-slate-500 italic">Loading…</p>
      </div>

      <div class="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-t border-slate-700">
        <button onclick="folderPicker.selectAll()"
          class="text-xs text-slate-400 hover:text-slate-200 underline underline-offset-2">Select All</button>
        <div class="flex items-center gap-2">
          <button onclick="folderPicker.close()"
            class="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded">Cancel</button>
          <button onclick="folderPicker.confirm()"
            class="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded font-medium">Confirm</button>
        </div>
      </div>
    </div>
  `

  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      close()
    }
  })

  document.body.appendChild(modal)
  return modal
}

function renderBody() {
  const body = document.getElementById('folder-picker-body')
  if (!body) {
    return
  }

  if (state.isLoading) {
    body.innerHTML = '<p class="text-xs text-slate-500 italic">Loading folders…</p>'
    return
  }

  if (state.error) {
    body.innerHTML = `<p class="text-xs text-red-400">${state.error}</p>`
    return
  }

  if (!state.entries.length) {
    body.innerHTML = '<p class="text-xs text-slate-500 italic">No subdirectories found at this path.</p>'
    return
  }

  body.innerHTML = state.entries.map((name) => {
    const isSelected = state.selected.has(name)
    const safeAttr = name.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    const checkBox = isSelected
      ? `<span class="w-3.5 h-3.5 shrink-0 rounded flex items-center justify-center bg-blue-500 border border-blue-400 text-white text-[10px] leading-none">✓</span>`
      : `<span class="w-3.5 h-3.5 shrink-0 rounded border border-slate-500 bg-slate-700"></span>`
    return `
      <button data-folder-name="${safeAttr}" onclick="folderPicker.toggleFolderFromEl(this)"
        class="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs transition-colors ${
          isSelected
          ? 'bg-blue-600/30 border border-blue-500/50 text-blue-200'
          : 'hover:bg-slate-800 border border-transparent text-slate-300'
        }">
        ${checkBox}
        <span class="font-mono truncate">📁 ${safeAttr}</span>
      </button>
    `
  }).join('')
}

async function loadFolders(sourcePath) {
  state.isLoading = true
  state.error = null
  state.entries = []
  renderBody()

  try {
    const response = await fetch('/queries/listDirectoryEntries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: sourcePath }),
    })

    if (!response.ok) {
      throw new Error(`Server error ${response.status}`)
    }

    const data = await response.json()

    if (data.error) {
      state.error = data.error
    } else {
      state.entries = data.entries
        .filter((entry) => entry.isDirectory)
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b))
    }
  } catch (err) {
    state.error = String(err)
  }

  state.isLoading = false
  renderBody()
}

function open({ stepId, fieldName, sourceValue }) {
  ensureModalMounted()

  state.stepId = stepId
  state.fieldName = fieldName

  const step = window.mediaTools?.findStepById?.(stepId)
  const currentFolders = Array.isArray(step?.params?.[fieldName]) ? step.params[fieldName] : []
  state.selected = new Set(currentFolders)

  const modal = getModal()
  modal.classList.remove('hidden')

  if (sourceValue) {
    loadFolders(sourceValue)
  } else {
    state.isLoading = false
    state.error = null
    state.entries = []
    renderBody()
    document.getElementById('folder-picker-body').innerHTML = (
      '<p class="text-xs text-slate-500 italic">Set a Source Path first to browse folders.</p>'
    )
  }
}

function close() {
  const modal = getModal()
  if (modal) {
    modal.classList.add('hidden')
  }
  state.stepId = null
  state.fieldName = null
  state.selected = new Set()
}

function toggleFolder(name) {
  if (state.selected.has(name)) {
    state.selected.delete(name)
  } else {
    state.selected.add(name)
  }
  renderBody()
}

function toggleFolderFromEl(el) {
  const name = el.closest('[data-folder-name]')?.getAttribute('data-folder-name')
  if (name !== null && name !== undefined) {
    toggleFolder(name)
  }
}

function selectAll() {
  state.entries.forEach((name) => state.selected.add(name))
  renderBody()
}

function confirm() {
  if (!state.stepId || !state.fieldName) {
    close()
    return
  }
  const folders = [...state.selected].sort((a, b) => a.localeCompare(b))
  window.setParamAndRender(state.stepId, state.fieldName, folders.length ? folders : undefined)
  close()
}

// Read step/field/sourcePath from data attributes so Windows backslashes in
// paths are never embedded as JS string literals in onclick attributes.
function openFromEl(el) {
  const stepId = el.getAttribute('data-step-id') ?? ''
  const fieldName = el.getAttribute('data-field-name') ?? ''
  const sourceField = el.getAttribute('data-source-field') ?? ''
  // Resolve source path live from step state so stale data-source-value
  // attributes (which only update on renderAll) don't produce wrong results.
  const step = window.mediaTools?.findStepById?.(stepId)
  const sourceValue = sourceField && step
    ? (window.mediaTools?.getLinkedValue?.(step, sourceField) ?? step.params?.[sourceField] ?? '')
    : ''
  open({ stepId, fieldName, sourceValue })
}

function removeFolder(stepId, fieldName, folderName) {
  const step = window.mediaTools?.findStepById?.(stepId)
  if (!step) {
    return
  }
  const current = Array.isArray(step.params[fieldName]) ? step.params[fieldName] : []
  const updated = current.filter((f) => f !== folderName)
  window.setParamAndRender(stepId, fieldName, updated.length ? updated : undefined)
}

export function registerFolderPickerGlobals() {
  if (typeof window === 'undefined') {
    return
  }
  window.folderPicker = { open, openFromEl, close, toggleFolder, toggleFolderFromEl, selectAll, confirm, removeFolder }
}
