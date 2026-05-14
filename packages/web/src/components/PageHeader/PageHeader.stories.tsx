import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider } from "jotai"
import {
  dryRunAtom,
  failureModeAtom,
} from "../../state/dryRunQuery"
import { runningAtom } from "../../state/runAtoms"
import { PageHeader } from "./PageHeader"

// Both menus animate from a transformed/transparent state into place over
// 200ms. Stories prefixed `…MenuOpen` click the relevant toggle in their
// play function so the open state renders for visual review. The transition
// happens once on mount — refresh the iframe to see it replay.

const meta: Meta<typeof PageHeader> = {
  title: "Components/PageHeader",
  component: PageHeader,
  decorators: [
    (Story, context) => {
      const store = context.parameters.store as ReturnType<
        typeof createStore
      >
      return (
        <Provider store={store ?? createStore()}>
          <Story />
        </Provider>
      )
    },
  ],
}
export default meta

type Story = StoryObj<typeof PageHeader>

export const Default: Story = {}

export const DryRunActive: Story = {
  parameters: {
    store: (() => {
      const store = createStore()
      store.set(dryRunAtom, true)
      return store
    })(),
  },
}

export const DryRunWithFailures: Story = {
  parameters: {
    store: (() => {
      const store = createStore()
      store.set(dryRunAtom, true)
      store.set(failureModeAtom, true)
      return store
    })(),
  },
}

export const RunInFlight: Story = {
  parameters: {
    store: (() => {
      const store = createStore()
      store.set(runningAtom, true)
      return store
    })(),
  },
}

const clickToggle = (
  canvasElement: HTMLElement,
  toggleId: string,
) => {
  const button = canvasElement.ownerDocument.getElementById(
    toggleId,
  ) as HTMLButtonElement | null
  button?.click()
}

export const NavMenuOpen: Story = {
  play: async ({ canvasElement }) => {
    clickToggle(canvasElement, "page-nav-toggle")
  },
}

export const ControlsMenuOpen: Story = {
  parameters: {
    store: (() => {
      const store = createStore()
      store.set(dryRunAtom, true)
      return store
    })(),
  },
  play: async ({ canvasElement }) => {
    clickToggle(canvasElement, "page-controls-toggle")
  },
}
