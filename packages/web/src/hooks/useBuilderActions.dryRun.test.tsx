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
import { commandsAtom } from "../state/commandsAtom"
import { pathsAtom } from "../state/pathsAtom"
import { stepsAtom } from "../state/stepsAtom"
import {
  dryRunAtom,
  failureModeAtom,
} from "../state/uiAtoms"
import type { Group, Step } from "../types"
import { useBuilderActions } from "./useBuilderActions"

// ─── P0 regression guard: dry-run query forwarding ───────────────────────────
//
// Every fetch path that triggers REAL command execution on the server
// must forward the client's dry-run state via `?fake=...` in the URL.
// Without this, the user can toggle the DRY RUN badge in the UI, click
// Run Sequence / Run Group, and the server still deletes real files
// via deleteFolder. These tests fail if any future change drops the
// dry-run forwarding from useBuilderActions.

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

const makeGroup = (
  overrides: Partial<Group> = {},
): Group => ({
  kind: "group",
  id: "group_1",
  label: "My group",
  isParallel: false,
  isCollapsed: false,
  steps: [makeStep()],
  ...overrides,
})

const setupStore = () => {
  const store = createStore()
  store.set(stepsAtom, [makeStep()])
  store.set(pathsAtom, [
    { id: "basePath", label: "basePath", value: "/media" },
  ])
  store.set(commandsAtom, COMMANDS)
  return store
}

const wrapper =
  (store: ReturnType<typeof setupStore>) =>
  ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  )

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

describe("useBuilderActions.runViaApi — dry-run forwarding", () => {
  test("posts to /sequences/run with NO fake query when dryRun is off", async () => {
    const store = setupStore()
    store.set(dryRunAtom, false)
    store.set(failureModeAtom, false)
    const { result } = renderHook(
      () => useBuilderActions(),
      {
        wrapper: wrapper(store),
      },
    )

    await result.current.runViaApi()

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "/sequences/run",
      expect.objectContaining({ method: "POST" }),
    )
  })

  test("posts to /sequences/run?fake=success when dryRun is on, failureMode off", async () => {
    const store = setupStore()
    store.set(dryRunAtom, true)
    store.set(failureModeAtom, false)
    const { result } = renderHook(
      () => useBuilderActions(),
      {
        wrapper: wrapper(store),
      },
    )

    await result.current.runViaApi()

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "/sequences/run?fake=success",
      expect.objectContaining({ method: "POST" }),
    )
  })

  test("posts to /sequences/run?fake=failure when dryRun AND failureMode are both on", async () => {
    const store = setupStore()
    store.set(dryRunAtom, true)
    store.set(failureModeAtom, true)
    const { result } = renderHook(
      () => useBuilderActions(),
      {
        wrapper: wrapper(store),
      },
    )

    await result.current.runViaApi()

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "/sequences/run?fake=failure",
      expect.objectContaining({ method: "POST" }),
    )
  })

  test("defensive: failureMode WITHOUT dryRun does not silently fake the call", async () => {
    const store = setupStore()
    store.set(dryRunAtom, false)
    store.set(failureModeAtom, true)
    const { result } = renderHook(
      () => useBuilderActions(),
      {
        wrapper: wrapper(store),
      },
    )

    await result.current.runViaApi()

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "/sequences/run",
      expect.objectContaining({ method: "POST" }),
    )
  })
})

describe("useBuilderActions.runGroup — dry-run forwarding", () => {
  const setupStoreWithGroup = () => {
    const store = createStore()
    store.set(stepsAtom, [makeGroup()])
    store.set(pathsAtom, [
      {
        id: "basePath",
        label: "basePath",
        value: "/media",
      },
    ])
    store.set(commandsAtom, COMMANDS)
    return store
  }

  test("posts to /sequences/run with NO fake query when dryRun is off", async () => {
    const store = setupStoreWithGroup()
    store.set(dryRunAtom, false)
    store.set(failureModeAtom, false)
    const { result } = renderHook(
      () => useBuilderActions(),
      {
        wrapper: wrapper(store),
      },
    )

    await result.current.runGroup("group_1")

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "/sequences/run",
      expect.objectContaining({ method: "POST" }),
    )
  })

  test("posts to /sequences/run?fake=success when dryRun is on, failureMode off", async () => {
    const store = setupStoreWithGroup()
    store.set(dryRunAtom, true)
    store.set(failureModeAtom, false)
    const { result } = renderHook(
      () => useBuilderActions(),
      {
        wrapper: wrapper(store),
      },
    )

    await result.current.runGroup("group_1")

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "/sequences/run?fake=success",
      expect.objectContaining({ method: "POST" }),
    )
  })

  test("posts to /sequences/run?fake=failure when dryRun AND failureMode are both on", async () => {
    const store = setupStoreWithGroup()
    store.set(dryRunAtom, true)
    store.set(failureModeAtom, true)
    const { result } = renderHook(
      () => useBuilderActions(),
      {
        wrapper: wrapper(store),
      },
    )

    await result.current.runGroup("group_1")

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "/sequences/run?fake=failure",
      expect.objectContaining({ method: "POST" }),
    )
  })
})
