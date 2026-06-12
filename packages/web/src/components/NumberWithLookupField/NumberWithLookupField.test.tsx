import {
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createStore, Provider } from "jotai"
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

import {
  FIXTURE_COMMANDS_BUNDLE_B,
  FIXTURE_COMMANDS_BUNDLE_D,
} from "../../commands/__fixtures__/commands"
import { stepsAtom } from "../../state/stepsAtom"
import { variablesAtom } from "../../state/variablesAtom"
import type { Step, Variable } from "../../types"
import { NumberWithLookupField } from "./NumberWithLookupField"

const createTestStep = (
  overrides?: Partial<Step>,
): Step => ({
  id: "test-step-1",
  alias: "",
  command: "nameAnimeEpisodes",
  params: { malId: 1, malName: "" },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
  ...overrides,
})

describe("NumberWithLookupField", () => {
  const field =
    FIXTURE_COMMANDS_BUNDLE_D.nameAnimeEpisodes.fields[1]

  test("renders input with current number value", () => {
    const step = createTestStep({ params: { malId: 5114 } })
    render(
      <Provider>
        <NumberWithLookupField field={field} step={step} />
      </Provider>,
    )
    const input = screen.getByDisplayValue(5114)
    expect(input).toBeInTheDocument()
  })

  test("shows lookup button", () => {
    const step = createTestStep()
    render(
      <Provider>
        <NumberWithLookupField field={field} step={step} />
      </Provider>,
    )
    const lookupButton = screen.getByTitle(/look up/i)
    expect(lookupButton).toBeInTheDocument()
  })

  test("shows companion name as link when present", () => {
    const step = createTestStep({
      params: {
        malId: 5114,
        malName: "Fullmetal Alchemist",
      },
    })
    render(
      <Provider>
        <NumberWithLookupField field={field} step={step} />
      </Provider>,
    )
    const companionLink = screen.getByText(
      "Fullmetal Alchemist",
    )
    expect(companionLink).toBeInTheDocument()
    expect(companionLink.tagName).toBe("A")
  })

  test("hides companion name when empty", () => {
    const step = createTestStep({
      params: { malId: 5114, malName: "" },
    })
    render(
      <Provider>
        <NumberWithLookupField field={field} step={step} />
      </Provider>,
    )
    expect(
      screen.queryByText("Fullmetal Alchemist"),
    ).not.toBeInTheDocument()
  })

  test("renders with AniDB lookup type from fixture B", () => {
    const anidbField =
      FIXTURE_COMMANDS_BUNDLE_B.nameAnimeEpisodesAniDB
        .fields[1]
    const step = {
      id: "test-step-2",
      alias: "",
      command: "nameAnimeEpisodesAniDB",
      params: { anidbId: 4171, anidbName: "Bleach" },
      links: {},
      status: null,
      error: null,
      isCollapsed: false,
    }
    render(
      <Provider>
        <NumberWithLookupField
          field={anidbField}
          step={step}
        />
      </Provider>,
    )
    const input = screen.getByDisplayValue(4171)
    expect(input).toBeInTheDocument()
    const companionLink = screen.getByText("Bleach")
    expect(companionLink).toBeInTheDocument()
  })

  test("with hasIncrementButtons false — renders no increment or decrement buttons", () => {
    const noButtonsField = {
      ...field,
      hasIncrementButtons: false,
    }
    const step = createTestStep()
    render(
      <Provider>
        <NumberWithLookupField
          field={noButtonsField}
          step={step}
        />
      </Provider>,
    )
    expect(
      screen.queryByRole("button", { name: /increment/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /decrement/i }),
    ).not.toBeInTheDocument()
  })

  test("with hasIncrementButtons false — input is not a spinbutton (no type=number)", () => {
    const noButtonsField = {
      ...field,
      hasIncrementButtons: false,
    }
    const step = createTestStep({
      params: { malId: 42, malName: "" },
    })
    render(
      <Provider>
        <NumberWithLookupField
          field={noButtonsField}
          step={step}
        />
      </Provider>,
    )
    expect(
      screen.queryByRole("spinbutton"),
    ).not.toBeInTheDocument()
    const input = screen.getByRole("textbox")
    expect(input).toHaveDisplayValue("42")
  })

  test("with hasIncrementButtons true — renders custom increment and decrement buttons", () => {
    const withButtonsField = {
      ...field,
      hasIncrementButtons: true,
    }
    const step = createTestStep()
    render(
      <Provider>
        <NumberWithLookupField
          field={withButtonsField}
          step={step}
        />
      </Provider>,
    )
    expect(
      screen.getByRole("button", { name: /increment/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /decrement/i }),
    ).toBeInTheDocument()
  })

  test("with hasIncrementButtons true — increment button updates store value by 1", () => {
    const withButtonsField = {
      ...field,
      hasIncrementButtons: true,
    }
    const step = createTestStep({
      params: { malId: 5, malName: "" },
    })
    const store = createStore()
    store.set(stepsAtom, [step])
    render(
      <Provider store={store}>
        <NumberWithLookupField
          field={withButtonsField}
          step={step}
        />
      </Provider>,
    )
    const incrementButton = screen.getByRole("button", {
      name: /increment/i,
    })
    incrementButton.click()
    const steps = store.get(stepsAtom)
    expect((steps[0] as Step).params.malId).toBe(6)
  })
})

