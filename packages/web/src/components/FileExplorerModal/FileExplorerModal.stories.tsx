import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider, useSetAtom } from "jotai"
import { useState } from "react"
import { fileExplorerAtom } from "../../components/FileExplorerModal/fileExplorerAtom"
import type { FileExplorerState } from "../../components/FileExplorerModal/types"
import { FileExplorerModal } from "./FileExplorerModal"

const ReOpenButton = ({
  initialState,
}: {
  initialState: FileExplorerState
}) => {
  const setFileExplorer = useSetAtom(fileExplorerAtom)
  return (
    <div className="p-4">
      <button
        type="button"
        className="text-xs bg-slate-700 text-white px-3 py-1.5 rounded"
        onClick={() => setFileExplorer(initialState)}
      >
        Re-open modal
      </button>
    </div>
  )
}

const meta: Meta<typeof FileExplorerModal> = {
  title: "Modals/FileExplorerModal",
  component: FileExplorerModal,
  decorators: [
    (Story, context) => {
      const initialState = context.parameters
        .initialState as FileExplorerState
      const [store] = useState(() => {
        const newStore = createStore()
        newStore.set(fileExplorerAtom, initialState)
        return newStore
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

export const BrowseMode: Story = {
  render: () => (
    <>
      <ReOpenButton
        initialState={{
          path: "/movies",
          pickerOnSelect: null,
        }}
      />
      <FileExplorerModal />
    </>
  ),
}

export const PickerMode: Story = {
  parameters: {
    initialState: {
      path: "/movies",
      pickerOnSelect: (path: string) => {
        console.log("Picker selected:", path)
      },
    } satisfies FileExplorerState,
  },
  render: () => (
    <>
      <ReOpenButton
        initialState={{
          path: "/movies",
          pickerOnSelect: (path: string) => {
            console.log("Picker selected:", path)
          },
        }}
      />
      <FileExplorerModal />
    </>
  ),
}
