import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, test } from "vitest"
import { makeFakeJob } from "../../jobs/__fixtures__/makeFakeJob"
import { progressByJobIdAtom } from "../../state/progressByJobIdAtom"
import { JobStepRow } from "./JobStepRow"

afterEach(() => {
  cleanup()
})

const LONG_STEP_ID =
  "this-is-an-extremely-long-step-name-that-exceeds-eighty-characters-in-total-length-to-trigger-overflow"

const renderRow = ({
  stepId = null,
  index = 0,
}: {
  stepId?: string | null
  index?: number
} = {}) => {
  const store = createStore()
  const child = makeFakeJob({
    id: "step-1",
    commandName: "copyFiles",
    status: "pending",
    stepId,
  })

  render(
    <Provider store={store}>
      <JobStepRow child={child} index={index} />
    </Provider>,
  )

  return { store, child }
}

// ─── Long step name overflow ──────────────────────────────────────────────────

describe("JobStepRow long step name", () => {
  test("renders the stepId text", () => {
    renderRow({ stepId: LONG_STEP_ID })
    expect(
      screen.getByText(LONG_STEP_ID),
    ).toBeInTheDocument()
  })

  test("stepId element has truncate class to prevent overflow", () => {
    renderRow({ stepId: LONG_STEP_ID })
    const stepIdEl = screen.getByText(LONG_STEP_ID)
    expect(stepIdEl.className).toContain("truncate")
  })

  test("stepId element has min-w-0 so it can shrink in the flex row", () => {
    renderRow({ stepId: LONG_STEP_ID })
    const stepIdEl = screen.getByText(LONG_STEP_ID)
    expect(stepIdEl.className).toContain("min-w-0")
  })

  test("stepId element has title attribute for accessibility", () => {
    renderRow({ stepId: LONG_STEP_ID })
    const stepIdEl = screen.getByText(LONG_STEP_ID)
    expect(stepIdEl).toHaveAttribute("title", LONG_STEP_ID)
  })

  test("command label element has min-w-0 so it can shrink when needed", () => {
    renderRow({ stepId: LONG_STEP_ID })
    const commandEl = screen.getByText("Copy Files")
    expect(commandEl.className).toContain("min-w-0")
  })
})

// ─── Basic rendering ──────────────────────────────────────────────────────────

describe("JobStepRow rendering", () => {
  test("shows step number", () => {
    renderRow({ index: 2 })
    expect(screen.getByText("3.")).toBeInTheDocument()
  })

  test("shows command label", () => {
    renderRow()
    expect(
      screen.getByText("Copy Files"),
    ).toBeInTheDocument()
  })

  test("does not render stepId span when stepId is null", () => {
    renderRow({ stepId: null })
    expect(screen.queryByTestId("step-id")).toBeNull()
  })

  test("shows error message when child has error", () => {
    const store = createStore()
    const child = makeFakeJob({
      id: "step-err",
      commandName: "copyFiles",
      status: "failed",
      error: "Something went wrong",
    })
    render(
      <Provider store={store}>
        <JobStepRow child={child} index={0} />
      </Provider>,
    )
    expect(
      screen.getByText("Something went wrong"),
    ).toBeInTheDocument()
  })

  test("shows progress bar for running step with snapshot", () => {
    const store = createStore()
    const child = makeFakeJob({
      id: "step-run",
      commandName: "remuxToMkv",
      status: "running",
    })
    store.set(
      progressByJobIdAtom,
      new Map([["step-run", { ratio: 0.4 }]]),
    )
    render(
      <Provider store={store}>
        <JobStepRow child={child} index={0} />
      </Provider>,
    )
    expect(
      screen.getByRole("progressbar"),
    ).toBeInTheDocument()
  })
})