// ─── Linked-field behaviour (worker 45) ──────────────────────────────────────
// When a step's field is linked to a Variable, the field should display the
// Variable's value and write changes back through to the Variable.

describe("NumberWithLookupField — linked-field read/write", () => {
  const malField =
    FIXTURE_COMMANDS_BUNDLE_D.nameAnimeEpisodes.fields[1]

  test("displays the linked Variable's value as the input value", () => {
    const malVariable: Variable = {
      id: "malIdVariable_test",
      label: "FMA Brotherhood",
      value: "5114",
      type: "malId",
    }
    const step: Step = {
      id: "test-linked-step",
      alias: "",
      command: "nameAnimeEpisodes",
      params: {},
      links: { malId: malVariable.id },
      status: null,
      error: null,
      isCollapsed: false,
    }
    const store = createStore()
    store.set(stepsAtom, [step])
    store.set(variablesAtom, [malVariable])

    render(
      <Provider store={store}>
        <NumberWithLookupField
          field={malField}
          step={step}
        />
      </Provider>,
    )

    // Input shows the Variable's value (5114), not step.params.malId
    const input = screen.getByDisplayValue(5114)
    expect(input).toBeInTheDocument()
  })

  test("shows empty input when linked Variable value is empty", () => {
    const malVariable: Variable = {
      id: "malIdVariable_empty",
      label: "",
      value: "",
      type: "malId",
    }
    const step: Step = {
      id: "test-linked-empty",
      alias: "",
      command: "nameAnimeEpisodes",
      params: {},
      links: { malId: malVariable.id },
      status: null,
      error: null,
      isCollapsed: false,
    }
    const store = createStore()
    store.set(stepsAtom, [step])
    store.set(variablesAtom, [malVariable])

    render(
      <Provider store={store}>
        <NumberWithLookupField
          field={malField}
          step={step}
        />
      </Provider>,
    )

    // Input should show "" (empty) when variable value is empty.
    // malId field has hasIncrementButtons: false → renders as textbox
    const input = screen.getByRole("textbox")
    expect(input).toHaveDisplayValue("")
  })

  test("onChange writes to the linked Variable, not to step.params", async () => {
    const user = userEvent.setup()
    const malVariable: Variable = {
      id: "malIdVariable_write",
      label: "",
      value: "",
      type: "malId",
    }
    const step: Step = {
      id: "test-linked-write",
      alias: "",
      command: "nameAnimeEpisodes",
      params: {},
      links: { malId: malVariable.id },
      status: null,
      error: null,
      isCollapsed: false,
    }
    const store = createStore()
    store.set(stepsAtom, [step])
    store.set(variablesAtom, [malVariable])

    render(
      <Provider store={store}>
        <NumberWithLookupField
          field={malField}
          step={step}
        />
      </Provider>,
    )

    // malId field has hasIncrementButtons: false → renders as textbox
    const input = screen.getByRole("textbox")
    await user.clear(input)
    await user.type(input, "5114")

    // Variable should have been updated
    await waitFor(() => {
      const variables = store.get(variablesAtom)
      expect(variables[0].value).toBe("5114")
    })

    // step.params.malId should remain unchanged (write went to variable)
    const updatedStep = store.get(stepsAtom)[0] as Step
    expect(updatedStep.params.malId).toBeUndefined()
  })
})

