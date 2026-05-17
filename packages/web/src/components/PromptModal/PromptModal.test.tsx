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

import { apiBase } from "../../apiBase"
import { promptModalAtom } from "../../components/PromptModal/promptModalAtom"
import { videoPreviewModalAtom } from "../../components/VideoPreviewModal/videoPreviewModalAtom"
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

  test("renders the prompt message, paused banner, and options when atom is set", () => {
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
      screen.getByText(/pipeline is paused/i),
    ).toBeInTheDocument()
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
      `${apiBase}/jobs/job-42/input`,
      expect.objectContaining({ method: "POST" }),
    )
  })

  test("top-level Play button sets the videoPreview atom (not window.openVideoModal)", async () => {
    const user = userEvent.setup()
    const store = createStore()
    store.set(promptModalAtom, {
      jobId: "job-play",
      promptId: "p-play",
      message: "Pick a file",
      filePath: "/movies/Demo.mkv",
      options: [{ index: 1, label: "Option A" }],
    })
    renderWithStore(store)
    await user.click(
      screen.getByRole("button", { name: /▶ Play/ }),
    )
    expect(store.get(videoPreviewModalAtom)).toEqual({
      path: "/movies/Demo.mkv",
    })
  })

  test("per-row Play button sets the videoPreview atom without picking the option", async () => {
    const user = userEvent.setup()
    const store = createStore()
    store.set(promptModalAtom, {
      jobId: "job-row",
      promptId: "p-row",
      message: "Pick a file",
      filePaths: [{ index: 1, path: "/movies/Movie.mkv" }],
      options: [{ index: 1, label: "Main feature" }],
    })
    renderWithStore(store)
    const playButtons = screen.getAllByRole("button", {
      name: /▶ Play/,
    })
    await user.click(playButtons[0])
    expect(store.get(videoPreviewModalAtom)).toEqual({
      path: "/movies/Movie.mkv",
    })
    // The prompt itself is NOT submitted by clicking Play.
    expect(store.get(promptModalAtom)).not.toBeNull()
  })

  test("Cancel job button fires DELETE /jobs/:id and clears the prompt atom", async () => {
    const user = userEvent.setup()
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("", { status: 202 }))
    const store = createStore()
    store.set(promptModalAtom, {
      jobId: "job-cancel",
      promptId: "p-cancel",
      message: "Pick one",
      options: [{ index: 1, label: "Option A" }],
    })
    renderWithStore(store)
    await user.click(
      screen.getByRole("button", { name: /Cancel job/ }),
    )
    expect(fetchSpy).toHaveBeenCalledWith(
      `${apiBase}/jobs/job-cancel`,
      expect.objectContaining({ method: "DELETE" }),
    )
    expect(store.get(promptModalAtom)).toBeNull()
  })

  test("Close (job stays running) clears the atom without firing any fetch", async () => {
    const user = userEvent.setup()
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const store = createStore()
    store.set(promptModalAtom, {
      jobId: "job-close",
      promptId: "p-close",
      message: "Pick one",
      options: [{ index: 1, label: "Option A" }],
    })
    renderWithStore(store)
    await user.click(
      screen.getByRole("button", {
        name: /Close \(job stays running\)/,
      }),
    )
    expect(store.get(promptModalAtom)).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  test("Escape closes the modal without submitting or DELETEing", async () => {
    const user = userEvent.setup()
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const store = createStore()
    store.set(promptModalAtom, {
      jobId: "job-esc",
      promptId: "p-esc",
      message: "Pick one",
      options: [
        { index: 1, label: "Option A" },
        { index: -1, label: "Skip" },
        { index: -2, label: "Cancel step" },
      ],
    })
    renderWithStore(store)
    await user.keyboard("{Escape}")
    expect(store.get(promptModalAtom)).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  test("Ctrl+C fires Cancel job (DELETE) and clears the atom", async () => {
    const user = userEvent.setup()
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("", { status: 202 }))
    const store = createStore()
    store.set(promptModalAtom, {
      jobId: "job-ctrlc",
      promptId: "p-ctrlc",
      message: "Pick one",
      options: [{ index: 1, label: "Option A" }],
    })
    renderWithStore(store)
    await user.keyboard("{Control>}c{/Control}")
    await waitFor(() =>
      expect(store.get(promptModalAtom)).toBeNull(),
    )
    expect(fetchSpy).toHaveBeenCalledWith(
      `${apiBase}/jobs/job-ctrlc`,
      expect.objectContaining({ method: "DELETE" }),
    )
  })

  test("Ctrl+C is suppressed when there is an active text selection (user can copy)", async () => {
    const user = userEvent.setup()
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    vi.spyOn(window, "getSelection").mockReturnValue({
      toString: () => "some selected text",
    } as Selection)
    const store = createStore()
    store.set(promptModalAtom, {
      jobId: "job-sel",
      promptId: "p-sel",
      message: "Pick one",
      options: [{ index: 1, label: "Option A" }],
    })
    renderWithStore(store)
    await user.keyboard("{Control>}c{/Control}")
    expect(store.get(promptModalAtom)).not.toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
