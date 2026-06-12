import { useState } from "react"
import type { CommandField } from "../../commands/types"
import { useBuilderActions } from "../../hooks/useBuilderActions"
import type { Step } from "../../types"
import { FieldLabel } from "../FieldLabel/FieldLabel"
import { RenameRegexRuleRow } from "./RenameRegexRuleRow"
import type {
  DisplayMode,
  RuleValue,
} from "./renameRegexTypes"

type RenameRegexFieldProps = {
  field: CommandField
  step: Step
}

let nextRuleId = 0
const allocateRuleId = () => {
  const id = nextRuleId
  nextRuleId += 1
  return id
}

const makeEmptyRule = (): RuleValue => ({
  _id: allocateRuleId(),
  pattern: "",
  flags: "",
  replacement: "",
  sample: "",
})

const readRule = (raw: unknown): RuleValue => {
  const id = allocateRuleId()
  if (raw && typeof raw === "object") {
    const { pattern, flags, replacement, sample } =
      raw as Partial<{
        pattern: unknown
        flags: unknown
        replacement: unknown
        sample: unknown
      }>
    return {
      _id: id,
      pattern: typeof pattern === "string" ? pattern : "",
      flags: typeof flags === "string" ? flags : "",
      replacement:
        typeof replacement === "string" ? replacement : "",
      sample: typeof sample === "string" ? sample : "",
    }
  }
  return makeEmptyRule()
}

// Emits the MINIMAL on-wire shape for a single rule: when flags + sample
// are both empty we write the legacy 2-key `{ pattern, replacement }` so
// existing YAML round-trips unchanged. With either set we promote to the
// full 4-key shape.
const serializeRule = (
  value: RuleValue,
): {
  pattern: string
  replacement: string
  flags?: string
  sample?: string
} => {
  const { pattern, flags, replacement, sample } = value
  const isLegacyShape = flags === "" && sample === ""
  return isLegacyShape
    ? { pattern, replacement }
    : {
        pattern,
        replacement,
        ...(flags !== "" ? { flags } : {}),
        ...(sample !== "" ? { sample } : {}),
      }
}

// In single-rule mode (isChain=false) emits the legacy object form or
// undefined when all fields are empty. In chain mode always emits the
// array form so the UI can round-trip the chain without silently
// collapsing back to object form.
const serializeForWrite = (
  rules: RuleValue[],
  isChain: boolean,
):
  | undefined
  | {
      pattern: string
      replacement: string
      flags?: string
      sample?: string
    }
  | Array<{
      pattern: string
      replacement: string
      flags?: string
      sample?: string
    }> => {
  if (!isChain) {
    const rule = rules[0]
    if (rule === undefined) return undefined
    const isAllEmpty =
      rule.pattern === "" &&
      rule.flags === "" &&
      rule.replacement === "" &&
      rule.sample === ""
    if (isAllEmpty) return undefined
    return serializeRule(rule)
  }
  return rules.map(serializeRule)
}

// Reads the raw params value into an array of rules + whether we're in
// chain mode. An array value always yields isChain=true. An object value
// yields isChain=false (single-rule mode until the user clicks Add rule).
const readFieldValue = (
  raw: unknown,
): { rules: RuleValue[]; isChain: boolean } => {
  if (Array.isArray(raw)) {
    return {
      rules: raw.map(readRule),
      isChain: true,
    }
  }
  return {
    rules: [readRule(raw)],
    isChain: false,
  }
}

// Computes the chain final output by applying all rules left-to-right to
// the sample of the first rule that has one. Returns null when no rule
// has a sample (nothing to preview).
const computeChainOutput = (
  rules: RuleValue[],
): string | null => {
  const firstSampleRule = rules.find(
    (rule) => rule.sample !== "",
  )
  if (firstSampleRule === undefined) return null
  return rules.reduce((current, rule) => {
    if (rule.pattern === "") return current
    try {
      return current.replace(
        new RegExp(rule.pattern, rule.flags || undefined),
        rule.replacement,
      )
    } catch {
      return current
    }
  }, firstSampleRule.sample)
}

