import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider } from "jotai"
import {
  dryRunAtom,
  failureModeAtom,
  runningAtom,
} from "../state/uiAtoms"
import { PageHeader } from "./PageHeader"

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
