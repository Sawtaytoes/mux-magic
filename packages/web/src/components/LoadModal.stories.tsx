import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider } from "jotai"
import { useState } from "react"
import { loadModalOpenAtom } from "../state/uiAtoms"
import type { Commands } from "../types"
import { LoadModal } from "./LoadModal"

// Minimal commands fixture so paste stories can exercise the full flow.
const mockCommands: Commands = {
  downloadEpisodes: {
    fields: [
      { name: "seriesPath", type: "path" },
      { name: "seriesName", type: "string" },
    ],
  },
}

const wireMediaTools = () => {
  if (typeof window !== "undefined") {
    window.mediaTools = window.mediaTools ?? {}
    window.mediaTools.COMMANDS = mockCommands
    window.mediaTools.renderAll = () => {}
    window.mediaTools.updateUrl = () => {}
  }
}

// Store is created inside useState so each mount gets a fresh atom — navigating
// away and back resets the modal to its initial state instead of staying closed.
const withStore = (initialOpen: boolean) => {
  return (Story: React.ComponentType) => {
    const [store] = useState(() => {
      const newStore = createStore()
      newStore.set(loadModalOpenAtom, initialOpen)
      return newStore
    })

    wireMediaTools()

    return (
      <Provider store={store}>
        <Story />
      </Provider>
    )
  }
}

const meta: Meta<typeof LoadModal> = {
  title: "Components/LoadModal",
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
  decorators: [
    withStore(true),
  ],
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
