import type { Meta, StoryObj } from "@storybook/react"

import { FIXTURE_COMMANDS_BUNDLE_D } from "../../commands/__fixtures__/commands"
import { PathField } from "./PathField"

const meta: Meta<typeof PathField> = {
  title: "Fields/PathField",
  component: PathField,
}

export default meta
type Story = StoryObj<typeof PathField>

const field =
  FIXTURE_COMMANDS_BUNDLE_D.makeDirectory.fields[0]

export const Default: Story = {
  args: {
    field,
    step: {
      id: "example-1",
      alias: "",
      command: "makeDirectory",
      params: { sourcePath: "" },
      links: {},
      status: null,
      error: null,
      isCollapsed: false,
    },
  },
}

export const WithValue: Story = {
  args: {
    field,
    step: {
      id: "example-2",
      alias: "",
      command: "makeDirectory",
      params: { sourcePath: "/home/user/videos" },
      links: {},
      status: null,
      error: null,
      isCollapsed: false,
    },
  },
}

export const LinkedToPathVariable: Story = {
  args: {
    field,
    step: {
      id: "example-3",
      alias: "",
      command: "makeDirectory",
      params: { sourcePath: "" },
      links: { sourcePath: "basePath" },
      status: null,
      error: null,
      isCollapsed: false,
    },
  },
}

export const LinkedToStepOutput: Story = {
  args: {
    field,
    step: {
      id: "example-4",
      alias: "",
      command: "makeDirectory",
      params: { sourcePath: "/fallback/path" },
      links: {
        sourcePath: {
          linkedTo: "previous-step-id",
          output: "folder",
        },
      },
      status: null,
      error: null,
      isCollapsed: false,
    },
  },
}
