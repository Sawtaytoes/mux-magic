import { useAtomValue } from "jotai"

import { GroupCard } from "../../components/GroupCard/GroupCard"
import { InsertDivider } from "../../components/InsertDivider/InsertDivider"
import { StepCard } from "../../components/StepCard/StepCard"
import { useBuilderActions } from "../../hooks/useBuilderActions"
import { isGroup } from "../../jobs/sequenceUtils"
import { stepsAtom } from "../../state/stepsAtom"
import type { Step } from "../../types"

export const BuilderSequenceList = () => {
  const steps = useAtomValue(stepsAtom)
  const actions = useBuilderActions()

  let flatIndex = 0

  const handlePaste =
    (index: number) =>
    (event: React.MouseEvent<HTMLButtonElement>) => {
      window.pasteCardAt?.({ itemIndex: index })
      event.stopPropagation()
    }

  const items: React.ReactNode[] = []

  steps.forEach((item, itemIndex) => {
    items.push(
      <InsertDivider
        key={`divider-before-${item.id}`}
        index={itemIndex}
        onInsertStep={() => actions.insertStep(itemIndex)}
        onInsertSequentialGroup={() =>
          actions.insertGroup(itemIndex, false)
        }
        onInsertParallelGroup={() =>
          actions.insertGroup(itemIndex, true)
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
      onInsertStep={() => actions.insertStep(steps.length)}
      onInsertSequentialGroup={() =>
        actions.insertGroup(steps.length, false)
      }
      onInsertParallelGroup={() =>
        actions.insertGroup(steps.length, true)
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
          onInsertStep={() => actions.insertStep(0)}
          onInsertSequentialGroup={() =>
            actions.insertGroup(0, false)
          }
          onInsertParallelGroup={() =>
            actions.insertGroup(0, true)
          }
          onPaste={handlePaste(0)}
        />
      </div>
    )
  }

  return <div className="flex flex-col gap-3">{items}</div>
}
