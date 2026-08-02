import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, test } from "vitest"

import { DisclosedLogViewer } from "./DisclosedLogViewer"

afterEach(() => {
  cleanup()
})

const lines = Array.from({ length: 60 }, (_, index) => ({
  key: `line-${index}`,
  text: `[INFO] file ${index} processed`,
}))

describe("DisclosedLogViewer", () => {
  test("does not mount the pane until the section is opened", async () => {
    const user = userEvent.setup()

    render(
      <DisclosedLogViewer
        label="Logs for job job-1"
        lines={lines}
        summary="Logs"
      />,
    )

    // The regression this component exists for. `AccordionSection` renders
    // its panel `hidden` rather than unmounting it, so a `LogViewer`
    // mounted there has NO LAYOUT — `scrollHeight` is 0 — and its one
    // auto-scroll effect sets `scrollTop = 0`. The effect's dependencies
    // are `isFollowing` and `shownLines`, neither of which changes when the
    // panel is revealed, so it never runs again and the pane opens on the
    // TOP of the log. That is mux-magic's original `}, [])` bug rebuilt out
    // of two components that are each individually correct.
    expect(screen.queryByRole("log")).toBeNull()

    await user.click(
      screen.getByRole("button", { name: "Logs" }),
    )

    const pane = screen.getByRole("log", {
      name: "Logs for job job-1",
    })

    // Mounted WITH LAYOUT, which is the whole point — the effect that
    // follows the tail reads `scrollHeight`, and inside the hidden panel
    // that is 0.
    //
    // The scrolling itself cannot be asserted here: this suite renders
    // without the app stylesheet, so `LogViewer`'s `max-h-64` never
    // applies and the pane is never taller than its content. It was
    // verified in the browser instead — collapsed `scrollHeight 0`,
    // expanded `scrollHeight 976 / clientHeight 254 / scrollTop 0` before
    // this component existed.
    expect(pane).toBeVisible()
    expect(pane.clientHeight).toBeGreaterThan(0)
  })

  test("stays mounted once opened, so a collapse keeps the pane's state", async () => {
    const user = userEvent.setup()

    render(
      <DisclosedLogViewer
        label="Logs for job job-1"
        lines={lines}
        summary="Logs"
      />,
    )

    const trigger = screen.getByRole("button", {
      name: "Logs",
    })

    await user.click(trigger)
    expect(screen.getByRole("log")).toBeVisible()

    await user.click(trigger)

    // Present but hidden — which is the property `AccordionSection` chose
    // `hidden` for, and the reason the gate above is "has it been opened"
    // rather than "is it open".
    expect(trigger).toHaveAttribute(
      "aria-expanded",
      "false",
    )
    expect(
      screen.getByRole("log", { hidden: true }),
    ).toBeInTheDocument()
  })

  test("reports the first expansion once", async () => {
    const user = userEvent.setup()
    const expansions: number[] = []

    render(
      <DisclosedLogViewer
        label="Logs for job job-1"
        lines={lines}
        onExpand={() => {
          expansions.push(1)
        }}
        summary="Logs"
      />,
    )

    const trigger = screen.getByRole("button", {
      name: "Logs",
    })

    await user.click(trigger)
    await user.click(trigger)

    // `onExpand` opens the log stream, so it must not fire on a collapse.
    expect(expansions).toHaveLength(1)
  })
})
