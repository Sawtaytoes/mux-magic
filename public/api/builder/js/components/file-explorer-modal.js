// File-explorer modal — listing + multi-select + watch + bulk delete.
//
// Opened by `openFileExplorer(path)` (forwarded as a window.* function
// for inline call sites on result cards). The modal pulls the listing
// from /files/list, the active delete mode from /files/delete-mode, and
// (for video preview) streams files via /files/stream — every server
// piece is tested under src/tools/*.test.ts.
//
// State is module-local; the modal singleton is fine because only one
// path can be browsed at a time.

import { esc } from '../util/esc.js'

let currentPath = ''
let entries = []
let deleteMode = 'trash'
let allowedRoots = []
const selectedNames = new Set()

// ─── DOM helpers ─────────────────────────────────────────────────────────────

const modal = () => document.getElementById('file-explorer-modal')
const body = () => document.getElementById('file-explorer-body')
const pathLabel = () => document.getElementById('file-explorer-path')
const selectionCount = () => document.getElementById('file-explorer-selection-count')
const deleteBtn = () => document.getElementById('file-explorer-delete-btn')
const modeBadge = () => document.getElementById('file-explorer-mode-badge')

// Pretty byte size — KB/MB/GB scale; 1 decimal at MB+ for the typical
// disc-rip sizes (1.x GB), otherwise integer to keep small files terse.
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatMtime(iso) {
  if (!iso) return '—'
  // Drop seconds and tz to keep the column tight; the user's just
  // eyeballing recency, not auditing.
  const d = new Date(iso)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}

// ─── Render ──────────────────────────────────────────────────────────────────

function renderModeBadge() {
  const el = modeBadge()
  if (!el) return
  if (deleteMode === 'trash') {
    el.textContent = 'Recycle Bin'
    el.className = 'text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium bg-emerald-900/50 text-emerald-300 border border-emerald-700/50'
    el.title = 'Deletes go to the OS Recycle Bin (DELETE_TO_TRASH=true)'
  } else {
    el.textContent = 'Permanent'
    el.className = 'text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium bg-rose-900/50 text-rose-300 border border-rose-700/50'
    el.title = 'Deletes are permanent — no recovery (DELETE_TO_TRASH=false)'
  }
}

function renderSelectionCount() {
  const n = selectedNames.size
  selectionCount().textContent = `${n} selected`
  deleteBtn().disabled = n === 0
}

function renderListing() {
  if (entries.length === 0) {
    body().innerHTML = '<p class="text-slate-500 text-sm py-4 text-center">Folder is empty.</p>'
    return
  }
  const rowsHtml = entries.map((entry) => {
    const checked = selectedNames.has(entry.name) ? 'checked' : ''
    const sizeCell = entry.isDirectory ? '—' : esc(formatSize(entry.size))
    const watchBtn = entry.isFile
      ? `<button class="fe-watch text-blue-400 hover:text-blue-300" data-name="${esc(entry.name)}" title="Play in browser">▶</button>`
      : '<span class="text-slate-700">—</span>'
    const copyBtn = entry.isFile
      ? `<button class="fe-copy text-slate-400 hover:text-slate-200" data-name="${esc(entry.name)}" title="Copy absolute path">📋</button>`
      : '<span class="text-slate-700">—</span>'
    const icon = entry.isDirectory ? '📁' : '🎬'
    const nameCell = `<span class="${entry.isDirectory ? 'text-slate-400' : 'text-slate-200'}">${icon} ${esc(entry.name)}</span>`
    return `<tr class="border-b border-slate-800 hover:bg-slate-800/30">
      <td class="py-1 px-2">
        <input type="checkbox" class="fe-checkbox" data-name="${esc(entry.name)}" ${checked}
          ${entry.isDirectory ? 'disabled title="Directories not deletable from this UI"' : ''}>
      </td>
      <td class="py-1 px-2 break-all">${nameCell}</td>
      <td class="py-1 px-2 text-right text-slate-400 font-mono text-xs whitespace-nowrap">${sizeCell}</td>
      <td class="py-1 px-2 text-slate-400 font-mono text-xs whitespace-nowrap">${esc(formatMtime(entry.mtime))}</td>
      <td class="py-1 px-2 text-center">${watchBtn}</td>
      <td class="py-1 px-2 text-center">${copyBtn}</td>
    </tr>`
  }).join('')
  body().innerHTML = `<table class="w-full text-sm">
    <thead class="text-[10px] uppercase tracking-wider text-slate-500 sticky top-0 bg-slate-900">
      <tr>
        <th class="py-1 px-2 text-left w-6"><input type="checkbox" id="fe-select-all" title="Select all files"></th>
        <th class="py-1 px-2 text-left">Name</th>
        <th class="py-1 px-2 text-right">Size</th>
        <th class="py-1 px-2 text-left">Modified</th>
        <th class="py-1 px-2 w-8"></th>
        <th class="py-1 px-2 w-8"></th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>`
  wireRowActions()
  renderSelectionCount()
}

