import type { Meta, StoryObj } from "@storybook/react"
import type { Step } from "../../types"
import { JsonField } from "./JsonField"

const meta: Meta<typeof JsonField> = {
  title: "Fields/JsonField",
  component: JsonField,
}

export default meta
type Story = StoryObj<typeof JsonField>

const field = {
  name: "testJson",
  type: "json" as const,
  label: "JSON Data",
}

const mockStep: Step = {
  id: "step-1",
  alias: "",
  command: "testCommand",
  params: { testJson: { key: "value" } },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

export const Empty: Story = {
  args: {
    field,
    step: {
      ...mockStep,
      params: {},
    },
  },
}

export const WithObject: Story = {
  args: {
    field,
    step: {
      ...mockStep,
      params: {
        testJson: { key: "value", nested: { foo: "bar" } },
      },
    },
  },
}

export const WithArray: Story = {
  args: {
    field,
    step: {
      ...mockStep,
      params: { testJson: [1, 2, 3, 4, 5] },
    },
  },
}

export const WithString: Story = {
  args: {
    field,
    step: {
      ...mockStep,
      params: {
        testJson: '{"key": "value", "number": 42}',
      },
    },
  },
}

export const Linked: Story = {
  args: {
    field,
    step: {
      ...mockStep,
      params: { testJson: {} },
      links: {
        testJson: {
          linkedTo: "step-0",
          output: "outputFolder",
        },
      },
    },
  },
}

export const WithPlaceholder: Story = {
  args: {
    field: {
      ...field,
      placeholder: '{\n  "example": "value"\n}',
    },
    step: {
      ...mockStep,
      params: {},
    },
  },
}
