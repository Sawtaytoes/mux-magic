import { displayDvdCompareVariant } from "../util/dvd-compare.js"
import { esc } from "../util/html-escape.js"

function kbdBadge(index) {
  return index < 9
    ? `<kbd class="text-xs font-mono bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded border border-slate-600 shrink-0">${index + 1}</kbd>`
    : ""
}

function renderSimpleSearchResults(state) {
  state._activeResults = state.results
  state._activeOptions = state.results.map(
    (_, index) => () =>
      window.lookupSelectSimpleByIndex(index),
  )
  return state.results
    .map((r, index) => {
      let label, id
      if (state.lookupType === "mal") {
        id = r.malId
        label = `${esc(r.name)}${r.airDate ? ` <span class="text-slate-500">(${esc(r.airDate)})</span>` : ""}${r.mediaType ? ` <span class="text-slate-500">[${esc(r.mediaType)}]</span>` : ""}`
      } else if (state.lookupType === "anidb") {
        id = r.aid
        label = `${esc(r.name)}${r.type ? ` <span class="text-slate-500">[${esc(r.type)}]</span>` : ""}${r.episodes ? ` <span class="text-slate-500">(${r.episodes} ep)</span>` : ""}`
      } else if (state.lookupType === "tvdb") {
        id = r.tvdbId
        label = `${esc(r.name)}${r.year ? ` <span class="text-slate-500">(${esc(r.year)})</span>` : ""}${r.status ? ` <span class="text-slate-500">[${esc(r.status)}]</span>` : ""}`
      } else if (state.lookupType === "tmdb") {
        id = r.movieDbId
        label = `${esc(r.title)}${r.year ? ` <span class="text-slate-500">(${esc(r.year)})</span>` : ""}`
      }
      return `<button onclick="lookupSelectSimpleByIndex(${index})"
      class="text-left text-sm px-3 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-blue-700 hover:border-blue-500 transition-colors flex items-center gap-2">
      ${kbdBadge(index)}
      <span class="flex-1 min-w-0 truncate">${label}</span>
      <span class="text-xs font-mono text-slate-500 shrink-0">#${id}</span>
    </button>`
    })
    .join("")
}

function renderDvdCompareSearchResults(state) {
  const groups = state.results.reduce(
    (accumulator, result) => {
      if (
        state.formatFilter !== "all" &&
        state.formatFilter !== result.variant
      ) {
        return accumulator
      }
      const key = `${result.baseTitle}|${result.year}`
      if (!accumulator.has(key)) {
        accumulator.set(key, {
          baseTitle: result.baseTitle,
          year: result.year,
          variants: [],
        })
      }
      accumulator.get(key).variants.push({
        id: result.id,
        variant: result.variant,
      })
      return accumulator
    },
    new Map(),
  )

  if (groups.size === 0) {
    return '<p class="text-xs text-slate-500 text-center py-4">No results match the selected format.</p>'
  }

  const groupArray = Array.from(groups.values())
  state._renderedGroups = groupArray
  state._activeOptions = groupArray.map(
    (_, index) => () => window.lookupSelectGroup(index),
  )

  return groupArray
    .map((group, index) => {
      const variantBadges = group.variants
        .map(
          (v) =>
            `<span class="text-xs font-mono px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">${esc(displayDvdCompareVariant(v.variant))}</span>`,
        )
        .join(" ")
      return `<button onclick="lookupSelectGroup(${index})"
      class="text-left text-sm px-3 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-blue-700 hover:border-blue-500 transition-colors flex items-center gap-2 flex-wrap">
      ${kbdBadge(index)}
      <span class="font-medium">${esc(group.baseTitle)}</span>
      ${group.year ? `<span class="text-slate-500">(${esc(group.year)})</span>` : ""}
      <span class="ml-auto flex gap-1">${variantBadges}</span>
    </button>`
    })
    .join("")
}

export function renderLookupSearchView(state) {
  const isDvdCompare = state.lookupType === "dvdcompare"
  const filterOptions = [
    { value: "all", label: "All" },
    { value: "DVD", label: "DVD" },
    { value: "Blu-ray", label: "Blu-ray" },
    { value: "Blu-ray 4K", label: "UHD Blu-ray" },
  ]
  const filters = isDvdCompare
    ? `<div class="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
        <span class="font-medium">Format:</span>
        ${filterOptions
          .map(
            (opt) => `
          <label class="flex items-center gap-1 cursor-pointer">
            <input type="radio" name="lookup-format-filter" value="${opt.value}"
              ${state.formatFilter === opt.value ? "checked" : ""}
              onchange="setLookupFormatFilter(this.value)"
              class="w-3.5 h-3.5 bg-slate-700 border-slate-500 accent-blue-500" />
            <span>${esc(opt.label)}</span>
          </label>
        `,
          )
          .join("")}
      </div>`
    : ""

  // Reset _activeOptions; result renderers populate them.
  state._activeOptions = []

  let resultsHtml = ""
  if (state.loading) {
    resultsHtml =
      '<p class="text-xs text-slate-500 text-center py-4">Searching…</p>'
  } else if (state.searchError) {
    resultsHtml = `<div class="text-xs text-red-300 bg-red-950/40 border border-red-900/60 rounded px-3 py-2 font-mono break-words">
      <p class="text-red-400 font-medium mb-1">Search failed</p>
      <p>${esc(state.searchError)}</p>
    </div>`
  } else if (state.results === null) {
    resultsHtml =
      '<p class="text-xs text-slate-500 text-center py-4">Enter a search term and press Enter.</p>'
  } else if (state.results.length === 0) {
    resultsHtml =
      '<p class="text-xs text-slate-500 text-center py-4">No results found.</p>'
  } else if (isDvdCompare) {
    resultsHtml = renderDvdCompareSearchResults(state)
  } else {
    resultsHtml = renderSimpleSearchResults(state)
  }

  return `
    <div class="flex items-center gap-2">
      <input id="lookup-search-input" type="text" value="${esc(state.searchTerm)}" placeholder="Title to search…"
        oninput="setLookupSearchTerm(this.value)"
        onkeydown="if(event.key==='Enter'){event.preventDefault();runLookupSearch(this.value)}"
        class="flex-1 bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500" />
      <button onclick="runLookupSearch(document.getElementById('lookup-search-input').value)"
        class="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded font-medium shrink-0">Search</button>
    </div>
    ${filters}
    <div class="flex flex-col gap-1.5 overflow-y-auto min-h-0">${resultsHtml}</div>
  `
}

