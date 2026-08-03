import type { Meta, StoryObj } from "@storybook/react"

import { CommandFieldGroup } from "./CommandFieldGroup"

const meta: Meta<typeof CommandFieldGroup> = {
  title: "Components/CommandFieldGroup",
  component: CommandFieldGroup,
  parameters: {
    layout: "centered",
  },
}

export default meta
type Story = StoryObj<typeof CommandFieldGroup>

const inputClass =
  "w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono"

const patternAndFlags = (
  <div className="grid w-72 grid-cols-[1fr_4rem] gap-2">
    <input
      aria-label="Pattern"
      className={inputClass}
      defaultValue="\\.mkv$"
      type="text"
    />
    <input
      aria-label="Flags"
      className={inputClass}
      defaultValue="i"
      type="text"
    />
  </div>
)

export const Default: Story = {
  args: {
    children: patternAndFlags,
    field: { label: "Rename regex", name: "renameRegex" },
  },
}

export const WithActions: Story = {
  args: {
    actions: (
      <button
        className="text-[10px] text-slate-400 hover:text-slate-200"
        type="button"
      >
        Show as /…/
      </button>
    ),
    children: patternAndFlags,
    field: {
      isRequired: true,
      label: "Rename regex",
      name: "renameRegex",
    },
  },
}

/**
 * The help affordance is a real `<button>`, which is what makes the tip
 * keyboard-openable and Escape-dismissible. `CommandFieldControl` cannot do
 * that — `Field` renders a `<label>`, and a `<label>` may not contain a
 * labelable element.
 */
export const WithDescription: Story = {
  args: {
    children: patternAndFlags,
    field: {
      description:
        "Applied to each entry's filename via String.replace. Capture groups $1, $2, … are available in the replacement.",
      label: "Rename regex",
      name: "renameRegex",
    },
  },
}
