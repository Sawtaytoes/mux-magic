import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider } from "jotai"
import { variablesAtom } from "../../state/variablesAtom"
import type { Variable } from "../../types"
import { VariableCard } from "./VariableCard"

const basePath: Variable = {
  id: "basePath",
  label: "Base Path",
  value: "/mnt/media",
  type: "path",
}

const withStore = (variables: Variable[]) => {
  const store = createStore()
  store.set(variablesAtom, variables)
  return (Story: React.ComponentType) => (
    <Provider store={store}>
      <Story />
    </Provider>
  )
}

const meta: Meta<typeof VariableCard> = {
  title: "Components/VariableCard",
  component: VariableCard,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}

export default meta
type Story = StoryObj<typeof VariableCard>

export const BasePath: Story = {
  decorators: [withStore([basePath])],
  args: { variable: basePath, isFirst: true },
}

export const SecondaryPath: Story = {
  decorators: [
    withStore([
      basePath,
      {
        id: "outputPath",
        label: "Output Path",
        value: "/mnt/output",
        type: "path",
      },
    ]),
  ],
  args: {
    variable: {
      id: "outputPath",
      label: "Output Path",
      value: "/mnt/output",
      type: "path",
    },
    isFirst: false,
  },
}

export const EmptyValue: Story = {
  decorators: [withStore([{ ...basePath, value: "" }])],
  args: {
    variable: { ...basePath, value: "" },
    isFirst: false,
  },
}
