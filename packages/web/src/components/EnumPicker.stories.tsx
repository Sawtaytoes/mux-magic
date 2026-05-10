import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider } from "jotai"
import { enumPickerStateAtom } from "../state/pickerAtoms"
import { EnumPicker } from "./EnumPicker"

const TRIGGER_RECT = {
  left: 200,
  top: 300,
  right: 500,
  bottom: 324,
  width: 300,
  height: 24,
}

const mockCommands = {
  setEpisodeType: {
    tag: "Naming Operations",
    summary: "Set episode type",
    fields: [
      {
        name: "episodeType",
        type: "enum",
        label: "Episode Type",
        default: "regular",
        options: [
          { value: "regular", label: "Regular (type=1)" },
          { value: "specials", label: "Specials (S, type=2)" },
          { value: "credits", label: "Credits / OP / ED (C, type=3)" },
          { value: "trailers", label: "Trailers (T, type=4)" },
          { value: "parodies", label: "Parodies (P, type=5)" },
          { value: "others", label: "Others (O, type=6)" },
        ],
      },
    ],
  },
}

const withOpenPicker = () => {
  const store = createStore()
  store.set(enumPickerStateAtom, {
    anchor: { stepId: "step-1", fieldName: "episodeType" },
    triggerRect: TRIGGER_RECT,
  })
  if (typeof window !== "undefined") {
    window.mediaTools = window.mediaTools ?? {}
    window.mediaTools.COMMANDS = mockCommands
    window.mediaTools.findStepById = () => ({
      command: "setEpisodeType",
      params: { episodeType: "regular" },
    })
    window.mediaTools.renderAll = () => {}
    window.setParam = () => {}
  }
  return (Story: React.ComponentType) => (
    <Provider store={store}>
      <Story />
    </Provider>
  )
}

const meta: Meta<typeof EnumPicker> = {
  title: "Components/EnumPicker",
  component: EnumPicker,
  parameters: {
    layout: "fullscreen",
    backgrounds: { default: "dark" },
  },
}

export default meta
type Story = StoryObj<typeof EnumPicker>

export const Open: Story = {
  decorators: [withOpenPicker()],
}

const withClosedPicker = () => {
  const store = createStore()
  return (Story: React.ComponentType) => (
    <Provider store={store}>
      <Story />
    </Provider>
  )
}

export const Closed: Story = {
  decorators: [withClosedPicker()],
}
