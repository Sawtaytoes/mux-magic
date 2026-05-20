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

// Worker 78 — these don't seed mocked entries (the modal hits the real
// API), but they pre-set a path the dev server can resolve so screenshot
// runs (worker 6a VRT rig, when it lands) can hit consistent folders for
// audio + image preview surfaces.
export const WithAudioRows: Story = {
  parameters: {
    initialState: {
      path: "/music",
      pickerOnSelect: null,
    } satisfies FileExplorerState,
  },
  render: () => (
    <>
      <ReOpenButton
        initialState={{
          path: "/music",
          pickerOnSelect: null,
        }}
      />
      <FileExplorerModal />
    </>
  ),
}

export const WithImageRows: Story = {
  parameters: {
    initialState: {
      path: "/music/Album",
      pickerOnSelect: null,
    } satisfies FileExplorerState,
  },
  render: () => (
    <>
      <ReOpenButton
        initialState={{
          path: "/music/Album",
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

// Same as PickerMode — exists so VRT can snapshot the picker variant with the
// always-on delete footer visible. The footer's "Delete selected" button now
// renders in picker mode (worker 73); it's inert until rows are ticked.
export const PickerModeWithDelete: Story = {
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
