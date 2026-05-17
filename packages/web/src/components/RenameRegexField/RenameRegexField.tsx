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
} from "./RegexFieldHelpers"
import { RegexLivePreview } from "./RegexLivePreview"

type RenameRegexValue = {
  pattern: string
  flags: string
  replacement: string
  sample: string
}

type RenameRegexFieldProps = {
  field: CommandField
  step: Step
}

const readValue = (raw: unknown): RenameRegexValue => {
  if (raw && typeof raw === "object") {
    const { pattern, flags, replacement, sample } =
      raw as Partial<{
        pattern: unknown
        flags: unknown
        replacement: unknown
        sample: unknown
      }>
    return {
      pattern: typeof pattern === "string" ? pattern : "",
      flags: typeof flags === "string" ? flags : "",
      replacement:
        typeof replacement === "string" ? replacement : "",
      sample: typeof sample === "string" ? sample : "",
    }
  }
  return {
    pattern: "",
    flags: "",
    replacement: "",
    sample: "",
  }
}

// Emits the MINIMAL on-wire shape: when flags + sample are both empty
// we write the legacy 2-key `{ pattern, replacement }` so the schema and
// YAML round-trip unchanged for users who never use the new fields. With
// either set we promote to the full 4-key shape. When pattern +
// replacement are also empty we write `undefined` so buildParams omits
// the key entirely.
const serializeForWrite = (
  value: RenameRegexValue,
):
  | undefined
  | {
      pattern: string
      replacement: string
      flags?: string
      sample?: string
    } => {
  const { pattern, flags, replacement, sample } = value
  const isFullyEmpty =
    pattern === "" &&
    flags === "" &&
    replacement === "" &&
    sample === ""
  if (isFullyEmpty) return undefined
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

type DisplayMode = "plain" | "slash"

export const RenameRegexField = ({
  field,
  step,
}: RenameRegexFieldProps) => {
  const { setParam } = useBuilderActions()
  const initialValue = readValue(step.params[field.name])
  const [value, setValue] =
    useState<RenameRegexValue>(initialValue)
  const [displayMode, setDisplayMode] =
    useState<DisplayMode>("plain")

  const patternId = useId()
  const flagsId = useId()
  const slashId = useId()
  const replacementId = useId()
  const sampleId = useId()

  const flagValidation = validateRegexFlags(value.flags)

  const writeBack = (nextValue: RenameRegexValue) => {
    setValue(nextValue)
    setParam(
      step.id,
      field.name,
      serializeForWrite(nextValue),
    )
  }

  const onChangeField =
    (key: keyof RenameRegexValue) =>
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
    replacement: value.replacement,
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
              value={value.pattern}
              onChange={onChangeField("pattern")}
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
          htmlFor={replacementId}
          className="block text-[10px] text-slate-400 mb-0.5"
        >
          Replacement
        </label>
        <input
          id={replacementId}
          type="text"
          value={value.replacement}
          onChange={onChangeField("replacement")}
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
          value={value.sample}
          onChange={onChangeField("sample")}
          placeholder="[Group] My Show - 01 [BD 1080p].mkv"
          className="w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono"
        />
        <RegexLivePreview
          result={livePreview}
          hasOutput={true}
        />
      </div>
      <small className="block text-[10px] text-slate-500 mt-1">
        {
          "Applied to each entry's filename (or folder name) via String.replace. Capture groups $1, $2, … and $<name> are available in the replacement."
        }
      </small>
    </div>
  )
}
