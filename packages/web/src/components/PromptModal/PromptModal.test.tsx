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

  test("minimizes the modal when backdrop is clicked (job stays suspended)", async () => {
    // Backdrop-click is a dismissal, not an answer — the server is
    // still waiting for input, so the prompt data must stick around
    // (isMinimized=true) so StepCard's "paused" badge can reopen it.
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
      expect(store.get(promptModalAtom)).toEqual(
        expect.objectContaining({
          jobId: "job-1",
          isMinimized: true,
        }),
      ),
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

  test("Close (job stays running) minimizes the atom without firing any fetch", async () => {
    // "Close" no longer means "wipe the prompt" — it means "hide the
    // modal but keep the prompt alive so StepCard can reopen it".
    // The fetch assertion stays: closing must NEVER answer or cancel.
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
    expect(store.get(promptModalAtom)).toEqual(
      expect.objectContaining({
        jobId: "job-close",
        isMinimized: true,
      }),
    )
    // Closing must not answer (/input) or cancel (DELETE /jobs/:id).
    // The /version probe fired by mount is a separate, idempotent
    // capability check — excluded explicitly so its presence doesn't
    // wash out the meaningful assertion.
    const answerOrCancelCalls = fetchSpy.mock.calls.filter(
      ([url]) =>
        typeof url === "string" &&
        (url.includes("/input") || url.includes("/jobs/")),
    )
    expect(answerOrCancelCalls).toEqual([])
  })

  test("Escape minimizes the modal without submitting or DELETEing", async () => {
    // Escape is the universal "I'm not ready to answer yet" dismissal.
    // Same minimization contract as the backdrop click and Close button:
    // the prompt stays in the atom so the user can reopen it from
    // StepCard, and no fetch fires.
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
    expect(store.get(promptModalAtom)).toEqual(
      expect.objectContaining({
        jobId: "job-esc",
        isMinimized: true,
      }),
    )
    // Same intent-filter as the Close test: ignore the mount-time
    // /version probe, just assert no answer/cancel call leaked out.
    const answerOrCancelCalls = fetchSpy.mock.calls.filter(
      ([url]) =>
        typeof url === "string" &&
        (url.includes("/input") || url.includes("/jobs/")),
    )
    expect(answerOrCancelCalls).toEqual([])
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
    // The suppression assertion is "no DELETE leaked through to the
    // jobs API" — the mount-time /version probe is unrelated.
    const cancelCalls = fetchSpy.mock.calls.filter(
      ([url, init]) =>
        typeof url === "string" &&
        url.includes("/jobs/") &&
        (init as RequestInit | undefined)?.method ===
          "DELETE",
    )
    expect(cancelCalls).toEqual([])
  })
})
