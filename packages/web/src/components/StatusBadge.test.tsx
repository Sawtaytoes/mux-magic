import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { StatusBadge } from "./StatusBadge"

afterEach(() => {
  cleanup()
})

describe("StatusBadge", () => {
  it("renders the status text", () => {
    render(<StatusBadge status="pending" />)
    expect(screen.getByText("pending")).toBeInTheDocument()
  })

  it("applies pending styles", () => {
    render(<StatusBadge status="pending" />)
    expect(screen.getByText("pending").className).toContain(
      "text-blue-300",
    )
  })

  it("applies running styles with animate-pulse", () => {
    render(<StatusBadge status="running" />)
    expect(screen.getByText("running").className).toContain(
      "animate-pulse",
    )
  })

  it("applies completed styles", () => {
    render(<StatusBadge status="completed" />)
    expect(
      screen.getByText("completed").className,
    ).toContain("text-emerald-400")
  })

  it("applies failed styles", () => {
    render(<StatusBadge status="failed" />)
    expect(screen.getByText("failed").className).toContain(
      "text-red-400",
    )
  })

  it("applies cancelled styles", () => {
    render(<StatusBadge status="cancelled" />)
    expect(
      screen.getByText("cancelled").className,
    ).toContain("text-slate-300")
  })

  it("renders unknown status without crashing", () => {
    render(<StatusBadge status="unknown" />)
    expect(screen.getByText("unknown")).toBeInTheDocument()
  })
})
