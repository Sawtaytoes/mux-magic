import { useAtomValue } from "jotai"

import { GroupCard } from "../components/GroupCard"
import { InsertDivider } from "../components/InsertDivider"
import { StepCard } from "../components/StepCard"
import { stepsAtom } from "../state/stepsAtom"
import type { Group, SequenceItem, Step } from "../types"

const isGroup = (item: SequenceItem): item is Group =>
  "kind" in item && item.kind === "group"

export const BuilderSequenceList = () => {
  const steps = useAtomValue(stepsAtom)

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
