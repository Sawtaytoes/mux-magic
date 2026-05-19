import {
  cleanup,
  render,
  screen,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, test } from "vitest"
import type { CommandField } from "../../commands/types"
import { stepsAtom } from "../../state/stepsAtom"
import type { Step } from "../../types"
import { SubtitleTypesField } from "./SubtitleTypesField"

const createMockStep = (
  overrides?: Partial<Step>,
): Step => ({
  id: "step-1",
  alias: "",
  command: "extractSubtitles",
  params: {},
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
  ...overrides,
})

const field: CommandField = {
  name: "subtitleTypes",
  type: "subtitleTypes",
  label: "Subtitle Types",
}

const renderField = (step: Step) => {
  const store = createStore()
  store.set(stepsAtom, [step])
  render(
    <Provider store={store}>
      <SubtitleTypesField step={step} field={field} />
    </Provider>,
  )
  return store
}

afterEach(() => {
  cleanup()
})

describe("SubtitleTypesField — tag rendering", () => {
  test("renders no tags when empty", () => {
    renderField(createMockStep())
    expect(
      screen.queryAllByRole("button", {
        name: /remove/i,
      }),
    ).toHaveLength(0)
  })

  test("renders selected values as removable tags", () => {
    renderField(
      createMockStep({
        params: { subtitleTypes: ["ass", "sup"] },
      }),
    )
    expect(
      screen.getAllByRole("button", { name: /remove/i }),
    ).toHaveLength(2)
  })

  test("removing the last tag clears the param", async () => {
    const user = userEvent.setup()
    const store = renderField(
      createMockStep({
        params: { subtitleTypes: ["ass"] },
      }),
    )
    await user.click(screen.getByTitle(/remove ass/i))
    const steps = store.get(stepsAtom)
    expect(
      (steps[0] as Step).params.subtitleTypes,
    ).toBeUndefined()
  })
})

describe("SubtitleTypesField — filter dropdown", () => {
  test("typing 'ass' shows the ASS option row", async () => {
    const user = userEvent.setup()
    renderField(createMockStep())

    await user.type(screen.getByRole("combobox"), "ass")

    const listbox = screen.getByRole("listbox")
    expect(
      within(listbox).getByText("S_TEXT/ASS"),
    ).toBeVisible()
  })

  test("typing the codec id filters too — 'TEXT' matches", async () => {
    const user = userEvent.setup()
    renderField(createMockStep())

    await user.type(screen.getByRole("combobox"), "TEXT")

    const listbox = screen.getByRole("listbox")
    expect(
      within(listbox).getByText("S_TEXT/ASS"),
    ).toBeVisible()
    expect(
      within(listbox).getByText("S_TEXT/UTF8"),
    ).toBeVisible()
  })

  test("typing the description filters — 'bitmap' matches PGS/TextST/VobSub", async () => {
    const user = userEvent.setup()
    renderField(createMockStep())

    await user.type(screen.getByRole("combobox"), "bitmap")

    const listbox = screen.getByRole("listbox")
    expect(
      within(listbox).getByText("S_HDMV/PGS"),
    ).toBeVisible()
    expect(
      within(listbox).getByText("S_HDMV/TEXTST"),
    ).toBeVisible()
    expect(
      within(listbox).getByText("S_VOBSUB"),
    ).toBeVisible()
  })

  test("clicking an option writes the extension string to params", async () => {
    const user = userEvent.setup()
    const store = renderField(createMockStep())

    await user.type(screen.getByRole("combobox"), "ass")
    const listbox = screen.getByRole("listbox")
    const assOption = within(listbox)
      .getAllByRole("option")
      .find((option) =>
        within(option).queryByText("S_TEXT/ASS"),
      )
    if (!assOption) {
      throw new Error("ASS option not found")
    }
    await user.click(assOption)

    const steps = store.get(stepsAtom)
    expect((steps[0] as Step).params.subtitleTypes).toEqual(
      ["ass"],
    )
  })

  test("already-selected extensions are excluded from the dropdown", async () => {
    const user = userEvent.setup()
    renderField(
      createMockStep({
        params: { subtitleTypes: ["sup"] },
      }),
    )

    await user.type(screen.getByRole("combobox"), "sup")

    const listbox = screen.queryByRole("listbox")
    // Either no listbox (empty options collapses it) or no PGS / TextST rows.
    if (listbox) {
      expect(
        within(listbox).queryByText("S_HDMV/PGS"),
      ).toBeNull()
      expect(
        within(listbox).queryByText("S_HDMV/TEXTST"),
      ).toBeNull()
    }
  })
})
