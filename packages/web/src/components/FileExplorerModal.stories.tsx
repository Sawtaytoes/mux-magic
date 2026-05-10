import type { Meta, StoryObj } from "@storybook/react"

import { Provider, createStore } from "jotai"
import { HttpResponse, http } from "msw"

import { FileExplorerModal } from "./FileExplorerModal"
import { fileExplorerAtom } from "../state/uiAtoms"

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
  title: "Wave E/FileExplorerModal",
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
    msw: {
      handlers: [
        http.get("/version", () => {
          return HttpResponse.json({ isContainerized: false })
        }),
        http.get("/files/delete-mode", () => {
          return HttpResponse.json({ mode: "trash" })
        }),
        http.get("/files/list", () => {
          return HttpResponse.json({
            entries: [
              { name: "Sample Folder", isDirectory: true, isFile: false, size: 0, mtime: null, duration: null },
              { name: "sample.mp4", isDirectory: false, isFile: true, size: 1024 * 1024 * 500, mtime: "2025-01-15T10:30:00Z", duration: "1:23:45" },
              { name: "document.txt", isDirectory: false, isFile: true, size: 2048, mtime: "2025-01-10T14:20:00Z", duration: null },
            ],
            separator: "/",
          })
        }),
      ],
    },
  },
}
export default meta

type Story = StoryObj<typeof FileExplorerModal>

export const BrowseMode: Story = {}

export const PickerMode: Story = {
  parameters: { store: pickerStore },
}
