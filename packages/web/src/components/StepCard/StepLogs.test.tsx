import {
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createStore, Provider } from "jotai"
import { describe, expect, test } from "vitest"

import {
  type LogEntry,
  logsByJobIdAtom,
} from "../../state/logsByJobIdAtom"
// `LogViewer`'s pane is capped by `max-h-64`, and the cap is the whole
// point here — without a stylesheet the pane is always as tall as its
// content, `scrollHeight === clientHeight`, and every assertion below
// passes whether or not the component follows anything.
import "../../styles/tailwindStyles.css"
import { StepLogs } from "./StepLogs"

const JOB_ID = "step-job-1"

const renderStepLogs = (lines: string[]) => {
  const store = createStore()
  const entries: LogEntry[] = lines.map((line, index) => ({
    key: String(index),
    line,
  }))

  store.set(logsByJobIdAtom, new Map([[JOB_ID, entries]]))

  return render(
    <Provider store={store}>
      <StepLogs jobId={JOB_ID} />
    </Provider>,
  )
}

const sixtyLines = Array.from(
  { length: 60 },
  (_, index) => `[INFO] file ${index} processed`,
)

describe("StepLogs", () => {
  /**
   * The regression `DisclosedLogViewer` used to exist for, now owned by
   * the library.
   *
   * `AccordionSection` renders its panel `hidden` rather than unmounting
   * it, deliberately — an unmounted panel loses a scroll position and any
   * subscription its content opened. A `hidden` subtree has no layout box,
   * so `LogViewer`'s mount effect measured `scrollHeight 0`, wrote
   * `scrollTop = 0`, and never ran again: neither `isFollowing` nor the
   * lines change when the section opens, so the log opened on its **first**
   * line. Measured here on a 60-line pane before the fix:
   *
   * ```
   * while collapsed : scrollTop 0   scrollHeight 0     clientHeight 0
   * after expanding : scrollTop 0   scrollHeight 976   clientHeight 254
   * ```
   *
   * `@charcuterie/ui@1.0.0` fixed it with a `ResizeObserver` on the pane —
   * gaining a box is the first callback — so this app renders `Accordion`
   * and `LogViewer` directly and asserts the tail here instead of working
   * around it.
   */
  test("the pane follows the tail once the disclosure opens", async () => {
    const user = userEvent.setup()

    renderStepLogs(sixtyLines)

    // `hidden: true` because that is the precondition: mounted, in the
    // accessibility tree's shadow, and in the layout tree not at all.
    const pane = screen.getByRole("log", {
      hidden: true,
      name: `Logs for step ${JOB_ID}`,
    })

    // Not rhetorical. If `AccordionSection` ever unmounts its panel, or
    // stops using `hidden`, this test quietly stops testing anything — so
    // it fails here instead.
    expect(pane.scrollHeight).toBe(0)

    await user.click(
      screen.getByRole("button", {
        name: `Logs (${sixtyLines.length} lines)`,
      }),
    )

    // The cap applied, so there is something to scroll past.
    await waitFor(() => {
      expect(pane.scrollHeight).toBeGreaterThan(
        pane.clientHeight,
      )
    })

    // Pinned to the tail. A few pixels of slack because a fractional
    // device pixel ratio means `scrollTop + clientHeight` never lands
    // exactly on `scrollHeight`.
    await waitFor(() => {
      expect(
        pane.scrollHeight -
          pane.scrollTop -
          pane.clientHeight,
      ).toBeLessThan(4)
    })
  })

  /**
   * The pane survives a collapse as the same node, and re-opening pins it
   * to the tail again rather than to the top.
   *
   * Note what cannot be asserted here: `scrollTop` reads `0` while the
   * panel is `hidden`, because a subtree with no layout box has no scroll
   * position to report. That is the same missing box the measurement bug
   * came from, and it is why the assertion is node identity plus a
   * re-measure after the reveal rather than a remembered number.
   */
  test("the pane survives a collapse and re-pins on reopening", async () => {
    const user = userEvent.setup()

    renderStepLogs(sixtyLines)

    const trigger = screen.getByRole("button", {
      name: `Logs (${sixtyLines.length} lines)`,
    })

    await user.click(trigger)

    const pane = screen.getByRole("log", {
      name: `Logs for step ${JOB_ID}`,
    })

    await waitFor(() => {
      expect(pane.scrollTop).toBeGreaterThan(0)
    })

    await user.click(trigger)

    // Present but hidden, which is the property `AccordionSection` chose
    // `hidden` for — and the reason withholding the pane was the wrong
    // fix for the measurement bug.
    expect(trigger).toHaveAttribute(
      "aria-expanded",
      "false",
    )
    expect(screen.getByRole("log", { hidden: true })).toBe(
      pane,
    )

    await user.click(trigger)

    // Same node, and following again — which is the reveal firing the
    // `ResizeObserver` a second time, not a fresh mount getting lucky.
    expect(
      screen.getByRole("log", {
        name: `Logs for step ${JOB_ID}`,
      }),
    ).toBe(pane)

    await waitFor(() => {
      expect(
        pane.scrollHeight -
          pane.scrollTop -
          pane.clientHeight,
      ).toBeLessThan(4)
    })
  })

  test("renders nothing when the step has no logs", () => {
    const { container } = renderStepLogs([])

    expect(container).toBeEmptyDOMElement()
  })
})
