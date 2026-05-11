import type { Meta, StoryObj } from "@storybook/react"

import { FIXTURE_COMMANDS_BUNDLE_D } from "../../commands/__fixtures__/commands"
import { FolderMultiSelectField } from "./FolderMultiSelectField"

const meta: Meta<typeof FolderMultiSelectField> = {
  title: "Fields/FolderMultiSelectField",
  component: FolderMultiSelectField,
}

export default meta
type Story = StoryObj<typeof FolderMultiSelectField>

const field =
  FIXTURE_COMMANDS_BUNDLE_D.storeAspectRatioData.fields[1]

export const Empty: Story = {
  args: {
    field,
    step: {
      id: "example-1",
      alias: "",
      command: "storeAspectRatioData",
      params: { folders: [] },
      links: {},
      status: null,
      error: null,
      isCollapsed: false,
    },
  },
}

export const WithFolders: Story = {
  args: {
    field,
    step: {
      id: "example-2",
      alias: "",
      command: "storeAspectRatioData",
      params: {
        folders: [
          "/home/user/videos/folder1",
          "/home/user/videos/folder2",
        ],
      },
      links: {},
      status: null,
      error: null,
      isCollapsed: false,
    },
  },
}
