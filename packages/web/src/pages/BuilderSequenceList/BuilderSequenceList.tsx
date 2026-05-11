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

  const handlePaste =
    (index: number) =>
    (event: React.MouseEvent<HTMLButtonElement>) => {
      actions.pasteCardAt({ itemIndex: index })
      event.stopPropagation()
    }

  // Build the rendered item list alongside a running flat index that numbers
  // steps globally (groups don't get a flat index; their inner steps do).
  const { items } = steps.reduce<{
    items: React.ReactNode[]
    flatIndex: number
  }>(
    (acc, item, itemIndex) => {
      const divider = (
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
        />
      )

      if (isGroup(item)) {
        return {
          items: [
            ...acc.items,
            divider,
            <GroupCard
              key={item.id}
              group={item}
              itemIndex={itemIndex}
              startingFlatIndex={acc.flatIndex}
              isFirst={itemIndex === 0}
              isLast={itemIndex === steps.length - 1}
            />,
          ],
          flatIndex: acc.flatIndex + item.steps.length,
        }
      }

      const step = item as Step
      return {
        items: [
          ...acc.items,
          divider,
          <StepCard
            key={step.id}
            step={step}
            index={acc.flatIndex}
            isFirst={itemIndex === 0}
            isLast={itemIndex === steps.length - 1}
          />,
        ],
        flatIndex: acc.flatIndex + 1,
      }
    },
    { items: [], flatIndex: 0 },
  )

  const trailingDivider = (
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
    />
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

  return (
    <div className="flex flex-col gap-3">
      {items}
      {trailingDivider}
    </div>
  )
}
