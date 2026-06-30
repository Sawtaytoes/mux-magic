import { renderHook } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import type React from "react"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"
import { COMMANDS } from "../commands/commands"
import { sequenceRunModalAtom } from "../components/SequenceRunModal/sequenceRunModalAtom"
import {
  findStepById,
  flattenSteps,
} from "../jobs/sequenceUtils"
import { commandsAtom } from "../state/commandsAtom"
import { pathsAtom } from "../state/pathsAtom"
import { runningAtom } from "../state/runAtoms"
import { setStepRunStatusAtom } from "../state/stepAtoms"
import { stepsAtom } from "../state/stepsAtom"
import type { Step } from "../types"
import { useBuilderActions } from "./useBuilderActions"

// Client-side "Run Sequence" drives each step itself via /commands/:name and
// waits for one step to settle before starting the next. In the real app the
// per-step SSE (StepRunProgress) writes the terminal status; here we emulate
// that by auto-settling whichever step is currently running. `outcomes` lets a
// test decide each step's result so we can exercise the fail-fast path.

const makeStep = (overrides: Partial<Step> = {}): Step => ({
  id: "step_1",
  alias: "",
  command: "ffmpegTranscode",
  params: {},
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
  ...overrides,
})

const setupStore = (steps: Step[]) => {
  const store = createStore()
  store.set(stepsAtom, steps)
  store.set(pathsAtom, [
    {
      id: "basePath",
      label: "basePath",
      value: "/media",
      type: "path" as const,
    },
  ])
  store.set(commandsAtom, COMMANDS)
  return store
}

const wrapper =
  (store: ReturnType<typeof setupStore>) =>
  ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  )

// Emulates StepRunProgress: the moment a step is running with a jobId, record
// it and write the caller-chosen terminal status so the serial loop advances.
const autoSettleSteps = (
  store: ReturnType<typeof setupStore>,
  outcomes: Record<string, string>,
) => {
  const runOrder: string[] = []
  const unsubscribe = store.sub(stepsAtom, () => {
    const running = flattenSteps(store.get(stepsAtom))
      .map((entry) => entry.step)
      .find(
        (step) =>
          step.status === "running" && Boolean(step.jobId),
      )
    if (!running) return
    runOrder.push(running.id)
    store.set(setStepRunStatusAtom, {
      stepId: running.id,
      status: outcomes[running.id] ?? "completed",
      jobId: running.jobId,
    })
    // StepRunProgress.handleDone also clears runningAtom on completion; the
    // serial loop relies on that to clear runOrStopStepAtom's "already
    // running" guard before it starts the next step.
    store.set(runningAtom, false)
  })
  return { runOrder, unsubscribe }
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ jobId: "job_new" }),
    }),
  )
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("useBuilderActions.runSequence — client-side serial run", () => {
  test("runs every step in order, advancing only after each completes", async () => {
    const store = setupStore([
      makeStep({ id: "step_a" }),
      makeStep({ id: "step_b" }),
      makeStep({ id: "step_c" }),
    ])
    const { runOrder, unsubscribe } = autoSettleSteps(
      store,
      {},
    )
    const { result } = renderHook(
      () => useBuilderActions(),
      { wrapper: wrapper(store) },
    )

    await result.current.runSequence()
    unsubscribe()

    expect(runOrder).toEqual(["step_a", "step_b", "step_c"])
  })

  test("clears a leftover terminal background badge from a prior server run before starting", async () => {
    const store = setupStore([makeStep({ id: "step_a" })])
    // Simulate a previous "Run on Server" that completed and was minimized
    // into the background badge — and was never dismissed.
    store.set(sequenceRunModalAtom, {
      mode: "background",
      jobId: "job-prior",
      status: "completed",
      logs: [],
      activeChildren: [],
      source: "sequence",
    })
    const { unsubscribe } = autoSettleSteps(store, {})
    const { result } = renderHook(
      () => useBuilderActions(),
      { wrapper: wrapper(store) },
    )

    await result.current.runSequence()
    unsubscribe()

    // The stale badge is gone — a fresh inline run no longer sits under a
    // confusing "Sequence completed" indicator from the old job.
    expect(store.get(sequenceRunModalAtom).mode).toBe(
      "closed",
    )
  })

  test("leaves an ACTIVE background run untouched (does not clobber a live job)", async () => {
    const store = setupStore([makeStep({ id: "step_a" })])
    store.set(runningAtom, true)
    store.set(sequenceRunModalAtom, {
      mode: "background",
      jobId: "job-live",
      status: "running",
      logs: [],
      activeChildren: [],
      source: "sequence",
    })
    const { result } = renderHook(
      () => useBuilderActions(),
      { wrapper: wrapper(store) },
    )

    // runningAtom is set, so runSequence bails immediately without touching
    // the live background job's modal state.
    await result.current.runSequence()

    const state = store.get(sequenceRunModalAtom)
    expect(state.mode).toBe("background")
    expect(
      state.mode !== "closed" ? state.status : null,
    ).toBe("running")
  })

  test("stops the sequence at the first step that does not complete", async () => {
    const store = setupStore([
      makeStep({ id: "step_a" }),
      makeStep({ id: "step_b" }),
      makeStep({ id: "step_c" }),
    ])
    const { runOrder, unsubscribe } = autoSettleSteps(
      store,
      { step_b: "failed" },
    )
    const { result } = renderHook(
      () => useBuilderActions(),
      { wrapper: wrapper(store) },
    )

    await result.current.runSequence()
    unsubscribe()

    // step_c must never start once step_b fails.
    expect(runOrder).toEqual(["step_a", "step_b"])
    expect(
      findStepById(store.get(stepsAtom), "step_c")?.status,
    ).toBeNull()
  })

  test("is a no-op when another run is already in flight", async () => {
    const store = setupStore([makeStep({ id: "step_a" })])
    store.set(runningAtom, true)
    const { result } = renderHook(
      () => useBuilderActions(),
      { wrapper: wrapper(store) },
    )

    await result.current.runSequence()

    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  })

  test("skips steps with no command selected", async () => {
    const store = setupStore([
      makeStep({ id: "step_a" }),
      makeStep({ id: "step_blank", command: "" }),
      makeStep({ id: "step_c" }),
    ])
    const { runOrder, unsubscribe } = autoSettleSteps(
      store,
      {},
    )
    const { result } = renderHook(
      () => useBuilderActions(),
      { wrapper: wrapper(store) },
    )

    await result.current.runSequence()
    unsubscribe()

    expect(runOrder).toEqual(["step_a", "step_c"])
  })
})
