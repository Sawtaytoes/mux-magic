import { createStore } from "jotai"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"
import { COMMANDS } from "../commands/commands"
import type { Step } from "../types"
import { commandsAtom } from "./commandsAtom"
import { pathsAtom } from "./pathsAtom"
import {
  runOrStopStepAtom,
  setStepRunStatusAtom,
} from "./sequenceAtoms"
import { stepsAtom } from "./stepsAtom"
import { apiRunModalAtom, runningAtom } from "./uiAtoms"

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

const makeStore = (step: Step) => {
  const store = createStore()
  store.set(stepsAtom, [step])
  store.set(pathsAtom, [
    { id: "basePath", label: "basePath", value: "/media" },
  ])
  store.set(commandsAtom, COMMANDS)
  return store
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("runOrStopStepAtom", () => {
  describe("cancel branch", () => {
    beforeEach(() => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: true }),
      )
    })

    test("DELETEs job when step is running with jobId", async () => {
      const step = makeStep({
        status: "running",
        jobId: "job_abc",
      })
      const store = makeStore(step)

      await store.set(runOrStopStepAtom, "step_1")

      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        "/jobs/job_abc",
        { method: "DELETE" },
      )
    })

    test("does not open ApiRunModal when cancelling", async () => {
      const step = makeStep({
        status: "running",
        jobId: "job_abc",
      })
      const store = makeStore(step)

      await store.set(runOrStopStepAtom, "step_1")

      expect(store.get(apiRunModalAtom)).toBeNull()
    })
  })

  describe("run branch", () => {
    beforeEach(() => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ jobId: "job_new" }),
        }),
      )
    })

    test("POSTs to /sequences/run when step is idle", async () => {
      const step = makeStep()
      const store = makeStore(step)

      await store.set(runOrStopStepAtom, "step_1")

      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        "/sequences/run",
        expect.objectContaining({ method: "POST" }),
      )
    })

    test("opens ApiRunModal with jobId from server response", async () => {
      const step = makeStep()
      const store = makeStore(step)

      await store.set(runOrStopStepAtom, "step_1")

      expect(store.get(apiRunModalAtom)).toMatchObject({
        jobId: "job_new",
        status: "running",
      })
    })

    test("does nothing when runningAtom is already true", async () => {
      const step = makeStep()
      const store = makeStore(step)
      store.set(runningAtom, true)

      await store.set(runOrStopStepAtom, "step_1")

      expect(vi.mocked(fetch)).not.toHaveBeenCalled()
    })

    test("does nothing when stepId not found", async () => {
      const step = makeStep()
      const store = makeStore(step)

      await store.set(runOrStopStepAtom, "nonexistent")

      expect(vi.mocked(fetch)).not.toHaveBeenCalled()
    })

    test("sets apiRunModal to failed when fetch throws", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(new Error("Network error")),
      )
      const step = makeStep()
      const store = makeStore(step)

      await store.set(runOrStopStepAtom, "step_1")

      expect(store.get(apiRunModalAtom)).toMatchObject({
        status: "failed",
      })
      expect(store.get(runningAtom)).toBe(false)
    })

    test("finds step inside a group", async () => {
      const innerStep = makeStep({ id: "inner_1" })
      const store = createStore()
      store.set(stepsAtom, [
        {
          kind: "group" as const,
          id: "group_1",
          label: "My group",
          isParallel: false,
          isCollapsed: false,
          steps: [innerStep],
        },
      ])
      store.set(pathsAtom, [
        { id: "basePath", label: "basePath", value: "/media" },
      ])
      store.set(commandsAtom, COMMANDS)

      await store.set(runOrStopStepAtom, "inner_1")

      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        "/sequences/run",
        expect.objectContaining({ method: "POST" }),
      )
    })
  })
})

// Verify setStepRunStatusAtom still works (regression guard after imports changed)
describe("setStepRunStatusAtom", () => {
  test("updates step status in stepsAtom", () => {
    const step = makeStep({ status: null })
    const store = makeStore(step)

    store.set(setStepRunStatusAtom, {
      stepId: "step_1",
      status: "running",
      jobId: "job_1",
    })

    const steps = store.get(stepsAtom)
    expect((steps[0] as Step).status).toBe("running")
    expect((steps[0] as Step).jobId).toBe("job_1")
  })
})
