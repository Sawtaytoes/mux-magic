import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider } from "jotai"
import { commandsAtom } from "../../state/commandsAtom"
import { commandPickerStateAtom } from "../../state/pickerAtoms"
import { stepsAtom } from "../../state/stepsAtom"
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
  store.set(commandsAtom, mockCommands)
  store.set(stepsAtom, [
    {
      id: "step-1",
      alias: "",
      command: "copyFiles",
      params: {},
      links: {},
      status: null,
      error: null,
      isCollapsed: false,
    },
  ])
  store.set(commandPickerStateAtom, {
    anchor: { stepId: "step-1" },
    triggerRect: TRIGGER_RECT,
  })
  return (Story: React.ComponentType) => (
    <Provider store={store}>
      <Story />
    </Provider>
  )
}

const meta: Meta<typeof CommandPicker> = {
  title: "Pickers/CommandPicker",
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
