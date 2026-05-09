import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider } from "jotai"
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
  const store = createStore()
  store.set(stepsAtom, steps as never)
  store.set(pathsAtom, paths as never)
  return (Story: React.ComponentType) => (
    <Provider store={store}>
      <Story />
    </Provider>
  )
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
    onClose: () => {},
  },
}

export default meta
type Story = StoryObj<typeof YamlModal>

export const WithSteps: Story = {
  decorators: [withStore([step], [{ id: "basePath", label: "basePath", value: "/media/movies" }])],
}

export const EmptySequence: Story = {
  decorators: [withStore([], [])],
}
