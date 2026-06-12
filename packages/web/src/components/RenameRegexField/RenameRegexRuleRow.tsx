import { useId } from "react"
import {
  formatSlashLiteral,
  parseSlashLiteral,
  runLivePreview,
  validateRegexFlags,
} from "./RegexFieldHelpers"
import { RegexLivePreview } from "./RegexLivePreview"
import type {
  DisplayMode,
  RuleValue,
} from "./renameRegexTypes"

export type RuleRowProps = {
  ruleIndex: number
  totalRules: number
  rule: RuleValue
  displayMode: DisplayMode
  isChain: boolean
  onChangeRule: (index: number, next: RuleValue) => void
  onDeleteRule: (index: number) => void
  onMoveUp: (index: number) => void
  onMoveDown: (index: number) => void
}

export const RenameRegexRuleRow = ({
  ruleIndex,
  totalRules,
  rule,
  displayMode,
  isChain,
  onChangeRule,
  onDeleteRule,
  onMoveUp,
  onMoveDown,
}: RuleRowProps) => {
  const patternId = useId()
  const flagsId = useId()
  const slashId = useId()
  const replacementId = useId()
  const sampleId = useId()

  const flagValidation = validateRegexFlags(rule.flags)

  const onChange =
    (key: keyof RuleValue) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChangeRule(ruleIndex, {
        ...rule,
        [key]: event.target.value,
      })
    }

  const onChangeSlash = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const parsed = parseSlashLiteral(event.target.value)
    onChangeRule(ruleIndex, {
      ...rule,
      pattern: parsed.pattern,
      flags: parsed.flags,
    })
  }

  const livePreview = runLivePreview({
    pattern: rule.pattern,
    flags: rule.flags,
    replacement: rule.replacement,
    sample: rule.sample,
  })

  return (
    <div
      className={
        isChain
          ? "border border-slate-700 rounded p-2 mb-2"
          : ""
      }
    >
      {isChain && (
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-slate-500 font-mono">
            Rule {ruleIndex + 1}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Move rule up"
              disabled={ruleIndex === 0}
              onClick={() => {
                onMoveUp(ruleIndex)
              }}
              className="text-[10px] text-slate-400 hover:text-slate-200 disabled:opacity-30 px-1"
            >
              ↑
            </button>
            <button
              type="button"
              aria-label="Move rule down"
              disabled={ruleIndex === totalRules - 1}
              onClick={() => {
                onMoveDown(ruleIndex)
              }}
              className="text-[10px] text-slate-400 hover:text-slate-200 disabled:opacity-30 px-1"
            >
              ↓
            </button>
            <button
              type="button"
              aria-label="Delete rule"
              onClick={() => {
                onDeleteRule(ruleIndex)
              }}
              className="text-[10px] text-rose-400 hover:text-rose-200 px-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      {displayMode === "slash" ? (
        <div>
          <label
            htmlFor={slashId}
            className="block text-[10px] text-slate-400 mb-0.5"
          >
            Pattern + flags
          </label>
          <input
            id={slashId}
            type="text"
            value={formatSlashLiteral(
              rule.pattern,
              rule.flags,
            )}
            onChange={onChangeSlash}
            placeholder="/^(.+)\\.mkv$/i"
            className="w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>
      ) : (
        <div className="grid grid-cols-[1fr_4rem] gap-2">
          <div>
            <label
              htmlFor={patternId}
              className="block text-[10px] text-slate-400 mb-0.5"
            >
              Pattern
            </label>
            <input
              id={patternId}
              type="text"
              value={rule.pattern}
              onChange={onChange("pattern")}
              placeholder="^(.+)\\.mkv$"
              className="w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>
          <div>
            <label
              htmlFor={flagsId}
              className="block text-[10px] text-slate-400 mb-0.5"
            >
              Flags
            </label>
            <input
              id={flagsId}
              type="text"
              value={rule.flags}
              onChange={onChange("flags")}
              placeholder="i"
              aria-invalid={!flagValidation.isValid}
              title={
                flagValidation.isValid
                  ? "Optional regex flags (g i m s u y)"
                  : `Invalid flag(s): ${flagValidation.invalidChars}`
              }
              className={`w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border focus:outline-none focus:border-blue-500 font-mono ${
                flagValidation.isValid
                  ? "border-slate-600"
                  : "border-rose-500"
              }`}
            />
          </div>
        </div>
      )}
      <div className="mt-2">
        <label
          htmlFor={replacementId}
          className="block text-[10px] text-slate-400 mb-0.5"
        >
          Replacement
        </label>
        <input
          id={replacementId}
          type="text"
          value={rule.replacement}
          onChange={onChange("replacement")}
          placeholder="$1.mp4"
          className="w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono"
        />
      </div>
      <div className="mt-2">
        <label
          htmlFor={sampleId}
          className="block text-[10px] text-slate-400 mb-0.5"
        >
          Test against (optional)
        </label>
        <input
          id={sampleId}
          type="text"
          value={rule.sample}
          onChange={onChange("sample")}
          placeholder="[Group] My Show - 01 [BD 1080p].mkv"
          className="w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono"
        />
        <RegexLivePreview
          result={livePreview}
          hasOutput={true}
        />
      </div>
    </div>
  )
}
