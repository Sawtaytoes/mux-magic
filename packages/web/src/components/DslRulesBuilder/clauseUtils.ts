import type {
  RefBody,
  WhenClauseCanonical,
  WhenClauseValue,
  WhenSlotValue,
} from "./types"

export const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value)

export const isRefBody = (body: unknown): body is RefBody =>
  isPlainObject(body) && typeof (body as RefBody).$ref === "string"

// Normalise the two shorthand forms DSL allows into {matches, excludes}.
// Shorthand: bare key→value map is treated as `matches` only.
export const normalizeWhenClause = (clause: unknown): WhenClauseCanonical => {
  if (!isPlainObject(clause)) {
    return { matches: {}, excludes: null }
  }
  const hasMatchesKey = Object.hasOwn(clause, "matches")
  const hasExcludesKey = Object.hasOwn(clause, "excludes")
  if (hasMatchesKey || hasExcludesKey) {
    return {
      matches: hasMatchesKey
        ? (clause.matches as WhenSlotValue)
        : null,
      excludes: hasExcludesKey
        ? (clause.excludes as WhenSlotValue)
        : null,
    }
  }
  return {
    matches: { ...(clause as Record<string, string>) },
    excludes: null,
  }
}

// Collapse canonical form back to shorthand when possible, keeping YAML clean.
export const compactWhenClause = (
  canonical: WhenClauseCanonical,
): WhenClauseValue | null => {
  const { matches, excludes } = canonical
  const hasMatches =
    (isPlainObject(matches) && Object.keys(matches).length > 0) ||
    isRefBody(matches)
  const hasExcludes =
    (isPlainObject(excludes) && Object.keys(excludes).length > 0) ||
    isRefBody(excludes)
  if (!hasMatches && !hasExcludes) {
    return null
  }
  if (hasMatches && !hasExcludes && !isRefBody(matches)) {
    return { ...(matches as Record<string, string>) }
  }
  const result: Record<string, unknown> = {}
  if (hasMatches) {
    result.matches = isRefBody(matches)
      ? { $ref: (matches as RefBody).$ref }
      : { ...(matches as Record<string, string>) }
  }
  if (hasExcludes) {
    result.excludes = isRefBody(excludes)
      ? { $ref: (excludes as RefBody).$ref }
      : { ...(excludes as Record<string, string>) }
  }
  return result as WhenClauseValue
}
