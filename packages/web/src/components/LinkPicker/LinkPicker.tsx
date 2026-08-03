import type { ListboxItem } from "@charcuterie/ui"
import { Combobox } from "@charcuterie/ui"
import { useAtomValue } from "jotai"
import type { ReactNode } from "react"
import { useState } from "react"
import { stepOutput } from "../../commands/links"
import type { Commands } from "../../commands/types"
import { useBuilderActions } from "../../hooks/useBuilderActions"
import { commandLabel } from "../../jobs/commandLabels"
import { flattenSteps } from "../../jobs/sequenceUtils"
import { commandsAtom } from "../../state/commandsAtom"
import { pathsAtom } from "../../state/pathsAtom"
import { stepsAtom } from "../../state/stepsAtom"
import type {
  PathVariable,
  SequenceItem,
  StepLink,
} from "../../types"

type LinkPickerAnchor = {
  stepId: string
  fieldName: string
}

const getCommandLabel = (name: string) => commandLabel(name)

const makePathBreakable = (text: string) =>
  text.replace(/([/\\])/g, "​$1")

// ─── Link item types ──────────────────────────────────────────────────────────

type PathLinkItem = {
  kind: "path"
  value: string
  label: string
  detail: string
  pathVariableId: string
}

type StepLinkItem = {
  kind: "step"
  value: string
  label: string
  detail: string
  sourceStepId: string
  outputName: string
}

type LinkItem = PathLinkItem | StepLinkItem

// One row per (preceding step × output): every step always contributes a
// `folder` row (the synthesized output folder), and any named outputs
// declared on the source command's `outputs` array contribute an extra
// row each. That lets users wire e.g. `deleteCopiedOriginals.pathsToDelete`
// to `copyFiles` → `Copied source paths` without hand-editing YAML.
//
// When the anchor field declares `acceptedOutputs`, both step-output
// rows and path-variable rows are filtered to only what's type-
// compatible: step rows whose output name is in the whitelist, and no
// path variables at all (they're single-string scalars, not arrays).
const buildItems = (
  anchor: LinkPickerAnchor,
  allSteps: SequenceItem[],
  paths: PathVariable[],
  commands: Commands,
): LinkItem[] => {
  const flatOrder = flattenSteps(allSteps)
  const currentIndex = flatOrder.findIndex(
    (entry) => entry.step.id === anchor.stepId,
  )
  if (currentIndex < 0) {
    return []
  }

  const findStep = (stepId: string) =>
    flatOrder.find((entry) => entry.step.id === stepId)
      ?.step

  const anchorStep = flatOrder[currentIndex]?.step
  const anchorField = anchorStep?.command
    ? commands[anchorStep.command]?.fields.find(
        (entry) => entry.name === anchor.fieldName,
      )
    : undefined
  const acceptedOutputs = anchorField?.acceptedOutputs
  const isOutputAccepted = (outputName: string) =>
    !acceptedOutputs || acceptedOutputs.includes(outputName)

  const pathItems: LinkItem[] = acceptedOutputs
    ? []
    : paths.map((pathVariable) => ({
        kind: "path",
        value: `path:${pathVariable.id}`,
        label: pathVariable.label || "(unnamed)",
        detail: pathVariable.value || "",
        pathVariableId: pathVariable.id,
      }))

  const stepItems: StepLinkItem[] = flatOrder
    .slice(0, currentIndex)
    .flatMap((entry) => {
      const previousStep = entry.step
      if (previousStep.command === null) {
        return []
      }
      const stepLabel = `Step ${entry.flatIndex + 1}: ${getCommandLabel(previousStep.command)}`
      const folderItem: StepLinkItem | null =
        isOutputAccepted("folder")
          ? {
              kind: "step",
              value: `step:${previousStep.id}:folder`,
              label: stepLabel,
              detail: stepOutput(
                previousStep,
                paths,
                commands,
                findStep,
              ),
              sourceStepId: previousStep.id,
              outputName: "folder",
            }
          : null
      const namedOutputs =
        commands[previousStep.command]?.outputs ?? []
      const namedItems: StepLinkItem[] = namedOutputs
        .filter((output) => isOutputAccepted(output.name))
        .map((output) => ({
          kind: "step",
          value: `step:${previousStep.id}:${output.name}`,
          label: `${stepLabel} → ${output.label ?? output.name}`,
          detail: output.name,
          sourceStepId: previousStep.id,
          outputName: output.name,
        }))
      return folderItem
        ? [folderItem].concat(namedItems)
        : namedItems
    })

  return pathItems.concat(stepItems)
}

