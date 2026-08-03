import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, test } from "vitest"
import { FIXTURE_COMMANDS_BUNDLE_B } from "../../commands/__fixtures__/commands"
import type { CommandField } from "../../commands/types"
import { stepsAtom } from "../../state/stepsAtom"
import type { Step } from "../../types"
import { EnumField } from "./EnumField"

const createMockStep = (
  overrides?: Partial<Step>,
): Step => ({
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

const episodeTypeField =
  FIXTURE_COMMANDS_BUNDLE_B.nameAnimeEpisodesAniDB.fields[2]

const renderWithJotai = (
  step: Step,
  field: CommandField,
) => {
  const store = createStore()
  store.set(stepsAtom, [step])
  render(
    <Provider store={store}>
      <EnumField step={step} field={field} />
    </Provider>,
  )
  return store
}

afterEach(() => {
  cleanup()
})

describe("EnumField — trigger", () => {
  test("renders selected value from step params", () => {
    const step = createMockStep({
      params: { episodeType: "specials" },
    })

    renderWithJotai(step, episodeTypeField)

    const button = screen.getByRole("button")
    expect(button).toHaveTextContent("Specials (S, type=2)")
  })

  test("renders default value when params undefined", () => {
    const step = createMockStep()

    renderWithJotai(step, episodeTypeField)

    const button = screen.getByRole("button")
    expect(button).toHaveTextContent("Regular (type=1)")
  })

  test("renders chevron indicator", () => {
    const step = createMockStep()

    renderWithJotai(step, episodeTypeField)

    expect(screen.getByText("▾")).toBeInTheDocument()
  })

  test("uses field label component", () => {
    const step = createMockStep()

    renderWithJotai(step, episodeTypeField)

    expect(
      screen.getByText("Episode Type"),
    ).toBeInTheDocument()
  })
})

describe("EnumField — picker", () => {
  const open = async (
    user: ReturnType<typeof userEvent.setup>,
  ) => {
    await user.click(screen.getByRole("button"))
    return screen.getByRole("combobox")
  }

  test("opening lists all options", async () => {
    const user = userEvent.setup()
    renderWithJotai(createMockStep(), episodeTypeField)

    await open(user)

    const listbox = screen.getByRole("listbox")
    expect(
      within(listbox).getByText("Regular (type=1)"),
    ).toBeInTheDocument()
    expect(
      within(listbox).getByText("Specials (S, type=2)"),
    ).toBeInTheDocument()
  })

  test("filters options by query", async () => {
    const user = userEvent.setup()
    renderWithJotai(createMockStep(), episodeTypeField)

    await user.type(await open(user), "special")

    const listbox = screen.getByRole("listbox")
    expect(
      within(listbox).getByText("Specials (S, type=2)"),
    ).toBeInTheDocument()
    expect(
      within(listbox).queryByText("Regular (type=1)"),
    ).toBeNull()
  })

  test("shows empty state when nothing matches", async () => {
    const user = userEvent.setup()
    renderWithJotai(createMockStep(), episodeTypeField)

    await user.type(await open(user), "zzznomatch")

    expect(
      screen.getByText(/no options match/i),
    ).toBeInTheDocument()
  })

  test("clicking an option sets the param and closes", async () => {
    const user = userEvent.setup()
    const store = renderWithJotai(
      createMockStep(),
      episodeTypeField,
    )

    await open(user)
    await user.click(
      screen.getByText("Specials (S, type=2)"),
    )

    expect(
      (store.get(stepsAtom)[0] as Step).params.episodeType,
    ).toBe("specials")
    expect(screen.queryByRole("listbox")).toBeNull()
  })

  test("Enter selects the active (filtered) item", async () => {
    const user = userEvent.setup()
    const store = renderWithJotai(
      createMockStep(),
      episodeTypeField,
    )

    await user.type(await open(user), "special")
    await user.keyboard("{Enter}")

    await waitFor(() => {
      expect(
        (store.get(stepsAtom)[0] as Step).params
          .episodeType,
      ).toBe("specials")
    })
  })

  test("Escape closes the picker", async () => {
    const user = userEvent.setup()
    renderWithJotai(createMockStep(), episodeTypeField)

    await open(user)
    await user.keyboard("{Escape}")

    await waitFor(() => {
      expect(screen.queryByRole("listbox")).toBeNull()
    })
  })
})
