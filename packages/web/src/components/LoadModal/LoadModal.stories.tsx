import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider, useSetAtom } from "jotai"
import { useState } from "react"
import { loadModalOpenAtom } from "../../components/LoadModal/loadModalAtom"
import { LoadModal } from "./LoadModal"

// Store is created inside useState so each mount gets a fresh atom — navigating
// away and back resets the modal to its initial state instead of staying closed.
const withStore = (isInitiallyOpen: boolean) => {
  return (Story: React.ComponentType) => {
    const [store] = useState(() => {
      const newStore = createStore()
      newStore.set(loadModalOpenAtom, isInitiallyOpen)
      return newStore
    })

    return (
      <Provider store={store}>
        <Story />
      </Provider>
    )
  }
}

const ReOpenButton = () => {
  const setOpen = useSetAtom(loadModalOpenAtom)
  return (
    <div className="p-4">
      <button
        type="button"
        className="text-xs bg-slate-700 text-white px-3 py-1.5 rounded"
        onClick={() => setOpen(true)}
      >
        Re-open modal
      </button>
    </div>
  )
}

const meta: Meta<typeof LoadModal> = {
  title: "Modals/LoadModal",
  component: LoadModal,
  parameters: {
    layout: "fullscreen",
    backgrounds: { default: "dark" },
  },
}

export default meta
type Story = StoryObj<typeof LoadModal>

export const Open: Story = {
  decorators: [withStore(true)],
  render: () => (
    <>
      <ReOpenButton />
      <LoadModal />
    </>
  ),
}

export const Closed: Story = {
  decorators: [withStore(false)],
  parameters: {
    docs: {
      description: {
        story:
          "When loadModalOpenAtom is false the component renders nothing.",
      },
    },
  },
}

export const WithError: Story = {
  decorators: [withStore(true)],
  render: () => (
    <>
      <ReOpenButton />
      <LoadModal />
    </>
  ),
  play: async ({ canvasElement }) => {
    // Simulate an invalid YAML paste to surface the error state.
    const event = new ClipboardEvent("paste", {
      clipboardData: new DataTransfer(),
      bubbles: true,
      cancelable: true,
    })
    Object.defineProperty(event, "clipboardData", {
      value: { getData: () => "not: valid: yaml: {{" },
    })
    canvasElement.ownerDocument.dispatchEvent(event)
  },
}
