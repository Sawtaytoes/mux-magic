import type {
  ApplyIfPredicate,
  ApplyIfStyleClause,
  AssFile,
  AssFormatEntry,
  AssModificationRule,
  AssScriptInfoSection,
  ComputeFromOp,
  ComputeFromValue,
  NamedPredicates,
  PredicateBody,
  ScaleResolutionRule,
  SetScriptInfoRule,
  SetStyleFieldsRule,
  StyleFieldValue,
  WhenPredicate,
  WhenPredicateClause,
} from "./assTypes.js"

// ---------------------------------------------------------------------------
// Batch-aggregate metadata used to evaluate `when:` predicates and to feed
// `computeFrom` ops with per-file values.
// ---------------------------------------------------------------------------

export type FileBatchMetadata = {
  filePath: string
  scriptInfo: Record<string, string>
  styles: Record<string, string>[]
}

// ---------------------------------------------------------------------------
// Predicate-body resolution + evaluation
// ---------------------------------------------------------------------------

const isRefBody = (
  body: PredicateBody,
): body is { $ref: string } =>
  typeof (body as { $ref?: unknown }).$ref === "string"

const resolvePredicateBody = ({
  body,
  predicates,
}: {
  body: PredicateBody
  predicates: NamedPredicates
}): Record<string, string> => {
  if (isRefBody(body)) {
    const referenced = predicates[body.$ref]
    if (!referenced) {
      throw new Error(
        `Unknown predicate $ref: '${body.$ref}'.`,
      )
    }
    return referenced
  }
  return body
}

const isShorthandClause = (
  clause: WhenPredicateClause,
): clause is Record<string, string> => {
  const candidate = clause as Record<string, unknown>
  if ("matches" in candidate || "excludes" in candidate) {
    return false
  }
  return true
}

const splitClause = ({
  clause,
}: {
  clause: WhenPredicateClause
}): {
  matches?: PredicateBody
  excludes?: PredicateBody
} => {
  if (isShorthandClause(clause)) {
    return { matches: clause }
  }
  return clause
}

const matchesAllPairs = ({
  pairs,
  source,
}: {
  pairs: Record<string, string>
  source: Record<string, string>
}): boolean =>
  Object.entries(pairs).every(
    ([key, value]) => source[key] === value,
  )

const evaluatePerSourceClause = ({
  clause,
  predicates,
  source,
}: {
  clause: WhenPredicateClause
  predicates: NamedPredicates
  source: Record<string, string>
}): boolean => {
  const { matches, excludes } = splitClause({ clause })

  const hasMatchesPasses = matches
    ? matchesAllPairs({
        pairs: resolvePredicateBody({
          body: matches,
          predicates,
        }),
        source,
      })
    : true
  if (!hasMatchesPasses) {
    return false
  }

  if (excludes) {
    const hasExcludesMatched = matchesAllPairs({
      pairs: resolvePredicateBody({
        body: excludes,
        predicates,
      }),
      source,
    })
    if (hasExcludesMatched) {
      return false
    }
  }

  return true
}

// All-styles aggregator: each style row across all files becomes a "source"
// the per-style clauses evaluate against. Returns the flat list.
const collectAllStyles = ({
  batchMetadata,
}: {
  batchMetadata: FileBatchMetadata[]
}): Record<string, string>[] =>
  batchMetadata.flatMap(({ styles }) => styles)

const evaluateAggregateClause = ({
  aggregator,
  batchMetadata,
  clause,
  predicates,
  scope,
}: {
  aggregator: "any" | "all" | "none" | "notAll"
  batchMetadata: FileBatchMetadata[]
  clause: WhenPredicateClause
  predicates: NamedPredicates
  scope: "scriptInfo" | "style"
}): boolean => {
  const sources =
    scope === "scriptInfo"
      ? batchMetadata.map(({ scriptInfo }) => scriptInfo)
      : collectAllStyles({ batchMetadata })

  const perSourceResults = sources.map((source) =>
    evaluatePerSourceClause({ clause, predicates, source }),
  )

  if (aggregator === "any") {
    return perSourceResults.some((isMatch) => isMatch)
  }
  if (aggregator === "all") {
    // Edge case: empty sources collection → "all of zero" is vacuously true.
    return perSourceResults.every((isMatch) => isMatch)
  }
  if (aggregator === "none") {
    return perSourceResults.every((isMatch) => !isMatch)
  }
  // notAll: at least one does NOT match. Empty → vacuously false.
  return perSourceResults.some((isMatch) => !isMatch)
}

