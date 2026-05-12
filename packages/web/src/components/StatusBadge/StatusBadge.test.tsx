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

  test("applies pending styles", () => {
    render(<StatusBadge status="pending" />)
    expect(screen.getByText("pending").className).toContain(
      "text-blue-300",
    )
  })

  test("applies running styles with animate-pulse", () => {
    render(<StatusBadge status="running" />)
    expect(screen.getByText("running").className).toContain(
      "animate-pulse",
    )
  })

  test("applies completed styles", () => {
    render(<StatusBadge status="completed" />)
    expect(
      screen.getByText("completed").className,
    ).toContain("text-emerald-400")
  })

  test("applies failed styles", () => {
    render(<StatusBadge status="failed" />)
    expect(screen.getByText("failed").className).toContain(
      "text-red-400",
    )
  })

  test("applies cancelled styles", () => {
    render(<StatusBadge status="cancelled" />)
    expect(
      screen.getByText("cancelled").className,
    ).toContain("text-slate-300")
  })

  test("renders unknown status without crashing", () => {
    render(<StatusBadge status="unknown" />)
    expect(screen.getByText("unknown")).toBeInTheDocument()
  })
})
