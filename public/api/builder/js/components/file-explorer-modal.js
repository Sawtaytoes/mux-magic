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
let deleteModeReason = null
const selectedNames = new Set()
// Set when openFileExplorer is invoked in picker mode. The picker badge
// renders, the "Delete selected" button hides, and the title bar grows a
// "📌 Use this folder" trigger that calls this back with currentPath.
// Cleared on close so the next non-picker open behaves normally.
let pickerOnSelect = null
// Active sort column ('default' uses the server's dirs-first/alphabetical
// order; 'name' / 'duration' / 'size' / 'mtime' use the corresponding
// entry field). Persisted across opens — switching folders shouldn't
// reset the user's sort preference. ASC for default; click toggles.
let sortColumn = 'default'
let sortDirection = 'asc'

// ─── DOM helpers ─────────────────────────────────────────────────────────────

const modal = () => document.getElementById('file-explorer-modal')
const body = () => document.getElementById('file-explorer-body')
const breadcrumb = () => document.getElementById('file-explorer-breadcrumb')
const selectionCount = () => document.getElementById('file-explorer-selection-count')
const footer = () => document.getElementById('file-explorer-footer')
const deleteBtn = () => document.getElementById('file-explorer-delete-btn')
const modeBadge = () => document.getElementById('file-explorer-mode-badge')
const pickerBadge = () => document.getElementById('file-explorer-picker-badge')
const pickBtn = () => document.getElementById('file-explorer-pick-btn')

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

// Splits the current path into clickable ancestor links. Click any
// segment to navigate up to that level; the trailing segment is the
// current directory and renders as plain text. Builds the cumulative
// target path as we walk segments so we don't have to round-trip through
// the OS separator's regex-escape dance.
function buildBreadcrumbSegments(path, sep) {
  if (!path) return []
  const parts = path.split(sep)
  const segments = []
  let cumulative = ''
  parts.forEach((part, idx) => {
    if (idx === 0) {
      // Windows: 'G:' from 'G:\\foo' — root is 'G:\\'.
      // POSIX: '' from '/home/foo' — root is '/'.
      if (part === '') {
        cumulative = sep
        segments.push({ label: sep, target: sep })
      } else {
        cumulative = part + sep
        segments.push({ label: part, target: cumulative })
      }
      return
    }
    // Skip trailing-separator empties (e.g. path 'G:\\').
    if (part === '') return
    cumulative += (idx === 1 ? '' : sep) + part
    // For non-root nodes, trim any trailing separator from the target.
    const target = cumulative.replace(new RegExp(sep === '\\' ? '\\\\$' : sep + '$'), '')
    segments.push({ label: part, target })
  })
  return segments
}

function renderBreadcrumb() {
  const el = breadcrumb()
  if (!el) return
  el.innerHTML = ''
  if (!currentPath) return
  const sep = pathSeparator
  const segments = buildBreadcrumbSegments(currentPath, sep)

  segments.forEach((seg, idx) => {
    const isLast = idx === segments.length - 1
    if (isLast) {
      const text = document.createElement('span')
      text.className = 'text-slate-200 truncate'
      text.textContent = seg.label
      el.appendChild(text)
    } else {
      const link = document.createElement('button')
      link.className = 'text-blue-300 hover:text-blue-200 underline-offset-2 hover:underline truncate shrink-0'
      link.textContent = seg.label
      link.title = `Navigate to ${seg.target}`
      link.onclick = () => navigateTo(seg.target)
      el.appendChild(link)
      const sepEl = document.createElement('span')
      sepEl.className = 'text-slate-500 shrink-0'
      sepEl.textContent = ` ${sep} `
      el.appendChild(sepEl)
    }
  })
}

function navigateTo(newPath) {
  currentPath = newPath
  selectedNames.clear()
  // Reload listing + delete-mode (network-drive detection is path-aware,
  // so navigating from a network share into a local dir flips the mode).
  loadDeleteMode()
  loadListing()
  renderBreadcrumb()
}

