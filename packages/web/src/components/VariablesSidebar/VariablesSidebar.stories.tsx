import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider } from "jotai"
import { variablesAtom } from "../../state/variablesAtom"
import { VariablesSidebar } from "./VariablesSidebar"

const withStore = () => {
  const store = createStore()
  store.set(variablesAtom, [
    {
      id: "basePath",
      label: "Base Path",
      value: "/mnt/media",
      type: "path",
    },
  ])
  return (Story: React.ComponentType) => (
    <Provider store={store}>
      <Story />
    </Provider>
  )
}

const meta: Meta<typeof VariablesSidebar> = {
  title: "Components/VariablesSidebar",
  component: VariablesSidebar,
  parameters: {
    layout: "fullscreen",
    backgrounds: { default: "dark" },
  },
}

export default meta
type Story = StoryObj<typeof VariablesSidebar>

export const WithVariable: Story = {
  decorators: [withStore()],
}
