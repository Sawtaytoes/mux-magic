import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider, useSetAtom } from "jotai"
import { useEffect } from "react"
import type { ProgressSnapshot } from "../../jobs/types"
import { commandsAtom } from "../../state/commandsAtom"
import { progressByJobIdAtom } from "../../state/progressByJobIdAtom"
import { stepsAtom } from "../../state/stepsAtom"
import type { Step } from "../../types"
import { promptModalAtom } from "../PromptModal/promptModalAtom"
import type { PromptData } from "../PromptModal/types"
import { StepCard } from "./StepCard"

const baseStep: Step = {
  id: "step_1",
  alias: "Encode video",
  command: "encodeVideo",
  params: { outputPath: "/mnt/media/output" },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

const withStore = (
  step: Step,
  progress: Map<string, ProgressSnapshot> = new Map(),
) => {
  const store = createStore()
  store.set(stepsAtom, [step])
  store.set(commandsAtom, {
    encodeVideo: {
      summary: "Encode a video file to H.264",
      fields: [],
    },
  })
  if (progress.size > 0) {
    store.set(progressByJobIdAtom, progress)
  }
  return (Story: React.ComponentType) => (
    <Provider store={store}>
      <Story />
    </Provider>
  )
}

const meta: Meta<typeof StepCard> = {
  title: "Components/StepCard",
  component: StepCard,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}

export default meta
type Story = StoryObj<typeof StepCard>

export const WithCommand: Story = {
  decorators: [withStore(baseStep)],
  args: {
    step: baseStep,
    index: 0,
    isFirst: true,
    isLast: false,
  },
}

export const NoCommand: Story = {
  decorators: [
    withStore({ ...baseStep, command: "", alias: "" }),
  ],
  args: {
    step: { ...baseStep, command: "", alias: "" },
    index: 2,
    isFirst: false,
    isLast: false,
  },
}

const runningStep: Step = {
  ...baseStep,
  status: "running",
  jobId: "job-running-1",
}

export const Running: Story = {
  decorators: [
    withStore(
      runningStep,
      new Map([
        [
          "job-running-1",
          {
            ratio: 0.62,
            filesDone: 3,
            filesTotal: 5,
            bytesPerSecond: 9_500_000,
            bytesRemaining: 38_000_000,
          },
        ],
      ]),
    ),
  ],
  args: {
    step: runningStep,
    index: 0,
    isFirst: true,
    isLast: true,
  },
}

export const WithStatus: Story = {
  decorators: [
    withStore({ ...baseStep, status: "running" }),
  ],
  args: {
    step: { ...baseStep, status: "running" },
    index: 0,
    isFirst: true,
    isLast: true,
  },
}

export const WithError: Story = {
  decorators: [
    withStore({
      ...baseStep,
      error: "Command exited with code 1",
    }),
  ],
  args: {
    step: {
      ...baseStep,
      error: "Command exited with code 1",
    },
    index: 0,
    isFirst: true,
    isLast: true,
  },
}

export const Collapsed: Story = {
  decorators: [
    withStore({ ...baseStep, isCollapsed: true }),
  ],
  args: {
    step: { ...baseStep, isCollapsed: true },
    index: 0,
    isFirst: true,
    isLast: true,
  },
}

// The pulse is driven by a falsy → true transition of
// promptModalAtom.isMinimized. To make it visually reviewable in
// Storybook we mount with a visible prompt, then flip it to minimized
// on the next tick so the StepCard's effect actually observes the
// transition (a static minimized prompt would NOT pulse).
const pausedStep: Step = {
  ...baseStep,
  status: "running",
  jobId: "job-paused-1",
}
const visiblePrompt: PromptData = {
  jobId: "job-paused-1",
  promptId: "p1",
  message: "Pick which audio track to keep",
  options: [],
  isMinimized: false,
}

const TriggerMinimizeAfterMount = () => {
  const setPromptData = useSetAtom(promptModalAtom)
  useEffect(() => {
    const id = window.setTimeout(() => {
      setPromptData({
        ...visiblePrompt,
        isMinimized: true,
      })
    }, 50)
    return () => {
      window.clearTimeout(id)
    }
  }, [setPromptData])
  return null
}

const withPausedStore =
  (initialPrompt: PromptData) =>
  (Story: React.ComponentType) => {
    const store = createStore()
    store.set(stepsAtom, [pausedStep])
    store.set(commandsAtom, {
      encodeVideo: {
        summary: "Encode a video file to H.264",
        fields: [],
      },
    })
    store.set(promptModalAtom, initialPrompt)
    return (
      <Provider store={store}>
        <TriggerMinimizeAfterMount />
        <Story />
      </Provider>
    )
  }

export const PausedBadgeJustMinimized: Story = {
  decorators: [withPausedStore(visiblePrompt)],
  args: {
    step: pausedStep,
    index: 0,
    isFirst: true,
    isLast: true,
  },
}
