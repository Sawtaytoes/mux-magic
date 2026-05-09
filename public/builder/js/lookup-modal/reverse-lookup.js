import { COMMANDS } from '../commands.js'
import { steps, findStepById } from '../sequence-state.js'
import { renderAll } from '../render-all.js'
import { refreshLinkedInputs, scheduleUpdateUrl } from '../sequence-editor.js'
import { LOOKUP_LINKS } from '../step-renderer.js'
import { updateYaml } from '../components/yaml-modal.js'
import { parseDvdCompareDisplayName } from '../util/dvd-compare.js'

const reverseLookupTimers = new Map()
const reverseLookupTokens = new Map()

function setCompanionDisplay(stepId, fieldName, text) {
  const el = document.querySelector(`[data-step="${stepId}"][data-companion="${fieldName}"]`)
  if (!el) return
  el.textContent = text
  el.title = text
  if (text) el.classList.remove('hidden')
  else el.classList.add('hidden')
}

export async function resolveTmdbForStep(stepId, baseTitle, year) {
  const step = steps.find((candidate) => candidate.id === stepId)
  if (!step || !baseTitle) return
  step.params.tmdbResolutionPending = true
  try {
    const response = await fetch('/queries/searchMovieDb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ searchTerm: baseTitle, year: year || undefined }),
    })
    if (!response.ok) return
    const data = await response.json()
    const top = (data.results || [])[0]
    if (top && top.movieDbId) {
      step.params.tmdbId = top.movieDbId
      step.params.tmdbName = top.year ? `${top.title} (${top.year})` : top.title
    } else {
      delete step.params.tmdbId
      delete step.params.tmdbName
    }
  } catch (err) {
    console.error('resolveTmdbForStep failed', err)
  } finally {
    delete step.params.tmdbResolutionPending
    step.params.tmdbResolutionAttempted = true
    renderAll()
  }
}

export function clearTmdbResolution(step) {
  delete step.params.tmdbId
  delete step.params.tmdbName
  delete step.params.tmdbResolutionAttempted
}

export function kickReverseLookups() {
  steps.forEach((step) => {
    if (!step.command) {
      return
    }
    const commandDefinition = COMMANDS[step.command]
    if (!commandDefinition) {
      return
    }
    commandDefinition.fields.forEach((field) => {
      if (field.type !== 'numberWithLookup') {
        return
      }
      if (!field.companionNameField) {
        return
      }
      const idValue = step.params[field.name]
      const numericId = Number(idValue)
      if (!Number.isFinite(numericId) || numericId <= 0) {
        return
      }
      const token = String(numericId)
      const key = `${step.id}-${field.name}`
      reverseLookupTokens.set(key, token)
      runReverseLookup(step.id, field.name, numericId, token)
    })
  })
}

export function kickTmdbResolutions() {
  steps.forEach((step) => {
    if (step.command !== 'nameSpecialFeatures') {
      return
    }
    if (step.params.tmdbId) {
      return
    }
    if (step.params.tmdbResolutionPending) {
      return
    }
    if (step.params.tmdbResolutionAttempted) {
      return
    }
    const parsed = parseDvdCompareDisplayName(step.params.dvdCompareName)
    if (!parsed?.baseTitle) {
      return
    }
    resolveTmdbForStep(step.id, parsed.baseTitle, parsed.year)
  })
}

export function updateLookupLinks(stepId, fieldName, rawValue) {
  const step = steps.find((candidate) => candidate.id === stepId)
  if (!step) return
  const cmd = COMMANDS[step.command]
  const field = cmd?.fields.find((candidate) => candidate.name === fieldName)
  if (!field || field.type !== 'numberWithLookup') return
  const lookupConfig = LOOKUP_LINKS[field.lookupType]
  if (!lookupConfig) return

  const numericValue = (rawValue !== undefined && rawValue !== '') ? Number(rawValue) : null
  const hasValidId = numericValue !== null && Number.isFinite(numericValue) && numericValue > 0
  const isNameSpecialFeaturesCard = (
    step.command === 'nameSpecialFeatures'
    && field.lookupType === 'dvdcompare'
  )

  const companion = document.querySelector(
    `[data-step="${stepId}"][data-companion="${fieldName}"]`,
  )
  if (companion && companion.tagName === 'A') {
    let companionHref
    if (isNameSpecialFeaturesCard) {
      // Movie name on the left → DVDCompare release URL when an ID
      // is set; falls back to DVDCompare home otherwise. (Swapped in
      // this session — used to point at TMDB; the user wanted the
      // primary click to open DVDCompare since that's the source of
      // truth for this command.)
      companionHref = hasValidId
        ? lookupConfig.buildUrl(numericValue, { ...step.params, [fieldName]: numericValue })
        : lookupConfig.homeUrl
    } else if (hasValidId) {
      const tempParams = { ...step.params, [fieldName]: numericValue }
      companionHref = lookupConfig.buildUrl(numericValue, tempParams)
    } else {
      companionHref = lookupConfig.homeUrl
    }
    companion.setAttribute('href', companionHref)
  }

  if (field.lookupType === 'dvdcompare') {
    const rightLink = document.querySelector(
      `[data-step="${stepId}"][data-right-link="${fieldName}"]`,
    )
    if (rightLink) {
      let href
      if (isNameSpecialFeaturesCard) {
        // Right-side link is now the TMDB target. Mirrors the
        // initial-render logic in step-renderer.js.
        if (step.params.tmdbId) {
          href = `https://www.themoviedb.org/movie/${encodeURIComponent(step.params.tmdbId)}`
        } else {
          href = 'https://www.themoviedb.org/'
        }
      } else {
        href = hasValidId
          ? lookupConfig.buildUrl(numericValue, { ...step.params, [fieldName]: numericValue })
          : lookupConfig.homeUrl
      }
      rightLink.setAttribute('href', href)
    }
  }
}