export const evaluateWhenPredicate = ({
  batchMetadata,
  predicate,
  predicates,
}: {
  batchMetadata: FileBatchMetadata[]
  predicate: WhenPredicate
  predicates: NamedPredicates
}): boolean => {
  const checks: Array<{
    aggregator: "any" | "all" | "none" | "notAll"
    clause: WhenPredicateClause | undefined
    scope: "scriptInfo" | "style"
  }> = [
    {
      aggregator: "any",
      clause: predicate.anyScriptInfo,
      scope: "scriptInfo",
    },
    {
      aggregator: "all",
      clause: predicate.allScriptInfo,
      scope: "scriptInfo",
    },
    {
      aggregator: "none",
      clause: predicate.noneScriptInfo,
      scope: "scriptInfo",
    },
    {
      aggregator: "notAll",
      clause: predicate.notAllScriptInfo,
      scope: "scriptInfo",
    },
    {
      aggregator: "any",
      clause: predicate.anyStyle,
      scope: "style",
    },
    {
      aggregator: "all",
      clause: predicate.allStyle,
      scope: "style",
    },
    {
      aggregator: "none",
      clause: predicate.noneStyle,
      scope: "style",
    },
  ]

  return checks.every(({ aggregator, clause, scope }) => {
    if (!clause) {
      return true
    }
    return evaluateAggregateClause({
      aggregator,
      batchMetadata,
      clause,
      predicates,
      scope,
    })
  })
}

// Filter the rule list down to those whose `when:` predicate (if any)
// passes against the aggregate batch metadata. Rules without `when:` always
// pass.
export const filterRulesByWhen = ({
  batchMetadata,
  predicates,
  rules,
}: {
  batchMetadata: FileBatchMetadata[]
  predicates: NamedPredicates
  rules: AssModificationRule[]
}): AssModificationRule[] =>
  rules.filter((rule) => {
    if (!rule.when) {
      return true
    }
    return evaluateWhenPredicate({
      batchMetadata,
      predicate: rule.when,
      predicates,
    })
  })

// ---------------------------------------------------------------------------
// computeFrom — math ops over a numeric accumulator
// ---------------------------------------------------------------------------

const isNumericOperation = (
  operation: ComputeFromOp,
): operation is Exclude<ComputeFromOp, string> =>
  typeof operation !== "string"

const applyComputeFromOps = ({
  initialValue,
  operations,
}: {
  initialValue: number
  operations: ComputeFromOp[]
}): number =>
  operations.reduce((accumulator, operation) => {
    if (!isNumericOperation(operation)) {
      if (operation === "round") {
        return Math.round(accumulator)
      }
      if (operation === "floor") {
        return Math.floor(accumulator)
      }
      if (operation === "ceil") {
        return Math.ceil(accumulator)
      }
      if (operation === "abs") {
        return Math.abs(accumulator)
      }
      return accumulator
    }
    if ("add" in operation) {
      return accumulator + operation.add
    }
    if ("subtract" in operation) {
      return accumulator - operation.subtract
    }
    if ("multiply" in operation) {
      return accumulator * operation.multiply
    }
    if ("divide" in operation) {
      return accumulator / operation.divide
    }
    if ("min" in operation) {
      return Math.min(accumulator, operation.min)
    }
    if ("max" in operation) {
      return Math.max(accumulator, operation.max)
    }
    return accumulator
  }, initialValue)

const isComputeFromValue = (
  fieldValue: StyleFieldValue,
): fieldValue is ComputeFromValue =>
  typeof fieldValue !== "string"

