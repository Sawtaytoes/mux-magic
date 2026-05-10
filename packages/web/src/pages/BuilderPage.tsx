import { useAtomValue, useSetAtom } from "jotai"
import { useEffect, useRef } from "react"
import { ApiRunModal } from "../components/ApiRunModal"
import { CommandHelpModal } from "../components/CommandHelpModal"
import { CommandPicker } from "../components/CommandPicker"
import { EnumPicker } from "../components/EnumPicker"
import { FileExplorerModal } from "../components/FileExplorerModal"
import { GroupCard } from "../components/GroupCard"
import { InsertDivider } from "../components/InsertDivider"
import { LinkPicker } from "../components/LinkPicker"
import { LoadModal } from "../components/LoadModal"
import { LookupModal } from "../components/LookupModal"
import { PageHeader } from "../components/PageHeader"
import { PathPicker } from "../components/PathPicker"
import { PathVarCard } from "../components/PathVarCard"
import { PromptModal } from "../components/PromptModal"
import { StepCard } from "../components/StepCard"
import { YamlModal } from "../components/YamlModal"
import { pathsAtom } from "../state/pathsAtom"
import { addPathAtom } from "../state/sequenceAtoms"
import { stepsAtom } from "../state/stepsAtom"
import type { Group, SequenceItem, Step } from "../types"

const isGroup = (item: SequenceItem): item is Group =>
  "kind" in item && item.kind === "group"

// ─── SequenceList ─────────────────────────────────────────────────────────────

const SequenceList = () => {
  const steps = useAtomValue(stepsAtom)

  // Flat index used by StepCard to show the step number across groups.
  let flatIndex = 0

  const insertStep = (
    index: number,
    parentGroupId?: string | null,
  ) => {
    window.mediaTools?.insertStep?.(index, parentGroupId)
  }

  const insertSequentialGroup = (index: number) => {
    window.mediaTools?.insertGroup?.(index, false)
  }

  const insertParallelGroup = (index: number) => {
    window.mediaTools?.insertGroup?.(index, true)
  }

  const handlePaste =
    (index: number) =>
    (event: React.MouseEvent<HTMLButtonElement>) => {
      window.mediaTools?.pasteCardAt?.({ itemIndex: index })
      event.stopPropagation()
    }

  const items: React.ReactNode[] = []

  steps.forEach((item, itemIndex) => {
    items.push(
      <InsertDivider
        key={`divider-before-${item.id}`}
        index={itemIndex}
        onInsertStep={() => insertStep(itemIndex)}
        onInsertSequentialGroup={() =>
          insertSequentialGroup(itemIndex)
        }
        onInsertParallelGroup={() =>
          insertParallelGroup(itemIndex)
        }
        onPaste={handlePaste(itemIndex)}
      />,
    )

    if (isGroup(item)) {
      const groupFlatStart = flatIndex
      flatIndex += item.steps.length
      items.push(
        <GroupCard
          key={item.id}
          group={item}
          itemIndex={itemIndex}
          startingFlatIndex={groupFlatStart}
          isFirst={itemIndex === 0}
          isLast={itemIndex === steps.length - 1}
        />,
      )
    } else {
      const step = item as Step
      const stepFlatIndex = flatIndex++
      items.push(
        <StepCard
          key={step.id}
          step={step}
          index={stepFlatIndex}
          isFirst={itemIndex === 0}
          isLast={itemIndex === steps.length - 1}
        />,
      )
    }
  })

  // Trailing divider — always present so the user can append after the last item.
  items.push(
    <InsertDivider
      key="divider-end"
      index={steps.length}
      onInsertStep={() => insertStep(steps.length)}
      onInsertSequentialGroup={() =>
        insertSequentialGroup(steps.length)
      }
      onInsertParallelGroup={() =>
        insertParallelGroup(steps.length)
      }
      onPaste={handlePaste(steps.length)}
    />,
  )

  if (steps.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-slate-500">
        <p className="text-sm">No steps yet.</p>
        <InsertDivider
          index={0}
          onInsertStep={() => insertStep(0)}
          onInsertSequentialGroup={() =>
            insertSequentialGroup(0)
          }
          onInsertParallelGroup={() =>
            insertParallelGroup(0)
          }
          onPaste={handlePaste(0)}
        />
      </div>
    )
  }

  return <div className="flex flex-col gap-3">{items}</div>
}

// ─── PathVarList ──────────────────────────────────────────────────────────────

const PathVarList = () => {
  const paths = useAtomValue(pathsAtom)
  const addPath = useSetAtom(addPathAtom)

  return (
    <div className="flex flex-col gap-2 mb-4">
      {paths.map((pathVar, idx) => (
        <PathVarCard
          key={pathVar.id}
          pathVar={pathVar}
          isFirst={idx === 0}
        />
      ))}
      {/** biome-ignore lint/a11y/useButtonType: suppressed during react-migration */}
      <button
        onClick={() => addPath()}
        className="self-start text-xs text-slate-500 hover:text-slate-300 px-2 py-1 rounded border border-dashed border-slate-700 hover:border-slate-500 transition-colors"
      >
        + Add path variable
      </button>
    </div>
  )
}

// ─── Keyboard shortcuts ───────────────────────────────────────────────────────

const useBuilderKeyboard = () => {
  const shortcutsRef = useRef<(e: KeyboardEvent) => void>()

  useEffect(() => {
    shortcutsRef.current = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      )
        return

      if (
        event.key === "z" &&
        (event.ctrlKey || event.metaKey)
      ) {
        event.preventDefault()
        if (event.shiftKey) {
          window.mediaTools?.redo?.()
        } else {
          window.mediaTools?.undo?.()
        }
      } else if (
        event.key === "y" &&
        (event.ctrlKey || event.metaKey)
      ) {
        event.preventDefault()
        window.mediaTools?.redo?.()
      }
    }

    const handler = (event: KeyboardEvent) =>
      shortcutsRef.current?.(event)
    document.addEventListener("keydown", handler)
    return () =>
      document.removeEventListener("keydown", handler)
  }, [])
}

// ─── BuilderPage ──────────────────────────────────────────────────────────────

export const BuilderPage = () => {
  useBuilderKeyboard()

  return (
    <div
      className="flex flex-col bg-slate-900 text-slate-200"
      style={{ height: "100dvh", overflow: "hidden" }}
    >
      <PageHeader />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <PathVarList />
          <SequenceList />
        </div>
      </main>

      {/* Modals */}
      <YamlModal />
      <LoadModal />
      <CommandHelpModal />
      <PromptModal />
      <ApiRunModal />
      <LookupModal />
      <FileExplorerModal />

      {/* Pickers — render via createPortal into document.body */}
      <CommandPicker />
      <EnumPicker />
      <LinkPicker />
      <PathPicker />
    </div>
  )
}
