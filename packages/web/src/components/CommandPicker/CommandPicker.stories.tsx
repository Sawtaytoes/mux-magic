import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider } from "jotai"
import { commandPickerStateAtom } from "../../state/pickerAtoms"
import { CommandPicker } from "./CommandPicker"

const TRIGGER_RECT = {
  left: 200,
  top: 300,
  right: 540,
  bottom: 324,
  width: 340,
  height: 24,
}

const mockCommands = {
  makeDirectory: {
    tag: "File Operations",
    summary: "Create a directory",
    fields: [],
  },
  copyFiles: {
    tag: "File Operations",
    summary: "Copy files",
    fields: [],
  },
  moveFiles: {
    tag: "File Operations",
    summary: "Move files",
    fields: [],
  },
  addSubtitles: {
    tag: "Subtitle Operations",
    summary: "Add subtitles",
    fields: [],
  },
  removeSubtitles: {
    tag: "Subtitle Operations",
    summary: "Remove subtitles",
    fields: [],
  },
}

const withOpenPicker = () => {
  const store = createStore()
  store.set(commandPickerStateAtom, {
    anchor: { stepId: "step-1" },
    triggerRect: TRIGGER_RECT,
  })
  if (typeof window !== "undefined") {
    window.mediaTools = window.mediaTools ?? {}
    window.mediaTools.COMMANDS = mockCommands
    window.mediaTools.findStepById = () => ({
      command: "copyFiles",
    })
    window.commandLabel = (name: string) => name
    window.changeCommand = () => {}
  }
  return (Story: React.ComponentType) => (
    <Provider store={store}>
      <Story />
    </Provider>
  )
}

const meta: Meta<typeof CommandPicker> = {
  title: "Components/CommandPicker",
  component: CommandPicker,
  parameters: {
    layout: "fullscreen",
    backgrounds: { default: "dark" },
  },
}

export default meta
type Story = StoryObj<typeof CommandPicker>

export const Open: Story = {
  decorators: [withOpenPicker()],
}

export const Closed: Story = {
  decorators: [
    (Story) => {
      const store = createStore()
      return (
        <Provider store={store}>
          <Story />
        </Provider>
      )
    },
  ],
  parameters: {
    docs: {
      description: {
        story:
          "When commandPickerStateAtom is null the component renders nothing.",
      },
    },
  },
}
