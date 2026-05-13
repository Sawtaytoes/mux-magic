import type { Meta, StoryObj } from "@storybook/react"
import { TagInputBase } from "./TagInputBase"

const meta = {
  title: "Primitives/TagInputBase",
  component: TagInputBase,
} satisfies Meta<typeof TagInputBase>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  args: {
    tags: [],
    onRemove: () => {},
    inputProps: { placeholder: "Type here…" },
  },
}

export const WithTags: Story = {
  args: {
    tags: [
      {
        key: "tag-a",
        label: <span>Tag A</span>,
        title: "Remove Tag A",
      },
      {
        key: "tag-b",
        label: <span>Tag B</span>,
        title: "Remove Tag B",
      },
    ],
    onRemove: () => {},
    inputProps: { placeholder: "Type here…" },
  },
}

export const WithManyTags: Story = {
  args: {
    tags: ["eng", "jpn", "spa", "fra", "deu", "por"].map(
      (code) => ({
        key: code,
        label: <span className="font-mono">{code}</span>,
        title: `Remove ${code}`,
      }),
    ),
    onRemove: () => {},
    inputProps: { placeholder: "Type to add more…" },
  },
}