export function renderLookupVariantView(state) {
  const group = state.selectedGroup
  state._activeOptions = group.variants.map(
    (v) => () =>
      window.lookupSelectVariant(v.id, v.variant),
  )
  const variants = group.variants
    .map(
      (
        v,
        index,
      ) => `<button onclick="lookupSelectVariant(${v.id},'${esc(v.variant)}')"
    class="text-left text-sm px-3 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-blue-700 hover:border-blue-500 transition-colors flex items-center gap-2">
    ${kbdBadge(index)}
    <span class="text-xs font-mono px-2 py-0.5 rounded bg-slate-700 text-slate-300">${esc(displayDvdCompareVariant(v.variant))}</span>
    <span class="text-slate-400 text-xs">Film ID</span>
    <span class="font-mono text-xs">#${v.id}</span>
  </button>`,
    )
    .join("")
  return `
    <p class="text-sm text-slate-300">Pick a format for <span class="font-medium">${esc(group.baseTitle)}${group.year ? ` (${esc(group.year)})` : ""}</span>:</p>
    <div class="flex flex-col gap-1.5">${variants}</div>
  `
}

export function renderLookupReleaseView(state) {
  const fid = state.selectedFid
  const filmUrl = `https://www.dvdcompare.net/comparisons/film.php?fid=${fid}`
  let body = ""
  state._activeOptions = []
  if (state.loading) {
    body =
      '<p class="text-xs text-slate-500 text-center py-4">Loading releases…</p>'
  } else if (state.releasesError) {
    body = `<div class="text-xs text-red-300 bg-red-950/40 border border-red-900/60 rounded px-3 py-2 font-mono break-words">
      <p class="text-red-400 font-medium mb-1">Failed to load releases</p>
      <p>${esc(state.releasesError)}</p>
    </div>`
  } else if (
    !state.releases ||
    state.releases.length === 0
  ) {
    const debug = state.releasesDebug
    const debugBlock = debug
      ? `<details class="mt-3 text-xs text-slate-400">
          <summary class="cursor-pointer text-amber-400 hover:text-amber-300 select-none">Debug</summary>
          <div class="mt-2 space-y-1 font-mono">
            <div><span class="text-slate-500">URL:</span> <a class="text-blue-400 hover:text-blue-300 underline break-all" href="${esc(debug.url)}" target="_blank" rel="noopener">${esc(debug.url)}</a></div>
            <div><span class="text-slate-500">HTTP status:</span> ${debug.httpStatus}</div>
            <div><span class="text-slate-500">HTML length:</span> ${debug.htmlLength}</div>
            <div><span class="text-slate-500">Page title:</span> ${esc(debug.pageTitle || "(empty)")}</div>
            <div><span class="text-slate-500">Checkbox count:</span> ${debug.checkboxCount}</div>
            <div class="pt-1"><span class="text-slate-500">HTML snippet:</span></div>
            <pre class="text-[11px] text-slate-300 bg-slate-950 rounded px-2 py-1.5 max-h-48 overflow-auto whitespace-pre-wrap break-all">${esc(debug.snippet || "")}</pre>
          </div>
        </details>`
      : ""
    body = `<p class="text-xs text-slate-500 text-center py-4">No release packages found.</p>${debugBlock}`
  } else {
    state._activeOptions = state.releases.map(
      (r) => () =>
        window.lookupSelectRelease(r.hash, r.label),
    )
    body = state.releases
      .map(
        (
          r,
          index,
        ) => `<button onclick="lookupSelectReleaseByIndex(${index})"
      class="text-left text-sm px-3 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-blue-700 hover:border-blue-500 transition-colors flex items-center gap-2">
      ${kbdBadge(index)}
      <span class="text-xs font-mono text-slate-500 shrink-0">#${esc(r.hash)}</span>
      <span class="flex-1 min-w-0">${esc(r.label || "(no label)")}</span>
    </button>`,
      )
      .join("")
  }
  return `
    <p class="text-sm text-slate-300">Pick a release package (Film ID #${fid}):</p>
    <a href="${filmUrl}" target="_blank" rel="noopener" class="text-xs text-blue-400 hover:text-blue-300 underline">Open film page in new tab ↗</a>
    <div class="flex flex-col gap-1.5 overflow-y-auto min-h-0">${body}</div>
  `
}
