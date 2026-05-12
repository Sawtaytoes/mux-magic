import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider } from "jotai"
import { useState } from "react"
import { COMMANDS } from "../../commands/commands"
import { yamlModalOpenAtom } from "../../components/YamlModal/yamlModalAtom"
import { commandsAtom } from "../../state/commandsAtom"
import { pathsAtom } from "../../state/pathsAtom"
import { stepsAtom } from "../../state/stepsAtom"
import { YamlModal } from "./YamlModal"

const step = {
  id: "step1",
  alias: "Encode video",
  command: "ffmpegTranscode",
  params: { preset: "slow", crf: 22 },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

const withStore = (
  steps: unknown[],
  paths: unknown[],
  isOpen: boolean,
) => {
  return (Story: React.ComponentType) => {
    const [store] = useState(() => {
      const newStore = createStore()
      newStore.set(stepsAtom, steps as never)
      newStore.set(pathsAtom, paths as never)
      newStore.set(commandsAtom, COMMANDS)
      newStore.set(yamlModalOpenAtom, isOpen)
      return newStore
    })
    return (
      <Provider store={store}>
        <Story />
      </Provider>
    )
  }
}

const meta: Meta<typeof YamlModal> = {
  title: "Modals/YamlModal",
  component: YamlModal,
  parameters: {
    layout: "fullscreen",
    backgrounds: { default: "dark" },
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
      true,
    ),
  ],
}

export const EmptySequence: Story = {
  decorators: [withStore([], [], true)],
}
