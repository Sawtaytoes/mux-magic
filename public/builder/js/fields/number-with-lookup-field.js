import { esc } from '../util/html-escape.js'
import { renderFieldLabel } from './field-label.js'
import { LOOKUP_LINKS } from '../util/lookup-links.js'
import { parseDvdCompareDisplayName } from '../util/dvd-compare.js'

/**
 * @param {{ step: object, field: object }} props
 * @returns {string}
 */
export function renderNumberWithLookupField({ step, field }) {
  const label = renderFieldLabel({ command: step.command, field })
  const num = step.params[field.name] ?? field.default ?? ''
  const companion = field.companionNameField ? step.params[field.companionNameField] : null
  const lookupConfig = LOOKUP_LINKS[field.lookupType]
  const idValue = step.params[field.name]
  const isNameSpecialFeaturesCard = (
    step.command === 'nameSpecialFeatures'
    && field.lookupType === 'dvdcompare'
  )
  let companionText = companion ?? ''
  let companionHref = lookupConfig?.homeUrl ?? '#'
  let tmdbHref = ''
  const tmdbLabel = 'Open on TheMovieDB'

  if (isNameSpecialFeaturesCard) {
    if (idValue) {
      companionHref = lookupConfig.buildUrl(idValue, step.params)
    }
    if (step.params.tmdbId) {
      tmdbHref = `https://www.themoviedb.org/movie/${encodeURIComponent(step.params.tmdbId)}`
    } else if (step.params.tmdbResolutionPending) {
      tmdbHref = 'https://www.themoviedb.org/'
    } else if (companion) {
      const parsedDvdCompare = parseDvdCompareDisplayName(companion)
      const fallbackTitle = parsedDvdCompare?.baseTitle || step.params.searchTerm || null
      if (fallbackTitle) {
        const searchQuery = parsedDvdCompare?.year
          ? `${fallbackTitle} y:${parsedDvdCompare.year}`
          : fallbackTitle
        tmdbHref = `https://www.themoviedb.org/search/movie?query=${encodeURIComponent(searchQuery)}`
      } else {
        tmdbHref = 'https://www.themoviedb.org/'
      }
    } else {
      tmdbHref = 'https://www.themoviedb.org/'
    }
  } else if (lookupConfig && idValue) {
    companionHref = lookupConfig.buildUrl(idValue, step.params)
  }

  const companionLink = lookupConfig
    ? `<div class="flex-1 min-w-0 truncate"><a data-step="${step.id}" data-companion="${field.name}" href="${esc(companionHref)}" target="_blank" rel="noopener" class="text-xs text-blue-400 hover:text-blue-300 hover:underline ${companionText ? '' : 'hidden'}" title="${esc(companionText)}">${esc(companionText)}</a></div>`
    : `<p data-step="${step.id}" data-companion="${field.name}" class="flex-1 min-w-0 text-xs text-slate-500 truncate ${companionText ? '' : 'hidden'}" title="${esc(companionText)}">${esc(companionText)}</p>`

  let rightSideLink = ''
  if (isNameSpecialFeaturesCard) {
    rightSideLink = `<a data-step="${step.id}" data-right-link="${field.name}" href="${esc(tmdbHref)}" target="_blank" rel="noopener" class="shrink-0 text-xs text-blue-400 hover:text-blue-300 inline-flex items-center gap-1">↗ ${esc(tmdbLabel)}</a>`
  } else if (field.lookupType === 'dvdcompare' && lookupConfig) {
    const releaseHref = idValue
      ? lookupConfig.buildUrl(idValue, step.params)
      : lookupConfig.homeUrl
    rightSideLink = `<a data-step="${step.id}" data-right-link="${field.name}" href="${esc(releaseHref)}" target="_blank" rel="noopener" class="shrink-0 text-xs text-blue-400 hover:text-blue-300 inline-flex items-center gap-1">↗ ${esc(lookupConfig.label)}</a>`
  }

  return `<div>${label}<div class="flex items-center gap-2">
    <input type="number" data-step="${step.id}" data-field="${field.name}" value="${esc(num)}" placeholder="${esc(field.placeholder ?? '')}"
      oninput="setParam('${step.id}','${field.name}',this.value===''?undefined:Number(this.value)); scheduleReverseLookup('${step.id}','${field.name}',this.value); updateLookupLinks('${step.id}','${field.name}',this.value)"
      class="flex-1 min-w-0 bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500" />
    <button onclick="openLookup('${field.lookupType}','${step.id}','${field.name}')"
      title="Look up ${esc(field.label)}"
      class="shrink-0 text-xs bg-slate-700 hover:bg-blue-700 text-slate-200 hover:text-white px-2.5 py-1.5 rounded border border-slate-600 hover:border-blue-500">🔍</button>
  </div>
  <div class="flex items-start gap-2 mt-0.5">
    ${companionLink}
    ${rightSideLink}
  </div>
  </div>`
}
