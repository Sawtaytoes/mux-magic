import { render, screen } from "@testing-library/react"
import { Provider } from "jotai"
import { describe, expect, it, test } from "vitest"

import {
  FIXTURE_COMMANDS_BUNDLE_B,
  FIXTURE_COMMANDS_BUNDLE_D,
} from "../../commands/__fixtures__/commands"
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

  test("with hasIncrementButtons true — increment button increases value", () => {
    const withButtonsField = {
      ...field,
      hasIncrementButtons: true,
    }
    const step = createTestStep({
      params: { malId: 5, malName: "" },
    })
    render(
      <Provider>
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
    const input = screen.getByDisplayValue(6)
    expect(input).toBeInTheDocument()
  })
})
