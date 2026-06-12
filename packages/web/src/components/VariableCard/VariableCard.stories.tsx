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

// ─── tmdbId variant (worker 45) ──────────────────────────────────────────────

const tmdbIdNumeric: Variable = {
  id: "tmdbIdVariable_abc",
  label: "Interstellar",
  value: "157336",
  type: "tmdbId",
}

export const TmdbIdNumeric: Story = {
  decorators: [withStore([tmdbIdNumeric])],
  args: { variable: tmdbIdNumeric, isFirst: false },
}

export const TmdbIdUrl: Story = {
  decorators: [
    withStore([
      {
        ...tmdbIdNumeric,
        value: "https://www.themoviedb.org/movie/157336",
      },
    ]),
  ],
  args: {
    variable: {
      ...tmdbIdNumeric,
      value: "https://www.themoviedb.org/movie/157336",
    },
    isFirst: false,
  },
}

export const TmdbIdEmpty: Story = {
  decorators: [
    withStore([{ ...tmdbIdNumeric, value: "" }]),
  ],
  args: {
    variable: { ...tmdbIdNumeric, value: "" },
    isFirst: false,
  },
}

// ─── anidbId variant (worker 45) ─────────────────────────────────────────────

const anidbIdNumeric: Variable = {
  id: "anidbIdVariable_def",
  label: "Fullmetal Alchemist: Brotherhood",
  value: "6922",
  type: "anidbId",
}

export const AnidbIdNumeric: Story = {
  decorators: [withStore([anidbIdNumeric])],
  args: { variable: anidbIdNumeric, isFirst: false },
}

export const AnidbIdUrl: Story = {
  decorators: [
    withStore([
      {
        ...anidbIdNumeric,
        value: "https://anidb.net/anime/6922",
      },
    ]),
  ],
  args: {
    variable: {
      ...anidbIdNumeric,
      value: "https://anidb.net/anime/6922",
    },
    isFirst: false,
  },
}

export const AnidbIdEmpty: Story = {
  decorators: [
    withStore([{ ...anidbIdNumeric, value: "" }]),
  ],
  args: {
    variable: { ...anidbIdNumeric, value: "" },
    isFirst: false,
  },
}

// ─── malId variant (worker 45) ───────────────────────────────────────────────

const malIdNumeric: Variable = {
  id: "malIdVariable_ghi",
  label: "Fullmetal Alchemist: Brotherhood",
  value: "5114",
  type: "malId",
}

export const MalIdNumeric: Story = {
  decorators: [withStore([malIdNumeric])],
  args: { variable: malIdNumeric, isFirst: false },
}

export const MalIdUrl: Story = {
  decorators: [
    withStore([
      {
        ...malIdNumeric,
        value: "https://myanimelist.net/anime/5114",
      },
    ]),
  ],
  args: {
    variable: {
      ...malIdNumeric,
      value: "https://myanimelist.net/anime/5114",
    },
    isFirst: false,
  },
}

export const MalIdEmpty: Story = {
  decorators: [withStore([{ ...malIdNumeric, value: "" }])],
  args: {
    variable: { ...malIdNumeric, value: "" },
    isFirst: false,
  },
}
