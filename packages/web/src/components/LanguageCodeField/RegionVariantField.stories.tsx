import type { Meta, StoryObj } from "@storybook/react"
import { useState } from "react"
import { RegionVariantField } from "./RegionVariantField"

const meta = {
  title: "Fields/RegionVariantField",
  component: RegionVariantField,
} satisfies Meta<typeof RegionVariantField>

export default meta
type Story = StoryObj<typeof meta>

export const ChineseNoSelection: Story = {
  args: {
    baseCode: "chi",
    selectedIetf: null,
    onIetfChange: () => {},
  },
}

export const ChineseWithSelection: Story = {
  args: {
    baseCode: "chi",
    selectedIetf: "zh-Hant-HK",
    onIetfChange: () => {},
  },
}

export const PortugueseNoSelection: Story = {
  args: {
    baseCode: "por",
    selectedIetf: null,
    onIetfChange: () => {},
  },
}

export const JapaneseHiddenNoVariants: Story = {
  args: {
    baseCode: "jpn",
    selectedIetf: null,
    onIetfChange: () => {},
  },
}

const InteractiveTemplate = () => {
  const [selected, setSelected] = useState<string | null>(
    null,
  )

  return (
    <div className="p-4 bg-slate-800">
      <p className="text-slate-300 text-xs mb-2">
        Selected: {selected ?? "(none)"}
      </p>
      <RegionVariantField
        baseCode="chi"
        selectedIetf={selected}
        onIetfChange={setSelected}
      />
    </div>
  )
}

export const Interactive: Story = {
  render: () => <InteractiveTemplate />,
  args: {
    baseCode: "chi",
    selectedIetf: null,
    onIetfChange: () => {},
  },
}
