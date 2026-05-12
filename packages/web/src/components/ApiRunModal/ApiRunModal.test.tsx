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

import { apiRunModalAtom } from "../../components/ApiRunModal/apiRunModalAtom"
import { runningAtom } from "../../state/runAtoms"
import { ApiRunModal } from "./ApiRunModal"

const renderWithStore = (
  store: ReturnType<typeof createStore>,
) =>
  render(
    <Provider store={store}>
      <ApiRunModal />
    </Provider>,
  )

describe("ApiRunModal", () => {
  test("renders nothing when apiRunModalAtom is null", () => {
    const store = createStore()
    renderWithStore(store)
    expect(screen.queryByText("Run Sequence")).toBeNull()
  })

  test("renders the modal when a job is set", () => {
    const store = createStore()
    store.set(apiRunModalAtom, {
      jobId: "job-99",
      status: "running",
      logs: [],
      childJobId: null,
      childStepId: null,
      source: "sequence",
    })
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
    store.set(apiRunModalAtom, {
      jobId: "job-99",
      status: "running",
      logs: [],
      childJobId: null,
      childStepId: null,
      source: "step",
    })
    renderWithStore(store)
    expect(screen.getByText("Run Step")).toBeInTheDocument()
    expect(screen.queryByText("Run Sequence")).toBeNull()
  })

  test("shows Cancel button when status is running", () => {
    const store = createStore()
    store.set(apiRunModalAtom, {
      jobId: "job-1",
      status: "running",
      logs: [],
      childJobId: null,
      childStepId: null,
      source: "sequence",
    })
    renderWithStore(store)
    expect(
      screen.getByRole("button", { name: /cancel/i }),
    ).toBeInTheDocument()
  })

  test("hides Cancel button when status is completed", () => {
    const store = createStore()
    store.set(apiRunModalAtom, {
      jobId: "job-1",
      status: "completed",
      logs: [],
      childJobId: null,
      childStepId: null,
      source: "sequence",
    })
    renderWithStore(store)
    expect(
      screen.queryByRole("button", { name: /cancel/i }),
    ).toBeNull()
  })

  test("closes the modal when the ✕ button is clicked", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response("{}", { status: 200 }),
      )
    const store = createStore()
    store.set(apiRunModalAtom, {
      jobId: "job-2",
      status: "completed",
      logs: [],
      childJobId: null,
      childStepId: null,
      source: "sequence",
    })
    renderWithStore(store)
    await userEvent.click(screen.getByTitle("Close"))
    expect(store.get(apiRunModalAtom)).toBeNull()
    fetchSpy.mockRestore()
  })

  test("clears runningAtom when closed", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response("{}", { status: 200 }),
      )
    const store = createStore()
    store.set(runningAtom, true)
    store.set(apiRunModalAtom, {
      jobId: "job-3",
      status: "completed",
      logs: [],
      childJobId: null,
      childStepId: null,
      source: "sequence",
    })
    renderWithStore(store)
    await userEvent.click(screen.getByTitle("Close"))
    expect(store.get(runningAtom)).toBe(false)
    fetchSpy.mockRestore()
  })
})
