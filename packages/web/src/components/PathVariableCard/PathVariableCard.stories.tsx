import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider } from "jotai"
import { pathsAtom } from "../../state/pathsAtom"
import type { PathVariable } from "../../types"
import { PathVariableCard } from "./PathVariableCard"

const basePath: PathVariable = {
  id: "basePath",
  label: "Base Path",
  value: "/mnt/media",
}

const withStore = (paths: PathVariable[]) => {
  const store = createStore()
  store.set(pathsAtom, paths)
  return (Story: React.ComponentType) => (
    <Provider store={store}>
      <Story />
    </Provider>
  )
}

const meta: Meta<typeof PathVariableCard> = {
  title: "Components/PathVariableCard",
  component: PathVariableCard,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}

export default meta
type Story = StoryObj<typeof PathVariableCard>

export const BasePath: Story = {
  decorators: [withStore([basePath])],
  args: { pathVariable: basePath, isFirst: true },
}

export const SecondaryPath: Story = {
  decorators: [
    withStore([
      basePath,
      {
        id: "outputPath",
        label: "Output Path",
        value: "/mnt/output",
      },
    ]),
  ],
  args: {
    pathVariable: {
      id: "outputPath",
      label: "Output Path",
      value: "/mnt/output",
    },
    isFirst: false,
  },
}

export const EmptyValue: Story = {
  decorators: [withStore([{ ...basePath, value: "" }])],
  args: {
    pathVariable: { ...basePath, value: "" },
    isFirst: false,
  },
}
