import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createStore, Provider } from "jotai"
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

import { sequenceRunModalAtom } from "../../components/SequenceRunModal/sequenceRunModalAtom"
import { runningAtom } from "../../state/runAtoms"
import { SequenceRunModal } from "./SequenceRunModal"

const renderWithStore = (
  store: ReturnType<typeof createStore>,
) =>
  render(
    <Provider store={store}>
      <SequenceRunModal />
    </Provider>,
  )

const openState = {
  mode: "open" as const,
  jobId: "job-99",
  status: "running" as const,
  logs: [],
  activeChildren: [],
  source: "sequence" as const,
}

describe("SequenceRunModal", () => {
  test("renders nothing when mode is closed", () => {
    const store = createStore()
    renderWithStore(store)
    expect(screen.queryByText("Run Sequence")).toBeNull()
  })

  test("renders the modal when mode is open", () => {
    const store = createStore()
    store.set(sequenceRunModalAtom, openState)
    renderWithStore(store)
    expect(
      screen.getByText("Run Sequence"),
    ).toBeInTheDocument()
    expect(
      screen.getByText("job job-99"),
    ).toBeInTheDocument()
    expect(screen.getByText("running")).toBeInTheDocument()
  })

  test("renders 'Run Step' title when source is step", () => {
    const store = createStore()
    store.set(sequenceRunModalAtom, {
      ...openState,
      source: "step",
    })
    renderWithStore(store)
    expect(
      screen.getByText("Run Step"),
    ).toBeInTheDocument()
    expect(screen.queryByText("Run Sequence")).toBeNull()
  })

  test("shows Cancel button when status is running", () => {
    const store = createStore()
    store.set(sequenceRunModalAtom, openState)
    renderWithStore(store)
    expect(
      screen.getByRole("button", { name: /cancel/i }),
    ).toBeInTheDocument()
  })

  test("hides Cancel button when status is completed", () => {
    const store = createStore()
    store.set(sequenceRunModalAtom, {
      ...openState,
      status: "completed",
    })
    renderWithStore(store)
    expect(
      screen.queryByRole("button", { name: /cancel/i }),
    ).toBeNull()
  })

  // ─── TDD step 1: Run in background button ──────────────────────────────────

  test("'Run in background' button sets mode to background without cancelling", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 }),
    )
    const store = createStore()
    store.set(sequenceRunModalAtom, openState)
    renderWithStore(store)

    await userEvent.click(
      screen.getByRole("button", {
        name: /run in background/i,
      }),
    )

    const state = store.get(sequenceRunModalAtom)
    expect(state.mode).toBe("background")
    if (state.mode === "background") {
      expect(state.jobId).toBe("job-99")
    }
    // Must NOT have called DELETE
    expect(globalThis.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/jobs/"),
      expect.objectContaining({ method: "DELETE" }),
    )
  })

  // ─── TDD step 2: Backdrop click backgrounds (does NOT cancel) ──────────────

  test("clicking the backdrop sets mode to background without cancelling", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 }),
    )
    const store = createStore()
    store.set(sequenceRunModalAtom, openState)
    renderWithStore(store)

    const backdrop = document.querySelector(
      '[role="none"]',
    ) as HTMLElement
    expect(backdrop).not.toBeNull()
    await userEvent.click(backdrop)

    const state = store.get(sequenceRunModalAtom)
    expect(state.mode).toBe("background")
    expect(globalThis.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/jobs/"),
      expect.objectContaining({ method: "DELETE" }),
    )
  })

  // ─── TDD step 3: Cancel button calls server DELETE ──────────────────────────

  test("Cancel button calls DELETE on the job and closes modal", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }))
    const store = createStore()
    store.set(sequenceRunModalAtom, openState)
    renderWithStore(store)

    await userEvent.click(
      screen.getByRole("button", { name: /cancel/i }),
    )

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/jobs/job-99"),
      expect.objectContaining({ method: "DELETE" }),
    )
    expect(store.get(sequenceRunModalAtom).mode).toBe(
      "closed",
    )
  })

  // ─── ✕ close button now backgrounds instead of cancelling ──────────────────

  test("✕ button sets mode to background (does NOT cancel)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 }),
    )
    const store = createStore()
    store.set(sequenceRunModalAtom, openState)
    renderWithStore(store)

    await userEvent.click(screen.getByTitle("Close"))

    const state = store.get(sequenceRunModalAtom)
    expect(state.mode).toBe("background")
    expect(globalThis.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/jobs/"),
      expect.objectContaining({ method: "DELETE" }),
    )
  })

  test("clears runningAtom when Cancel is clicked", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 }),
    )
    const store = createStore()
    store.set(runningAtom, true)
    store.set(sequenceRunModalAtom, openState)
    renderWithStore(store)

    await userEvent.click(
      screen.getByRole("button", { name: /cancel/i }),
    )

    expect(store.get(runningAtom)).toBe(false)
  })
})

// ─── PageHeader background badge tests (via sequenceRunModalAtom) ─────────────

import { PageHeader } from "../PageHeader/PageHeader"

const renderHeaderWithStore = (
  store: ReturnType<typeof createStore>,
) =>
  render(
    <Provider store={store}>
      <PageHeader />
    </Provider>,
  )

describe("PageHeader background badge", () => {
  test("shows no badge when no background job", () => {
    const store = createStore()
    renderHeaderWithStore(store)
    expect(
      screen.queryByRole("button", {
        name: /background job/i,
      }),
    ).toBeNull()
  })

  test("shows '1 background job' badge when a job is backgrounded", () => {
    const store = createStore()
    store.set(sequenceRunModalAtom, {
      mode: "background",
      jobId: "job-bg-1",
      status: "running",
      logs: [],
      activeChildren: [],
      source: "sequence",
    })
    renderHeaderWithStore(store)
    expect(
      screen.getByRole("button", {
        name: /1 background job/i,
      }),
    ).toBeInTheDocument()
  })

  test("clicking the badge re-opens the modal", async () => {
    const store = createStore()
    store.set(sequenceRunModalAtom, {
      mode: "background",
      jobId: "job-bg-1",
      status: "running",
      logs: [],
      activeChildren: [],
      source: "sequence",
    })
    renderHeaderWithStore(store)

    await userEvent.click(
      screen.getByRole("button", {
        name: /1 background job/i,
      }),
    )

    expect(store.get(sequenceRunModalAtom).mode).toBe("open")
  })
})