const resolveStyleFieldValue = ({
  fieldValue,
  fileMetadata,
  styleRow,
}: {
  fieldValue: StyleFieldValue
  fileMetadata: FileBatchMetadata
  styleRow: Record<string, string>
}): string => {
  if (!isComputeFromValue(fieldValue)) {
    return fieldValue
  }

  const { property, scope, ops } = fieldValue.computeFrom
  const sourceValue =
    scope === "scriptInfo"
      ? fileMetadata.scriptInfo[property]
      : styleRow[property]
  const initialValue = Number(sourceValue ?? "0") || 0
  const finalValue = applyComputeFromOps({
    initialValue,
    operations: ops,
  })
  return String(finalValue)
}

// ---------------------------------------------------------------------------
// applyIf — per-file/per-style style match predicate with comparators
// ---------------------------------------------------------------------------

const styleMatchesEntry = ({
  fieldValue,
  styleValue,
}: {
  fieldValue:
    | string
    | {
        eq?: number
        lt?: number
        gt?: number
        lte?: number
        gte?: number
      }
  styleValue: string | undefined
}): boolean => {
  if (typeof fieldValue === "string") {
    return styleValue === fieldValue
  }

  const numericStyleValue = Number(styleValue ?? "")
  if (!Number.isFinite(numericStyleValue)) {
    return false
  }

  if (
    fieldValue.eq !== undefined &&
    numericStyleValue !== fieldValue.eq
  ) {
    return false
  }
  if (
    fieldValue.lt !== undefined &&
    !(numericStyleValue < fieldValue.lt)
  ) {
    return false
  }
  if (
    fieldValue.gt !== undefined &&
    !(numericStyleValue > fieldValue.gt)
  ) {
    return false
  }
  if (
    fieldValue.lte !== undefined &&
    !(numericStyleValue <= fieldValue.lte)
  ) {
    return false
  }
  if (
    fieldValue.gte !== undefined &&
    !(numericStyleValue >= fieldValue.gte)
  ) {
    return false
  }
  return true
}

const styleRowMatchesClause = ({
  clause,
  styleRow,
}: {
  clause: ApplyIfStyleClause
  styleRow: Record<string, string>
}): boolean =>
  Object.entries(clause).every(([fieldName, fieldValue]) =>
    styleMatchesEntry({
      fieldValue,
      styleValue: styleRow[fieldName],
    }),
  )

export const evaluateApplyIfPredicate = ({
  applyIf,
  fileMetadata,
}: {
  applyIf: ApplyIfPredicate
  fileMetadata: FileBatchMetadata
}): boolean => {
  const { styles } = fileMetadata

  if (applyIf.anyStyleMatches) {
    const { anyStyleMatches } = applyIf
    const isPassing = styles.some((styleRow) =>
      styleRowMatchesClause({
        clause: anyStyleMatches,
        styleRow,
      }),
    )
    if (!isPassing) {
      return false
    }
  }

  if (applyIf.allStyleMatches) {
    const { allStyleMatches } = applyIf
    const isPassing = styles.every((styleRow) =>
      styleRowMatchesClause({
        clause: allStyleMatches,
        styleRow,
      }),
    )
    if (!isPassing) {
      return false
    }
  }

  if (applyIf.noneStyleMatches) {
    const { noneStyleMatches } = applyIf
    const isPassing = styles.every(
      (styleRow) =>
        !styleRowMatchesClause({
          clause: noneStyleMatches,
          styleRow,
        }),
    )
    if (!isPassing) {
      return false
    }
  }

  return true
}

// ---------------------------------------------------------------------------
// AssFile mutators (functional — return new file, never mutate)
// ---------------------------------------------------------------------------

const getScriptInfoSection = (
  assFile: AssFile,
): AssScriptInfoSection | undefined =>
  assFile.sections.find(
    (section): section is AssScriptInfoSection =>
      section.sectionType === "scriptInfo",
  )

