import { render, screen } from "@testing-library/react"
import { describe, expect, test } from "vitest"

import { RouteFallback } from "./RouteFallback"

describe("RouteFallback", () => {
  // `@charcuterie/ui`'s Skeleton is `aria-hidden` by contract, so the
  // region that owns the load has to announce it. Without this a
  // screen-reader user gets silence for the whole chunk fetch.
  test("announces the load to assistive tech", () => {
    render(<RouteFallback />)

    const status = screen.getByRole("status")

    expect(status).toHaveAttribute("aria-busy", "true")
    expect(status).toHaveTextContent("Loading page…")
  })

  // The bars are decoration standing in for content that does not
  // exist yet; announcing them reads as empty rows.
  test("the skeleton bars stay hidden from assistive tech", () => {
    const { container } = render(<RouteFallback />)

    const hidden = container.querySelectorAll(
      "[aria-hidden='true']",
    )

    expect(hidden.length).toBeGreaterThan(0)
  })
})
