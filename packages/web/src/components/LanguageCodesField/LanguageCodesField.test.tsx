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
import { LanguageCodesField } from "./LanguageCodesField"

const createMockStep = (
  overrides?: Partial<Step>,
): Step => ({
  id: "step-1",
  alias: "",
  command: "keepLanguages",
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
      <LanguageCodesField step={step} field={field} />
    </Provider>,
  )
  return store
}

afterEach(() => {
  cleanup()
})

const field =
  FIXTURE_COMMANDS_BUNDLE_B.keepLanguages.fields[1]

describe("LanguageCodesField — tag rendering", () => {
  test("renders empty state with no tags", () => {
    const step = createMockStep()
    renderField(step, field)
    expect(
      screen.queryAllByRole("button", {
        name: /remove/i,
      }),
    ).toHaveLength(0)
  })

  test("renders existing language values as removable tags", () => {
    const step = createMockStep({
      params: { audioLanguages: ["eng"] },
    })
    renderField(step, field)
    const removeButtons = screen.getAllByRole("button", {
      name: /remove/i,
    })
    expect(removeButtons).toHaveLength(1)
  })

  test("renders multiple languages as separate tags", () => {
    const step = createMockStep({
      params: { audioLanguages: ["eng", "jpn"] },
    })
    renderField(step, field)
    const removeButtons = screen.getAllByRole("button", {
      name: /remove/i,
    })
    expect(removeButtons).toHaveLength(2)
  })

  test("eng tag shows English as the language name", () => {
    const step = createMockStep({
      params: { audioLanguages: ["eng"] },
    })
    renderField(step, field)
    expect(screen.getByText("English")).toBeInTheDocument()
  })

  test("jpn tag shows Japanese as the language name", () => {
    const step = createMockStep({
      params: { audioLanguages: ["jpn"] },
    })
    renderField(step, field)
    expect(screen.getByText("Japanese")).toBeInTheDocument()
  })

  test("tag includes the language code", () => {
    const step = createMockStep({
      params: { audioLanguages: ["eng"] },
    })
    renderField(step, field)
    expect(screen.getByText("eng")).toBeInTheDocument()
  })

  test("remove button has accessible title containing the language code", () => {
    const step = createMockStep({
      params: { audioLanguages: ["eng"] },
    })
    renderField(step, field)
    expect(
      screen.getByTitle(/remove eng/i),
    ).toBeInTheDocument()
  })

  test("clicking remove updates stepsAtom to exclude that code", async () => {
    const user = userEvent.setup()
    const step = createMockStep({
      params: { audioLanguages: ["eng", "jpn"] },
    })
    const store = renderField(step, field)

    await user.click(screen.getByTitle(/remove eng/i))

    const steps = store.get(stepsAtom)
    expect(
      (steps[0] as Step).params.audioLanguages,
    ).toEqual(["jpn"])
  })

  test("removing the last tag sets the param to undefined", async () => {
    const user = userEvent.setup()
    const step = createMockStep({
      params: { audioLanguages: ["eng"] },
    })
    const store = renderField(step, field)

    await user.click(screen.getByTitle(/remove eng/i))

    const steps = store.get(stepsAtom)
    expect(
      (steps[0] as Step).params.audioLanguages,
    ).toBeUndefined()
  })

  test("uses field label component", () => {
    const step = createMockStep()
    renderField(step, field)
    expect(
      screen.getByText("Audio Languages"),
    ).toBeInTheDocument()
  })
})

describe("LanguageCodesField — filter autocomplete", () => {
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

  test("filter matches by language code — typing 'eng' shows English option", async () => {
    const user = userEvent.setup()
    const step = createMockStep()
    renderField(step, field)

    await user.type(screen.getByRole("combobox"), "eng")

    const listbox = screen.getByRole("listbox")
    expect(
      within(listbox).getByText("English"),
    ).toBeInTheDocument()
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

  test("selecting an option adds it to stepsAtom params", async () => {
    const user = userEvent.setup()
    const step = createMockStep()
    const store = renderField(step, field)

    await user.type(screen.getByRole("combobox"), "eng")

    const listbox = screen.getByRole("listbox")
    const engOption = within(listbox)
      .getAllByRole("option")
      .find((opt) => within(opt).queryByText("eng"))
    if (!engOption) throw new Error("eng option not found")
    await user.click(engOption)

    const steps = store.get(stepsAtom)
    expect(
      (steps[0] as Step).params.audioLanguages,
    ).toContain("eng")
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

  test("already-selected codes are excluded from the dropdown", async () => {
    const user = userEvent.setup()
    const step = createMockStep({
      params: { audioLanguages: ["eng"] },
    })
    renderField(step, field)

    await user.type(screen.getByRole("combobox"), "eng")

    const listbox = screen.getByRole("listbox")
    const options = within(listbox).queryAllByRole("option")
    const engOptionInList = options.find(
      (opt) =>
        within(opt).queryByText("eng") !== null &&
        within(opt).queryByText("English") !== null,
    )
    expect(engOptionInList).toBeUndefined()
  })
})
