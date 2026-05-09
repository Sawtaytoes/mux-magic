// ─── Lookup modal + reverse lookup ───────────────────────────────────────────
//
// Multi-stage search UI for MAL, AniDB, TVDB, and DVDCompare, plus the
// reverse-lookup (typed ID → fetch display name) and TMDB resolution chain.

import { COMMANDS } from './commands.js'
import { findStepById } from './sequence-state.js'
import { renderAll } from './render-all.js'
import { refreshLinkedInputs } from './sequence-editor.js'
import { LOOKUP_LINKS } from './step-renderer.js'
import { updateYaml } from './components/yaml-modal.js'
import { displayDvdCompareVariant } from './util/dvd-compare.js'
import { renderLookupSearchView, renderLookupVariantView, renderLookupReleaseView } from './lookup-modal/views.js'
import { clearTmdbResolution, resolveTmdbForStep } from './lookup-modal/reverse-lookup.js'

export { parseDvdCompareDisplayName } from './util/dvd-compare.js'
export {
  resolveTmdbForStep,
  clearTmdbResolution,
  kickReverseLookups,
  kickTmdbResolutions,
  updateLookupLinks,
  scheduleReverseLookup,
} from './lookup-modal/reverse-lookup.js'

// ─── Lookup modal state ───────────────────────────────────────────────────────

let lookupState = null
// shape: { lookupType, stepId, fieldName, stage, searchTerm, results, formatFilter,
//          selectedGroup, selectedFid, releases, loading }

const LOOKUP_TITLES = {
  mal: 'Look up MAL ID',
  anidb: 'Look up AniDB ID',
  tvdb: 'Look up TVDB ID',
  dvdcompare: 'Look up DVDCompare Film ID',
}

// ─── Resolves the external link for a step (or for one specific field) ────────
// Returns { url, label } or null.
export function getLookupLinkData(step, field) {
  if (field) {
    const lookup = LOOKUP_LINKS[field.lookupType]
    if (!lookup) return null
    const id = step.params[field.name]
    if (id === undefined || id === null || id === '') return null
    return { url: lookup.buildUrl(id, step.params), label: lookup.label }
  }
  const cmd = COMMANDS[step.command]
  if (!cmd) return null
  const lookupField = cmd.fields.find((candidate) => (
    candidate.type === 'numberWithLookup'
    && LOOKUP_LINKS[candidate.lookupType]
  ))
  if (lookupField) {
    const id = step.params[lookupField.name]
    if (id !== undefined && id !== null && id !== '') {
      const lookup = LOOKUP_LINKS[lookupField.lookupType]
      return { url: lookup.buildUrl(id, step.params), label: lookup.label }
    }
  }
  if (step.command === 'nameSpecialFeatures' && step.params.url) {
    return { url: step.params.url, label: 'open URL on DVDCompare' }
  }
  return null
}

// ─── Open / close / navigate ──────────────────────────────────────────────────

export function openLookup(lookupType, stepId, fieldName) {
  lookupState = {
    lookupType, stepId, fieldName,
    stage: 'search',
    searchTerm: '',
    searchError: null,
    results: null,
    formatFilter: lookupType === 'dvdcompare' ? 'Blu-ray 4K' : 'all',
    selectedGroup: null,
    selectedVariant: null,
    selectedFid: null,
    releases: null,
    releasesDebug: null,
    releasesError: null,
    loading: false,
    _activeOptions: [],
    _activeResults: null,
    _renderedGroups: null,
  }
  installLookupKeyboardHandler()
  renderLookupModal()
  document.getElementById('lookup-modal').classList.remove('hidden')
  setTimeout(() => document.getElementById('lookup-search-input')?.focus(), 50)
}

export function closeLookupModal(event) {
  if (event && event.target !== document.getElementById('lookup-modal')) return
  document.getElementById('lookup-modal').classList.add('hidden')
  uninstallLookupKeyboardHandler()
  lookupState = null
}

