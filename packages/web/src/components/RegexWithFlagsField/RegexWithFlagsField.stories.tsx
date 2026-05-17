import type { Meta, StoryObj } from "@storybook/react"
import type { Step } from "../../types"
import { RegexWithFlagsField } from "./RegexWithFlagsField"

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
  name: "fileFilterRegex" as const,
  type: "regexWithFlags" as const,
  label: "File Filter Regex",
  isRequired: false,
  placeholder: "\\.mkv$",
}

const meta: Meta<typeof RegexWithFlagsField> = {
  title: "Fields/RegexWithFlagsField",
  component: RegexWithFlagsField,
  parameters: {
    layout: "centered",
    backgrounds: { default: "dark" },
  },
}

export default meta
type Story = StoryObj<typeof RegexWithFlagsField>

export const Empty: Story = {
  args: { step: baseStep, field: baseField },
}

export const LegacyBareString: Story = {
  args: {
    step: {
      ...baseStep,
      params: { fileFilterRegex: "\\.mkv$" },
    },
    field: baseField,
  },
}

export const WithFlagsAndMatchingSample: Story = {
  args: {
    step: {
      ...baseStep,
      params: {
        fileFilterRegex: {
          pattern: "^(?<groupTag>\\[.+?\\])",
          flags: "i",
          sample: "[GroupName] Show - 01 [1080p].mkv",
        },
      },
    },
    field: baseField,
  },
}

export const WithNoMatchSample: Story = {
  args: {
    step: {
      ...baseStep,
      params: {
        fileFilterRegex: {
          pattern: "^foo$",
          sample: "bar.mkv",
        },
      },
    },
    field: baseField,
  },
}

export const InvalidFlag: Story = {
  args: {
    step: {
      ...baseStep,
      params: {
        fileFilterRegex: { pattern: "foo", flags: "z" },
      },
    },
    field: baseField,
  },
}
