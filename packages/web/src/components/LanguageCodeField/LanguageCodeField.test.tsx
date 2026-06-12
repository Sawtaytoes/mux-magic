import {
  cleanup,
  render,
  screen,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, test } from "vitest"
import { FIXTURE_COMMANDS_BUNDLE_B } from "../../commands/__fixtures__/commands"
import type { CommandField } from "../../commands/types"
import { stepsAtom } from "../../state/stepsAtom"
import type { Step } from "../../types"
import { LanguageCodeField } from "./LanguageCodeField"

const createMockStep = (
  overrides?: Partial<Step>,
): Step => ({
  id: "step-1",
  alias: "",
  command: "changeTrackLanguages",
  params: {},
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
  ...overrides,
})

const renderField = (step: Step, field: CommandField) => {
  const store = createStore()
  store.set(stepsAtom, [step])
  render(
    <Provider store={store}>
      <LanguageCodeField step={step} field={field} />
    </Provider>,
  )
  return store
}

afterEach(() => {
  cleanup()
})

const field =
  FIXTURE_COMMANDS_BUNDLE_B.changeTrackLanguages.fields[1]

describe("LanguageCodeField — selected tag rendering", () => {
  test("renders no tag when params undefined", () => {
    const step = createMockStep()
    renderField(step, field)
    expect(
      screen.queryByRole("button", { name: /remove/i }),
    ).not.toBeInTheDocument()
  })

  test("renders existing value as a removable tag", () => {
    const step = createMockStep({
      params: { audioLanguage: "jpn" },
    })
    renderField(step, field)
    expect(
      screen.getByRole("button", { name: /remove jpn/i }),
    ).toBeInTheDocument()
  })

  test("tag shows the language name", () => {
    const step = createMockStep({
      params: { audioLanguage: "jpn" },
    })
    renderField(step, field)
    expect(screen.getByText("Japanese")).toBeInTheDocument()
  })

  test("tag shows the language code", () => {
    const step = createMockStep({
      params: { audioLanguage: "jpn" },
    })
    renderField(step, field)
    expect(screen.getByText("jpn")).toBeInTheDocument()
  })

  test("clicking remove sets the param to undefined", async () => {
    const user = userEvent.setup()
    const step = createMockStep({
      params: { audioLanguage: "jpn" },
    })
    const store = renderField(step, field)

    await user.click(screen.getByTitle(/remove jpn/i))

    const steps = store.get(stepsAtom)
    expect(
      (steps[0] as Step).params.audioLanguage,
    ).toBeUndefined()
  })

  test("renders no variant field for jpn (no BCP 47 variants)", () => {
    const step = createMockStep({
      params: { audioLanguage: "jpn" },
    })
    renderField(step, field)
    expect(
      screen.queryByRole("combobox", { name: /variant/i }),
    ).not.toBeInTheDocument()
  })

  test("renders a variant select for chi (7 Chinese BCP 47 variants)", () => {
    const step = createMockStep({
      params: { audioLanguage: "chi" },
    })
    renderField(step, field)
    const selects = screen.getAllByRole("combobox")
    expect(selects.length).toBeGreaterThanOrEqual(1)
  })

  test("uses field label component", () => {
    const step = createMockStep()
    renderField(step, field)
    expect(
      screen.getByText("Audio Language"),
    ).toBeInTheDocument()
  })
})

describe("LanguageCodeField — filter autocomplete", () => {
  test("renders a filter combobox input", () => {
    const step = createMockStep()
    renderField(step, field)
    expect(screen.getByRole("combobox")).toBeInTheDocument()
  })

  test("typing in the filter shows a listbox with options", async () => {
    const user = userEvent.setup()
    const step = createMockStep()
    renderField(step, field)

    await user.type(screen.getByRole("combobox"), "eng")

    expect(screen.getByRole("listbox")).toBeInTheDocument()
    expect(
      screen.getAllByRole("option").length,
    ).toBeGreaterThan(0)
  })

  test("filter matches by language name — typing 'Japanese' shows jpn option", async () => {
    const user = userEvent.setup()
    const step = createMockStep()
    renderField(step, field)

    await user.type(
      screen.getByRole("combobox"),
      "Japanese",
    )

    const listbox = screen.getByRole("listbox")
    expect(
      within(listbox).getByText("Japanese"),
    ).toBeInTheDocument()
  })

  test("eng is the first option in the unfiltered list (pinned)", async () => {
    const user = userEvent.setup()
    const step = createMockStep()
    renderField(step, field)

    await user.click(screen.getByRole("combobox"))

    const options = screen.getAllByRole("option")
    expect(
      within(options[0]).getByText("eng"),
    ).toBeInTheDocument()
  })

  test("selecting an option sets the param to a LanguageSelection object", async () => {
    const user = userEvent.setup()
    const step = createMockStep()
    const store = renderField(step, field)

    await user.type(screen.getByRole("combobox"), "jpn")

    const listbox = screen.getByRole("listbox")
    const jpnOption = within(listbox)
      .getAllByRole("option")
      .find((opt) => within(opt).queryByText("jpn"))
    if (!jpnOption) throw new Error("jpn option not found")
    await user.click(jpnOption)

    const steps = store.get(stepsAtom)
    expect((steps[0] as Step).params.audioLanguage).toEqual(
      { code: "jpn" },
    )
  })

  test("selecting an option clears the filter input", async () => {
    const user = userEvent.setup()
    const step = createMockStep()
    renderField(step, field)

    await user.type(screen.getByRole("combobox"), "eng")
    const listbox = screen.getByRole("listbox")
    const firstOption =
      within(listbox).getAllByRole("option")[0]
    await user.click(firstOption)

    expect(screen.getByRole("combobox")).toHaveValue("")
  })

  test("selecting a new code replaces the previous selection", async () => {
    const user = userEvent.setup()
    const step = createMockStep({
      params: { audioLanguage: "jpn" },
    })
    const store = renderField(step, field)

    await user.type(screen.getByRole("combobox"), "Korean")

    const listbox = screen.getByRole("listbox")
    const korOption = within(listbox)
      .getAllByRole("option")
      .find((opt) => within(opt).queryByText("kor"))
    if (!korOption) throw new Error("kor option not found")
    await user.click(korOption)

    const steps = store.get(stepsAtom)
    expect((steps[0] as Step).params.audioLanguage).toEqual(
      { code: "kor" },
    )
  })

  test("currently-selected code is excluded from the dropdown", async () => {
    const user = userEvent.setup()
    const step = createMockStep({
      params: { audioLanguage: "jpn" },
    })
    renderField(step, field)

    // Type a letter that matches many codes — "j" — so the listbox renders
    // with results. The selected code "jpn" must not appear among them.
    await user.type(screen.getByRole("combobox"), "j")

    const listbox = screen.getByRole("listbox")
    const options = within(listbox).queryAllByRole("option")
    const jpnOptionInList = options.find(
      (opt) =>
        within(opt).queryByText("jpn") !== null &&
        within(opt).queryByText("Japanese") !== null,
    )
    expect(jpnOptionInList).toBeUndefined()
  })
})
