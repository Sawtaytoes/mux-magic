import type { Meta, StoryObj } from "@storybook/react"

import { FIXTURE_COMMANDS_BUNDLE_D } from "../../commands/__fixtures__/commands"
import { SubtitleRulesField } from "./SubtitleRulesField"

const meta: Meta<typeof SubtitleRulesField> = {
  title: "Fields/SubtitleRulesField",
  component: SubtitleRulesField,
}

export default meta
type Story = StoryObj<typeof SubtitleRulesField>

const field =
  FIXTURE_COMMANDS_BUNDLE_D.modifySubtitleMetadata.fields[1]

export const Empty: Story = {
  args: {
    field,
    step: {
      id: "example-1",
      alias: "",
      command: "modifySubtitleMetadata",
      params: { rules: [] },
      links: {},
      status: null,
      error: null,
      isCollapsed: false,
    },
  },
}

export const WithSampleRules: Story = {
  args: {
    field,
    step: {
      id: "example-2",
      alias: "",
      command: "modifySubtitleMetadata",
      params: {
        rules: [
          {
            type: "setStyleFields",
            predicates: [{ matches: { name: "Sample" } }],
            fields: { fontname: { value: "Arial" } },
          },
        ],
      },
      links: {},
      status: null,
      error: null,
      isCollapsed: false,
    },
  },
}
