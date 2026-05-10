// Phase B — autocomplete dropdown attached to the interactive rename
// rows on the nameSpecialFeatures result card. The dropdown filters a
// pre-supplied label list (pulled from the trailing summary record's
// `allKnownNames` + `possibleNames`) by case-insensitive substring +
// shared-word overlap. We keep the matcher inline here rather than
// pulling in `match-sorter` because the full list is small (typically
// under 200 labels) and the only signal that matters for this UX is
// "does the user's typed text appear inside the candidate label".
//
// The "Untimed suggestions" section in the dropdown gives the
// possibleNames list extra visual weight — those are the labels
// DVDCompare published WITHOUT a timecode, which is the most likely
// pool the user is matching when they reach the interactive renamer
// at all.

import { esc } from "./esc.js"

const MAX_VISIBLE_OPTIONS = 25

// Score one candidate label against a typed query. Higher score means
// "better match". Zero means "doesn't match at all" (caller filters).
const scoreCandidate = (
  candidate,
  normalizedQuery,
  queryWords,
) => {
  const normalizedCandidate = candidate.toLowerCase()
  // Exact prefix match wins outright so the most predictable typing
  // path always lands the candidate at the top.
  if (normalizedCandidate.startsWith(normalizedQuery)) {
    return 1000 - candidate.length
  }
  if (normalizedCandidate.includes(normalizedQuery)) {
    return 500 - candidate.length
  }
  // Word-overlap fallback — useful when the user types pieces that
  // don't appear contiguously (e.g. "image gallery 300" matching
  // "Image Gallery (300 images)").
  const candidateWords = new Set(
    normalizedCandidate.split(/[\W_]+/).filter(Boolean),
  )
  const overlap = queryWords.filter((word) =>
    candidateWords.has(word),
  ).length
  if (overlap === 0) {
    return 0
  }
  return overlap * 10
}

// Filter + sort the combined candidate list by relevance to the query.
// Returns an object with `untimed` (intersection with possibleNames)
// and `other` so the renderer can group them visually.
export const filterCandidates = ({
  allKnownNames,
  possibleNames,
  query,
}) => {
  const trimmedQuery = String(query ?? "").trim()
  const possibleSet = new Set(possibleNames)
  if (trimmedQuery === "") {
    const untimed = allKnownNames.filter((name) =>
      possibleSet.has(name),
    )
    const other = allKnownNames.filter(
      (name) => !possibleSet.has(name),
    )
    return {
      untimed: untimed.slice(0, MAX_VISIBLE_OPTIONS),
      other: other.slice(0, MAX_VISIBLE_OPTIONS),
    }
  }
  const normalizedQuery = trimmedQuery.toLowerCase()
  const queryWords = normalizedQuery
    .split(/[\W_]+/)
    .filter(Boolean)
  const scored = allKnownNames
    .map((candidate) => ({
      candidate,
      score: scoreCandidate(
        candidate,
        normalizedQuery,
        queryWords,
      ),
    }))
    .filter((entry) => entry.score > 0)
  scored.sort(
    (firstEntry, secondEntry) =>
      secondEntry.score - firstEntry.score,
  )
  const untimed = scored
    .filter(({ candidate }) => possibleSet.has(candidate))
    .map(({ candidate }) => candidate)
  const other = scored
    .filter(({ candidate }) => !possibleSet.has(candidate))
    .map(({ candidate }) => candidate)
  return {
    untimed: untimed.slice(0, MAX_VISIBLE_OPTIONS),
    other: other.slice(0, MAX_VISIBLE_OPTIONS),
  }
}

// Render the dropdown body HTML for a given query.
const renderDropdownHtml = ({
  allKnownNames,
  possibleNames,
  query,
}) => {
  const { untimed, other } = filterCandidates({
    allKnownNames,
    possibleNames,
    query,
  })
  if (untimed.length === 0 && other.length === 0) {
    return '<div class="px-2 py-1 text-slate-400 italic text-xs">No matching suggestions.</div>'
  }
  const renderItems = (labels) =>
    labels
      .map(
        (label) =>
          `<button type="button" tabindex="-1"` +
          ` data-autocomplete-pick="${esc(label)}"` +
          ` class="block w-full text-left px-2 py-1 text-xs font-mono text-slate-200 hover:bg-blue-700 hover:text-white">` +
          esc(label) +
          "</button>",
      )
      .join("")
  const untimedBlock =
    untimed.length > 0
      ? '<div class="px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-400 font-semibold">Untimed suggestions</div>' +
        renderItems(untimed)
      : ""
  const otherBlock =
    other.length > 0
      ? (untimed.length > 0
          ? '<div class="border-t border-slate-700 my-1"></div>' +
            '<div class="px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">All known names</div>'
          : "") + renderItems(other)
      : ""
  return `${untimedBlock}${otherBlock}`
}

// Wire an autocomplete dropdown onto a given input + dropdown container.
// The caller passes the input element, the dropdown container, the
// candidate list, and an `onPick(label)` callback. Returns a teardown
// function that detaches the listeners.
export const attachAutocomplete = ({
  allKnownNames,
  dropdownElement,
  inputElement,
  onPick,
  possibleNames,
}) => {
  const candidateList = Array.isArray(allKnownNames)
    ? allKnownNames
    : []
  const possibleList = Array.isArray(possibleNames)
    ? possibleNames
    : []
  const renderForCurrentQuery = () => {
    dropdownElement.innerHTML = renderDropdownHtml({
      allKnownNames: candidateList,
      possibleNames: possibleList,
      query: inputElement.value,
    })
  }
  const showDropdown = () => {
    renderForCurrentQuery()
    dropdownElement.classList.remove("hidden")
  }
  const hideDropdown = () => {
    dropdownElement.classList.add("hidden")
  }
  const handleInput = () => {
    showDropdown()
  }
  const handleFocus = () => {
    showDropdown()
  }
  const handleBlur = () => {
    // Defer so the click on a dropdown item registers before we hide.
    setTimeout(() => {
      hideDropdown()
    }, 120)
  }
  const handleDropdownClick = (event) => {
    const target = event.target.closest(
      "[data-autocomplete-pick]",
    )
    if (!target) {
      return
    }
    event.preventDefault()
    const picked =
      target.getAttribute("data-autocomplete-pick") ?? ""
    inputElement.value = picked
    hideDropdown()
    if (typeof onPick === "function") {
      onPick(picked)
    }
  }
  inputElement.addEventListener("input", handleInput)
  inputElement.addEventListener("focus", handleFocus)
  inputElement.addEventListener("blur", handleBlur)
  dropdownElement.addEventListener(
    "mousedown",
    handleDropdownClick,
  )
  return () => {
    inputElement.removeEventListener("input", handleInput)
    inputElement.removeEventListener("focus", handleFocus)
    inputElement.removeEventListener("blur", handleBlur)
    dropdownElement.removeEventListener(
      "mousedown",
      handleDropdownClick,
    )
  }
}
