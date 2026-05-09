export type AssScriptInfoComment = {
  type: 'comment'
  text: string
}

export type AssScriptInfoProperty = {
  type: 'property'
  key: string
  value: string
}

export type AssScriptInfoEntry = AssScriptInfoComment | AssScriptInfoProperty

export type AssFormatEntry = {
  entryType: string
  fields: Record<string, string>
}

export type AssScriptInfoSection = {
  sectionName: string
  sectionType: 'scriptInfo'
  entries: AssScriptInfoEntry[]
}

export type AssFormattedSection = {
  sectionName: string
  sectionType: 'formatted'
  format: string[]
  entries: AssFormatEntry[]
}

export type AssRawSection = {
  sectionName: string
  sectionType: 'raw'
  lines: string[]
}

export type AssSection = AssScriptInfoSection | AssFormattedSection | AssRawSection

export type AssFile = {
  sections: AssSection[]
}

// A predicate body is a flat key→value equality map OR a $ref to a named
// predicate defined in the request's top-level `predicates:` map.
export type PredicateBodyLiteral = Record<string, string>
export type PredicateBodyRef = { $ref: string }
export type PredicateBody = PredicateBodyLiteral | PredicateBodyRef

// A single `when:` clause. Bare key→value pairs are sugar for `matches:`.
export type WhenPredicateClauseExplicit = {
  matches?: PredicateBody
  excludes?: PredicateBody
}
export type WhenPredicateClauseShorthand = Record<string, string>
export type WhenPredicateClause = WhenPredicateClauseExplicit | WhenPredicateClauseShorthand

export type WhenPredicate = {
  anyScriptInfo?: WhenPredicateClause
  allScriptInfo?: WhenPredicateClause
  noneScriptInfo?: WhenPredicateClause
  notAllScriptInfo?: WhenPredicateClause
  anyStyle?: WhenPredicateClause
  allStyle?: WhenPredicateClause
  noneStyle?: WhenPredicateClause
}

export type ComparatorOperator = 'lt' | 'gt' | 'eq' | 'lte' | 'gte'
export type ComparatorMatch = { [key in ComparatorOperator]?: number }
export type ApplyIfFieldMatch = string | ComparatorMatch
export type ApplyIfStyleClause = Record<string, ApplyIfFieldMatch>

export type ApplyIfPredicate = {
  anyStyleMatches?: ApplyIfStyleClause
  allStyleMatches?: ApplyIfStyleClause
  noneStyleMatches?: ApplyIfStyleClause
}

// Math op for `computeFrom.ops` — either a `{ verb: number }` numeric op
// or a bare-string no-arg op.
export type ComputeFromNumericOp =
  | { add: number }
  | { subtract: number }
  | { multiply: number }
  | { divide: number }
  | { min: number }
  | { max: number }
export type ComputeFromBareOp = 'round' | 'floor' | 'ceil' | 'abs'
export type ComputeFromOp = ComputeFromNumericOp | ComputeFromBareOp

export type ComputeFromValue = {
  computeFrom: {
    property: string
    scope: 'scriptInfo' | 'style'
    ops: ComputeFromOp[]
  }
}

export type StyleFieldValue = string | ComputeFromValue

export type SetScriptInfoRule = {
  type: 'setScriptInfo'
  key: string
  value: string
  when?: WhenPredicate
}

export type ScaleResolutionRule = {
  type: 'scaleResolution'
  from?: { width: number; height: number }
  to: { width: number; height: number }
  hasLayoutRes?: boolean
  hasScaledBorderAndShadow?: boolean
  isLayoutResSynced?: boolean
  when?: WhenPredicate
}

export type SetStyleFieldsRule = {
  type: 'setStyleFields'
  ignoredStyleNamesRegexString?: string
  fields: Record<string, StyleFieldValue>
  applyIf?: ApplyIfPredicate
  when?: WhenPredicate
}

export type AssModificationRule = SetScriptInfoRule | ScaleResolutionRule | SetStyleFieldsRule

export type NamedPredicates = Record<string, PredicateBodyLiteral>