const currentLinkValue = (
  anchor: LinkPickerAnchor,
  allSteps: SequenceItem[],
): string | undefined => {
  const flatOrder = flattenSteps(allSteps)
  const entry = flatOrder.find(
    (flatEntry) => flatEntry.step.id === anchor.stepId,
  )
  const link: StepLink | undefined =
    entry?.step.links?.[anchor.fieldName]
  if (typeof link === "string") {
    return `path:${link}`
  }
  if (link && typeof link === "object" && link.linkedTo) {
    return `step:${link.linkedTo}:${link.output}`
  }
  return undefined
}

const toOption = (item: LinkItem): ListboxItem => ({
  value: item.value,
  textValue: `${item.label} ${item.detail}`,
  label: (
    <span className="flex min-w-0 flex-1 flex-col">
      <span
        className={
          item.kind === "path"
            ? "text-xs font-medium"
            : "text-xs font-mono"
        }
      >
        {item.label}
      </span>
      {item.detail && (
        <span className="path-detail font-mono text-[11px] text-slate-400 wrap-anywhere">
          {makePathBreakable(item.detail)}
        </span>
      )}
    </span>
  ),
})

// ─── Component ────────────────────────────────────────────────────────────────

type LinkPickerProps = {
  stepId: string
  fieldName: string
  /** The current link's display label, shown on the trigger button. */
  label: ReactNode
}

/**
 * Wires a step field to a prior step's output or a path variable. Rendered
 * inline at each link-button site (`PathField`, `StringArrayField`) rather
 * than as a singleton — the searchable Combobox portals itself and anchors
 * off its own trigger.
 */
export const LinkPicker = ({
  stepId,
  fieldName,
  label,
}: LinkPickerProps) => {
  const allSteps = useAtomValue(stepsAtom)
  const paths = useAtomValue(pathsAtom)
  const commands = useAtomValue(commandsAtom)
  const { setLink } = useBuilderActions()
  const [isOpen, setIsOpen] = useState(false)

  const anchor = { stepId, fieldName }
  const items = buildItems(
    anchor,
    allSteps,
    paths,
    commands,
  )
  const options = items.map(toOption)

  const flat = flattenSteps(allSteps)
  const anchorStep = flat.find(
    (entry) => entry.step.id === stepId,
  )?.step
  const anchorField = anchorStep?.command
    ? commands[anchorStep.command]?.fields.find(
        (entry) => entry.name === fieldName,
      )
    : undefined
  const hasAcceptedOutputsWhitelist = Array.isArray(
    anchorField?.acceptedOutputs,
  )

  const handleSelect = (value: string) => {
    const item = items.find(
      (candidate) => candidate.value === value,
    )
    setIsOpen(false)
    if (!item) {
      return
    }
    if (item.kind === "path") {
      setLink(stepId, fieldName, item.pathVariableId)
    } else {
      setLink(stepId, fieldName, {
        linkedTo: item.sourceStepId,
        output: item.outputName,
      })
    }
  }

  const trigger = (
    <button
      type="button"
      title="Link to a path variable or step output"
      onClick={() =>
        setIsOpen((isCurrentlyOpen) => !isCurrentlyOpen)
      }
      className="shrink-0 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded px-1.5 py-0.5 border border-slate-600 focus:outline-none focus:border-blue-500 min-w-0 max-w-full flex items-center gap-1 cursor-pointer"
    >
      <span className="truncate">{label}</span>
      <span className="text-slate-400 shrink-0">▾</span>
    </button>
  )

  return (
    <Combobox
      trigger={trigger}
      isVisible={isOpen}
      onDismiss={() => setIsOpen(false)}
      onSelect={handleSelect}
      options={options}
      selectedValue={currentLinkValue(anchor, allSteps)}
      placeholder="Search locations…"
      emptyLabel="No matches."
      footer={
        hasAcceptedOutputsWhitelist ? undefined : (
          <span className="italic">
            {
              "Don't see what you need? Close this and type a path directly into the field — it saves as a new path automatically."
            }
          </span>
        )
      }
    />
  )
}
