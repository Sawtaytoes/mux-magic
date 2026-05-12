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
import type { Step } from "../../types"
import { StepCard } from "./StepCard"

const InteractiveStoryProvider = ({
  children,
  steps,
}: {
  children: React.ReactNode
  steps: Step[]
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

const meta: Meta<typeof StepCard> = {
  title: "Components/StepCard/Interactive",
  component: StepCard,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}

export default meta
type Story = StoryObj<typeof StepCard>

// keepLanguages — LanguageCodesField example
const keepLanguagesStep: Step = {
  id: "step_keep_lang",
  alias: "Filter Languages",
  command: "keepLanguages",
  params: {
    sourcePath: "/mnt/input/media",
    audioLanguages: ["eng", "jpn"],
  },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

export const WithKeepLanguagesCommand: Story = {
  decorators: [
    (Story) => (
      <InteractiveStoryProvider steps={[keepLanguagesStep]}>
        <Story />
      </InteractiveStoryProvider>
    ),
  ],
  args: {
    step: keepLanguagesStep,
    index: 0,
    isFirst: true,
    isLast: false,
  },
}

// copyFiles — PathField + NumericField example
const copyFilesStep: Step = {
  id: "step_copy_files",
  alias: "Copy Output",
  command: "copyFiles",
  params: {
    sourcePath: "/mnt/chained",
    destinationPath: "/mnt/archive",
  },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

export const WithCopyFilesCommand: Story = {
  decorators: [
    (Story) => (
      <InteractiveStoryProvider steps={[copyFilesStep]}>
        <Story />
      </InteractiveStoryProvider>
    ),
  ],
  args: {
    step: copyFilesStep,
    index: 1,
    isFirst: false,
    isLast: false,
  },
}

// modifySubtitleMetadata — SubtitleRulesField example
const modifySubtitlesStep: Step = {
  id: "step_modify_subs",
  alias: "Apply Subtitle Rules",
  command: "modifySubtitleMetadata",
  params: {
    sourcePath: "/mnt/subtitles",
    rules: [],
  },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

export const WithModifySubtitleMetadataCommand: Story = {
  decorators: [
    (Story) => (
      <InteractiveStoryProvider
        steps={[modifySubtitlesStep]}
      >
        <Story />
      </InteractiveStoryProvider>
    ),
  ],
  args: {
    step: modifySubtitlesStep,
    index: 2,
    isFirst: false,
    isLast: false,
  },
}

// Blank step — no command selected
const blankStep: Step = {
  id: "step_blank",
  alias: "",
  command: "",
  params: {},
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

export const BlankStep: Story = {
  decorators: [
    (Story) => (
      <InteractiveStoryProvider steps={[blankStep]}>
        <Story />
      </InteractiveStoryProvider>
    ),
  ],
  args: {
    step: blankStep,
    index: 0,
    isFirst: true,
    isLast: true,
  },
}

// Running state
const runningStep: Step = {
  ...keepLanguagesStep,
  id: "step_running",
  alias: "Processing...",
  status: "running",
  jobId: "job_123",
}

export const RunningState: Story = {
  decorators: [
    (Story) => (
      <InteractiveStoryProvider steps={[runningStep]}>
        <Story />
      </InteractiveStoryProvider>
    ),
  ],
  args: {
    step: runningStep,
    index: 0,
    isFirst: true,
    isLast: true,
  },
}

// Success state
const successStep: Step = {
  ...keepLanguagesStep,
  id: "step_success",
  alias: "Completed",
  status: "success",
}

export const SuccessState: Story = {
  decorators: [
    (Story) => (
      <InteractiveStoryProvider steps={[successStep]}>
        <Story />
      </InteractiveStoryProvider>
    ),
  ],
  args: {
    step: successStep,
    index: 0,
    isFirst: true,
    isLast: true,
  },
}

// Error state
const errorStep: Step = {
  ...keepLanguagesStep,
  id: "step_error",
  alias: "Failed",
  error: "FFmpeg exited with code 1: Invalid audio codec",
}

export const ErrorState: Story = {
  decorators: [
    (Story) => (
      <InteractiveStoryProvider steps={[errorStep]}>
        <Story />
      </InteractiveStoryProvider>
    ),
  ],
  args: {
    step: errorStep,
    index: 0,
    isFirst: true,
    isLast: true,
  },
}

// Collapsed state
const collapsedStep: Step = {
  ...keepLanguagesStep,
  id: "step_collapsed",
  alias: "Hidden Fields",
  isCollapsed: true,
}

export const CollapsedState: Story = {
  decorators: [
    (Story) => (
      <InteractiveStoryProvider steps={[collapsedStep]}>
        <Story />
      </InteractiveStoryProvider>
    ),
  ],
  args: {
    step: collapsedStep,
    index: 0,
    isFirst: true,
    isLast: true,
  },
}

// Multi-step with dragging enabled
export const InASequence: Story = {
  decorators: [
    (Story) => {
      const steps = [
        keepLanguagesStep,
        { ...copyFilesStep, id: "step_copy_2" },
        { ...modifySubtitlesStep, id: "step_modify_2" },
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
    step: keepLanguagesStep,
    index: 0,
    isFirst: true,
    isLast: false,
  },
}
