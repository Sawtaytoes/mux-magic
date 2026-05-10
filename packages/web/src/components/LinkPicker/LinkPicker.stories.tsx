import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider } from "jotai"
import { pathsAtom } from "../../state/pathsAtom"
import { linkPickerStateAtom } from "../../state/pickerAtoms"
import { stepsAtom } from "../../state/stepsAtom"
import type { Step } from "../../types"
import { LinkPicker } from "./LinkPicker"

const TRIGGER_RECT = {
  left: 400,
  top: 300,
  right: 760,
  bottom: 324,
  width: 360,
  height: 24,
}

const makeStep = (id: string, command: string): Step => ({
  id,
  alias: "",
  command,
  params: {},
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
})

const withOpenPicker = () => {
  const store = createStore()
  store.set(stepsAtom, [
    makeStep("step-1", "copyFiles"),
    makeStep("step-2", "moveFiles"),
    makeStep("step-3", "addSubtitles"),
  ])
  store.set(pathsAtom, [
    {
      id: "basePath",
      label: "Base Path",
      value: "/home/user/videos",
    },
    {
      id: "outputPath",
      label: "Output Path",
      value: "/home/user/output",
    },
  ])
  store.set(linkPickerStateAtom, {
    anchor: { stepId: "step-3", fieldName: "sourcePath" },
    triggerRect: TRIGGER_RECT,
  })
  if (typeof window !== "undefined") {
    window.commandLabel = (name: string) => name
    window.setLink = () => {}
    window.refreshLinkPickerTrigger = () => {}
  }
  return (Story: React.ComponentType) => (
    <Provider store={store}>
      <Story />
    </Provider>
  )
}

const meta: Meta<typeof LinkPicker> = {
  title: "Components/LinkPicker",
  component: LinkPicker,
  parameters: {
    layout: "fullscreen",
    backgrounds: { default: "dark" },
  },
}

export default meta
type Story = StoryObj<typeof LinkPicker>

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
}
