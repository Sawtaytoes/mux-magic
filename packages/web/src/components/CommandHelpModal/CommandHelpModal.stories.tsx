import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider, useSetAtom } from "jotai"
import {
  commandHelpCommandNameAtom,
  commandHelpModalOpenAtom,
} from "../../components/CommandHelpModal/commandHelpAtoms"
import { commandsAtom } from "../../state/commandsAtom"
import { CommandHelpModal } from "./CommandHelpModal"

const mockCommands = {
  ffmpeg: {
    summary:
      "Encode video using ffmpeg with full control over codec and quality settings.",
    note: "Requires ffmpeg to be installed and on PATH.",
    outputFolderName: "encoded",
    fields: [
      {
        name: "input",
        label: "Input file",
        type: "path",
        isRequired: true,
      },
      {
        name: "preset",
        label: "Encoding preset",
        type: "string",
      },
      {
        name: "crf",
        label: "CRF quality (0–51)",
        type: "number",
      },
    ],
  },
  noFields: {
    summary: "A command with no configurable fields.",
    fields: [],
  },
}

const withStore = (commandName: string) => {
  const store = createStore()
  store.set(commandHelpModalOpenAtom, true)
  store.set(commandHelpCommandNameAtom, commandName)
  store.set(commandsAtom, mockCommands as never)
  return (Story: React.ComponentType) => (
    <Provider store={store}>
      <Story />
    </Provider>
  )
}

const ReOpenButton = () => {
  const setOpen = useSetAtom(commandHelpModalOpenAtom)
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

const meta: Meta<typeof CommandHelpModal> = {
  title: "Modals/CommandHelpModal",
  component: CommandHelpModal,
  parameters: {
    layout: "fullscreen",
    backgrounds: { default: "dark" },
  },
}

export default meta
type Story = StoryObj<typeof CommandHelpModal>

export const WithFields: Story = {
  decorators: [withStore("ffmpeg")],
  render: () => (
    <>
      <ReOpenButton />
      <CommandHelpModal />
    </>
  ),
}

export const NoFields: Story = {
  decorators: [withStore("noFields")],
  render: () => (
    <>
      <ReOpenButton />
      <CommandHelpModal />
    </>
  ),
}
