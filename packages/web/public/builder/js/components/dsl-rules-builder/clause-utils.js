// ─── Data normalization ───────────────────────────────────────────────────────
//
// The DSL allows shorthand forms (bare key→value map = `matches:` only).
// On read we keep that flexibility, but the editor only manipulates the
// canonical (matches/excludes) form so we don't have to render two
// different sub-UIs for the same data. `normalizeWhenClause` converts
// shorthand into canonical so the editor logic doesn't fork. On write,
// `compactWhenClause` collapses back to shorthand when only `matches:`
// is set with literal entries — keeps the YAML clean.

export function isPlainObject(value) {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value)
  )
}

export function isRefBody(body) {
  return (
    isPlainObject(body) && typeof body.$ref === "string"
  )
}

export function normalizeWhenClause(clause) {
  if (!isPlainObject(clause)) {
    return { matches: {}, excludes: null }
  }
  const hasMatchesKey = Object.hasOwn(clause, "matches")
  const hasExcludesKey = Object.hasOwn(clause, "excludes")
  if (hasMatchesKey || hasExcludesKey) {
    return {
      matches: hasMatchesKey ? clause.matches : null,
      excludes: hasExcludesKey ? clause.excludes : null,
    }
  }
  return { matches: { ...clause }, excludes: null }
}

export function compactWhenClause(canonicalClause) {
  const matches = canonicalClause.matches
  const excludes = canonicalClause.excludes
  const hasMatches =
    (isPlainObject(matches) &&
      Object.keys(matches).length > 0) ||
    isRefBody(matches)
  const hasExcludes =
    (isPlainObject(excludes) &&
      Object.keys(excludes).length > 0) ||
    isRefBody(excludes)
  if (!hasMatches && !hasExcludes) {
    return null
  }
  if (hasMatches && !hasExcludes && !isRefBody(matches)) {
    return { ...matches }
  }
  const result = {}
  if (hasMatches) {
    result.matches = isRefBody(matches)
      ? { $ref: matches.$ref }
      : { ...matches }
  }
  if (hasExcludes) {
    result.excludes = isRefBody(excludes)
      ? { $ref: excludes.$ref }
      : { ...excludes }
  }
  return result
}
