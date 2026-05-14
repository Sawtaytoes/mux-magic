import type { Meta, StoryObj } from "@storybook/react"

import type { Step } from "../../types"
import { DslRulesBuilder } from "./DslRulesBuilder"

const baseStep: Step = {
  id: "story-step",
  alias: "",
  command: "modifySubtitleMetadata",
  params: {},
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

const meta: Meta<typeof DslRulesBuilder> = {
  title: "Fields/DslRulesBuilder",
  component: DslRulesBuilder,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}

export default meta
type Story = StoryObj<typeof DslRulesBuilder>

export const Empty: Story = {
  args: {
    step: { ...baseStep, params: { rules: [] } },
  },
}

export const SingleSetScriptInfo: Story = {
  args: {
    step: {
      ...baseStep,
      params: {
        rules: [
          {
            type: "setScriptInfo",
            key: "Title",
            value: "My Series",
          },
        ],
      },
    },
  },
}

export const AllRuleKinds: Story = {
  args: {
    step: {
      ...baseStep,
      params: {
        hasDefaultRules: true,
        rules: [
          {
            type: "setScriptInfo",
            key: "Title",
            value: "Example",
          },
          {
            type: "scaleResolution",
            from: { width: 1920, height: 1080 },
            to: { width: 1280, height: 720 },
            hasScaledBorderAndShadow: true,
          },
          {
            type: "setStyleFields",
            fields: {
              MarginV: "60",
              FontSize: {
                computeFrom: {
                  property: "PlayResY",
                  scope: "scriptInfo",
                  ops: [{ multiply: 0.05 }, "round"],
                },
              },
            },
            ignoredStyleNamesRegexString: "^Default$",
          },
        ],
      },
    },
  },
}

export const ScaleResolutionLocked: Story = {
  args: {
    step: {
      ...baseStep,
      params: {
        rules: [
          {
            type: "scaleResolution",
            from: { width: 1920, height: 1080 },
            to: { width: 1280, height: 720 },
          },
        ],
      },
    },
  },
}

export const ScaleResolutionFromUnlocked: Story = {
  args: {
    step: {
      ...baseStep,
      params: {
        rules: [
          {
            type: "scaleResolution",
            from: { width: 1920, height: 1080 },
            to: { width: 1280, height: 720 },
            isFromAspectLocked: false,
          },
        ],
      },
    },
  },
}

export const ScaleResolutionBothUnlocked: Story = {
  args: {
    step: {
      ...baseStep,
      params: {
        rules: [
          {
            type: "scaleResolution",
            from: { width: 1920, height: 1080 },
            to: { width: 1280, height: 720 },
            isFromAspectLocked: false,
            isToAspectLocked: false,
          },
        ],
      },
    },
  },
}

export const ReadOnly: Story = {
  args: {
    isReadOnly: true,
    step: {
      ...baseStep,
      params: {
        rules: [
          {
            type: "setScriptInfo",
            key: "Title",
            value: "Read Only",
          },
        ],
      },
    },
  },
}
