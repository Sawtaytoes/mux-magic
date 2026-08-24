import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
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

import { apiBase } from "../../apiBase"
import { TagMatchModal } from "./TagMatchModal"
import {
  type TagMatchModalState,
  tagMatchModalAtom,
} from "./tagMatchModalAtom"
import type {
  ScoredReleaseCandidate,
  TagMatchFile,
} from "./tagMatchTypes"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const renderWithStore = (
  store: ReturnType<typeof createStore>,
) =>
  render(
    <Provider store={store}>
      <TagMatchModal />
    </Provider>,
  )

const buildCandidate = ({
  confidence,
  proposedTitle,
  proposedTrackNumber,
  releaseId,
  releaseTitle,
}: {
  confidence: number
  proposedTitle: string
  proposedTrackNumber: number
  releaseId: string
  releaseTitle: string
}): ScoredReleaseCandidate => ({
  candidate: {
    artistName: "Nova Harbour",
    country: "GB",
    format: "CD",
    label: "Tidewater Records",
    releaseId,
    releaseTitle,
    source: "musicbrainz",
    trackCount: 11,
    year: "2019",
  },
  confidence,
  proposedTags: {
    album: releaseTitle,
    albumArtist: "Nova Harbour",
    artist: "Nova Harbour",
    date: "2019",
    genres: ["Ambient", "Downtempo"],
    title: proposedTitle,
    totalTracks: 11,
    trackNumber: proposedTrackNumber,
  },
})

const firstFilePath = "/music/inbox/01 harbour lights.flac"
const secondFilePath = "/music/inbox/02 tidewater.flac"
const thirdFilePath = "/music/inbox/03 unknown track.flac"

// Third row scores 0.65 — above SmartMatch's 0.6, below the music
// threshold of 0.7. It must start UNCHECKED.
const mixedFiles: TagMatchFile[] = [
  {
    filePath: firstFilePath,
    filename: "01 harbour lights.flac",
    extension: ".flac",
    durationSeconds: 254,
    currentTags: {
      album: "Harbour Lights",
      artist: "Nova Harbour",
      title: "harbour lights",
      trackNumber: "01",
    },
    rankedCandidates: [
      buildCandidate({
        confidence: 0.94,
        proposedTitle: "Harbour Lights",
        proposedTrackNumber: 1,
        releaseId: "release-gb-cd",
        releaseTitle: "Harbour Lights",
      }),
      buildCandidate({
        confidence: 0.71,
        proposedTitle: "Harbour Lights",
        proposedTrackNumber: 1,
        releaseId: "release-jp-cd",
        releaseTitle: "Harbour Lights (Japan)",
      }),
    ],
  },
  {
    filePath: secondFilePath,
    filename: "02 tidewater.flac",
    extension: ".flac",
    durationSeconds: 311,
    currentTags: {
      album: "Harbour Lights",
      artist: "Nova Harbour",
      title: "tidewater",
      trackNumber: "02",
    },
    rankedCandidates: [
      buildCandidate({
        confidence: 0.88,
        proposedTitle: "Tidewater",
        proposedTrackNumber: 2,
        releaseId: "release-gb-cd",
        releaseTitle: "Harbour Lights",
      }),
    ],
  },
  {
    filePath: thirdFilePath,
    filename: "03 unknown track.flac",
    extension: ".flac",
    durationSeconds: 198,
    currentTags: {
      artist: "Nova Harbour",
      title: "unknown track",
    },
    rankedCandidates: [
      buildCandidate({
        confidence: 0.65,
        proposedTitle: "Signal Fires",
        proposedTrackNumber: 3,
        releaseId: "release-us-digital",
        releaseTitle: "Harbour Lights (Deluxe)",
      }),
    ],
  },
]

const mixedPayload: TagMatchModalState = {
  jobId: "job-1",
  stepId: "step-1",
  sourcePath: "/music/inbox",
  files: mixedFiles,
}

const includeCheckbox = (filename: string) =>
  screen.getByLabelText(
    `Include ${filename}`,
  ) as HTMLInputElement

const expandRow = async ({
  filename,
  user,
}: {
  filename: string
  user: ReturnType<typeof userEvent.setup>
}) => {
  await user.click(
    screen.getByRole("button", {
      name: `Show tag changes for ${filename}`,
    }),
  )
}

const diffRowFor = (filePath: string) =>
  document.querySelector(
    `[data-tag-match-diff-row="${filePath}"]`,
  ) as HTMLElement

const fieldInput = ({
  fieldLabel,
  filePath,
}: {
  fieldLabel: string
  filePath: string
}) =>
  within(diffRowFor(filePath)).getByLabelText(
    `${fieldLabel} proposed value`,
  ) as HTMLInputElement

const changeTypeFor = ({
  fieldName,
  filePath,
}: {
  fieldName: string
  filePath: string
}) =>
  diffRowFor(filePath)
    .querySelector(`[data-tag-match-field="${fieldName}"]`)
    ?.getAttribute("data-tag-match-change-type")

