import type { Meta, StoryObj } from "@storybook/react"
import type { Step } from "../../types"
import { RenameRegexField } from "./RenameRegexField"

const baseStep: Step = {
  id: "step1",
  alias: "",
  command: "copyFiles",
  params: {},
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

const meta: Meta<typeof RenameRegexField> = {
  title: "Fields/RenameRegexField",
  component: RenameRegexField,
  parameters: {
    layout: "centered",
    backgrounds: { default: "dark" },
  },
}

export default meta
type Story = StoryObj<typeof RenameRegexField>

export const Empty: Story = {
  args: {
    step: baseStep,
    field: {
      name: "renameRegex",
      type: "renameRegex",
      label: "Rename Regex",
      isRequired: false,
    },
  },
}

export const PartiallyFilled: Story = {
  args: {
    step: {
      ...baseStep,
      params: {
        renameRegex: { pattern: "^(.+)\\.mkv$" },
      },
    },
    field: {
      name: "renameRegex",
      type: "renameRegex",
      label: "Rename Regex",
      isRequired: false,
    },
  },
}

export const FullyFilled: Story = {
  args: {
    step: {
      ...baseStep,
      params: {
        renameRegex: {
          pattern: "^(.+)\\.mkv$",
          replacement: "$1.mp4",
        },
      },
    },
    field: {
      name: "renameRegex",
      type: "renameRegex",
      label: "Rename Regex",
      isRequired: false,
    },
  },
}
