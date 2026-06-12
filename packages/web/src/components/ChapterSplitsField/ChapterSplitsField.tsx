import { useEffect, useState } from "react"
import type { CommandField } from "../../commands/types"
import { useBuilderActions } from "../../hooks/useBuilderActions"
import type { Step } from "../../types"
import { FieldLabel } from "../FieldLabel/FieldLabel"

type ChapterSplitsFieldProps = {
  field: CommandField
  step: Step
}

// `chapterSplits` is a *space-separated list of comma-separated* chapter
// markers (see splitChaptersCommand.ts and the schema's description). Each
// whitespace-separated token is one file's split spec, and the commas
// inside a token are that file's chapter markers — e.g.
//   "7,18,26,33 6,17,25 6" → ["7,18,26,33", "6,17,25", "6"]
// meaning file 1 splits at chapters 7/18/26/33, file 2 at 6/17/25, file 3
// at 6. So the ARRAY delimiter is whitespace, NOT comma — the generic
// StringArrayField (which splits on comma) would turn one file's "6,9"
// into two files, which is wrong.
export const parseChapterSplits = (
  text: string,
): string[] =>
  text
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)

export const ChapterSplitsField = ({
  field,
  step,
}: ChapterSplitsFieldProps) => {
  const { setParam } = useBuilderActions()

  const value = step.params[field.name] as
    | string[]
    | undefined
  const displayValue = Array.isArray(value)
    ? value.join(" ")
    : ""

  // Mirror NumberArrayField: hold the raw text locally and only parse on
  // blur. Parsing on every keystroke would rewrite the controlled input
  // (collapsing whitespace, dropping a comma the user is mid-typing) and
  // fight the caret — that reformatting is exactly what ate "6,9".
  const [inputValue, setInputValue] = useState(displayValue)

  useEffect(() => {
    setInputValue(displayValue)
  }, [displayValue])

  const handleBlur = () => {
    setParam(
      step.id,
      field.name,
      parseChapterSplits(inputValue),
    )
  }

  return (
    <div>
      <FieldLabel stepId={step.id} field={field} />
      <input
        id={`${step.id}-${field.name}`}
        type="text"
        value={inputValue}
        placeholder={
          field.placeholder ?? "7,18,26,33 6,17,25 6"
        }
        onChange={(event) =>
          setInputValue(event.target.value)
        }
        onBlur={handleBlur}
        aria-required={
          field.isRequired ? "true" : undefined
        }
        className="w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono"
      />
    </div>
  )
}
