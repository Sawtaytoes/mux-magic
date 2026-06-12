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

  test("Apply fires one POST /files/rename per included row with oldPath under UNNAMED-FEATURES/ (worker 25)", async () => {
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
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe(`${apiBase}/files/rename`)
    const body = JSON.parse(
      (init as RequestInit).body as string,
    ) as { oldPath: string; newPath: string }
    // Worker 25: oldPath points into the UNNAMED-FEATURES/ bucket; the
    // /files/rename route handles cross-folder fs.rename, so the file
    // moves back to sourcePath under its new name in one call.
    expect(body.oldPath).toBe(
      "/movies/Demo/UNNAMED-FEATURES/BONUS_1.mkv",
    )
    expect(body.newPath).toBe(
      "/movies/Demo/Theatrical Cut.mkv",
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

  test("Apply pre-flight detects cross-row target collisions and halts with inline warnings (worker 25)", async () => {
    const user = userEvent.setup()
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ isOk: true }), {
          status: 200,
        }),
      )
    // Two rows where both top candidates are the same high-confidence
    // pick — by default both auto-check AND both produce the same
    // newPath, so Apply should halt with inline collision warnings
    // rather than firing any rename POSTs.
    const collisionPayload = {
      jobId: "job-collide",
      stepId: "step-1",
      sourcePath: "/movies/Demo",
      suggestions: [
        {
          filename: "BONUS_a",
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
          ],
        },
        {
          filename: "BONUS_b",
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
          ],
        },
      ],
    }
    const store = createStore()
    store.set(smartMatchModalAtom, collisionPayload)
    renderWithStore(store)
    await user.click(
      screen.getByRole("button", { name: /Apply/ }),
    )
    // No POSTs fired — the pre-flight check halted Apply.
    expect(fetchSpy).not.toHaveBeenCalled()
    // Both rows surface an inline collision warning naming the other row.
    const collisionLines = document.querySelectorAll(
      "[data-smart-match-collision]",
    )
    expect(collisionLines).toHaveLength(2)
    // Unchecking BONUS_b resolves the collision; Apply now proceeds.
    await user.click(
      screen.getByLabelText("Include BONUS_b"),
    )
    await user.click(
      screen.getByRole("button", { name: /Apply/ }),
    )
    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledTimes(1),
    )
  })

  test("toggling ✏ swaps the picker for a text input; typed name is the one POSTed on apply (worker 6f)", async () => {
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
    // BONUS_1 defaults to picker (Theatrical Cut). Clicking ✏
    // should reveal a custom input and let the user type a name
    // that wins on apply even though candidates exist.
    const editToggle = document.querySelector(
      '[data-smart-match-edit-toggle="BONUS_1"]',
    ) as HTMLButtonElement
    expect(editToggle).not.toBeNull()
    await user.click(editToggle)
    const customInput = (await screen.findByLabelText(
      "Custom rename target for BONUS_1",
    )) as HTMLInputElement
    expect(customInput).toBeVisible()
    // Entering ✏ for the first time seeds the input from the picker
    // selection so the user can hand-edit (e.g. strip a typo) rather
    // than retype the whole name.
    expect(customInput.value).toBe("Theatrical Cut")
    await user.clear(customInput)
    await user.type(
      customInput,
      "Director's Commentary -other",
    )
    await user.click(
      screen.getByRole("button", { name: /Apply/ }),
    )
    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledTimes(1),
    )
    const [, init] = fetchSpy.mock.calls[0]
    const body = JSON.parse(
      (init as RequestInit).body as string,
    ) as { oldPath: string; newPath: string }
    expect(body.newPath).toBe(
      "/movies/Demo/Director's Commentary -other.mkv",
    )
  })

  test("toggling ✏ off retains the typed value for the next toggle (worker 6f hybrid retention)", async () => {
    const user = userEvent.setup()
    const store = createStore()
    store.set(smartMatchModalAtom, mixedPayload)
    renderWithStore(store)
    const editToggle = document.querySelector(
      '[data-smart-match-edit-toggle="BONUS_1"]',
    ) as HTMLButtonElement
    await user.click(editToggle)
    const customInput = (await screen.findByLabelText(
      "Custom rename target for BONUS_1",
    )) as HTMLInputElement
    // First ✏ entry seeds from the picker; clear before typing the
    // value we actually want to assert is retained across toggles.
    await user.clear(customInput)
    await user.type(customInput, "My Custom Take")
    // Toggle back to picker — typed value should NOT be cleared.
    await user.click(editToggle)
    expect(
      screen.queryByLabelText(
        "Custom rename target for BONUS_1",
      ),
    ).toBeNull()
    // Toggle ✏ on again — the previously typed value is still there.
    await user.click(editToggle)
    const customInputAfter = (await screen.findByLabelText(
      "Custom rename target for BONUS_1",
    )) as HTMLInputElement
    expect(customInputAfter.value).toBe("My Custom Take")
  })

  test("row confidence badge syncs to the selected candidate, not the top-ranked one (worker 70 bug A)", async () => {
    // Two candidates: top-ranked has confidence 0.7 (70%), second has 0.2 (20%).
    // After the user selects the second candidate, the row badge must read "20%",
    // not "70%" (which was the bug — the badge was using rankedCandidates[0]).
    const user = userEvent.setup()
    // Mock getBoundingClientRect so PortalDropdown can compute its position
    // and render the listbox in the portal.
    vi.spyOn(
      HTMLElement.prototype,
      "getBoundingClientRect",
    ).mockReturnValue({
      top: 100,
      bottom: 140,
      left: 0,
      right: 200,
      width: 200,
      height: 40,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    })
    Object.defineProperty(window, "innerHeight", {
      value: 800,
      configurable: true,
      writable: true,
    })
    const badgeSyncPayload = {
      jobId: "job-badge-sync",
      stepId: "step-1",
      sourcePath: "/movies/Demo",
      suggestions: [
        {
          filename: "FAR_AWAY_IDOL",
          extension: ".mkv",
          durationSeconds: 353,
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
                name: "Far Far Away Idol",
                timecode: "8:55",
              },
              confidence: 0.2,
              durationScore: 0,
              filenameScore: 0.75,
            },
          ],
        },
      ],
    }
    const store = createStore()
    store.set(smartMatchModalAtom, badgeSyncPayload)
    renderWithStore(store)

    // Initially the top candidate (70%) is pre-selected — badge should show 70%.
    const row = document.querySelector(
      '[data-smart-match-row="FAR_AWAY_IDOL"]',
    )
    expect(row).not.toBeNull()
    // The badge is the last cell in the row.
    const initialBadge = row?.querySelector(
      "td:last-child span",
    )
    expect(initialBadge?.textContent).toBe("70%")

    // Open the picker dropdown.
    const picker = screen.getByLabelText(
      "Rename target for FAR_AWAY_IDOL",
    )
    await user.click(picker)

    // Select the second candidate via the portal listbox.
    const secondOption = await screen.findByRole("option", {
      name: /Far Far Away Idol/,
    })
    await user.pointer({
      target: secondOption,
      keys: "[MouseLeft]",
    })

    // Badge must now reflect the selected candidate's confidence (20%), not the top's (70%).
    await waitFor(() => {
      const updatedBadge = row?.querySelector(
        "td:last-child span",
      )
      expect(updatedBadge?.textContent).toBe("20%")
    })
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