// Sort comparator factories — directories ALWAYS group above files
// regardless of the active sort column (matches OS file-manager
// expectations). Within each group, the active column drives ordering.
function buildEntriesComparator() {
  const dir = sortDirection === 'desc' ? -1 : 1
  const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) * dir
  const byDuration = (a, b) => {
    // Durations like '4:48' or '1:38:47'. Convert to seconds; nulls
    // (non-video / unknown) sort to the end regardless of direction.
    const aSec = durationToSeconds(a.duration)
    const bSec = durationToSeconds(b.duration)
    if (aSec === null && bSec === null) return 0
    if (aSec === null) return 1
    if (bSec === null) return -1
    return (aSec - bSec) * dir
  }
  const bySize = (a, b) => (a.size - b.size) * dir
  const byMtime = (a, b) => {
    if (!a.mtime && !b.mtime) return 0
    if (!a.mtime) return 1
    if (!b.mtime) return -1
    return (Date.parse(a.mtime) - Date.parse(b.mtime)) * dir
  }
  const inner = (
    sortColumn === 'name' ? byName
    : sortColumn === 'duration' ? byDuration
    : sortColumn === 'size' ? bySize
    : sortColumn === 'mtime' ? byMtime
    // 'default' replays the server-side order (already directories-first
    // then case-insensitive name). Returning 0 keeps Array.prototype.sort
    // stable so the server-supplied order survives.
    : () => 0
  )
  return (a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return inner(a, b)
  }
}

function durationToSeconds(timecode) {
  if (!timecode) return null
  const parts = timecode.split(':').map(Number)
  if (parts.some(Number.isNaN)) return null
  if (parts.length === 1) return parts[0]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return parts[0] * 3600 + parts[1] * 60 + parts[2]
}

function setSort(column) {
  if (sortColumn === column) {
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'
  } else {
    sortColumn = column
    sortDirection = 'asc'
  }
  renderListing()
}

function sortIndicator(column) {
  if (sortColumn !== column) return ''
  return sortDirection === 'asc' ? ' ▲' : ' ▼'
}

function renderPickerUi() {
  const isPicker = typeof pickerOnSelect === 'function'
  pickerBadge().classList.toggle('hidden', !isPicker)
  pickBtn().classList.toggle('hidden', !isPicker)
  // Hide the bulk-delete footer in picker mode — accidental destructive
  // operations during a pick flow would be a bad surprise.
  footer().classList.toggle('hidden', isPicker)
}

