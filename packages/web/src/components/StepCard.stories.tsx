import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider } from "jotai"
import { stepsAtom } from "../state/stepsAtom"
import type { Step } from "../types"
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

const withStore = (step: Step) => {
  const store = createStore()
  store.set(stepsAtom, [step])
  if (typeof window !== "undefined") {
    window.mediaTools = window.mediaTools ?? {}
    window.mediaTools.COMMANDS = {
      encodeVideo: { summary: "Encode a video file to H.264", fields: [] },
    }
    window.commandLabel = (name: string) => name
    window.commandPicker = { open: () => {}, close: () => {} }
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
  args: { step: baseStep, index: 0, isFirst: true, isLast: false },
}

export const NoCommand: Story = {
  decorators: [withStore({ ...baseStep, command: "", alias: "" })],
  args: { step: { ...baseStep, command: "", alias: "" }, index: 2, isFirst: false, isLast: false },
}

export const WithStatus: Story = {
  decorators: [withStore({ ...baseStep, status: "running" })],
  args: { step: { ...baseStep, status: "running" }, index: 0, isFirst: true, isLast: true },
}

export const WithError: Story = {
  decorators: [withStore({ ...baseStep, error: "Command exited with code 1" })],
  args: {
    step: { ...baseStep, error: "Command exited with code 1" },
    index: 0,
    isFirst: true,
    isLast: true,
  },
}

export const Collapsed: Story = {
  decorators: [withStore({ ...baseStep, isCollapsed: true })],
  args: { step: { ...baseStep, isCollapsed: true }, index: 0, isFirst: true, isLast: true },
}
