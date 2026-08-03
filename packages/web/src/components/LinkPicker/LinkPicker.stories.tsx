import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider } from "jotai"
import type { ReactNode } from "react"
import { pathsAtom } from "../../state/pathsAtom"
import { stepsAtom } from "../../state/stepsAtom"
import type { Step } from "../../types"
import { LinkPicker } from "./LinkPicker"

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

const withSteps = (Story: () => ReactNode) => {
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
      type: "path" as const,
    },
    {
      id: "outputPath",
      label: "Output Path",
      value: "/home/user/output",
      type: "path" as const,
    },
  ])
  return (
    <Provider store={store}>
      <div className="bg-slate-900 p-4">
        <Story />
      </div>
    </Provider>
  )
}

const meta: Meta<typeof LinkPicker> = {
  title: "Pickers/LinkPicker",
  component: LinkPicker,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
  decorators: [withSteps],
}

export default meta
type Story = StoryObj<typeof LinkPicker>

// The trigger button — click it in the canvas to open the searchable
// Combobox, which portals itself and anchors off the trigger.
export const Default: Story = {
  args: {
    stepId: "step-3",
    fieldName: "sourcePath",
    label: "— custom —",
  },
}