function renderModeBadge() {
  const el = modeBadge()
  if (!el) return
  // Frame the badge as the action it describes ("Delete → X") rather
  // than just the destination. Standalone "Recycle Bin" or "Permanent"
  // didn't read as a delete target at a glance.
  if (deleteMode === 'trash') {
    el.textContent = 'Delete → Recycle Bin'
    el.className = 'text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium bg-emerald-900/50 text-emerald-300 border border-emerald-700/50'
    el.title = 'Deletes go to the OS Recycle Bin (DELETE_TO_TRASH=true)'
  } else {
    el.textContent = 'Delete → Permanent'
    el.className = 'text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium bg-rose-900/50 text-rose-300 border border-rose-700/50'
    // Reason is supplied by the server when the mode auto-downgraded —
    // typically a network drive that the OS Recycle Bin can't service.
    // Surface it in the tooltip and (when present) inline next to the
    // badge so the user isn't blindsided by a permanent delete.
    el.title = deleteModeReason || 'Deletes are permanent — no recovery (DELETE_TO_TRASH=false)'
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
  // Apply the active sort. Mutating-sort on a slice keeps `entries`
  // (the server-supplied order) intact so 'default' can fall back to
  // it without re-fetching.
  const sortedEntries = entries.slice().sort(buildEntriesComparator())
  const rowsHtml = sortedEntries.map((entry) => {
    const checked = selectedNames.has(entry.name) ? 'checked' : ''
    const sizeCell = entry.isDirectory ? '—' : esc(formatSize(entry.size))
    // Server returns null for non-video files / directories / mediainfo
    // failures. Show an em-dash so the column doesn't look empty.
    const durationCell = entry.duration ? esc(entry.duration) : '—'
    const copyBtn = entry.isFile
      ? `<button class="fe-copy text-slate-400 hover:text-slate-200" data-name="${esc(entry.name)}" title="Copy absolute path">📋</button>`
      : '<span class="text-slate-700">—</span>'
    const icon = entry.isDirectory ? '📁' : '🎬'
    // Clicking the name navigates (directories) or plays (files). Both
    // render as buttons with the same hover affordance so the row's
    // interactivity is obvious.
    const nameContent = `${icon} ${esc(entry.name)}`
    const nameCell = entry.isDirectory
      ? `<button class="fe-name fe-dir text-left text-slate-200 hover:text-blue-300 underline-offset-2 hover:underline w-full" data-name="${esc(entry.name)}" title="Open this folder">${nameContent}</button>`
      : entry.isFile
        ? `<button class="fe-name fe-file text-left text-slate-200 hover:text-blue-300 underline-offset-2 hover:underline w-full" data-name="${esc(entry.name)}" title="Play in browser">${nameContent}</button>`
        : `<span class="text-slate-400">${nameContent}</span>`
    return `<tr class="border-b border-slate-800 hover:bg-slate-800/30">
      <td class="py-1 px-2">
        <input type="checkbox" class="fe-checkbox" data-name="${esc(entry.name)}" ${checked}
          ${entry.isDirectory ? 'disabled title="Directories not deletable from this UI"' : ''}>
      </td>
      <td class="py-1 px-2 break-all">${nameCell}</td>
      <td class="py-1 px-2 text-right text-slate-300 font-mono text-xs whitespace-nowrap">${durationCell}</td>
      <td class="py-1 px-2 text-right text-slate-400 font-mono text-xs whitespace-nowrap">${sizeCell}</td>
      <td class="py-1 px-2 text-slate-400 font-mono text-xs whitespace-nowrap">${esc(formatMtime(entry.mtime))}</td>
      <td class="py-1 px-2 text-center">${copyBtn}</td>
    </tr>`
  }).join('')
  // Sticky <thead> needs both top-0 AND a high z-index so tbody rows
  // scroll UNDER it instead of rendering above. Also: the parent body
  // div had p-3 padding earlier — that pushed the sticky element off
  // top:0 of the scroll viewport, so rows above the scroll position
  // bled through. Padding now lives inside the table block so the
  // thead snaps cleanly to the top of the scroll container.
  // Sortable column headers. Clicking a header toggles between asc/desc
  // when already active, or switches to that column at asc when not.
  // Indicator (▲/▼) renders next to the active column. Directories
  // always group above files regardless of column — the comparator
  // handles that.
  const sortableHeader = (column, label, extraClass = '') => (
    `<th class="py-2 px-2 ${extraClass} cursor-pointer hover:text-white select-none" data-fe-sort="${column}" title="Click to sort by ${label.toLowerCase()}">${label}<span class="ml-1 text-slate-300">${sortIndicator(column)}</span></th>`
  )
  body().innerHTML = `<div class="px-3 py-2"><table class="w-full text-sm">
    <thead class="text-[10px] uppercase tracking-wider text-slate-300 sticky top-0 bg-slate-800 z-10 shadow-sm">
      <tr>
        <th class="py-2 px-2 text-left w-6"><input type="checkbox" id="fe-select-all" title="Select all files"></th>
        ${sortableHeader('name', 'Name', 'text-left')}
        ${sortableHeader('duration', 'Duration', 'text-right')}
        ${sortableHeader('size', 'Size', 'text-right')}
        ${sortableHeader('mtime', 'Modified', 'text-left')}
        <th class="py-2 px-2 w-8"></th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table></div>`
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
  body().querySelectorAll('.fe-dir').forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = btn.getAttribute('data-name')
      navigateTo(joinPath(currentPath, name))
    })
  })
  body().querySelectorAll('.fe-file').forEach((btn) => {
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
  body().querySelectorAll('[data-fe-sort]').forEach((th) => {
    th.addEventListener('click', () => setSort(th.getAttribute('data-fe-sort')))
  })
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
    const url = new URL('/files/delete-mode', window.location.origin)
    if (currentPath) url.searchParams.set('path', currentPath)
    const resp = await fetch(url)
    const data = await resp.json()
    deleteMode = data.mode
    deleteModeReason = data.reason || null
  } catch {
    // If the endpoint is missing, default to 'permanent' so the UI is
    // honest about the safety story instead of falsely promising a
    // Recycle Bin fallback that doesn't exist.
    deleteMode = 'permanent'
    deleteModeReason = 'Could not determine delete mode (endpoint unreachable)'
  }
  renderModeBadge()
}

