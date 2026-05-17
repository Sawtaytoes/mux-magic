import { useAtomValue, useSetAtom } from "jotai"
import { useEffect, useRef } from "react"
import { getLinkedValue } from "../../commands/links"
import type { CommandField } from "../../commands/types"
import { fileExplorerAtom } from "../../components/FileExplorerModal/fileExplorerAtom"
import { useBuilderActions } from "../../hooks/useBuilderActions"
import { commandLabel } from "../../jobs/commandLabels"
import { flattenSteps } from "../../jobs/sequenceUtils"
import { commandsAtom } from "../../state/commandsAtom"
import { pathsAtom } from "../../state/pathsAtom"
import {
  linkPickerStateAtom,
  pathPickerStateAtom,
} from "../../state/pickerAtoms"
import { stepsAtom } from "../../state/stepsAtom"
import type {
  PathVariable,
  SequenceItem,
  Step,
  StepLink,
} from "../../types"
import { FieldLabel } from "../FieldLabel/FieldLabel"
import { parentPathFromInput } from "../PathPicker/parentPathFromInput"

type PathFieldProps = {
  field: CommandField
  step: Step
}

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
  const {
    addPathVariable,
    setLink,
    setParam,
    setPathValue,
  } = useBuilderActions()
  const setFileExplorer = useSetAtom(fileExplorerAtom)
  const setLinkPickerState = useSetAtom(linkPickerStateAtom)
  const setPathPickerState = useSetAtom(pathPickerStateAtom)
  const paths = useAtomValue(pathsAtom)
  const allSteps = useAtomValue(stepsAtom)
  const commands = useAtomValue(commandsAtom)

  const inputRef = useRef<HTMLInputElement>(null)
  const linkButtonRef = useRef<HTMLButtonElement>(null)
  const debounceTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null)

  useEffect(
    () => () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    },
    [],
  )

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
        if (typeof link === "string") {
          setPathValue(link, selectedPath)
        } else {
          setParam(step.id, field.name, selectedPath)
        }
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
      <div className="flex items-center gap-2 mb-1">
        <FieldLabel command={step.command} field={field} />
        <button
          type="button"
          onClick={handleBrowse}
          title="Browse folders"
          aria-label="Browse folders"
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
        data-field={field.name}
        value={displayValue}
        readOnly={isObjectLink}
        onChange={(event) => {
          if (isObjectLink) return
          const rawValue = event.target.value
          const value = rawValue || undefined
          if (typeof link === "string") {
            setPathValue(link, value ?? "")
          } else if (!step.params[field.name] && value) {
            const newId = `pathVariable_${Math.random().toString(36).slice(2, 8)}`
            addPathVariable(newId, value)
            setLink(step.id, field.name, newId)
          } else {
            setParam(step.id, field.name, value)
          }
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current)
          }
          const currentInput = inputRef.current
          if (
            currentInput &&
            /^([/\\]|[A-Za-z]:[/\\])/.test(rawValue)
          ) {
            const { parentPath, query } =
              parentPathFromInput(rawValue)
            const pickerTarget =
              typeof link === "string"
                ? ({
                    mode: "pathVariable",
                    pathVariableId: link,
                  } as const)
                : ({
                    mode: "step",
                    stepId: step.id,
                    fieldName: field.name,
                  } as const)
            debounceTimerRef.current = setTimeout(() => {
              const rect =
                currentInput.getBoundingClientRect()
              setPathPickerState({
                inputElement: currentInput,
                target: pickerTarget,
                parentPath,
                query,
                triggerRect: {
                  left: rect.left,
                  top: rect.top,
                  right: rect.right,
                  bottom: rect.bottom,
                  width: rect.width,
                  height: rect.height,
                },
                entries: null,
                error: null,
                activeIndex: 0,
                matches: null,
                separator: "/",
                cachedParentPath: null,
                requestToken: 0,
                debounceTimerId: null,
              })
            }, 250)
          } else {
            setPathPickerState(null)
          }
        }}
        className={`w-full bg-slate-${isObjectLink ? "900" : "700"} text-slate-${isObjectLink ? "400" : "200"} text-xs rounded px-2 py-1.5 border border-slate-${isObjectLink ? "700" : "600"} focus:outline-none focus:border-blue-500 font-mono`}
      />
    </div>
  )
}