// A Response body can only be read once, so every call gets its own.
const mockOkFetch = () =>
  vi.spyOn(globalThis, "fetch").mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify({ isOk: true }), {
        status: 200,
      }),
    ),
  )

const readPostedBodies = (
  fetchSpy: ReturnType<typeof mockOkFetch>,
) =>
  fetchSpy.mock.calls.map(
    (call) =>
      JSON.parse(
        (call[1] as RequestInit).body as string,
      ) as {
        filePath: string
        tags: Record<string, unknown>
      },
  )

describe("TagMatchModal", () => {
  test("renders nothing when tagMatchModalAtom is null", () => {
    const store = createStore()
    renderWithStore(store)
    expect(
      document.getElementById("tag-match-modal"),
    ).toBeNull()
  })

  test("renders one row per audio file", () => {
    const store = createStore()
    store.set(tagMatchModalAtom, mixedPayload)
    renderWithStore(store)
    expect(
      screen.getByRole("dialog", {
        name: "Tag Match — Review Tags",
      }),
    ).toBeVisible()
    expect(
      document.querySelectorAll("[data-tag-match-row]"),
    ).toHaveLength(3)
  })

  test("seeds checked rows at the 0.7 file-lookup threshold, not SmartMatch's 0.6", () => {
    const store = createStore()
    store.set(tagMatchModalAtom, mixedPayload)
    renderWithStore(store)
    expect(
      includeCheckbox("01 harbour lights.flac").checked,
    ).toBe(true)
    expect(
      includeCheckbox("02 tidewater.flac").checked,
    ).toBe(true)
    // 0.65 sits above 0.6 and below 0.7 — it must stay unchecked.
    expect(
      includeCheckbox("03 unknown track.flac").checked,
    ).toBe(false)
  })

  test("a row below the track-matching threshold reads as unmatched", () => {
    const store = createStore()
    store.set(tagMatchModalAtom, {
      ...mixedPayload,
      files: [
        {
          ...mixedFiles[0],
          rankedCandidates: [
            buildCandidate({
              confidence: 0.18,
              proposedTitle: "Harbour Lights",
              proposedTrackNumber: 1,
              releaseId: "release-gb-cd",
              releaseTitle: "Harbour Lights",
            }),
          ],
        },
      ],
    })
    renderWithStore(store)
    expect(screen.getByText("Unmatched")).toBeVisible()
  })

  test("the header checkbox clears every eligible row, then checks them all", async () => {
    const user = userEvent.setup()
    const store = createStore()
    store.set(tagMatchModalAtom, mixedPayload)
    renderWithStore(store)
    await user.click(screen.getByLabelText("Uncheck all"))
    expect(
      includeCheckbox("01 harbour lights.flac").checked,
    ).toBe(false)
    expect(
      includeCheckbox("02 tidewater.flac").checked,
    ).toBe(false)
    await user.click(screen.getByLabelText("Select all"))
    expect(
      includeCheckbox("01 harbour lights.flac").checked,
    ).toBe(true)
    expect(
      includeCheckbox("03 unknown track.flac").checked,
    ).toBe(true)
  })

  test("expanding a row reveals the per-field diff", async () => {
    const user = userEvent.setup()
    const store = createStore()
    store.set(tagMatchModalAtom, mixedPayload)
    renderWithStore(store)
    expect(diffRowFor(firstFilePath)).toBeNull()
    await expandRow({
      filename: "01 harbour lights.flac",
      user,
    })
    expect(diffRowFor(firstFilePath)).toBeVisible()
    expect(
      diffRowFor(firstFilePath).querySelectorAll(
        "[data-tag-match-field]",
      ),
    ).toHaveLength(11)
  })

  test("an unchanged field renders as unchanged and a changed one does not", async () => {
    const user = userEvent.setup()
    const store = createStore()
    store.set(tagMatchModalAtom, mixedPayload)
    renderWithStore(store)
    await expandRow({
      filename: "01 harbour lights.flac",
      user,
    })
    // "01" against 1 compares numerically.
    expect(
      changeTypeFor({
        fieldName: "trackNumber",
        filePath: firstFilePath,
      }),
    ).toBe("unchanged")
    expect(
      changeTypeFor({
        fieldName: "album",
        filePath: firstFilePath,
      }),
    ).toBe("unchanged")
    // "harbour lights" against "Harbour Lights".
    expect(
      changeTypeFor({
        fieldName: "title",
        filePath: firstFilePath,
      }),
    ).toBe("changed")
    // The file has no album artist yet.
    expect(
      changeTypeFor({
        fieldName: "albumArtist",
        filePath: firstFilePath,
      }),
    ).toBe("added")
  })

  test("editing a field overrides the candidate value and Apply posts the edit", async () => {
    const user = userEvent.setup()
    const fetchSpy = mockOkFetch()
    const store = createStore()
    store.set(tagMatchModalAtom, mixedPayload)
    renderWithStore(store)
    await expandRow({
      filename: "01 harbour lights.flac",
      user,
    })
    await user.type(
      fieldInput({
        fieldLabel: "Title",
        filePath: firstFilePath,
      }),
      " (Live)",
    )
    expect(
      fieldInput({
        fieldLabel: "Title",
        filePath: firstFilePath,
      }).value,
    ).toBe("Harbour Lights (Live)")
    await user.click(
      screen.getByRole("button", { name: "Apply" }),
    )
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2)
    })
    expect(readPostedBodies(fetchSpy)[0]?.tags.title).toBe(
      "Harbour Lights (Live)",
    )
  })

  test("Apply posts one request per included row", async () => {
    const user = userEvent.setup()
    const fetchSpy = mockOkFetch()
    const store = createStore()
    store.set(tagMatchModalAtom, mixedPayload)
    renderWithStore(store)
    await user.click(
      screen.getByRole("button", { name: "Apply" }),
    )
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2)
    })
    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      `${apiBase}/music/tags`,
      expect.objectContaining({ method: "POST" }),
    )
    expect(
      readPostedBodies(fetchSpy).map(
        (body) => body.filePath,
      ),
    ).toEqual([firstFilePath, secondFilePath])
    expect(readPostedBodies(fetchSpy)[0]?.tags.album).toBe(
      "Harbour Lights",
    )
  })

  test("the modal closes when every included row succeeds", async () => {
    const user = userEvent.setup()
    mockOkFetch()
    const store = createStore()
    store.set(tagMatchModalAtom, mixedPayload)
    renderWithStore(store)
    await user.click(
      screen.getByRole("button", { name: "Apply" }),
    )
    await waitFor(() => {
      expect(store.get(tagMatchModalAtom)).toBeNull()
    })
  })

  test("a failed row keeps its error visible and the modal stays open", async () => {
    const user = userEvent.setup()
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            isOk: false,
            error: "File is read-only",
          }),
          { status: 500 },
        ),
      ),
    )
    const store = createStore()
    store.set(tagMatchModalAtom, mixedPayload)
    renderWithStore(store)
    await user.click(
      screen.getByRole("button", { name: "Apply" }),
    )
    expect(
      await screen.findAllByText("File is read-only"),
    ).toHaveLength(2)
    expect(store.get(tagMatchModalAtom)).not.toBeNull()
  })

  test("bulk apply sets the field on every included row and leaves excluded rows alone", async () => {
    const user = userEvent.setup()
    const store = createStore()
    store.set(tagMatchModalAtom, mixedPayload)
    renderWithStore(store)
    await user.click(
      screen.getByRole("button", { name: "Bulk edit" }),
    )
    await user.type(
      screen.getByLabelText("Bulk value"),
      "Vela Collective",
    )
    await user.click(
      screen.getByRole("button", {
        name: /Apply to 2 included rows/,
      }),
    )
    await expandRow({
      filename: "01 harbour lights.flac",
      user,
    })
    await expandRow({
      filename: "03 unknown track.flac",
      user,
    })
    expect(
      fieldInput({
        fieldLabel: "Album Artist",
        filePath: firstFilePath,
      }).value,
    ).toBe("Vela Collective")
    // The third row is excluded, so bulk edit must not touch it.
    expect(
      fieldInput({
        fieldLabel: "Album Artist",
        filePath: thirdFilePath,
      }).value,
    ).toBe("Nova Harbour")
  })

  test("find and replace rewrites the field over the included rows only", async () => {
    const user = userEvent.setup()
    const store = createStore()
    store.set(tagMatchModalAtom, mixedPayload)
    renderWithStore(store)
    await user.click(
      screen.getByRole("button", { name: "Bulk edit" }),
    )
    await user.type(
      screen.getByLabelText("Find text"),
      "Nova",
    )
    await user.type(
      screen.getByLabelText("Replace text"),
      "Vela",
    )
    expect(
      screen.getByText("2 rows affected"),
    ).toBeVisible()
    await user.click(
      screen.getByRole("button", { name: "Replace" }),
    )
    await expandRow({
      filename: "01 harbour lights.flac",
      user,
    })
    await expandRow({
      filename: "03 unknown track.flac",
      user,
    })
    expect(
      fieldInput({
        fieldLabel: "Artist",
        filePath: firstFilePath,
      }).value,
    ).toBe("Vela Harbour")
    expect(
      fieldInput({
        fieldLabel: "Artist",
        filePath: thirdFilePath,
      }).value,
    ).toBe("Nova Harbour")
  })

  test("the empty payload renders a focused message", () => {
    const store = createStore()
    store.set(tagMatchModalAtom, {
      ...mixedPayload,
      files: [],
    })
    renderWithStore(store)
    expect(screen.getByText("No audio files")).toBeVisible()
  })
})
