import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import { afterEach, describe, expect, test } from "vitest"
import { DeliveryStateBadge } from "./DeliveryStateBadge"

afterEach(() => {
  cleanup()
})

describe("DeliveryStateBadge", () => {
  test("renders pending badge with neutral styling", () => {
    render(<DeliveryStateBadge state="pending" />)
    const badge = screen.getByText("pending")
    expect(badge).toBeVisible()
    expect(badge).toHaveClass("delivery-state-badge")
    expect(badge).toHaveClass("delivery-state-badge--pending")
  })

  test("renders delivered badge with success styling", () => {
    render(<DeliveryStateBadge state="delivered" />)
    const badge = screen.getByText("delivered")
    expect(badge).toBeVisible()
    expect(badge).toHaveClass("delivery-state-badge--delivered")
  })

  test("renders exhausted badge with danger styling", () => {
    render(<DeliveryStateBadge state="exhausted" />)
    const badge = screen.getByText("exhausted")
    expect(badge).toBeVisible()
    expect(badge).toHaveClass("delivery-state-badge--exhausted")
  })
})
