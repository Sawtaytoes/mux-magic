import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

import { PredicatesManager } from "./PredicatesManager"
import type { PredicatesMap } from "./types"

afterEach(() => {
  cleanup()
})

const renderPredicatesManager = (
  predicates: PredicatesMap = {},
  openDetailsKeys: Set<string> = new Set(),
) =>
  render(
    <PredicatesManager
      predicates={predicates}
      isReadOnly={false}
      stepId="test-step"
      openDetailsKeys={openDetailsKeys}
      onToggleDetails={vi.fn()}
      onCommitPredicates={vi.fn()}
    />,
  )

/**
 * These used to assert `-rotate-90` on the chevron's `class` — the icon
 * WAS the state, because the trigger carried no `aria-expanded` at all.
 * That is the same defect `ErrorRow` had, and this component is the one the
 * M6b brief did not list: it was never a `<details>`, so a grep for
 * `<details>` walks straight past it.
 *
 * The chevron is `aria-hidden` decoration now, so the assertions moved to
 * the fact it had been standing in for.
 */
describe("PredicatesManager disclosure", () => {
  test("the trigger says whether the section is open", async () => {
    renderPredicatesManager()

    const trigger = screen.getByRole("button", {
      name: /^Predicates \(/,
    })

    expect(trigger).toHaveAttribute(
      "aria-expanded",
      "false",
    )

    await userEvent.click(trigger)
    expect(trigger).toHaveAttribute("aria-expanded", "true")

    await userEvent.click(trigger)
    expect(trigger).toHaveAttribute(
      "aria-expanded",
      "false",
    )
  })

  test("the panel is a named group the trigger controls", async () => {
    renderPredicatesManager()

    const trigger = screen.getByRole("button", {
      name: /^Predicates \(/,
    })
    await userEvent.click(trigger)

    const panel = screen.getByRole("group", {
      name: /^Predicates \(/,
    })

    expect(panel).toBeVisible()
    expect(trigger).toHaveAttribute(
      "aria-controls",
      panel.id,
    )
  })

  test("expanding reveals the Add predicate control", async () => {
    renderPredicatesManager()

    expect(
      screen.getByRole("button", {
        name: "+ Add predicate",
        hidden: true,
      }),
    ).not.toBeVisible()

    await userEvent.click(
      screen.getByRole("button", {
        name: /^Predicates \(/,
      }),
    )

    expect(
      screen.getByRole("button", {
        name: "+ Add predicate",
      }),
    ).toBeVisible()
  })

  test("the chevron is decoration, not the state", async () => {
    renderPredicatesManager()

    const trigger = screen.getByRole("button", {
      name: /^Predicates \(/,
    })
    const chevron = trigger.querySelector("svg")

    // Announced by `aria-expanded` on the button above it. A chevron that
    // announces itself says the same thing twice; one that announces it
    // INSTEAD — which is what this component shipped — says it to nobody.
    expect(chevron).toHaveAttribute("aria-hidden", "true")
    expect(chevron?.getAttribute("class")).not.toContain(
      "rotate-180",
    )

    await userEvent.click(trigger)

    expect(chevron?.getAttribute("class")).toContain(
      "rotate-180",
    )
  })
})