function wireRowActions() {
  body().querySelectorAll('.fe-checkbox').forEach((cb) => {
    cb.addEventListener('change', (event) => {
      const name = event.target.getAttribute('data-name')
      if (event.target.checked) selectedNames.add(name)
      else selectedNames.delete(name)
      renderSelectionCount()
    })
  })
  body().querySelectorAll('.fe-watch').forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = btn.getAttribute('data-name')
      openVideoModal(joinPath(currentPath, name))
    })
  })
  body().querySelectorAll('.fe-copy').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const name = btn.getAttribute('data-name')
      const fullPath = joinPath(currentPath, name)
      try {
        await navigator.clipboard.writeText(fullPath)
        const original = btn.textContent
        btn.textContent = '✓'
        setTimeout(() => { btn.textContent = original }, 1200)
      } catch {
        // Clipboard API blocked (e.g., insecure origin). Fall back to
        // showing the path in a prompt so the user can still grab it.
        window.prompt('Copy this path manually:', fullPath)
      }
    })
  })
  const selectAll = document.getElementById('fe-select-all')
  if (selectAll) {
    selectAll.addEventListener('change', (event) => {
      if (event.target.checked) {
        entries.forEach((e) => { if (e.isFile) selectedNames.add(e.name) })
      } else {
        selectedNames.clear()
      }
      renderListing()
    })
  }
}

// Path joining respecting the OS separator. The /files/list response
// includes the separator field; we cache it on the listing's first
// load. Falls back to '/' for safety.
let pathSeparator = '/'
function joinPath(dir, child) {
  const trimmed = dir.endsWith(pathSeparator) ? dir.slice(0, -1) : dir
  return `${trimmed}${pathSeparator}${child}`
}

// ─── Loading ─────────────────────────────────────────────────────────────────

async function loadDeleteMode() {
  try {
    const resp = await fetch('/files/delete-mode')
    const data = await resp.json()
    deleteMode = data.mode
    allowedRoots = data.allowedRoots || []
  } catch {
    // If the endpoint is missing, default to 'permanent' so the UI is
    // honest about the safety story instead of falsely promising a
    // Recycle Bin fallback that doesn't exist.
    deleteMode = 'permanent'
    allowedRoots = []
  }
  renderModeBadge()
}

async function loadListing() {
  body().innerHTML = '<p class="text-slate-500 text-sm py-4 text-center">Loading…</p>'
  try {
    const url = new URL('/files/list', window.location.origin)
    url.searchParams.set('path', currentPath)
    const resp = await fetch(url)
    const data = await resp.json()
    if (data.error) {
      body().innerHTML = `<p class="text-rose-400 text-sm py-4">${esc(data.error)}</p>`
      return
    }
    entries = data.entries
    pathSeparator = data.separator || pathSeparator
    selectedNames.clear()
    renderListing()
  } catch (err) {
    body().innerHTML = `<p class="text-rose-400 text-sm py-4">${esc(String(err))}</p>`
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function openFileExplorer(path) {
  if (!path) return
  currentPath = path
  pathLabel().textContent = path
  modal().classList.remove('hidden')
  await Promise.all([loadDeleteMode(), loadListing()])
}

export function refreshFileExplorer() {
  loadListing()
}

export function closeFileExplorerModal(event) {
  if (event && event.target !== modal()) return
  modal().classList.add('hidden')
  // Pause/clear any playing video too if its sub-modal happens to be
  // open — closing the parent should kill the child.
  closeVideoModal()
}

export async function confirmFileExplorerDelete() {
  if (selectedNames.size === 0) return
  const verb = deleteMode === 'trash' ? 'Move' : 'Permanently delete'
  const target = deleteMode === 'trash' ? 'to Recycle Bin' : ''
  const filesText = `${selectedNames.size} file${selectedNames.size === 1 ? '' : 's'}`
  const confirmed = window.confirm(`${verb} ${filesText}${target ? ' ' + target : ''}?`)
  if (!confirmed) return
  const paths = Array.from(selectedNames).map((name) => joinPath(currentPath, name))
  try {
    const resp = await fetch('/files', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths }),
    })
    const data = await resp.json()
    const failed = data.results.filter((r) => !r.ok)
    if (failed.length > 0) {
      const summary = failed.map((r) => `• ${r.path}: ${r.error}`).join('\n')
      window.alert(`Deleted ${data.results.length - failed.length} of ${data.results.length}.\n\nFailed:\n${summary}`)
    }
    selectedNames.clear()
    await loadListing()
  } catch (err) {
    window.alert(`Delete request failed: ${err}`)
  }
}

// ─── Video sub-modal ─────────────────────────────────────────────────────────

const videoModal = () => document.getElementById('video-modal')
const videoPlayer = () => document.getElementById('video-modal-player')
const videoNameLabel = () => document.getElementById('video-modal-name')

export function openVideoModal(absolutePath) {
  const url = new URL('/files/stream', window.location.origin)
  url.searchParams.set('path', absolutePath)
  videoNameLabel().textContent = absolutePath
  const player = videoPlayer()
  player.src = url.toString()
  videoModal().classList.remove('hidden')
  // Wire copy-path button per-open so the closure captures the path
  // currently shown.
  const copyBtn = document.getElementById('video-modal-copy-path')
  copyBtn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(absolutePath)
      const original = copyBtn.textContent
      copyBtn.textContent = '✓ Copied'
      setTimeout(() => { copyBtn.textContent = original }, 1200)
    } catch {
      window.prompt('Copy this path manually:', absolutePath)
    }
  }
}

export function closeVideoModal(event) {
  if (event && event.target !== videoModal()) return
  const player = videoPlayer()
  if (player) {
    player.pause()
    player.removeAttribute('src')
    player.load()
  }
  if (videoModal()) videoModal().classList.add('hidden')
}
