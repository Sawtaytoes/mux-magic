export type AssScriptInfoComment = {
  type: "comment"
  text: string
}

export type AssScriptInfoProperty = {
  type: "property"
  key: string
  value: string
}

export type AssScriptInfoEntry =
  | AssScriptInfoComment
  | AssScriptInfoProperty

export type AssFormatEntry = {
  entryType: string
  fields: Record<string, string>
}

export type AssScriptInfoSection = {
  sectionName: string
  sectionType: "scriptInfo"
  entries: AssScriptInfoEntry[]
}

export type AssFormattedSection = {
  sectionName: string
  sectionType: "formatted"
  format: string[]
  entries: AssFormatEntry[]
}

export type AssRawSection = {
  sectionName: string
  sectionType: "raw"
  lines: string[]
}

export type AssSection =
  | AssScriptInfoSection
  | AssFormattedSection
  | AssRawSection

export type AssFile = {
  sections: AssSection[]
}

// A predicate body is a flat key→value equality map OR a $ref to a named
// predicate defined in the request's top-level `predicates:` map.
export type PredicateBodyLiteral = Record<string, string>
export type PredicateBodyRef = { $ref: string }
export type PredicateBody =
  | PredicateBodyLiteral
  | PredicateBodyRef

// A single `when:` clause. Bare key→value pairs are sugar for `matches:`.
export type WhenPredicateClauseExplicit = {
  matches?: PredicateBody
  excludes?: PredicateBody
}
export type WhenPredicateClauseShorthand = Record<
  string,
  string
>
export type WhenPredicateClause =
  | WhenPredicateClauseExplicit
  | WhenPredicateClauseShorthand

// A clause map: an implicit AND over the clauses it names. This is what
// every `when:` written before nesting existed looks like, and it stays
// the wire format for any rule that does not nest.
//
// Note the asymmetry — `notAllScriptInfo` exists and `notAllStyle` does
// NOT. That is deliberate and load-bearing: the builder's target picker
// filters on it, so the missing pair cannot be constructed in the UI.
export type WhenPredicate = {
  anyScriptInfo?: WhenPredicateClause
  allScriptInfo?: WhenPredicateClause
  noneScriptInfo?: WhenPredicateClause
  notAllScriptInfo?: WhenPredicateClause
  anyStyle?: WhenPredicateClause
  allStyle?: WhenPredicateClause
  noneStyle?: WhenPredicateClause
}

// ── Nested `when:` ───────────────────────────────────────────────────
//
// A boolean node joins CHILD NODES; a clause map quantifies over SOURCE
// ROWS. Keeping those two jobs in separate node kinds is the whole point:
// `anyStyle: {a, b}` asks "is there one style row with BOTH?", which is
// not the same question as "any of these two sub-conditions holds", and
// conflating them would silently change what a saved rule means.
//
// A `WhenPredicate` IS a `WhenNode`, so every rule already on disk parses
// and evaluates unchanged — the nested form is additive, not a migration.
export type WhenBooleanNode = {
  all?: WhenNode[]
  any?: WhenNode[]
  none?: WhenNode[]
}

export type WhenNode = WhenBooleanNode | WhenPredicate

export type ComparatorOperator =
  | "lt"
  | "gt"
  | "eq"
  | "lte"
  | "gte"
export type ComparatorMatch = {
  [key in ComparatorOperator]?: number
}
export type ApplyIfFieldMatch = string | ComparatorMatch
export type ApplyIfStyleClause = Record<
  string,
  ApplyIfFieldMatch
>

export type ApplyIfPredicate = {
  anyStyleMatches?: ApplyIfStyleClause
  allStyleMatches?: ApplyIfStyleClause
  noneStyleMatches?: ApplyIfStyleClause
}

// The same boolean layer `WhenNode` gets, for the same reason and with
// the same guarantee: a clause still quantifies over style rows, an
// `ApplyIfPredicate` is still a valid node, and nothing on disk changes
// meaning. Kept symmetric deliberately — two rule predicates that nest
// by different rules would be a trap for whoever writes the next one.
export type ApplyIfBooleanNode = {
  all?: ApplyIfNode[]
  any?: ApplyIfNode[]
  none?: ApplyIfNode[]
}

export type ApplyIfNode =
  | ApplyIfBooleanNode
  | ApplyIfPredicate

// Math op for `computeFrom.ops` — either a `{ verb: number }` numeric op
// or a bare-string no-arg op.
export type ComputeFromNumericOp =
  | { add: number }
  | { subtract: number }
  | { multiply: number }
  | { divide: number }
  | { min: number }
  | { max: number }
export type ComputeFromBareOp =
  | "round"
  | "floor"
  | "ceil"
  | "abs"
export type ComputeFromOp =
  | ComputeFromNumericOp
  | ComputeFromBareOp

export type ComputeFromValue = {
  computeFrom: {
    property: string
    scope: "scriptInfo" | "style"
    ops: ComputeFromOp[]
  }
}

export type StyleFieldValue = string | ComputeFromValue

export type SetScriptInfoRule = {
  type: "setScriptInfo"
  key: string
  value: string
  when?: WhenNode
}

export type ScaleResolutionRule = {
  type: "scaleResolution"
  from?: { width: number; height: number }
  to: { width: number; height: number }
  hasLayoutRes?: boolean
  hasScaledBorderAndShadow?: boolean
  isLayoutResSynced?: boolean
  when?: WhenNode
}

export type SetStyleFieldsRule = {
  type: "setStyleFields"
  ignoredStyleNamesRegexString?: string
  fields: Record<string, StyleFieldValue>
  applyIf?: ApplyIfNode
  when?: WhenNode
}

export type AssModificationRule =
  | SetScriptInfoRule
  | ScaleResolutionRule
  | SetStyleFieldsRule

export type NamedPredicates = Record<
  string,
  PredicateBodyLiteral
>
