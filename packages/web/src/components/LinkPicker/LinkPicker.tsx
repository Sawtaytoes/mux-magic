import { useAtom, useAtomValue } from "jotai"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { stepOutput } from "../../commands/links"
import type { Commands } from "../../commands/types"
import { useBuilderActions } from "../../hooks/useBuilderActions"
import { commandLabel } from "../../jobs/commandLabels"
import { flattenSteps } from "../../jobs/sequenceUtils"
import { commandsAtom } from "../../state/commandsAtom"
import { pathsAtom } from "../../state/pathsAtom"
import {
  type LinkPickerAnchor,
  linkPickerStateAtom,
  type TriggerRect,
} from "../../state/pickerAtoms"
import { stepsAtom } from "../../state/stepsAtom"
import type {
  PathVariable,
  SequenceItem,
  StepLink,
} from "../../types"

const PICKER_WIDTH = 360
const PICKER_MAX_HEIGHT = 400

const getCommandLabel = (name: string): string =>
  commandLabel(name)

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

const findInitialIndex = (
  items: LinkItem[],
  anchor: LinkPickerAnchor,
  allSteps: SequenceItem[],
): number => {
  const flatOrder = flattenSteps(allSteps)
  const entry = flatOrder.find(
    (flatEntry) => flatEntry.step.id === anchor.stepId,
  )
  if (!entry) {
    return 0
  }
  const link: StepLink | undefined =
    entry.step.links?.[anchor.fieldName]
  if (typeof link === "string") {
    const idx = items.findIndex(
      (item) =>
        item.kind === "path" &&
        item.pathVariableId === link,
    )
    return idx >= 0 ? idx : 0
  }
  if (link && typeof link === "object" && link.linkedTo) {
    const idx = items.findIndex(
      (item) =>
        item.kind === "step" &&
        item.sourceStepId === link.linkedTo &&
        item.outputName === link.output,
    )
    return idx >= 0 ? idx : 0
  }
  return 0
}

const matchesQuery = (item: LinkItem, query: string) =>
  item.label.toLowerCase().includes(query) ||
  item.detail.toLowerCase().includes(query)

