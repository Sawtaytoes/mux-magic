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
import { createStore, Provider } from "jotai"
import { FIXTURE_COMMANDS } from "../../commands/__fixtures__/commands"
import { commandsAtom } from "../../state/commandsAtom"
import { stepsAtom } from "../../state/stepsAtom"
import type { Group, Step } from "../../types"
import { GroupCard } from "./GroupCard"

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
      params: { filePath: "/mnt/output" },
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
  decorators: [
    (Story) => (
      <InteractiveStoryProvider steps={[parallelGroup]}>
        <Story />
      </InteractiveStoryProvider>
    ),
  ],
  args: {
    group: parallelGroup,
    itemIndex: 0,
    isFirst: true,
    isLast: false,
    startingFlatIndex: 0,
  },
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
  decorators: [
    (Story) => (
      <InteractiveStoryProvider steps={[sequentialGroup]}>
        <Story />
      </InteractiveStoryProvider>
    ),
  ],
  args: {
    group: sequentialGroup,
    itemIndex: 0,
    isFirst: true,
    isLast: true,
    startingFlatIndex: 0,
  },
}

// Collapsed parallel group
const collapsedParallelGroup: Group = {
  ...parallelGroup,
  id: "group_collapsed_parallel",
  label: "Collapsed Parallel",
  isCollapsed: true,
}

export const CollapsedParallelGroup: Story = {
  decorators: [
    (Story) => (
      <InteractiveStoryProvider
        steps={[collapsedParallelGroup]}
      >
        <Story />
      </InteractiveStoryProvider>
    ),
  ],
  args: {
    group: collapsedParallelGroup,
    itemIndex: 0,
    isFirst: true,
    isLast: true,
    startingFlatIndex: 0,
  },
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
  decorators: [
    (Story) => (
      <InteractiveStoryProvider steps={[mixedStatesGroup]}>
        <Story />
      </InteractiveStoryProvider>
    ),
  ],
  args: {
    group: mixedStatesGroup,
    itemIndex: 0,
    isFirst: true,
    isLast: true,
    startingFlatIndex: 0,
  },
}

// Multiple groups with dragging enabled
export const InASequenceMultipleGroups: Story = {
  decorators: [
    (Story) => {
      const steps: (Step | Group)[] = [
        parallelGroup,
        sequentialGroup,
      ]
      return (
        <InteractiveStoryProvider steps={steps}>
          <div className="space-y-2">
            <Story />
          </div>
        </InteractiveStoryProvider>
      )
    },
  ],
  args: {
    group: parallelGroup,
    itemIndex: 0,
    isFirst: true,
    isLast: false,
    startingFlatIndex: 0,
  },
}