export function scheduleReverseLookup(stepId, fieldName, rawValue) {
  const key = `${stepId}-${fieldName}`
  if (reverseLookupTimers.has(key)) {
    clearTimeout(reverseLookupTimers.get(key))
    reverseLookupTimers.delete(key)
  }
  reverseLookupTokens.set(key, rawValue)

  const step = findStepById(stepId)
  if (!step) return
  const cmd = COMMANDS[step.command]
  const field = cmd?.fields.find(f => f.name === fieldName)
  if (!field?.companionNameField) return
  delete step.params[field.companionNameField]
  setCompanionDisplay(stepId, fieldName, '')
  updateYaml()

  if (fieldName === 'dvdCompareId') {
    const hashField = cmd?.fields.find(f => f.name === 'dvdCompareReleaseHash')
    if (hashField?.companionNameField) {
      delete step.params[hashField.companionNameField]
      setCompanionDisplay(stepId, 'dvdCompareReleaseHash', '')
    }
    clearTmdbResolution(step)
  }

  if (!rawValue) return
  const numericValue = Number(rawValue)
  if (!Number.isFinite(numericValue) || numericValue <= 0) return

  const timeoutId = setTimeout(() => {
    reverseLookupTimers.delete(key)
    runReverseLookup(stepId, fieldName, numericValue, rawValue)
  }, 600)
  reverseLookupTimers.set(key, timeoutId)
}

async function runReverseLookup(stepId, fieldName, id, requestToken) {
  const key = `${stepId}-${fieldName}`
  const step = findStepById(stepId)
  if (!step) return
  const cmd = COMMANDS[step.command]
  const field = cmd?.fields.find(f => f.name === fieldName)
  if (!field?.companionNameField) return

  const request = (() => {
    if (field.lookupType === 'mal') {
      return { endpoint: '/queries/lookupMal', body: { malId: id } }
    }
    if (field.lookupType === 'anidb') {
      return { endpoint: '/queries/lookupAnidb', body: { anidbId: id } }
    }
    if (field.lookupType === 'tvdb') {
      return { endpoint: '/queries/lookupTvdb', body: { tvdbId: id } }
    }
    if (field.lookupType === 'tmdb') {
      return { endpoint: '/queries/lookupMovieDb', body: { movieDbId: id } }
    }
    if (field.lookupType === 'dvdcompare') {
      return { endpoint: '/queries/lookupDvdCompare', body: { dvdCompareId: id } }
    }
    if (fieldName === 'dvdCompareReleaseHash') {
      if (!step.params.dvdCompareId) {
        return null
      }
      return {
        endpoint: '/queries/lookupDvdCompareRelease',
        body: { dvdCompareId: step.params.dvdCompareId, hash: String(id) },
      }
    }
    return null
  })()
  if (!request) {
    return
  }

  try {
    const response = await fetch(request.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request.body),
    })
    if (!response.ok) {
      return
    }
    const data = await response.json()
    const name = data.name ?? data.label
    if (!name) return

    if (reverseLookupTokens.get(key) !== requestToken) return

    step.params[field.companionNameField] = name
    if (fieldName === 'dvdCompareId' && step.command === 'nameSpecialFeatures') {
      step.params.tmdbResolutionPending = true
      setCompanionDisplay(stepId, fieldName, '')
    } else {
      setCompanionDisplay(stepId, fieldName, name)
    }
    updateYaml()
    scheduleUpdateUrl()

    if (fieldName === 'dvdCompareId') {
      const hashField = cmd?.fields.find(f => f.name === 'dvdCompareReleaseHash')
      if (hashField) {
        const hashValue = step.params.dvdCompareReleaseHash ?? hashField.default ?? 1
        const hashKey = `${stepId}-dvdCompareReleaseHash`
        const hashToken = String(hashValue)
        reverseLookupTokens.set(hashKey, hashToken)
        runReverseLookup(stepId, 'dvdCompareReleaseHash', Number(hashValue), hashToken)
      }
      if (step.command === 'nameSpecialFeatures') {
        const parsed = parseDvdCompareDisplayName(name)
        if (parsed?.baseTitle) {
          resolveTmdbForStep(stepId, parsed.baseTitle, parsed.year)
        }
      }
    }
  } catch (err) {
    console.error('Reverse lookup failed', err)
  }
}
