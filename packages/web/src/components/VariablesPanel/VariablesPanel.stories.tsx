import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider } from "jotai"
import { variablesAtom } from "../../state/variablesAtom"
import type { Variable } from "../../types"
import { VariablesPanel } from "./VariablesPanel"

const withStore = (variables: Variable[]) => {
  const store = createStore()
  store.set(variablesAtom, variables)
  return (Story: React.ComponentType) => (
    <Provider store={store}>
      <Story />
    </Provider>
  )
}

const meta: Meta<typeof VariablesPanel> = {
  title: "Components/VariablesPanel",
  component: VariablesPanel,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}

export default meta
type Story = StoryObj<typeof VariablesPanel>

export const Empty: Story = {
  decorators: [withStore([])],
}

export const WithOnePathVariable: Story = {
  decorators: [
    withStore([
      {
        id: "basePath",
        label: "Base Path",
        value: "/mnt/media",
        type: "path",
      },
    ]),
  ],
}

export const WithMultiplePathVariables: Story = {
  decorators: [
    withStore([
      {
        id: "basePath",
        label: "Base Path",
        value: "/mnt/media",
        type: "path",
      },
      {
        id: "outputPath",
        label: "Output Path",
        value: "/mnt/output",
        type: "path",
      },
    ]),
  ],
}
