import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider } from "jotai"
import { useState } from "react"
import { action } from "storybook/actions"
import { pathsAtom } from "../state/pathsAtom"
import { stepsAtom } from "../state/stepsAtom"
import { YamlModal } from "./YamlModal"

const step = {
  id: "step1",
  alias: "Encode video",
  command: "ffmpeg",
  params: { preset: "slow", crf: 22 },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

const withStore = (steps: unknown[], paths: unknown[]) => {
  return (Story: React.ComponentType) => {
    const [store] = useState(() => {
      const s = createStore()
      s.set(stepsAtom, steps as never)
      s.set(pathsAtom, paths as never)
      return s
    })
    return (
      <Provider store={store}>
        <Story />
      </Provider>
    )
  }
}

const meta: Meta<typeof YamlModal> = {
  title: "Components/YamlModal",
  component: YamlModal,
  parameters: {
    layout: "fullscreen",
    backgrounds: { default: "dark" },
  },
  args: {
    isOpen: true,
    onClose: action("onClose"),
  },
}

export default meta
type Story = StoryObj<typeof YamlModal>

export const WithSteps: Story = {
  decorators: [
    withStore(
      [step],
      [
        {
          id: "basePath",
          label: "basePath",
          value: "/media/movies",
        },
      ],
    ),
  ],
}

export const EmptySequence: Story = {
  decorators: [withStore([], [])],
}
