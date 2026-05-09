import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider } from "jotai"
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

// Each story gets its own isolated Jotai store so they don't share state.
const withStore = (initialOpen: boolean) => {
  const store = createStore()
  store.set(loadModalOpenAtom, initialOpen)

  // Wire minimal mediaTools so the paste handler doesn't throw.
  if (typeof window !== "undefined") {
    window.mediaTools = window.mediaTools ?? {}
    window.mediaTools.COMMANDS = mockCommands
    window.mediaTools.renderAll = () => {}
    window.mediaTools.updateUrl = () => {}
  }

  return (Story: React.ComponentType) => (
    <Provider store={store}>
      <Story />
    </Provider>
  )
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
        story: "When loadModalOpenAtom is false the component renders nothing.",
      },
    },
  },
}

export const WithError: Story = {
  decorators: [
    () => {
      const store = createStore()
      store.set(loadModalOpenAtom, true)
      if (typeof window !== "undefined") {
        window.mediaTools = window.mediaTools ?? {}
        window.mediaTools.COMMANDS = mockCommands
        window.mediaTools.renderAll = () => {}
        window.mediaTools.updateUrl = () => {}
      }
      return (Story: React.ComponentType) => (
        <Provider store={store}>
          <Story />
        </Provider>
      )
    },
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
