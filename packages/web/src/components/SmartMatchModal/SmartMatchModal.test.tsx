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
import { SmartMatchModal } from "./SmartMatchModal"
import { smartMatchModalAtom } from "./smartMatchModalAtom"

const renderWithStore = (
  store: ReturnType<typeof createStore>,
) =>
  render(
    <Provider store={store}>
      <SmartMatchModal />
    </Provider>,
  )

// Worker 25: the modal now consumes pre-ranked `FileSuggestion[]`
// straight from the server payload — confidence values are realistic
// stand-ins for what `rankCandidatesForFile` would produce for these
// inputs (Theatrical Cut at duration 5400 ≈ 0.7; the filename-only
// MOVIE_t99 row falls below LOW_CONFIDENCE_THRESHOLD).
const mixedPayload = {
  jobId: "job-1",
  stepId: "step-1",
  sourcePath: "/movies/Demo",
  suggestions: [
    {
      filename: "BONUS_1",
      extension: ".mkv",
      durationSeconds: 5400,
      rankedCandidates: [
        {
          candidate: {
            name: "Theatrical Cut",
            timecode: "1:30:00",
          },
          confidence: 0.7,
          durationScore: 1,
          filenameScore: 0,
        },
        {
          candidate: {
            name: "Image Gallery",
            timecode: undefined,
          },
          confidence: 0,
          durationScore: Number.NaN,
          filenameScore: 0,
        },
      ],
    },
    {
      filename: "MOVIE_t99",
      extension: ".mkv",
      durationSeconds: 30,
      rankedCandidates: [
        {
          candidate: {
            name: "Image Gallery",
            timecode: undefined,
          },
          confidence: 0,
          durationScore: Number.NaN,
          filenameScore: 0,
        },
        {
          candidate: {
            name: "Theatrical Cut",
            timecode: "1:30:00",
          },
          confidence: 0,
          durationScore: 0,
          filenameScore: 0,
        },
      ],
    },
  ],
}

describe("SmartMatchModal", () => {
  test("renders nothing when smartMatchModalAtom is null", () => {
    const store = createStore()
    renderWithStore(store)
    expect(
      document.getElementById("smart-match-modal"),
    ).toBeNull()
  })

  test("renders one row per unrenamed file", () => {
    const store = createStore()
    store.set(smartMatchModalAtom, mixedPayload)
    renderWithStore(store)
    expect(
      screen.getByRole("dialog", {
        name: /Smart Match — Fix Unnamed/,
      }),
    ).toBeInTheDocument()
    expect(
      document.querySelector(
        '[data-smart-match-row="BONUS_1"]',
      ),
    ).not.toBeNull()
    expect(
      document.querySelector(
        '[data-smart-match-row="MOVIE_t99"]',
      ),
    ).not.toBeNull()
  })

  test("checks high-confidence rows by default and leaves low-confidence rows unchecked", () => {
    const store = createStore()
    store.set(smartMatchModalAtom, mixedPayload)
    renderWithStore(store)
    // BONUS_1 matches Theatrical Cut exactly on duration → high confidence.
    const includeBonus1 = screen.getByLabelText(
      "Include BONUS_1",
    ) as HTMLInputElement
    // MOVIE_t99 only has a filename-fuzz path, multiplied by FILENAME_ONLY_SCORE_FACTOR → low confidence.
    const includeMovieT99 = screen.getByLabelText(
      "Include MOVIE_t99",
    ) as HTMLInputElement
    expect(includeBonus1.checked).toBe(true)
    expect(includeMovieT99.checked).toBe(false)
  })

  test("Apply fires one POST /files/rename per included row", async () => {
    const user = userEvent.setup()
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ isOk: true }), {
          status: 200,
        }),
      )
    const store = createStore()
    store.set(smartMatchModalAtom, mixedPayload)
    renderWithStore(store)
    await user.click(
      screen.getByRole("button", { name: /Apply/ }),
    )
    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledTimes(1),
    )
    expect(fetchSpy).toHaveBeenCalledWith(
      `${apiBase}/files/rename`,
      expect.objectContaining({ method: "POST" }),
    )
  })

  test("when every included row renames successfully, the modal closes", async () => {
    const user = userEvent.setup()
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ isOk: true }), {
        status: 200,
      }),
    )
    const store = createStore()
    store.set(smartMatchModalAtom, mixedPayload)
    renderWithStore(store)
    await user.click(
      screen.getByRole("button", { name: /Apply/ }),
    )
    await waitFor(() =>
      expect(store.get(smartMatchModalAtom)).toBeNull(),
    )
  })

  test("a failed rename keeps the row visible with the error inline", async () => {
    const user = userEvent.setup()
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          isOk: false,
          error: "Target name already exists",
        }),
        { status: 409 },
      ),
    )
    const store = createStore()
    store.set(smartMatchModalAtom, mixedPayload)
    renderWithStore(store)
    await user.click(
      screen.getByRole("button", { name: /Apply/ }),
    )
    expect(
      await screen.findByText(/Target name already exists/),
    ).toBeInTheDocument()
    // Modal stays open because the failed row prevents auto-close.
    expect(store.get(smartMatchModalAtom)).not.toBeNull()
  })

  test("empty-state renders a focused message when no unrenamed files are passed", () => {
    const store = createStore()
    store.set(smartMatchModalAtom, {
      jobId: "job-2",
      stepId: "step-2",
      sourcePath: "/movies/Demo",
      suggestions: [],
    })
    renderWithStore(store)
    expect(
      screen.getByText(/No unnamed files/i),
    ).toBeInTheDocument()
  })

  test("Close button clears the atom", async () => {
    const user = userEvent.setup()
    const store = createStore()
    store.set(smartMatchModalAtom, mixedPayload)
    renderWithStore(store)
    const closeButtons = screen.getAllByRole("button", {
      name: /Close/,
    })
    await user.click(closeButtons[0])
    expect(store.get(smartMatchModalAtom)).toBeNull()
  })
})