const getScriptInfoValue = ({
  assFile,
  key,
}: {
  assFile: AssFile
  key: string
}): string | undefined => {
  const section = getScriptInfoSection(assFile)
  if (!section) {
    return undefined
  }
  const entry = section.entries.find(
    (candidate) =>
      candidate.type === "property" &&
      candidate.key === key,
  )
  return entry?.type === "property"
    ? entry.value
    : undefined
}

const applySetScriptInfo = ({
  assFile,
  rule,
}: {
  assFile: AssFile
  rule: SetScriptInfoRule
}): AssFile => ({
  ...assFile,
  sections: assFile.sections.map((section) => {
    if (section.sectionType !== "scriptInfo") {
      return section
    }

    const existingIndex = section.entries.findIndex(
      (entry) =>
        entry.type === "property" && entry.key === rule.key,
    )

    if (existingIndex !== -1) {
      const entries = [...section.entries]
      entries[existingIndex] = {
        type: "property",
        key: rule.key,
        value: rule.value,
      }
      return { ...section, entries }
    }

    const lastPropertyIndex = section.entries.reduce(
      (lastIndex, entry, currentIndex) =>
        entry.type === "property"
          ? currentIndex
          : lastIndex,
      -1,
    )
    const entries = [...section.entries]
    entries.splice(lastPropertyIndex + 1, 0, {
      type: "property",
      key: rule.key,
      value: rule.value,
    })
    return { ...section, entries }
  }),
})

const applyScaleResolution = ({
  assFile,
  rule,
}: {
  assFile: AssFile
  rule: ScaleResolutionRule
}): AssFile => {
  const currentWidth = getScriptInfoValue({
    assFile,
    key: "PlayResX",
  })
  const currentHeight = getScriptInfoValue({
    assFile,
    key: "PlayResY",
  })

  if (
    rule.from &&
    (currentWidth !== String(rule.from.width) ||
      currentHeight !== String(rule.from.height))
  ) {
    return assFile
  }

  const baseRules: SetScriptInfoRule[] = [
    {
      type: "setScriptInfo",
      key: "PlayResX",
      value: String(rule.to.width),
    },
    {
      type: "setScriptInfo",
      key: "PlayResY",
      value: String(rule.to.height),
    },
  ]

  const layoutRules: SetScriptInfoRule[] =
    rule.isLayoutResSynced !== false
      ? (() => {
          const hasLayoutResX =
            getScriptInfoValue({
              assFile,
              key: "LayoutResX",
            }) !== undefined
          const hasLayoutResY =
            getScriptInfoValue({
              assFile,
              key: "LayoutResY",
            }) !== undefined
          const layoutXRule: SetScriptInfoRule[] =
            hasLayoutResX || rule.hasLayoutRes
              ? [
                  {
                    type: "setScriptInfo",
                    key: "LayoutResX",
                    value: String(rule.to.width),
                  },
                ]
              : []
          const layoutYRule: SetScriptInfoRule[] =
            hasLayoutResY || rule.hasLayoutRes
              ? [
                  {
                    type: "setScriptInfo",
                    key: "LayoutResY",
                    value: String(rule.to.height),
                  },
                ]
              : []
          return [...layoutXRule, ...layoutYRule]
        })()
      : []

  const scaledBorderRules: SetScriptInfoRule[] =
    rule.hasScaledBorderAndShadow !== false
      ? [
          {
            type: "setScriptInfo",
            key: "ScaledBorderAndShadow",
            value: "yes",
          },
        ]
      : []

  const subRules = [
    ...baseRules,
    ...layoutRules,
    ...scaledBorderRules,
  ]

  return subRules.reduce(
    (currentFile, setScriptInfoRule) =>
      applySetScriptInfo({
        assFile: currentFile,
        rule: setScriptInfoRule,
      }),
    assFile,
  )
}

