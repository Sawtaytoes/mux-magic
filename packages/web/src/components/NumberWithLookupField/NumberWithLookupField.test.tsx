import { render, screen } from "@testing-library/react"
import { Provider } from "jotai"
import { describe, expect, it } from "vitest"

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
})
