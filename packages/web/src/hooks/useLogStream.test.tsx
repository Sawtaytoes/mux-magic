import { act, renderHook } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import type { ReactNode } from "react"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"
import { promptModalAtom } from "../components/PromptModal/promptModalAtom"
import { useLogStream } from "./useLogStream"

// Minimal EventSource stub: tests fire events synchronously through
// the captured onmessage handler instead of running a real SSE server.
type StubbedEventSource = {
  url: string
  readyState: number
  onmessage: ((event: MessageEvent) => void) | null
  onerror: (() => void) | null
  close: () => void
}

let lastEventSource: StubbedEventSource | null = null

const fireMessage = (data: unknown) => {
  lastEventSource?.onmessage?.({
    data: JSON.stringify(data),
    lastEventId: "",
  } as MessageEvent)
}

beforeEach(() => {
  lastEventSource = null
  vi.stubGlobal(
    "EventSource",
    class implements StubbedEventSource {
      static CLOSED = 2
      url: string
      readyState = 1
      onmessage: ((event: MessageEvent) => void) | null =
        null
      onerror: (() => void) | null = null
      constructor(url: string) {
        this.url = url
        lastEventSource = this
      }
      close() {
        this.readyState = 2
      }
    },
  )
})

afterEach(() => {
  vi.restoreAllMocks()
})

const wrapWithStore =
  (store: ReturnType<typeof createStore>) =>
  ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  )

describe("useLogStream — prompt routing", () => {
  test("sets promptModalAtom when a 'prompt' SSE event arrives", () => {
    const store = createStore()
    const { result } = renderHook(
      () => useLogStream("job_abc"),
      { wrapper: wrapWithStore(store) },
    )

    act(() => {
      result.current.connect()
    })

    act(() => {
      fireMessage({
        type: "prompt",
        promptId: "p_1",
        message: "Pick a category",
        options: [
          { index: 0, label: "featurette" },
          { index: -1, label: "Skip" },
        ],
        filePath: "C:\\videos\\t17.mkv",
      })
    })

    const promptData = store.get(promptModalAtom)
    expect(promptData).not.toBeNull()
    expect(promptData?.jobId).toBe("job_abc")
    expect(promptData?.promptId).toBe("p_1")
    expect(promptData?.message).toBe("Pick a category")
    expect(promptData?.options).toEqual([
      { index: 0, label: "featurette" },
      { index: -1, label: "Skip" },
    ])
    expect(promptData?.filePath).toBe("C:\\videos\\t17.mkv")
  })

  test("clears promptModalAtom when this job's 'isDone' arrives (modal must not survive cancel/complete)", () => {
    const store = createStore()
    store.set(promptModalAtom, {
      jobId: "job_abc",
      promptId: "p_open",
      message: "Still waiting",
      options: [{ index: -1, label: "Skip" }],
    })
    const { result } = renderHook(
      () => useLogStream("job_abc"),
      { wrapper: wrapWithStore(store) },
    )

    act(() => {
      result.current.connect()
    })

    act(() => {
      fireMessage({ isDone: true, status: "cancelled" })
    })

    expect(store.get(promptModalAtom)).toBeNull()
  })

  test("does NOT clear promptModalAtom when 'isDone' arrives for a DIFFERENT job", () => {
    const store = createStore()
    const otherJobsPrompt = {
      jobId: "job_other",
      promptId: "p_other",
      message: "Other job's prompt",
      options: [{ index: -1, label: "Skip" }],
    }
    store.set(promptModalAtom, otherJobsPrompt)
    const { result } = renderHook(
      () => useLogStream("job_abc"),
      { wrapper: wrapWithStore(store) },
    )

    act(() => {
      result.current.connect()
    })

    act(() => {
      fireMessage({ isDone: true, status: "completed" })
    })

    expect(store.get(promptModalAtom)).toEqual(
      otherJobsPrompt,
    )
  })
})
