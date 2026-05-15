import type { Meta, StoryObj } from "@storybook/react"

import { SavedTemplateRow } from "./SavedTemplateRow"

const baseTemplate = {
  id: "movie-workflow",
  name: "Movie Workflow",
  description: "First pass on full-disc rips",
  updatedAt: "2026-01-01T00:00:00.000Z",
}

const noop = () => {}

const meta: Meta<typeof SavedTemplateRow> = {
  title: "Components/SavedTemplates/SavedTemplateRow",
  component: SavedTemplateRow,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
  args: {
    template: baseTemplate,
    isSelected: false,
    onLoad: noop,
    onUpdateFromCurrent: noop,
    onRename: noop,
    onEditDescription: noop,
    onDelete: noop,
  },
  decorators: [
    (Story) => (
      <ul className="w-72 bg-slate-900 p-2">
        <Story />
      </ul>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof SavedTemplateRow>

export const Idle: Story = {}

export const Selected: Story = {
  args: { isSelected: true },
}

export const WithoutDescription: Story = {
  args: {
    template: { ...baseTemplate, description: undefined },
  },
}
