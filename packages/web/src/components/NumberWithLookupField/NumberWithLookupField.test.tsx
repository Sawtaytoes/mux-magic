import {
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { createStore, Provider } from "jotai"
import {
  afterEach,
  describe,
  expect,
  it,
  test,
  vi,
} from "vitest"

import {
  FIXTURE_COMMANDS_BUNDLE_B,
  FIXTURE_COMMANDS_BUNDLE_D,
} from "../../commands/__fixtures__/commands"
import { stepsAtom } from "../../state/stepsAtom"
import type { Step } from "../../types"
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

  it("renders input with current number value", () => {
    const step = createTestStep({ params: { malId: 5114 } })
    render(
      <Provider>
        <NumberWithLookupField field={field} step={step} />
      </Provider>,
    )
    const input = screen.getByDisplayValue(5114)
    expect(input).toBeInTheDocument()
  })

  it("shows lookup button", () => {
    const step = createTestStep()
    render(
      <Provider>
        <NumberWithLookupField field={field} step={step} />
      </Provider>,
    )
    const lookupButton = screen.getByTitle(/look up/i)
    expect(lookupButton).toBeInTheDocument()
  })

  it("shows companion name as link when present", () => {
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

  it("hides companion name when empty", () => {
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

  it("renders with AniDB lookup type from fixture B", () => {
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

  it("fetches and stores companion name on mount when ID is set but companion is empty", async () => {
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

  it("skips the fetch when the companion name is already present (YAML cache)", async () => {
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
