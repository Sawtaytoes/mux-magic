import type { Meta, StoryObj } from "@storybook/react"

import { createStore, Provider } from "jotai"

import { fileExplorerAtom } from "../state/uiAtoms"
import { FileExplorerModal } from "./FileExplorerModal"

const store = createStore()
store.set(fileExplorerAtom, { path: "/movies", pickerOnSelect: null })

const pickerStore = createStore()
pickerStore.set(fileExplorerAtom, {
  path: "/movies",
  pickerOnSelect: (path: string) => {
    console.log("Picker selected:", path)
  },
})

const meta: Meta<typeof FileExplorerModal> = {
  title: "Components/FileExplorerModal",
  component: FileExplorerModal,
  decorators: [
    (Story, context) => {
      const decoratorStore = context.parameters["store"] as ReturnType<typeof createStore>
      return (
        <Provider store={decoratorStore ?? store}>
          <Story />
        </Provider>
      )
    },
  ],
  parameters: {
    store,
  },
}
export default meta

type Story = StoryObj<typeof FileExplorerModal>

export const BrowseMode: Story = {}

export const PickerMode: Story = {
  parameters: { store: pickerStore },
}