async function loadListing() {
  body().innerHTML = '<p class="text-slate-500 text-sm py-4 text-center">Loading…</p>'
  try {
    const url = new URL('/files/list', window.location.origin)
    url.searchParams.set('path', currentPath)
    // Always request video durations — the user explicitly asked for
    // timecodes in the explorer to compare against DVDCompare's listing.
    // The server caps mediainfo concurrency at 8 so a folder of 50 files
    // is still ~1-2s.
    url.searchParams.set('includeDuration', '1')
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
    // Re-render the breadcrumb after the listing call lands — the very
    // first open won't have pathSeparator until the server replies, so
    // the initial render in openFileExplorer might use the fallback.
    renderBreadcrumb()
  } catch (err) {
    body().innerHTML = `<p class="text-rose-400 text-sm py-4">${esc(String(err))}</p>`
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

// `options.pickerOnSelect`: when set, the modal renders in picker mode —
// the "PICKER" badge appears, the bulk-delete footer hides, and a
// "📌 Use this folder" button in the title bar invokes this callback
// with the currently-displayed directory path (then closes the modal).
// Click-to-play and click-to-navigate row behavior is unchanged in
// picker mode so the user can preview / dive in without exiting.
export async function openFileExplorer(path, options = {}) {
  if (!path) return
  currentPath = path
  pickerOnSelect = typeof options.pickerOnSelect === 'function' ? options.pickerOnSelect : null
  renderBreadcrumb()
  renderPickerUi()
  modal().classList.remove('hidden')
  // delete-mode now wants the path so it can downgrade trash → permanent
  // for network drives. loadDeleteMode reads currentPath, so it must run
  // AFTER the assignment above.
  await Promise.all([loadDeleteMode(), loadListing()])
}

export function confirmFileExplorerPick() {
  if (!pickerOnSelect) return
  const cb = pickerOnSelect
  // Clear before invoking so the callback's setParam → renderAll cycle
  // doesn't see a stale picker reference if it ends up reopening the
  // modal for some reason.
  pickerOnSelect = null
  modal().classList.add('hidden')
  renderPickerUi()
  cb(currentPath)
}

export function refreshFileExplorer() {
  loadListing()
}

export function closeFileExplorerModal(event) {
  if (event && event.target !== modal()) return
  modal().classList.add('hidden')
  // Clear picker mode on close so the next open without options reverts
  // to read-only browsing — the "Use this folder" button and badge
  // shouldn't linger across opens.
  pickerOnSelect = null
  renderPickerUi()
  // Pause/clear any playing video too if its sub-modal happens to be
  // open — closing the parent should kill the child.
  closeVideoModal()
}

// Document-level keydown listener — ESC closes whichever modal is on
// top. Video sub-modal takes priority since it's z-[60] over the
// explorer's z-50; closing it first matches the visual stack so the
// user only loses one layer per press.
function handleEscapeKey(event) {
  if (event.key !== 'Escape') return
  if (videoModal() && !videoModal().classList.contains('hidden')) {
    event.preventDefault()
    closeVideoModal()
    return
  }
  if (modal() && !modal().classList.contains('hidden')) {
    event.preventDefault()
    closeFileExplorerModal()
  }
}

// Bound once at module load — the listener is cheap to leave attached
// (no work when no modal is open) and survives rerenders since we never
// detach. capture:true is critical: when the user clicks into the video
// element's seek bar, focus moves into the <video>'s native controls
// shadow DOM and ESC keypresses are absorbed by the bubbling-phase
// handlers there. Capturing on the way DOWN catches it before the video
// element gets a chance.
document.addEventListener('keydown', handleEscapeKey, { capture: true })

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
  // The HTML attribute handles autoplay on the first open, but the
  // <video> element is reused across subsequent opens — changing src
  // doesn't re-trigger the attribute, so call play() explicitly. The
  // user's click on ▶ counts as a user gesture so autoplay policies
  // allow this. play() returns a Promise that rejects when the codec
  // is unsupported (DTS/HEVC on browsers without hardware decode);
  // swallow it since the controls + the codec-caveat footer make the
  // failure obvious.
  player.play().catch(() => { /* unsupported codec; user falls back to VLC */ })
  // Wire per-open buttons so each closure captures the path currently
  // shown — onclick assignment overwrites any previous handler so we
  // don't accumulate stale closures across opens.
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
  const openExternalBtn = document.getElementById('video-modal-open-external')
  openExternalBtn.onclick = async () => {
    const original = openExternalBtn.textContent
    openExternalBtn.textContent = '⏳ Launching…'
    try {
      const resp = await fetch('/files/open-external', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: absolutePath }),
      })
      const data = await resp.json()
      if (data.ok) {
        openExternalBtn.textContent = '✓ Launched'
      } else {
        openExternalBtn.textContent = '✗ Failed'
        console.error('Launch failed:', data.error)
      }
    } catch (err) {
      openExternalBtn.textContent = '✗ Failed'
      console.error('Launch failed:', err)
    }
    setTimeout(() => { openExternalBtn.textContent = original }, 1500)
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
