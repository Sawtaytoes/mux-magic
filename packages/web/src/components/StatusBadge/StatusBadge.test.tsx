import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import { afterEach, describe, expect, test } from "vitest"
import { StatusBadge } from "./StatusBadge"

afterEach(() => {
  cleanup()
})

describe("StatusBadge", () => {
  test("renders the status text", () => {
    render(<StatusBadge status="pending" />)
    expect(screen.getByText("pending")).toBeInTheDocument()
  })

  // The intent + marker classes live on the outer Badge span; the
  // status text renders in an inner label span, so reach up to the
  // `.status-badge` element to read them.
  const badgeOf = (status: string) =>
    screen.getByText(status).closest(".status-badge")

  test("applies pending styles", () => {
    render(<StatusBadge status="pending" />)
    expect(badgeOf("pending")?.className).toContain(
      "text-intent-info-content",
    )
  })

  test("applies running styles with animate-pulse", () => {
    render(<StatusBadge status="running" />)
    expect(badgeOf("running")?.className).toContain(
      "animate-pulse",
    )
  })

  test("applies completed styles", () => {
    render(<StatusBadge status="completed" />)
    expect(badgeOf("completed")?.className).toContain(
      "text-intent-success-content",
    )
  })

  test("applies failed styles", () => {
    render(<StatusBadge status="failed" />)
    expect(badgeOf("failed")?.className).toContain(
      "text-intent-danger-content",
    )
  })

  test("applies cancelled styles", () => {
    render(<StatusBadge status="cancelled" />)
    expect(badgeOf("cancelled")?.className).toContain(
      "text-intent-neutral-content",
    )
  })

  test("applies paused styles with amber color", () => {
    render(<StatusBadge status="paused" />)
    expect(badgeOf("paused")?.className).toContain(
      "text-intent-warning-content",
    )
  })

  test("renders unknown status without crashing", () => {
    render(<StatusBadge status="unknown" />)
    expect(screen.getByText("unknown")).toBeInTheDocument()
  })
})
