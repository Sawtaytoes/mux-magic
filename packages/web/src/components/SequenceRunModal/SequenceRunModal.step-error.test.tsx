import type { JobLogsEvent } from "@mux-magic/server/api-types"
import { cleanup, render } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"
import { promptModalAtom } from "../../components/PromptModal/promptModalAtom"
import { stepsAtom } from "../../state/stepsAtom"
import type { Step } from "../../types"
import { SequenceRunModal } from "./SequenceRunModal"
import { sequenceRunModalAtom } from "./sequenceRunModalAtom"

// Capture the onMessage callback injected by SequenceRunModal into useTolerantEventSource
// so tests can fire SSE events synchronously without a real server.
let capturedOnMessage:
  | ((data: JobLogsEvent) => void)
  | undefined

vi.mock("../../hooks/useTolerantEventSource", () => ({
  useTolerantEventSource: vi.fn(
    ({
      onMessage,
    }: {
      onMessage: (data: JobLogsEvent) => void
    }) => {
      capturedOnMessage = onMessage
    },
  ),
}))

const makeStep = (overrides: Partial<Step> = {}): Step => ({
  id: "step-1",
  alias: "",
  command: "",
  params: {},
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
  ...overrides,
})

const renderWithStore = (
  store: ReturnType<typeof createStore>,
) => {
  render(
    <Provider store={store}>
      <SequenceRunModal />
    </Provider>,
  )
}

const openModal = (
  store: ReturnType<typeof createStore>,
  stepId: string,
) => {
  store.set(sequenceRunModalAtom, {
    mode: "open",
    jobId: "job-umbrella",
    status: "running",
    logs: [],
    activeChildren: [{ stepId, jobId: "job-child" }],
    source: "sequence",
  })
}

const fireStepFinished = (
  stepId: string,
  errorMessage: string,
) => {
  capturedOnMessage?.({
    type: "step-finished",
    childJobId: "job-child",
    stepId,
    status: "failed",
    error: errorMessage,
  })
}

afterEach(() => {
  cleanup()
  capturedOnMessage = undefined
  vi.restoreAllMocks()
})

describe("SequenceRunModal — dry-run error propagation for sequence-builder cards", () => {
  beforeEach(() => {
    capturedOnMessage = undefined
  })

  test("addSubtitles: step-finished error surfaces on the step atom", () => {
    const store = createStore()
    store.set(stepsAtom, [
      makeStep({ id: "step-1", command: "addSubtitles" }),
    ])
    openModal(store, "step-1")
    renderWithStore(store)

    fireStepFinished(
      "step-1",
      "merge-tracks dry-run failure",
    )

    const steps = store.get(stepsAtom)
    const step = steps.find(
      (item) => !("kind" in item) && item.id === "step-1",
    ) as Step | undefined
    expect(step?.error).toBe("merge-tracks dry-run failure")
  })

  test("copyFiles: step-finished error surfaces on the step atom", () => {
    const store = createStore()
    store.set(stepsAtom, [
      makeStep({ id: "step-1", command: "copyFiles" }),
    ])
    openModal(store, "step-1")
    renderWithStore(store)

    fireStepFinished("step-1", "copy-files dry-run failure")

    const steps = store.get(stepsAtom)
    const step = steps.find(
      (item) => !("kind" in item) && item.id === "step-1",
    ) as Step | undefined
    expect(step?.error).toBe("copy-files dry-run failure")
  })

  test("deleteFilesByExtension: step-finished error surfaces on the step atom", () => {
    const store = createStore()
    store.set(stepsAtom, [
      makeStep({
        id: "step-1",
        command: "deleteFilesByExtension",
      }),
    ])
    openModal(store, "step-1")
    renderWithStore(store)

    fireStepFinished(
      "step-1",
      "delete-files dry-run failure",
    )

    const steps = store.get(stepsAtom)
    const step = steps.find(
      (item) => !("kind" in item) && item.id === "step-1",
    ) as Step | undefined
    expect(step?.error).toBe("delete-files dry-run failure")
  })

  test("modifySubtitleMetadata: step-finished error surfaces on the step atom", () => {
    const store = createStore()
    store.set(stepsAtom, [
      makeStep({
        id: "step-1",
        command: "modifySubtitleMetadata",
      }),
    ])
    openModal(store, "step-1")
    renderWithStore(store)

    fireStepFinished(
      "step-1",
      "subtitle-metadata dry-run failure",
    )

    const steps = store.get(stepsAtom)
    const step = steps.find(
      (item) => !("kind" in item) && item.id === "step-1",
    ) as Step | undefined
    expect(step?.error).toBe(
      "subtitle-metadata dry-run failure",
    )
  })
})

describe("SequenceRunModal — prompt routing (umbrella SSE)", () => {
  beforeEach(() => {
    capturedOnMessage = undefined
  })

  test("a 'prompt' event on the umbrella stream sets promptModalAtom with the umbrella's jobId", () => {
    const store = createStore()
    store.set(stepsAtom, [
      makeStep({ id: "step-1", command: "addSubtitles" }),
    ])
    openModal(store, "step-1")
    renderWithStore(store)

    capturedOnMessage?.({
      type: "prompt",
      promptId: "p_xyz",
      message: "Pick a file",
      options: [{ index: -1, label: "Skip" }],
      filePath: "C:\\videos\\foo.mkv",
    })

    const promptData = store.get(promptModalAtom)
    expect(promptData).not.toBeNull()
    // Modal carries the umbrella job id; PromptModal POSTs to
    // /jobs/<umbrella>/input and the runner forwards by promptId to the
    // suspended child observable.
    expect(promptData?.jobId).toBe("job-umbrella")
    expect(promptData?.promptId).toBe("p_xyz")
    expect(promptData?.message).toBe("Pick a file")
  })

  test("clears the prompt modal when the umbrella's 'isDone' arrives (cancel mid-prompt)", () => {
    const store = createStore()
    store.set(promptModalAtom, {
      jobId: "job-umbrella",
      promptId: "stale",
      message: "Mid-prompt cancel",
      options: [{ index: -1, label: "Skip" }],
    })
    store.set(stepsAtom, [
      makeStep({ id: "step-1", command: "addSubtitles" }),
    ])
    openModal(store, "step-1")
    renderWithStore(store)

    capturedOnMessage?.({
      isDone: true,
      status: "cancelled",
    })

    expect(store.get(promptModalAtom)).toBeNull()
  })
})
