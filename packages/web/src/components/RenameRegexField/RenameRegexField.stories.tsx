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

const baseField = {
  name: "renameRegex" as const,
  type: "renameRegex" as const,
  label: "Rename Regex",
  isRequired: false,
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
  args: { step: baseStep, field: baseField },
}

export const PartiallyFilled: Story = {
  args: {
    step: {
      ...baseStep,
      params: {
        renameRegex: { pattern: "^(.+)\\.mkv$" },
      },
    },
    field: baseField,
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
    field: baseField,
  },
}

export const WithFlagsAndSampleMatch: Story = {
  args: {
    step: {
      ...baseStep,
      params: {
        renameRegex: {
          pattern: "^(?<title>.+?)-(?<episode>\\d+)\\.mkv$",
          replacement: "$<title> ep$<episode>.mkv",
          flags: "i",
          sample: "MY-SHOW-01.MKV",
        },
      },
    },
    field: baseField,
  },
}

export const WithSampleNoMatch: Story = {
  args: {
    step: {
      ...baseStep,
      params: {
        renameRegex: {
          pattern: "^foo$",
          replacement: "bar",
          sample: "baz.mkv",
        },
      },
    },
    field: baseField,
  },
}