export function lookupGoBack() {
  if (!lookupState) return
  if (lookupState.stage === 'release') {
    lookupState.stage = 'variant'
  } else if (lookupState.stage === 'variant') {
    lookupState.stage = 'search'
    lookupState.selectedGroup = null
  }
  renderLookupModal()
}

// ─── Exported helpers for HTML inline event handlers ─────────────────────────

export function setLookupFormatFilter(value) {
  if (!lookupState) return
  lookupState.formatFilter = value
  renderLookupModal()
}

export function setLookupSearchTerm(value) {
  if (!lookupState) return
  lookupState.searchTerm = value
}

// ─── Render orchestrator ──────────────────────────────────────────────────────

function renderLookupModal() {
  const titleEl = document.getElementById('lookup-title')
  const backBtn = document.getElementById('lookup-back-btn')
  const body = document.getElementById('lookup-body')
  if (!lookupState) return

  titleEl.textContent = LOOKUP_TITLES[lookupState.lookupType] ?? 'Lookup'

  if (lookupState.stage === 'search') {
    backBtn.classList.add('hidden')
    body.innerHTML = renderLookupSearchView(lookupState)
  } else if (lookupState.stage === 'variant') {
    backBtn.classList.remove('hidden')
    body.innerHTML = renderLookupVariantView(lookupState)
  } else if (lookupState.stage === 'release') {
    backBtn.classList.remove('hidden')
    body.innerHTML = renderLookupReleaseView(lookupState)
  }
}

// ─── Search action ────────────────────────────────────────────────────────────

export async function runLookupSearch(searchTerm) {
  if (!searchTerm || !lookupState) return
  lookupState.searchTerm = searchTerm
  lookupState.searchError = null
  document.getElementById('lookup-search-input')?.blur()
  lookupState.loading = true
  renderLookupModal()
  try {
    const endpoint = lookupState.lookupType === 'mal' ? '/queries/searchMal'
                   : lookupState.lookupType === 'anidb' ? '/queries/searchAnidb'
                   : lookupState.lookupType === 'tvdb' ? '/queries/searchTvdb'
                   : lookupState.lookupType === 'tmdb' ? '/queries/searchMovieDb'
                   : '/queries/searchDvdCompare'
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ searchTerm }),
    })
    const data = await resp.json()
    lookupState.results = data.results ?? []
    lookupState.searchError = data.error ?? null
    if (data.error) console.error('[lookup search]', data.error)
  } catch (err) {
    lookupState.results = []
    lookupState.searchError = err?.message ?? String(err)
    console.error('Lookup search failed', err)
  }
  lookupState.loading = false
  renderLookupModal()
}

// ─── Selection handlers ───────────────────────────────────────────────────────

export function lookupSelectSimpleByIndex(index) {
  if (!lookupState) return
  const r = lookupState._activeResults?.[index]
  if (!r) return
  let id, displayName
  if (lookupState.lookupType === 'mal') {
    id = r.malId
    displayName = r.name
  } else if (lookupState.lookupType === 'anidb') {
    id = r.aid
    displayName = r.name
  } else if (lookupState.lookupType === 'tvdb') {
    id = r.tvdbId
    displayName = r.name
  } else if (lookupState.lookupType === 'tmdb') {
    id = r.movieDbId
    displayName = r.year ? `${r.title} (${r.year})` : r.title
  } else {
    id = r.tvdbId
    displayName = r.name
  }
  const step = findStepById(lookupState.stepId)
  if (step) {
    const cmd = COMMANDS[step.command]
    const field = cmd?.fields.find(f => f.name === lookupState.fieldName)
    step.params[lookupState.fieldName] = id
    if (field?.companionNameField && displayName) {
      step.params[field.companionNameField] = displayName
    }
    refreshLinkedInputs()
    updateYaml()
    renderAll()
  }
  closeLookupModal()
}