// Reverse-lookup auto-resolution.
// ────────────────────────────────
// When a numberWithLookup field has an ID but no companion name (typical
// after the user types an ID directly, before LookupModal interaction),
// the component should debounce-fetch the resolved name from the matching
// /queries/lookup* endpoint and write it to the companion param.
describe("NumberWithLookupField — reverse-lookup auto-resolution", () => {
  const malField =
    FIXTURE_COMMANDS_BUNDLE_D.nameAnimeEpisodes.fields[1]

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test("fetches and stores companion name on mount when ID is set but companion is empty", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ name: "Cowboy Bebop" }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const step: Step = {
      id: "test-step-mal",
      alias: "",
      command: "nameAnimeEpisodes",
      params: { malId: 1, malName: "" },
      links: {},
      status: null,
      error: null,
      isCollapsed: false,
    }
    const store = createStore()
    store.set(stepsAtom, [step])

    render(
      <Provider store={store}>
        <NumberWithLookupField
          field={malField}
          step={step}
        />
      </Provider>,
    )

    await waitFor(
      () => {
        const updated = store.get(stepsAtom)[0] as Step
        expect(updated.params.malName).toBe("Cowboy Bebop")
      },
      { timeout: 2000 },
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain("/queries/lookupMal")
    expect(JSON.parse(init.body as string)).toEqual({
      malId: 1,
    })
  })

  test("skips the fetch when the companion name is already present (YAML cache)", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const step: Step = {
      id: "test-step-cached",
      alias: "",
      command: "nameAnimeEpisodes",
      params: {
        malId: 5114,
        malName: "Fullmetal Alchemist",
      },
      links: {},
      status: null,
      error: null,
      isCollapsed: false,
    }
    const store = createStore()
    store.set(stepsAtom, [step])

    render(
      <Provider store={store}>
        <NumberWithLookupField
          field={malField}
          step={step}
        />
      </Provider>,
    )
    await new Promise((resolve) => setTimeout(resolve, 800))
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

// Release-hash reverse-lookup.
// ────────────────────────────
// dvdCompareReleaseHash is a sibling-aware field: it has no lookupType of
// its own, but the reverse-lookup machinery resolves the label by pairing
// the hash with the sibling dvdCompareId. The field renders via
// NumberWithLookupField (not NumberField) so the effect is wired up.
describe("NumberWithLookupField — dvdCompareReleaseHash sibling-id reverse-lookup", () => {
  const releaseHashField = {
    name: "dvdCompareReleaseHash",
    type: "numberWithLookup",
    label: "Release Hash",
    default: 1,
    companionNameField: "dvdCompareReleaseLabel",
  }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test("uses field.default for the input and fires lookupDvdCompareRelease when params has no hash but sibling dvdCompareId is set", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        label:
          "Blu-ray ALL America - Universal Pictures [2022]",
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const step: Step = {
      id: "test-step-rh",
      alias: "",
      command: "nameSpecialFeaturesDvdCompareTmdb",
      // No dvdCompareReleaseHash, no dvdCompareReleaseLabel — exactly the
      // shape from the user-reported YAML where the label is missing.
      params: { dvdCompareId: 53207 },
      links: {},
      status: null,
      error: null,
      isCollapsed: false,
    }
    const store = createStore()
    store.set(stepsAtom, [step])

    render(
      <Provider store={store}>
        <NumberWithLookupField
          field={releaseHashField}
          step={step}
        />
      </Provider>,
    )

    // Input reflects field.default (was "" before the fallback was added).
    const input = screen.getByDisplayValue(1)
    expect(input).toBeVisible()

    await waitFor(
      () => {
        const updated = store.get(stepsAtom)[0] as Step
        expect(updated.params.dvdCompareReleaseLabel).toBe(
          "Blu-ray ALL America - Universal Pictures [2022]",
        )
      },
      { timeout: 2000 },
    )
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain(
      "/queries/lookupDvdCompareRelease",
    )
    expect(JSON.parse(init.body as string)).toEqual({
      dvdCompareId: 53207,
      hash: "1",
    })
  })

  test("skips the lookup when the sibling dvdCompareId is missing (can't resolve a release without a film)", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const step: Step = {
      id: "test-step-rh-no-sibling",
      alias: "",
      command: "nameSpecialFeaturesDvdCompareTmdb",
      params: {},
      links: {},
      status: null,
      error: null,
      isCollapsed: false,
    }
    const store = createStore()
    store.set(stepsAtom, [step])

    render(
      <Provider store={store}>
        <NumberWithLookupField
          field={releaseHashField}
          step={step}
        />
      </Provider>,
    )
    await new Promise((resolve) => setTimeout(resolve, 800))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test("does not render the 🔍 lookup button (no lookupType on this field)", () => {
    const step: Step = {
      id: "test-step-rh-no-button",
      alias: "",
      command: "nameSpecialFeaturesDvdCompareTmdb",
      params: { dvdCompareId: 53207 },
      links: {},
      status: null,
      error: null,
      isCollapsed: false,
    }
    render(
      <Provider>
        <NumberWithLookupField
          field={releaseHashField}
          step={step}
        />
      </Provider>,
    )
    expect(
      screen.queryByTitle(/look up/i),
    ).not.toBeInTheDocument()
  })
})
