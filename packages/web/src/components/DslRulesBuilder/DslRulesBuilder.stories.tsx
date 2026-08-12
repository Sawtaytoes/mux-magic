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

// Linked state: single chain icon between from/to, default-on (no flag needed).
export const ScaleResolutionLinked: Story = {
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

// Unlinked state: single chain icon shown as broken; all four fields edit freely.
export const ScaleResolutionUnlinked: Story = {
  args: {
    step: {
      ...baseStep,
      params: {
        rules: [
          {
            type: "scaleResolution",
            from: { width: 1920, height: 1080 },
            to: { width: 1280, height: 720 },
            isAspectLinked: false,
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

/**
 * A rule carrying both predicates, in the legacy flat shape every saved
 * sequence uses. Open "When" or "Apply If" to drive the QueryBuilder:
 * the quantifier picker is ANY/ALL/NO, and the target picker beside it
 * says what is being quantified — sub-groups, style rows, or script
 * info. Set the quantifier to NOT ALL and the target list filters to
 * script info, because the DSL has no `notAllStyle`.
 *
 * There was no `when:`/`applyIf:` story before the QueryBuilder
 * migration, which is why the predicates' rendering was never in a
 * screenshot or an axe run.
 */
export const WithWhenAndApplyIf: Story = {
  args: {
    step: {
      ...baseStep,
      params: {
        predicates: {
          hdSource: { PlayResX: "1920" },
        },
        rules: [
          {
            type: "setStyleFields",
            fields: { Fontname: "Arial" },
            when: {
              allScriptInfo: { PlayResX: "1920" },
              anyStyle: {
                excludes: { Bold: "-1" },
                matches: { Fontname: "Comic Sans MS" },
              },
            },
            applyIf: {
              anyStyleMatches: { Fontsize: { gt: 40 } },
            },
          },
        ],
      },
    },
  },
}
