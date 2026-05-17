// Shared helpers for the per-command StepCard stories
// (StepCard.<commandName>.stories.tsx). Each per-command file imports
// these to avoid duplicating the DndContext / Jotai Provider boilerplate
// and to standardize the state-variant matrix.

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import type { StoryObj } from "@storybook/react"
import { createStore, Provider, useAtomValue } from "jotai"
import { COMMANDS } from "../../commands/commands"
import { commandsAtom } from "../../state/commandsAtom"
import { stepsAtom } from "../../state/stepsAtom"
import type { Step } from "../../types"
import { StepCard } from "./StepCard"

export const InteractiveStoryProvider = ({
  children,
  steps,
}: {
  children: React.ReactNode
  steps: Step[]
}) => {
  const store = createStore()
  store.set(stepsAtom, steps)
  // Seed with the live registry so every command's real field schema
  // is available — stories don't need their own command fixtures.
  store.set(commandsAtom, COMMANDS)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  return (
    <Provider store={store}>
      <DndContext sensors={sensors}>
        <SortableContext
          items={steps.map((step) => step.id)}
          strategy={verticalListSortingStrategy}
        >
          {children}
        </SortableContext>
        <DragOverlay />
      </DndContext>
    </Provider>
  )
}

// Subscribes to stepsAtom and feeds the live Step to StepCard so atom
// mutations (collapse, alias edit, remove, duplicate) re-render the
// card. Without this wrapper, clicks update the store but the rendered
// card stays pinned to the original fixture prop.
export const LiveStepCard = ({
  stepId,
  index,
  isFirst,
  isLast,
}: {
  stepId: string
  index: number
  isFirst: boolean
  isLast: boolean
}) => {
  const items = useAtomValue(stepsAtom)
  const step = items.find(
    (item): item is Step =>
      !("steps" in item) && item.id === stepId,
  )
  if (!step) return null
  return (
    <StepCard
      step={step}
      index={index}
      isFirst={isFirst}
      isLast={isLast}
    />
  )
}

// Shared single-step render — every per-command story uses this so the
// DndContext + Jotai provider boilerplate stays in one place.
export const renderSolo = (step: Step) => () => (
  <InteractiveStoryProvider steps={[step]}>
    <LiveStepCard
      stepId={step.id}
      index={0}
      isFirst={true}
      isLast={true}
    />
  </InteractiveStoryProvider>
)

// One-liner factory for the common case: a per-command file that just
// wants `Default: makeStory(baseStep)`. Variants override fields on
// top of that base when they're more than a trivial restatement.
export const makeStory = (
  step: Step,
): StoryObj<typeof StepCard> => ({
  render: renderSolo(step),
})

// Standard state-variant matrix every per-command file exports. Pass a
// fully-populated base step (with the command-specific params filled
// in) and you get Default + the four state overrides "for free". The
// returned object is spread directly into the story file's exports.
export const makeStateStories = (
  baseStep: Step,
): Record<string, StoryObj<typeof StepCard>> => {
  const Default: StoryObj<typeof StepCard> = {
    render: renderSolo(baseStep),
  }

  const Running: StoryObj<typeof StepCard> = {
    render: renderSolo({
      ...baseStep,
      id: `${baseStep.id}__running`,
      status: "running",
      jobId: "job_demo",
    }),
  }

  const Success: StoryObj<typeof StepCard> = {
    render: renderSolo({
      ...baseStep,
      id: `${baseStep.id}__success`,
      status: "success",
    }),
  }

  const Errored: StoryObj<typeof StepCard> = {
    render: renderSolo({
      ...baseStep,
      id: `${baseStep.id}__error`,
      error: "Command exited with code 1",
    }),
  }

  const Collapsed: StoryObj<typeof StepCard> = {
    render: renderSolo({
      ...baseStep,
      id: `${baseStep.id}__collapsed`,
      isCollapsed: true,
    }),
  }

  return { Default, Running, Success, Errored, Collapsed }
}
