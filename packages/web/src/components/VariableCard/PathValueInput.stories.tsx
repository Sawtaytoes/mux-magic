import type { Meta, StoryObj } from "@storybook/react"
import { useRef, useState } from "react"
import {
  expect,
  userEvent,
  waitFor,
  within,
} from "storybook/test"
import type { Variable } from "../../types"
import { PathValueInput } from "./PathValueInput"

// The directory listing is served by the Storybook mock server
// (.storybook/mock-server-plugin.ts → /queries/listDirectoryEntries):
// Documents / Downloads / Music / Pictures / Videos, and an error for a
// path under /nonexistent.
const Harness = () => {
  const [value, setValue] = useState("")

  const valueInputRef = useRef<HTMLInputElement>(null)

  const variable: Variable = {
    id: "pv-1",
    label: "Source",
    type: "path",
    value,
  }

  return (
    <div className="w-[420px] p-4">
      <PathValueInput
        onValueChange={setValue}
        valueInputRef={valueInputRef}
        variable={variable}
      />
    </div>
  )
}

const meta = {
  title: "Pickers/PathValueInput",
  component: PathValueInput,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof PathValueInput>

export default meta

type Story = StoryObj<typeof meta>

/**
 * Inline typing with the directory dropdown below — attached-input mode on
 * charcuterie's Combobox. The play function types an absolute path to open
 * it; picking a folder drills in and the list stays open.
 */
export const Autocomplete: Story = {
  // Required by the story type; the render uses <Harness/> instead.
  args: {
    onValueChange: () => {},
    valueInputRef: { current: null },
    variable: {
      id: "pv-1",
      label: "Source",
      type: "path",
      value: "",
    },
  },
  render: () => <Harness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const input = canvas.getByPlaceholderText(
      "/mnt/media or D:\\Media",
    )

    await userEvent.click(input)

    await userEvent.type(input, "/media/")

    // Options portal to document.body, so query the whole screen.
    await waitFor(() => {
      expect(
        within(document.body).getByRole("option", {
          name: /Documents/,
        }),
      ).toBeInTheDocument()
    })
  },
}
