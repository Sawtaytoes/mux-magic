import { useId, useState } from "react"
import type { CommandField } from "../../commands/types"
import { useBuilderActions } from "../../hooks/useBuilderActions"
import type { Step } from "../../types"
import { FieldLabel } from "../FieldLabel/FieldLabel"
import {
  formatSlashLiteral,
  parseSlashLiteral,
  runLivePreview,
  validateRegexFlags,
} from "../RenameRegexField/RegexFieldHelpers"
import { RegexLivePreview } from "../RenameRegexField/RegexLivePreview"

// Filter-only regex value: `pattern + flags? + sample?`. No `replacement`
// — filters match/no-match, they don't transform. Used by `copyFiles` /
// `moveFiles` for `fileFilterRegex` / `folderFilterRegex`.
type RegexFilterValue = {
  pattern: string
  flags: string
  sample: string
}

type RegexWithFlagsFieldProps = {
  field: CommandField
  step: Step
}

// Worker 63 stored these fields as bare strings. Worker 65 promotes them
// to `{ pattern, flags?, sample? }` but accepts the legacy string shape
// transparently so existing YAML / `?seqJson=` templates keep loading.
const readValue = (raw: unknown): RegexFilterValue => {
  if (typeof raw === "string") {
    return { pattern: raw, flags: "", sample: "" }
  }
  if (raw && typeof raw === "object") {
    const { pattern, flags, sample } = raw as Partial<{
      pattern: unknown
      flags: unknown
      sample: unknown
    }>
    return {
      pattern: typeof pattern === "string" ? pattern : "",
      flags: typeof flags === "string" ? flags : "",
      sample: typeof sample === "string" ? sample : "",
    }
  }
  return { pattern: "", flags: "", sample: "" }
}

// Emits the MINIMAL on-wire shape: bare string when flags + sample are
// empty (legacy worker 63 format); promoted object otherwise. When the
// pattern itself is empty too we write `undefined` so buildParams omits
// the field.
const serializeForWrite = (
  value: RegexFilterValue,
):
  | undefined
  | string
  | {
      pattern: string
      flags?: string
      sample?: string
    } => {
  const { pattern, flags, sample } = value
  if (pattern === "" && flags === "" && sample === "") {
    return undefined
  }
  if (flags === "" && sample === "") {
    return pattern
  }
  return {
    pattern,
    ...(flags !== "" ? { flags } : {}),
    ...(sample !== "" ? { sample } : {}),
  }
}

type DisplayMode = "plain" | "slash"

export const RegexWithFlagsField = ({
  field,
  step,
}: RegexWithFlagsFieldProps) => {
  const { setParam } = useBuilderActions()
  const initial = readValue(step.params[field.name])
  const [value, setValue] =
    useState<RegexFilterValue>(initial)
  const [displayMode, setDisplayMode] =
    useState<DisplayMode>("plain")

  const patternId = useId()
  const flagsId = useId()
  const slashId = useId()
  const sampleId = useId()
  const flagValidation = validateRegexFlags(value.flags)

  const writeBack = (next: RegexFilterValue) => {
    setValue(next)
    setParam(step.id, field.name, serializeForWrite(next))
  }

  const onChangeField =
    (key: keyof RegexFilterValue) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      writeBack({ ...value, [key]: event.target.value })
    }

  const onChangeSlash = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const parsed = parseSlashLiteral(event.target.value)
    writeBack({
      ...value,
      pattern: parsed.pattern,
      flags: parsed.flags,
    })
  }

  const livePreview = runLivePreview({
    pattern: value.pattern,
    flags: value.flags,
    sample: value.sample,
  })

  const toggleDisplayMode = () => {
    setDisplayMode((current) =>
      current === "plain" ? "slash" : "plain",
    )
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <FieldLabel command={step.command} field={field} />
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
              value.pattern,
              value.flags,
            )}
            onChange={onChangeSlash}
            placeholder={field.placeholder ?? "/\\.mkv$/i"}
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
              value={value.pattern}
              onChange={onChangeField("pattern")}
              placeholder={field.placeholder ?? "\\.mkv$"}
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
              value={value.flags}
              onChange={onChangeField("flags")}
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
          htmlFor={sampleId}
          className="block text-[10px] text-slate-400 mb-0.5"
        >
          Test against (optional)
        </label>
        <input
          id={sampleId}
          type="text"
          value={value.sample}
          onChange={onChangeField("sample")}
          placeholder="example-filename.mkv"
          className="w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono"
        />
        <RegexLivePreview
          result={livePreview}
          hasOutput={false}
        />
      </div>
    </div>
  )
}
