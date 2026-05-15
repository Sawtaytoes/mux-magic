import type { Meta, StoryObj } from "@storybook/react"

import { SaveTemplateModal } from "./SaveTemplateModal"

const noop = () => {}

const meta: Meta<typeof SaveTemplateModal> = {
  title: "Components/SavedTemplates/SaveTemplateModal",
  component: SaveTemplateModal,
  parameters: {
    layout: "fullscreen",
    backgrounds: { default: "dark" },
  },
  args: {
    isOpen: true,
    yaml: "steps: []\n",
    onClose: noop,
    onSaved: noop,
  },
}

export default meta
type Story = StoryObj<typeof SaveTemplateModal>

export const Open: Story = {}

export const Closed: Story = { args: { isOpen: false } }
