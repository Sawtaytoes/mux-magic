import {
  cleanup,
  render,
  screen,
  waitFor,
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

import { promptModalAtom } from "../../components/PromptModal/promptModalAtom"
import { PromptModal } from "./PromptModal"

const renderWithStore = (
  store: ReturnType<typeof createStore>,
) =>
  render(
    <Provider store={store}>
      <PromptModal />
    </Provider>,
  )

describe("PromptModal", () => {
  test("renders nothing when promptModalAtom is null", () => {
    const store = createStore()
    renderWithStore(store)
    expect(screen.queryByText(/pick/i)).toBeNull()
  })

  test("renders the prompt message and options when atom is set", () => {
    const store = createStore()
    store.set(promptModalAtom, {
      jobId: "job-1",
      promptId: "p-1",
      message: "Which file should we use?",
      options: [
        { index: 1, label: "File A" },
        { index: 2, label: "File B" },
        { index: -1, label: "Skip" },
      ],
    })
    renderWithStore(store)
    expect(
      screen.getByRole("button", { name: /File A/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /Skip/ }),
    ).toBeInTheDocument()
  })

  test("closes the modal when backdrop is clicked", async () => {
    const user = userEvent.setup()
    const store = createStore()
    store.set(promptModalAtom, {
      jobId: "job-1",
      promptId: "p-1",
      message: "Pick one",
      options: [{ index: 1, label: "Option A" }],
    })
    renderWithStore(store)
    await user.click(
      screen.getByRole("dialog")
        .parentElement as HTMLElement,
    )
    await waitFor(() =>
      expect(store.get(promptModalAtom)).toBeNull(),
    )
  })

  test("submits and closes when an option is clicked", async () => {
    const user = userEvent.setup()
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response("{}", { status: 200 }),
      )
    const store = createStore()
    store.set(promptModalAtom, {
      jobId: "job-42",
      promptId: "p-42",
      message: "Pick one",
      options: [{ index: 1, label: "Option A" }],
    })
    renderWithStore(store)
    await user.click(
      screen.getByRole("button", { name: /Option A/ }),
    )
    expect(store.get(promptModalAtom)).toBeNull()
    expect(fetchSpy).toHaveBeenCalledWith(
      "/jobs/job-42/input",
      expect.objectContaining({ method: "POST" }),
    )
    fetchSpy.mockRestore()
  })
})
