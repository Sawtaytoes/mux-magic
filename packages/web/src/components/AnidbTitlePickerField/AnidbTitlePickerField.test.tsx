import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Provider } from "jotai"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

import type { CommandField } from "../../commands/types"
import type { Step } from "../../types"
import { AnidbTitlePickerField } from "./AnidbTitlePickerField"
import { fetchAnidbTitles } from "./fetchAnidbTitles"

const setParam = vi.fn()

vi.mock("../../hooks/useBuilderActions", () => ({
  useBuilderActions: () => ({ setParam }),
}))

vi.mock("./fetchAnidbTitles", () => ({
  fetchAnidbTitles: vi.fn(),
}))

const field: CommandField = {
  name: "seriesName",
  type: "anidbTitlePicker",
  label: "Series Name",
  sourceField: "anidbId",
  description: "Overrides AniDB's auto-picked title.",
}

const createStep = (overrides?: Partial<Step>): Step => ({
  id: "step-1",
  alias: "",
  command: "nameAnimeEpisodesAniDB",
  params: {},
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
  ...overrides,
})

const renderField = (step: Step) =>
  render(
    <Provider>
      <AnidbTitlePickerField field={field} step={step} />
    </Provider>,
  )

describe("AnidbTitlePickerField", () => {
  beforeEach(() => {
    setParam.mockClear()
    vi.mocked(fetchAnidbTitles).mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test("shows the current seriesName value in the input", () => {
    renderField(
      createStep({
        params: { anidbId: 8160, seriesName: "My Title" },
      }),
    )
    expect(
      screen.getByDisplayValue("My Title"),
    ).toBeInTheDocument()
  })

  test("disables the load button until an AniDB ID is set", () => {
    renderField(createStep({ params: {} }))
    expect(
      screen.getByRole("button", {
        name: /load titles from anidb/i,
      }),
    ).toBeDisabled()
  })

  test("enables the load button once an AniDB ID is present", () => {
    renderField(createStep({ params: { anidbId: 8160 } }))
    expect(
      screen.getByRole("button", {
        name: /load titles from anidb/i,
      }),
    ).toBeEnabled()
  })

  test("loads candidate titles verbatim and picking one sets the param", async () => {
    // AniDB's actual backtick form must be preserved verbatim for the
    // user to character-clean.
    vi.mocked(fetchAnidbTitles).mockResolvedValue([
      {
        lang: "en",
        type: "official",
        value: "Hell`s Paradise Season 2",
      },
    ])
    const user = userEvent.setup()
    renderField(createStep({ params: { anidbId: 8160 } }))

    await user.click(
      screen.getByRole("button", {
        name: /load titles from anidb/i,
      }),
    )

    expect(fetchAnidbTitles).toHaveBeenCalledWith(8160)

    const option = await screen.findByRole("option", {
      name: /Hell`s Paradise Season 2/,
    })
    expect(option).toBeInTheDocument()

    await user.selectOptions(
      screen.getByRole("combobox", {
        name: /anidb title candidates/i,
      }),
      "Hell`s Paradise Season 2",
    )

    expect(setParam).toHaveBeenCalledWith(
      "step-1",
      "seriesName",
      "Hell`s Paradise Season 2",
    )
  })

  test("reports when AniDB returns no titles", async () => {
    vi.mocked(fetchAnidbTitles).mockResolvedValue([])
    const user = userEvent.setup()
    renderField(createStep({ params: { anidbId: 8160 } }))

    await user.click(
      screen.getByRole("button", {
        name: /load titles from anidb/i,
      }),
    )

    expect(
      await screen.findByText(/no titles found/i),
    ).toBeInTheDocument()
  })
})
