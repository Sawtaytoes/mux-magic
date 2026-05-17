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
import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider, useAtomValue } from "jotai"
import { FIXTURE_COMMANDS } from "../../commands/__fixtures__/commands"
import { isGroup } from "../../jobs/sequenceUtils"
import { commandsAtom } from "../../state/commandsAtom"
import { stepsAtom } from "../../state/stepsAtom"
import type { Group, Step } from "../../types"
import { GroupCard } from "./GroupCard"

// Subscribes to stepsAtom and feeds the live Group to GroupCard so that
// atom mutations (collapse, +Step, move, remove, paste-into) re-render
// the card instead of leaving the original fixture frozen on screen.
const LiveGroupCard = ({
  groupId,
  itemIndex,
  startingFlatIndex,
  isFirst,
  isLast,
}: {
  groupId: string
  itemIndex: number
  startingFlatIndex: number
  isFirst: boolean
  isLast: boolean
}) => {
  const items = useAtomValue(stepsAtom)
  const group = items.find(
    (item): item is Group =>
      isGroup(item) && item.id === groupId,
  )
  if (!group) return null
  return (
    <GroupCard
      group={group}
      itemIndex={itemIndex}
      startingFlatIndex={startingFlatIndex}
      isFirst={isFirst}
      isLast={isLast}
    />
  )
}

const InteractiveStoryProvider = ({
  children,
  steps,
}: {
  children: React.ReactNode
  steps: (Step | Group)[]
}) => {
  const store = createStore()
  store.set(stepsAtom, steps)
  store.set(commandsAtom, FIXTURE_COMMANDS)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const allIds = steps.map((item) => {
    if ("steps" in item) return item.id
    return (item as Step).id
  })

  return (
    <Provider store={store}>
      <DndContext sensors={sensors}>
        <SortableContext
          items={allIds}
          strategy={verticalListSortingStrategy}
        >
          {children}
        </SortableContext>
        <DragOverlay />
      </DndContext>
    </Provider>
  )
}

const meta: Meta<typeof GroupCard> = {
  title: "Components/GroupCard/Interactive",
  component: GroupCard,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}

export default meta
type Story = StoryObj<typeof GroupCard>

// Parallel group with 2 steps
const parallelGroup: Group = {
  kind: "group",
  id: "group_parallel",
  label: "Process in Parallel",
  isParallel: true,
  isCollapsed: false,
  steps: [
    {
      id: "step_p1",
      alias: "Encode Video",
      command: "makeDirectory",
      params: { sourcePath: "/mnt/output" },
      links: {},
      status: null,
      error: null,
      isCollapsed: false,
    },
    {
      id: "step_p2",
      alias: "Extract Subtitles",
      command: "keepLanguages",
      params: {
        sourcePath: "/mnt/input",
        audioLanguages: ["eng"],
      },
      links: {},
      status: null,
      error: null,
      isCollapsed: false,
    },
  ],
}

export const ParallelGroup: Story = {
  render: () => (
    <InteractiveStoryProvider steps={[parallelGroup]}>
      <LiveGroupCard
        groupId={parallelGroup.id}
        itemIndex={0}
        startingFlatIndex={0}
        isFirst={true}
        isLast={false}
      />
    </InteractiveStoryProvider>
  ),
}

// Sequential (serial) group with 3 steps
const sequentialGroup: Group = {
  kind: "group",
  id: "group_sequential",
  label: "Process Sequentially",
  isParallel: false,
  isCollapsed: false,
  steps: [
    {
      id: "step_s1",
      alias: "Copy Files",
      command: "copyFiles",
      params: {
        sourcePath: "/mnt/input",
        destinationPath: "/mnt/work",
      },
      links: {},
      status: null,
      error: null,
      isCollapsed: false,
    },
    {
      id: "step_s2",
      alias: "Modify Metadata",
      command: "modifySubtitleMetadata",
      params: {
        sourcePath: "/mnt/work",
        rules: [],
      },
      links: {},
      status: null,
      error: null,
      isCollapsed: false,
    },
    {
      id: "step_s3",
      alias: "Archive Output",
      command: "copyFiles",
      params: {
        sourcePath: "/mnt/work",
        destinationPath: "/mnt/archive",
      },
      links: {},
      status: null,
      error: null,
      isCollapsed: false,
    },
  ],
}

export const SequentialGroup: Story = {
  render: () => (
    <InteractiveStoryProvider steps={[sequentialGroup]}>
      <LiveGroupCard
        groupId={sequentialGroup.id}
        itemIndex={0}
        startingFlatIndex={0}
        isFirst={true}
        isLast={true}
      />
    </InteractiveStoryProvider>
  ),
}

// Collapsed parallel group
const collapsedParallelGroup: Group = {
  ...parallelGroup,
  id: "group_collapsed_parallel",
  label: "Collapsed Parallel",
  isCollapsed: true,
}

export const CollapsedParallelGroup: Story = {
  render: () => (
    <InteractiveStoryProvider
      steps={[collapsedParallelGroup]}
    >
      <LiveGroupCard
        groupId={collapsedParallelGroup.id}
        itemIndex={0}
        startingFlatIndex={0}
        isFirst={true}
        isLast={true}
      />
    </InteractiveStoryProvider>
  ),
}

// Group with steps in various states
const mixedStatesGroup: Group = {
  kind: "group",
  id: "group_mixed",
  label: "Various Step States",
  isParallel: false,
  isCollapsed: false,
  steps: [
    {
      id: "step_idle",
      alias: "Idle Step",
      command: "keepLanguages",
      params: {
        sourcePath: "/mnt/input",
        audioLanguages: ["eng", "jpn"],
      },
      links: {},
      status: null,
      error: null,
      isCollapsed: false,
    },
    {
      id: "step_running",
      alias: "Running Step",
      command: "copyFiles",
      params: {
        sourcePath: "/mnt/source",
        destinationPath: "/mnt/dest",
      },
      links: {},
      status: "running",
      error: null,
      isCollapsed: false,
      jobId: "job_456",
    },
    {
      id: "step_error",
      alias: "Failed Step",
      command: "modifySubtitleMetadata",
      params: {
        sourcePath: "/mnt/subs",
        rules: [],
      },
      links: {},
      status: null,
      error: "FFmpeg not found",
      isCollapsed: false,
    },
  ],
}

export const GroupWithMixedStates: Story = {
  render: () => (
    <InteractiveStoryProvider steps={[mixedStatesGroup]}>
      <LiveGroupCard
        groupId={mixedStatesGroup.id}
        itemIndex={0}
        startingFlatIndex={0}
        isFirst={true}
        isLast={true}
      />
    </InteractiveStoryProvider>
  ),
}

// Multiple groups with dragging enabled
export const InASequenceMultipleGroups: Story = {
  render: () => {
    const steps: (Step | Group)[] = [
      parallelGroup,
      sequentialGroup,
    ]
    return (
      <InteractiveStoryProvider steps={steps}>
        <div className="space-y-2">
          <LiveGroupCard
            groupId={parallelGroup.id}
            itemIndex={0}
            startingFlatIndex={0}
            isFirst={true}
            isLast={false}
          />
          <LiveGroupCard
            groupId={sequentialGroup.id}
            itemIndex={1}
            startingFlatIndex={parallelGroup.steps.length}
            isFirst={false}
            isLast={true}
          />
        </div>
      </InteractiveStoryProvider>
    )
  },
}
