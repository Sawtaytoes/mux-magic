import { Combobox } from "@charcuterie/ui"
import { useAtomValue, useSetAtom } from "jotai"
import { useRef } from "react"
import { getLinkedValue } from "../../commands/links"
import type { CommandField } from "../../commands/types"
import { fileExplorerAtom } from "../../components/FileExplorerModal/fileExplorerAtom"
import { useBuilderActions } from "../../hooks/useBuilderActions"
import { commandLabel } from "../../jobs/commandLabels"
import { flattenSteps } from "../../jobs/sequenceUtils"
import { commandsAtom } from "../../state/commandsAtom"
import { pathsAtom } from "../../state/pathsAtom"
import { stepsAtom } from "../../state/stepsAtom"
import type {
  PathVariable,
  SequenceItem,
  Step,
  StepLink,
} from "../../types"
import { CommandFieldGroup } from "../CommandFieldGroup/CommandFieldGroup"
import { LinkPicker } from "../LinkPicker/LinkPicker"
import { usePathAutocomplete } from "../PathPicker/usePathAutocomplete"

type PathFieldProps = {
  field: CommandField
  step: Step
}

const resolveLinkLabel = (
  link: StepLink | undefined,
  paths: PathVariable[],
  steps: SequenceItem[],
) => {
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
  const paths = useAtomValue(pathsAtom)
  const allSteps = useAtomValue(stepsAtom)
  const commands = useAtomValue(commandsAtom)

  const inputRef = useRef<HTMLInputElement>(null)

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

  // The value writeback stays here (not in the hook): a linked field writes
  // the path variable, an unset field mints one, otherwise it's a plain
  // param — logic the autocomplete hook has no business owning.
  const writeValue = (rawValue: string) => {
    if (isObjectLink) {
      return
    }

    const nextValue = rawValue || undefined

    if (typeof link === "string") {
      setPathValue(link, rawValue)
    } else if (!step.params[field.name] && nextValue) {
      const newId = `pathVariable_${Math.random().toString(36).slice(2, 8)}`
      addPathVariable(newId, nextValue)
      setLink(step.id, field.name, newId)
    } else {
      setParam(step.id, field.name, nextValue)
    }
  }

  const pathAutocomplete = usePathAutocomplete({
    onWriteValue: writeValue,
    value: displayValue,
  })

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

  return (
    <CommandFieldGroup
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleBrowse}
            title="Browse folders"
            aria-label="Browse folders"
            className="shrink-0 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded px-1.5 py-0.5 border border-slate-600 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            📁
          </button>
          <LinkPicker
            stepId={step.id}
            fieldName={field.name}
            label={linkLabel}
          />
        </div>
      }
      className="mb-2"
      field={field}
    >
      <input
        ref={inputRef}
        type="text"
        aria-label={field.label ?? field.name}
        id={`${step.id}-${field.name}`}
        data-field={field.name}
        value={displayValue}
        readOnly={isObjectLink}
        onChange={(event) => {
          pathAutocomplete.onInputChange(event.target.value)
        }}
        className={`w-full bg-slate-${isObjectLink ? "900" : "700"} text-slate-${isObjectLink ? "400" : "200"} text-xs rounded px-2 py-1.5 border border-slate-${isObjectLink ? "700" : "600"} focus:outline-none focus:border-blue-500 font-mono`}
      />

      {/* Directory autocomplete: attached to the input above; a picked
          folder drills in and the popup stays open. Object-linked fields
          are read-only mirrors of another step's output — no autocomplete. */}
      {!isObjectLink && (
        <Combobox
          emptyLabel="No matching entries."
          error={pathAutocomplete.error}
          inputRef={inputRef}
          isLoading={pathAutocomplete.isLoading}
          isVisible={pathAutocomplete.isOpen}
          onDismiss={pathAutocomplete.close}
          onSelect={pathAutocomplete.onSelectFolder}
          options={pathAutocomplete.options}
          query={displayValue}
        />
      )}
    </CommandFieldGroup>
  )
}
