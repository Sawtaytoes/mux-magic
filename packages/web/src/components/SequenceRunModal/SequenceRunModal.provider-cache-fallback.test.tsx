import type {
  JobLogsEvent,
  ProviderCacheFallback,
} from "@mux-magic/api/api-types"
import {
  act,
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import { createStore, Provider } from "jotai"
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"
import { SequenceRunModal } from "./SequenceRunModal"
import { sequenceRunModalAtom } from "./sequenceRunModalAtom"

// Capture the onMessage callback SequenceRunModal hands to
// useTolerantEventSource, so a test can deliver SSE events itself.
const captured: {
  onMessage?: (data: JobLogsEvent) => void
} = {}

vi.mock("../../hooks/useTolerantEventSource", () => ({
  useTolerantEventSource: vi.fn(
    ({
      onMessage,
    }: {
      onMessage: (data: JobLogsEvent) => void
    }) => {
      captured.onMessage = onMessage
    },
  ),
}))

afterEach(() => {
  cleanup()
  captured.onMessage = undefined
  vi.restoreAllMocks()
})

const FALLBACK: ProviderCacheFallback = {
  ageMilliseconds: 3 * 24 * 60 * 60 * 1000,
  cachedAt: "2026-09-26T12:00:00.000Z",
  cause: "fetch failed",
  isProviderSkipped: false,
  provider: "dvdCompare",
  request:
    "https://www.dvdcompare.net/comparisons/film.php?fid=12345",
}

const renderOpenModal = ({ jobId }: { jobId: string }) => {
  const store = createStore()
  store.set(sequenceRunModalAtom, {
    activeChildren: [],
    jobId,
    logs: [],
    mode: "open",
    source: "sequence",
    status: "running",
  })
  render(
    <Provider store={store}>
      <SequenceRunModal />
    </Provider>,
  )
  return store
}

const deliver = (event: JobLogsEvent) => {
  act(() => {
    captured.onMessage?.(event)
  })
}

describe("SequenceRunModal — cached provider data", () => {
  test("shows no notice while no fallback has arrived", () => {
    renderOpenModal({ jobId: "job-1" })

    expect(
      screen.queryByRole("region", {
        name: "Cached provider data",
      }),
    ).toBeNull()
  })

  test("shows the notice when a fallback event arrives", () => {
    renderOpenModal({ jobId: "job-1" })

    deliver({
      fallback: FALLBACK,
      index: 0,
      type: "provider-cache-fallback",
    })

    expect(
      screen.getByRole("region", {
        name: "Cached provider data",
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /^DVDCompare: https:\/\/www\.dvdcompare\.net/,
      ),
    ).toBeInTheDocument()
  })

  test("a replayed event after a reconnect does not add a second line", () => {
    renderOpenModal({ jobId: "job-1" })

    deliver({
      fallback: FALLBACK,
      index: 0,
      type: "provider-cache-fallback",
    })
    deliver({
      fallback: FALLBACK,
      index: 0,
      type: "provider-cache-fallback",
    })

    expect(screen.getAllByRole("listitem")).toHaveLength(1)
  })

  test("the done frame's list is the final word", () => {
    renderOpenModal({ jobId: "job-1" })

    deliver({
      isDone: true,
      providerCacheFallbacks: [
        FALLBACK,
        { ...FALLBACK, isProviderSkipped: true },
      ],
      status: "completed",
    })

    expect(screen.getAllByRole("listitem")).toHaveLength(2)
  })

  test("a new job starts with no notice", () => {
    const store = renderOpenModal({ jobId: "job-1" })
    deliver({
      fallback: FALLBACK,
      index: 0,
      type: "provider-cache-fallback",
    })

    act(() => {
      store.set(sequenceRunModalAtom, {
        activeChildren: [],
        jobId: "job-2",
        logs: [],
        mode: "open",
        source: "sequence",
        status: "running",
      })
    })

    expect(
      screen.queryByRole("region", {
        name: "Cached provider data",
      }),
    ).toBeNull()
  })
})
