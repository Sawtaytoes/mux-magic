import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider } from "jotai"
import { useState } from "react"
import { fileExplorerAtom } from "../state/uiAtoms"
import type { FileExplorerState } from "../types"
import { FileExplorerModal } from "./FileExplorerModal"

const meta: Meta<typeof FileExplorerModal> = {
  title: "Components/FileExplorerModal",
  component: FileExplorerModal,
  decorators: [
    (Story, context) => {
      const initialState = context.parameters.initialState as FileExplorerState
      const [store] = useState(() => {
        const s = createStore()
        s.set(fileExplorerAtom, initialState)
        return s
      })
      return (
        <Provider store={store}>
          <Story />
        </Provider>
      )
    },
  ],
  parameters: {
    initialState: {
      path: "/movies",
      pickerOnSelect: null,
    } satisfies FileExplorerState,
  },
}
export default meta

type Story = StoryObj<typeof FileExplorerModal>

export const BrowseMode: Story = {}

export const PickerMode: Story = {
  parameters: {
    initialState: {
      path: "/movies",
      pickerOnSelect: (path: string) => {
        console.log("Picker selected:", path)
      },
    } satisfies FileExplorerState,
  },
}