export const RenameRegexField = ({
  field,
  step,
}: RenameRegexFieldProps) => {
  const { setParam } = useBuilderActions()
  const initial = readFieldValue(step.params[field.name])
  const [rules, setRules] = useState<RuleValue[]>(
    initial.rules,
  )
  const [isChain, setIsChain] = useState<boolean>(
    initial.isChain,
  )
  const [displayMode, setDisplayMode] =
    useState<DisplayMode>("plain")

  const writeBack = (
    nextRules: RuleValue[],
    isNextChain: boolean,
  ) => {
    setRules(nextRules)
    setIsChain(isNextChain)
    setParam(
      step.id,
      field.name,
      serializeForWrite(nextRules, isNextChain),
    )
  }

  const onChangeRule = (index: number, next: RuleValue) => {
    const nextRules = rules.map((rule, ruleIndex) =>
      ruleIndex === index ? next : rule,
    )
    writeBack(nextRules, isChain)
  }

  const onAddRule = () => {
    const nextRules = rules.concat(makeEmptyRule())
    writeBack(nextRules, true)
  }

  const onDeleteRule = (index: number) => {
    const nextRules = rules.filter(
      (_, ruleIndex) => ruleIndex !== index,
    )
    writeBack(nextRules, true)
  }

  const onMoveUp = (index: number) => {
    if (index === 0) return
    const nextRules = rules.map((rule, ruleIndex) => {
      if (ruleIndex === index - 1) {
        return rules[index] as RuleValue
      }
      if (ruleIndex === index) {
        return rules[index - 1] as RuleValue
      }
      return rule
    })
    writeBack(nextRules, true)
  }

  const onMoveDown = (index: number) => {
    if (index === rules.length - 1) return
    const nextRules = rules.map((rule, ruleIndex) => {
      if (ruleIndex === index) {
        return rules[index + 1] as RuleValue
      }
      if (ruleIndex === index + 1) {
        return rules[index] as RuleValue
      }
      return rule
    })
    writeBack(nextRules, true)
  }

  const toggleDisplayMode = () => {
    setDisplayMode((current) =>
      current === "plain" ? "slash" : "plain",
    )
  }

  const chainOutput = isChain
    ? computeChainOutput(rules)
    : null

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <FieldLabel stepId={step.id} field={field} />
        <button
          type="button"
          onClick={toggleDisplayMode}
          className="text-[10px] text-slate-400 hover:text-slate-200 underline-offset-2 hover:underline"
          aria-label="Toggle slash-form regex display"
        >
          {displayMode === "plain"
            ? "Show as /…/"
            : "Show as Aa"}
        </button>
      </div>
      {rules.map((rule, index) => (
        <RenameRegexRuleRow
          key={rule._id}
          ruleIndex={index}
          totalRules={rules.length}
          rule={rule}
          displayMode={displayMode}
          isChain={isChain}
          onChangeRule={onChangeRule}
          onDeleteRule={onDeleteRule}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
        />
      ))}
      <button
        type="button"
        onClick={onAddRule}
        className="mt-1 text-[10px] text-blue-400 hover:text-blue-200 underline-offset-2 hover:underline"
        aria-label="Add rule"
      >
        + Add rule
      </button>
      {chainOutput !== null && (
        <div className="mt-2 rounded border border-slate-600 bg-slate-800/60 px-2 py-1.5 text-[11px] text-slate-200">
          <span className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider mr-1">
            Chain output
          </span>
          <span className="font-mono">{chainOutput}</span>
        </div>
      )}
      {!isChain && (
        <small className="block text-[10px] text-slate-500 mt-1">
          {
            "Applied to each entry's filename (or folder name) via String.replace. Capture groups $1, $2, … and $<name> are available in the replacement."
          }
        </small>
      )}
    </div>
  )
}
