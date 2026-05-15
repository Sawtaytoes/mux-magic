import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider } from "jotai"
import { variablesAtom } from "../../state/variablesAtom"
import type { Variable } from "../../types"
import { VariableCard } from "./VariableCard"

const basePath: Variable = {
  id: "basePath",
  label: "Base Path",
  value: "/mnt/media",
  type: "path",
}

const withStore = (variables: Variable[]) => {
  const store = createStore()
  store.set(variablesAtom, variables)
  return (Story: React.ComponentType) => (
    <Provider store={store}>
      <Story />
    </Provider>
  )
}

const meta: Meta<typeof VariableCard> = {
  title: "Components/VariableCard",
  component: VariableCard,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}

export default meta
type Story = StoryObj<typeof VariableCard>

export const BasePath: Story = {
  decorators: [withStore([basePath])],
  args: { variable: basePath, isFirst: true },
}

export const SecondaryPath: Story = {
  decorators: [
    withStore([
      basePath,
      {
        id: "outputPath",
        label: "Output Path",
        value: "/mnt/output",
        type: "path",
      },
    ]),
  ],
  args: {
    variable: {
      id: "outputPath",
      label: "Output Path",
      value: "/mnt/output",
      type: "path",
    },
    isFirst: false,
  },
}

export const EmptyValue: Story = {
  decorators: [withStore([{ ...basePath, value: "" }])],
  args: {
    variable: { ...basePath, value: "" },
    isFirst: false,
  },
}

// ─── dvdCompareId variant (worker 35) ────────────────────────────────────────

const dvdCompareIdSlug: Variable = {
  id: "dvdCompareIdVariable_xyz",
  label: "Spider-Man 2002",
  value: "spider-man-2002",
  type: "dvdCompareId",
}

export const DvdCompareIdSlug: Story = {
  decorators: [withStore([dvdCompareIdSlug])],
  args: { variable: dvdCompareIdSlug, isFirst: true },
}

export const DvdCompareIdNumeric: Story = {
  decorators: [
    withStore([{ ...dvdCompareIdSlug, value: "74759" }]),
  ],
  args: {
    variable: { ...dvdCompareIdSlug, value: "74759" },
    isFirst: true,
  },
}

export const DvdCompareIdUrl: Story = {
  decorators: [
    withStore([
      {
        ...dvdCompareIdSlug,
        value:
          "https://dvdcompare.net/comparisons/film.php?fid=74759",
      },
    ]),
  ],
  args: {
    variable: {
      ...dvdCompareIdSlug,
      value:
        "https://dvdcompare.net/comparisons/film.php?fid=74759",
    },
    isFirst: true,
  },
}

export const DvdCompareIdEmpty: Story = {
  decorators: [
    withStore([{ ...dvdCompareIdSlug, value: "" }]),
  ],
  args: {
    variable: { ...dvdCompareIdSlug, value: "" },
    isFirst: false,
  },
}
