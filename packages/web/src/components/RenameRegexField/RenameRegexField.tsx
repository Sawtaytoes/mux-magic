import { useId, useRef } from "react"
import type { CommandField } from "../../commands/types"
import { useBuilderActions } from "../../hooks/useBuilderActions"
import type { Step } from "../../types"
import { FieldLabel } from "../FieldLabel/FieldLabel"

type RenameRegexValue = {
  pattern: string
  replacement: string
}

type RenameRegexFieldProps = {
  field: CommandField
  step: Step
}

const readValue = (
  raw: unknown,
): RenameRegexValue | undefined => {
  if (raw && typeof raw === "object") {
    const { pattern, replacement } = raw as Partial<{
      pattern: unknown
      replacement: unknown
    }>
    return {
      pattern: typeof pattern === "string" ? pattern : "",
      replacement:
        typeof replacement === "string" ? replacement : "",
    }
  }
  return undefined
}

export const RenameRegexField = ({
  field,
  step,
}: RenameRegexFieldProps) => {
  const { setParam } = useBuilderActions()
  const patternInputRef = useRef<HTMLInputElement>(null)
  const replacementInputRef = useRef<HTMLInputElement>(null)
  const value = readValue(step.params[field.name])
  const patternId = useId()
  const replacementId = useId()

  const writeBack = () => {
    const nextPattern = patternInputRef.current?.value ?? ""
    const nextReplacement =
      replacementInputRef.current?.value ?? ""
    const isEmpty =
      nextPattern === "" && nextReplacement === ""
    setParam(
      step.id,
      field.name,
      isEmpty
        ? undefined
        : {
            pattern: nextPattern,
            replacement: nextReplacement,
          },
    )
  }

  return (
    <div>
      <FieldLabel command={step.command} field={field} />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label
            htmlFor={patternId}
            className="block text-[10px] text-slate-400 mb-0.5"
          >
            Pattern
          </label>
          <input
            id={patternId}
            ref={patternInputRef}
            type="text"
            defaultValue={value?.pattern ?? ""}
            placeholder="^(.+)\\.mkv$"
            onInput={writeBack}
            className="w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>
        <div>
          <label
            htmlFor={replacementId}
            className="block text-[10px] text-slate-400 mb-0.5"
          >
            Replacement
          </label>
          <input
            id={replacementId}
            ref={replacementInputRef}
            type="text"
            defaultValue={value?.replacement ?? ""}
            placeholder="$1.mp4"
            onInput={writeBack}
            className="w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>
      </div>
      <small className="block text-[10px] text-slate-500 mt-1">
        {
          "Applied to each entry's filename (or folder name) via String.replace. Capture groups $1, $2, ... are available in the replacement."
        }
      </small>
    </div>
  )
}