const computePosition = (
  rect: TriggerRect,
  width: number,
  maxHeight: number,
) => {
  const margin = 8
  const initialLeft = Math.round(
    (rect.left + rect.right) / 2 - width / 2,
  )
  const clampedLeft = (() => {
    if (initialLeft + width > window.innerWidth - margin) {
      return Math.max(
        margin,
        window.innerWidth - width - margin,
      )
    }
    if (initialLeft < margin) {
      return margin
    }
    return initialLeft
  })()
  const spaceBelow =
    window.innerHeight - rect.bottom - margin
  const spaceAbove = rect.top - margin
  const isFlippedAbove =
    spaceBelow < 200 && spaceAbove > spaceBelow
  const { top, height } = (() => {
    if (isFlippedAbove) {
      const flippedHeight = Math.min(
        maxHeight,
        Math.max(0, spaceAbove),
      )
      return {
        top: rect.top - flippedHeight - 4,
        height: flippedHeight,
      }
    }
    const droppedHeight = Math.min(
      maxHeight,
      Math.max(0, spaceBelow),
    )
    return { top: rect.bottom + 4, height: droppedHeight }
  })()
  const clampedTop = Math.max(
    margin,
    Math.min(top, window.innerHeight - height - margin),
  )
  return {
    top: clampedTop,
    left: clampedLeft,
    maxHeight: height,
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export const LinkPicker = () => {
  const [pickerState, setPickerState] = useAtom(
    linkPickerStateAtom,
  )
  const allSteps = useAtomValue(stepsAtom)
  const paths = useAtomValue(pathsAtom)
  const commands = useAtomValue(commandsAtom)
  const { setLink } = useBuilderActions()
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const allItems = pickerState
    ? buildItems(
        pickerState.anchor,
        allSteps,
        paths,
        commands,
      )
    : []
  const hasAcceptedOutputsWhitelist = (() => {
    if (!pickerState) return false
    const flat = flattenSteps(allSteps)
    const anchorStep = flat.find(
      (entry) =>
        entry.step.id === pickerState.anchor.stepId,
    )?.step
    if (!anchorStep?.command) return false
    const anchorField = commands[
      anchorStep.command
    ]?.fields.find(
      (entry) =>
        entry.name === pickerState.anchor.fieldName,
    )
    return Array.isArray(anchorField?.acceptedOutputs)
  })()
  const queryLower = query.trim().toLowerCase()
  const filtered = queryLower
    ? allItems.filter((item) =>
        matchesQuery(item, queryLower),
      )
    : allItems
  const safeActiveIndex =
    activeIndex >= filtered.length ? 0 : activeIndex

  useEffect(() => {
    if (!pickerState) {
      return
    }
    const items = buildItems(
      pickerState.anchor,
      allSteps,
      paths,
      commands,
    )
    setQuery("")
    setActiveIndex(
      findInitialIndex(items, pickerState.anchor, allSteps),
    )
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [pickerState, allSteps, paths, commands])

  useEffect(() => {
    if (!pickerState) {
      return
    }
    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node
      const popover = document.getElementById(
        "link-picker-react",
      )
      if (popover?.contains(target)) {
        return
      }
      setPickerState(null)
    }
    document.addEventListener(
      "mousedown",
      handleMouseDown,
      true,
    )
    return () =>
      document.removeEventListener(
        "mousedown",
        handleMouseDown,
        true,
      )
  }, [pickerState, setPickerState])

  const close = () => setPickerState(null)

  const selectItem = (item: LinkItem) => {
    const anchor = pickerState?.anchor
    close()
    if (!anchor) return
    if (item.kind === "path") {
      setLink(
        anchor.stepId,
        anchor.fieldName,
        item.pathVariableId,
      )
    } else {
      setLink(anchor.stepId, anchor.fieldName, {
        linkedTo: item.sourceStepId,
        output: item.outputName,
      })
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault()
      close()
      return
    }
    if (!filtered.length) {
      return
    }
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveIndex((prev) => (prev + 1) % filtered.length)
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex(
        (prev) =>
          (prev - 1 + filtered.length) % filtered.length,
      )
    } else if (event.key === "Enter") {
      event.preventDefault()
      if (filtered[safeActiveIndex]) {
        selectItem(filtered[safeActiveIndex])
      }
    }
  }

  if (!pickerState) {
    return null
  }

  const { top, left, maxHeight } = computePosition(
    pickerState.triggerRect,
    PICKER_WIDTH,
    PICKER_MAX_HEIGHT,
  )

  return createPortal(
    <div
      id="link-picker-react"
      role="listbox"
      aria-label="Link picker"
      className="fixed z-40 bg-slate-900 border border-slate-600 rounded-lg shadow-xl flex flex-col"
      style={{ top, left, width: PICKER_WIDTH, maxHeight }}
    >
      <input
        ref={inputRef}
        type="text"
        placeholder="Search locations…"
        className="shrink-0 w-full px-3 py-2 text-xs bg-transparent border-b border-slate-700 text-slate-200 placeholder:text-slate-500 outline-none"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setActiveIndex(0)
        }}
        onKeyDown={handleKeyDown}
        aria-autocomplete="list"
      />
      <div className="overflow-y-auto py-1 flex-1">
        {filtered.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">
            No matches.
          </p>
        ) : (
          filtered.map((item, index) => {
            const isActive = index === safeActiveIndex
            const labelClass = `text-xs ${isActive ? "text-white" : "text-slate-200"} ${item.kind === "path" ? "font-medium" : "font-mono"}`
            const detailClass = `path-detail font-mono text-[11px] pl-4 ${isActive ? "text-blue-100" : "text-slate-400"}`
            return (
              <button
                key={item.value}
                type="button"
                role="option"
                aria-selected={isActive}
                className={`w-full text-left px-3 py-1.5 ${isActive ? "bg-blue-700" : "hover:bg-slate-800"}`}
                onMouseDown={(event) =>
                  event.preventDefault()
                }
                onClick={() => selectItem(item)}
              >
                <div className={labelClass}>
                  {item.label}
                </div>
                {item.detail && (
                  <div className={detailClass}>
                    {makePathBreakable(item.detail)}
                  </div>
                )}
              </button>
            )
          })
        )}
      </div>
      {hasAcceptedOutputsWhitelist ? null : (
        <div className="shrink-0 px-3 py-2 border-t border-slate-700 text-[11px] text-slate-500 italic">
          {
            "Don't see what you need? Close this and type a path directly into the field — it saves as a new path automatically."
          }
        </div>
      )}
    </div>,
    document.body,
  )
}
