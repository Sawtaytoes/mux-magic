import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider } from "jotai"
import { variablesAtom } from "../../state/variablesAtom"
import { editVariablesModalOpenAtom } from "./editVariablesModalOpenAtom"
import { EditVariablesModal } from "./EditVariablesModal"

const withStore = (isOpen: boolean) => {
  const store = createStore()
  store.set(editVariablesModalOpenAtom, isOpen)
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

const meta: Meta<typeof EditVariablesModal> = {
  title: "Components/EditVariablesModal",
  component: EditVariablesModal,
  parameters: {
    layout: "fullscreen",
    backgrounds: { default: "dark" },
  },
}

export default meta
type Story = StoryObj<typeof EditVariablesModal>

export const Open: Story = {
  decorators: [withStore(true)],
}

export const Closed: Story = {
  decorators: [withStore(false)],
}