const applySetStyleFields = ({
  assFile,
  fileMetadata,
  rule,
}: {
  assFile: AssFile
  fileMetadata: FileBatchMetadata
  rule: SetStyleFieldsRule
}): AssFile => {
  if (
    rule.applyIf &&
    !evaluateApplyIfPredicate({
      applyIf: rule.applyIf,
      fileMetadata,
    })
  ) {
    return assFile
  }

  const ignoredStyleNamesRegex =
    rule.ignoredStyleNamesRegexString
      ? new RegExp(rule.ignoredStyleNamesRegexString, "i")
      : null

  return {
    ...assFile,
    sections: assFile.sections.map((section) => {
      if (section.sectionType !== "formatted") {
        return section
      }

      const hasStyleEntries = section.entries.some(
        (entry) => entry.entryType === "Style",
      )
      if (!hasStyleEntries) {
        return section
      }

      return {
        ...section,
        entries: section.entries.map((entry) => {
          if (entry.entryType !== "Style") {
            return entry
          }

          const styleName = entry.fields.Name ?? ""
          if (ignoredStyleNamesRegex?.test(styleName)) {
            return entry
          }

          const computedFields = Object.entries(
            rule.fields,
          ).reduce(
            (accumulator, [fieldName, fieldValue]) => {
              accumulator[fieldName] =
                resolveStyleFieldValue({
                  fieldValue,
                  fileMetadata,
                  styleRow: entry.fields,
                })
              return accumulator
            },
            {} as Record<string, string>,
          )

          const updatedEntry: AssFormatEntry = {
            ...entry,
            fields: { ...entry.fields, ...computedFields },
          }
          return updatedEntry
        }),
      }
    }),
  }
}

// ---------------------------------------------------------------------------
// Public entry — apply rules to a single file. Caller must precompute the
// `activeRules` (post-`when:` filter) and pass per-file metadata so
// `applyIf` and `computeFrom` have access to scriptInfo + styles without
// re-parsing the file.
// ---------------------------------------------------------------------------

export const applyAssRules = ({
  assFile,
  fileMetadata,
  rules,
}: {
  assFile: AssFile
  // Optional. When omitted the engine derives a snapshot from `assFile`,
  // which is fine for callers that don't care about cross-file `when:`
  // gating (already filtered upstream) but DO need per-file `applyIf` /
  // `computeFrom` to see the right scriptInfo + styles.
  fileMetadata?: FileBatchMetadata
  rules: AssModificationRule[]
}): AssFile => {
  const resolvedMetadata =
    fileMetadata ??
    buildFileMetadata({ assFile, filePath: "" })
  return rules.reduce((currentFile, rule) => {
    if (rule.type === "setScriptInfo") {
      return applySetScriptInfo({
        assFile: currentFile,
        rule,
      })
    }
    if (rule.type === "scaleResolution") {
      return applyScaleResolution({
        assFile: currentFile,
        rule,
      })
    }
    if (rule.type === "setStyleFields") {
      return applySetStyleFields({
        assFile: currentFile,
        fileMetadata: resolvedMetadata,
        rule,
      })
    }
    return currentFile
  }, assFile)
}

// ---------------------------------------------------------------------------
// Helper: build per-file metadata snapshot from a parsed AssFile. Used by
// callers that already have the parsed file in hand (avoids re-parsing).
// ---------------------------------------------------------------------------

export const buildFileMetadata = ({
  assFile,
  filePath,
}: {
  assFile: AssFile
  filePath: string
}): FileBatchMetadata => {
  const scriptInfoSection = assFile.sections.find(
    (section) => section.sectionType === "scriptInfo",
  )
  const scriptInfo: Record<string, string> =
    scriptInfoSection?.sectionType === "scriptInfo"
      ? Object.fromEntries(
          scriptInfoSection.entries
            .filter((entry) => entry.type === "property")
            .map((entry) =>
              entry.type === "property"
                ? [entry.key, entry.value]
                : ["", ""],
            ),
        )
      : {}

  const stylesSection = assFile.sections.find(
    (section) =>
      section.sectionType === "formatted" &&
      section.entries.some(
        (entry) => entry.entryType === "Style",
      ),
  )
  const styles: Record<string, string>[] =
    stylesSection?.sectionType === "formatted"
      ? stylesSection.entries
          .filter((entry) => entry.entryType === "Style")
          .map((entry) => entry.fields)
      : []

  return { filePath, scriptInfo, styles }
}