export function lookupSelectGroup(index) {
  if (!lookupState) return
  const group = lookupState._renderedGroups?.[index]
  if (!group) return
  lookupState.selectedGroup = group
  // If only one variant, skip straight to release stage
  if (group.variants.length === 1) {
    lookupSelectVariant(group.variants[0].id, group.variants[0].variant)
    return
  }
  lookupState.stage = 'variant'
  renderLookupModal()
}

export async function lookupSelectVariant(fid, variant) {
  if (!lookupState) return
  lookupState.selectedFid = fid
  lookupState.selectedVariant = variant ?? null
  lookupState.stage = 'release'
  lookupState.releases = null
  lookupState.releasesDebug = null
  lookupState.releasesError = null
  lookupState.loading = true
  renderLookupModal()
  try {
    const resp = await fetch('/queries/listDvdCompareReleases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dvdCompareId: fid }),
    })
    const data = await resp.json()
    lookupState.releases = data.releases ?? []
    lookupState.releasesDebug = data.debug ?? null
    lookupState.releasesError = data.error ?? null
    if (data.error) {
      console.error('[listDvdCompareReleases] error', data.error)
    } else if (lookupState.releases.length === 0) {
      console.warn('[listDvdCompareReleases] no releases', data.debug)
    }
  } catch (err) {
    lookupState.releases = []
    lookupState.releasesError = err?.message ?? String(err)
    console.error('listDvdCompareReleases failed', err)
  }
  lookupState.loading = false

  // Single release — auto-select it.
  if (lookupState.releases && lookupState.releases.length === 1) {
    const only = lookupState.releases[0]
    lookupSelectRelease(only.hash, only.label)
    return
  }

  renderLookupModal()
}

export function lookupSelectReleaseByIndex(index) {
  if (!lookupState) return
  const release = lookupState.releases?.[index]
  if (!release) return
  lookupSelectRelease(release.hash, release.label)
}

export function lookupSelectRelease(hash, label) {
  if (!lookupState) return
  const step = findStepById(lookupState.stepId)
  if (step) {
    step.params.dvdCompareId = lookupState.selectedFid
    step.params.dvdCompareReleaseHash = Number(hash) || hash
    const group = lookupState.selectedGroup
    if (group) {
      const variantSuffix = lookupState.selectedVariant && lookupState.selectedVariant !== 'DVD'
        ? ` (${displayDvdCompareVariant(lookupState.selectedVariant)})` : ''
      const yearSuffix = group.year ? ` (${group.year})` : ''
      step.params.dvdCompareName = `${group.baseTitle}${variantSuffix}${yearSuffix}`
    }
    if (label) step.params.dvdCompareReleaseLabel = label
    clearTmdbResolution(step)
    if (group?.baseTitle && step.command === 'nameSpecialFeatures') {
      step.params.tmdbResolutionPending = true
    }
    refreshLinkedInputs()
    updateYaml()
    renderAll()
    if (group?.baseTitle && step.command === 'nameSpecialFeatures') {
      resolveTmdbForStep(step.id, group.baseTitle, group.year || '')
    }
  }
  closeLookupModal()
}

// ─── Keyboard handler ─────────────────────────────────────────────────────────

let lookupKeydownHandler = null

function installLookupKeyboardHandler() {
  uninstallLookupKeyboardHandler()
  lookupKeydownHandler = (event) => {
    if (!lookupState) return
    if (event.key === 'Escape') {
      closeLookupModal()
      return
    }
    if (event.target?.tagName === 'INPUT' || event.target?.tagName === 'TEXTAREA') return
    if (event.key >= '1' && event.key <= '9') {
      const index = Number(event.key) - 1
      const handler = lookupState._activeOptions?.[index]
      if (handler) {
        event.preventDefault()
        handler()
      }
    }
  }
  document.addEventListener('keydown', lookupKeydownHandler)
}

function uninstallLookupKeyboardHandler() {
  if (lookupKeydownHandler) {
    document.removeEventListener('keydown', lookupKeydownHandler)
    lookupKeydownHandler = null
  }
}
