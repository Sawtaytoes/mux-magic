import { useAtomValue, useSetAtom } from "jotai"
import { useRef } from "react"
import { getLinkedValue } from "../../commands/links"
import { useBuilderActions } from "../../hooks/useBuilderActions"
import { commandLabel } from "../../jobs/commandLabels"
import { flattenSteps } from "../../jobs/sequenceUtils"
import { commandsAtom } from "../../state/commandsAtom"
import { pathsAtom } from "../../state/pathsAtom"
import { linkPickerStateAtom } from "../../state/pickerAtoms"
import { stepsAtom } from "../../state/stepsAtom"
import { fileExplorerAtom } from "../../state/uiAtoms"
import type {
  CommandField,
  PathVar,
  SequenceItem,
  Step,
  StepLink,
} from "../../types"
import { FieldLabel } from "../FieldLabel/FieldLabel"

type PathFieldProps = {
  field: CommandField
  step: Step
}

const resolveLinkLabel = (
  link: StepLink | undefined,
  paths: PathVar[],
  steps: SequenceItem[],
): string => {
  if (!link) {
    return "— custom —"
  }
  if (typeof link === "string") {
    const pathVar = paths.find((pv) => pv.id === link)
    return pathVar?.label ?? link
  }
  if (link && typeof link === "object" && link.linkedTo) {
    const flat = flattenSteps(steps)
    const entry = flat.find(
      (flEntry) => flEntry.step.id === link.linkedTo,
    )
    if (entry?.step.command) {
      return `Step ${entry.flatIndex + 1}: ${commandLabel(entry.step.command)}`
    }
    return link.linkedTo
  }
  return "— custom —"
}

export const PathField = ({
  field,
  step,
}: PathFieldProps) => {
  const { setParam } = useBuilderActions()
  const setFileExplorer = useSetAtom(fileExplorerAtom)
  const setLinkPickerState = useSetAtom(linkPickerStateAtom)
  const paths = useAtomValue(pathsAtom)
  const allSteps = useAtomValue(stepsAtom)
  const commands = useAtomValue(commandsAtom)

  const inputRef = useRef<HTMLInputElement>(null)
  const linkButtonRef = useRef<HTMLButtonElement>(null)

  const link = step.links?.[field.name]
  const isObjectLink =
    link != null &&
    typeof link === "object" &&
    typeof link.linkedTo === "string"

  const findStep = (stepId: string) =>
    flattenSteps(allSteps).find(
      (entry) => entry.step.id === stepId,
    )?.step

  const computedValue =
    getLinkedValue(
      step,
      field.name,
      paths,
      commands,
      findStep,
    ) ?? ""
  const manualValue =
    (step.params[field.name] as string | undefined) ?? ""
  const displayValue =
    link != null ? computedValue : manualValue

  const linkLabel = resolveLinkLabel(link, paths, allSteps)

  const handleBrowse = () => {
    setFileExplorer({
      path: displayValue,
      pickerOnSelect: (selectedPath) => {
        setParam(step.id, field.name, selectedPath)
      },
    })
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
    <div className="mb-2">
      <FieldLabel command={step.command} field={field} />
      <div className="flex items-center gap-2 mb-1">
        <button
          type="button"
          onClick={handleBrowse}
          title="Browse to pick a folder for this field"
          className="shrink-0 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded px-1.5 py-0.5 border border-slate-600 focus:outline-none focus:border-blue-500 cursor-pointer"
        >
          📁
        </button>
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
      <input
        ref={inputRef}
        type="text"
        id={`${step.command}-${field.name}`}
        value={displayValue}
        readOnly={isObjectLink}
        onChange={(event) => {
          if (!isObjectLink) {
            setParam(
              step.id,
              field.name,
              event.target.value || undefined,
            )
          }
        }}
        className={`w-full bg-slate-${isObjectLink ? "900" : "700"} text-slate-${isObjectLink ? "400" : "200"} text-xs rounded px-2 py-1.5 border border-slate-${isObjectLink ? "700" : "600"} focus:outline-none focus:border-blue-500 font-mono`}
      />
      {link &&
        typeof link === "object" &&
        link.linkedTo && (
          <div className="text-xs text-slate-400 mt-1">
            Linked → {link.linkedTo}.
            {link.output ?? "folder"}
          </div>
        )}
    </div>
  )
}
