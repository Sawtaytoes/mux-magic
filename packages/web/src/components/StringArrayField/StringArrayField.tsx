import { useAtomValue, useSetAtom } from "jotai"
import { useRef } from "react"
import type { CommandField } from "../../commands/types"
import { useBuilderActions } from "../../hooks/useBuilderActions"
import { commandLabel } from "../../jobs/commandLabels"
import { flattenSteps } from "../../jobs/sequenceUtils"
import { pathsAtom } from "../../state/pathsAtom"
import { linkPickerStateAtom } from "../../state/pickerAtoms"
import { stepsAtom } from "../../state/stepsAtom"
import type {
  PathVariable,
  SequenceItem,
  Step,
  StepLink,
} from "../../types"
import { FieldLabel } from "../FieldLabel/FieldLabel"

type StringArrayFieldProps = {
  field: CommandField
  step: Step
}

// Mirrors PathField's label-row link button so an array-typed field can
// be wired to a prior step's named output (e.g. `pathsToDelete` →
// `copyFiles.copiedSourcePaths`). The text input is hidden when a link
// is in place because the value comes from the linked source at runtime
// and is opaque to the editor — showing an editable comma list would
// imply hand-edit semantics that don't apply.
const resolveLinkLabel = (
  link: StepLink | undefined,
  paths: PathVariable[],
  steps: SequenceItem[],
): string => {
  if (!link) {
    return "— custom —"
  }
  if (typeof link === "string") {
    const pathVariable = paths.find((pv) => pv.id === link)
    return pathVariable?.label ?? link
  }
  if (link && typeof link === "object" && link.linkedTo) {
    const flat = flattenSteps(steps)
    const entry = flat.find(
      (flEntry) => flEntry.step.id === link.linkedTo,
    )
    const stepLabel = entry?.step.command
      ? `Step ${entry.flatIndex + 1}: ${commandLabel(entry.step.command)}`
      : link.linkedTo
    return link.output && link.output !== "folder"
      ? `${stepLabel} → ${link.output}`
      : stepLabel
  }
  return "— custom —"
}

export const StringArrayField = ({
  field,
  step,
}: StringArrayFieldProps) => {
  const { setParam } = useBuilderActions()
  const paths = useAtomValue(pathsAtom)
  const allSteps = useAtomValue(stepsAtom)
  const setLinkPickerState = useSetAtom(linkPickerStateAtom)
  const linkButtonRef = useRef<HTMLButtonElement>(null)

  const link = step.links?.[field.name]
  const isLinked = link != null
  const linkLabel = resolveLinkLabel(link, paths, allSteps)

  const value = step.params[field.name] as
    | string[]
    | undefined
  const displayValue = Array.isArray(value)
    ? value.join(", ")
    : ""

  const handleChange = (text: string) => {
    const array = text
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0)

    setParam(step.id, field.name, array)
  }

  const handleLinkPicker = () => {
    const buttonRect =
      linkButtonRef.current?.getBoundingClientRect()
    if (!buttonRect) return
    setLinkPickerState({
      anchor: { stepId: step.id, fieldName: field.name },
      triggerRect: buttonRect,
    })
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <FieldLabel command={step.command} field={field} />
        <button
          ref={linkButtonRef}
          type="button"
          onClick={handleLinkPicker}
          title="Link to a path variable or step output"
          className="shrink-0 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded px-1.5 py-0.5 border border-slate-600 focus:outline-none focus:border-blue-500 min-w-0 max-w-full flex items-center gap-1 cursor-pointer"
        >
          <span className="truncate">{linkLabel}</span>
          <span className="text-slate-400 shrink-0">▾</span>
        </button>
      </div>
      {isLinked ? (
        <p className="w-full bg-slate-900 text-slate-400 text-xs rounded px-2 py-1.5 border border-slate-700 font-mono">
          {linkLabel}
        </p>
      ) : (
        <input
          id={`${step.command}-${field.name}`}
          type="text"
          value={displayValue}
          placeholder={field.placeholder ?? ""}
          onChange={(event) =>
            handleChange(event.target.value)
          }
          aria-required={
            field.isRequired ? "true" : undefined
          }
          className="w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono"
        />
      )}
    </div>
  )
}
