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

import { audioPreviewModalAtom } from "../../components/AudioPreviewModal/audioPreviewModalAtom"
import { fileExplorerAtom } from "../../components/FileExplorerModal/fileExplorerAtom"
import { imagePreviewModalAtom } from "../../components/ImagePreviewModal/imagePreviewModalAtom"
import { videoPreviewModalAtom } from "../../components/VideoPreviewModal/videoPreviewModalAtom"
import { FileExplorerModal } from "./FileExplorerModal"

const mockListing = (
  entries: Array<{
    name: string
    isFile: boolean
    isDirectory: boolean
  }>,
  separator = "/",
) =>
  vi
    .spyOn(globalThis, "fetch")
    .mockImplementation((url) => {
      const urlStr = String(url)
      if (urlStr.includes("/files/list")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              separator,
              entries: entries.map((entry) => ({
                ...entry,
                size: 1000,
                duration: null,
                mtime: null,
              })),
            }),
            { status: 200 },
          ),
        )
      }
      return Promise.resolve(
        new Response(JSON.stringify({ mode: "trash" }), {
          status: 200,
        }),
      )
    })

const renderWithStore = (
  store: ReturnType<typeof createStore>,
) =>
  render(
    <Provider store={store}>
      <FileExplorerModal />
    </Provider>,
  )

describe("FileExplorerModal", () => {
  test("renders nothing when fileExplorerAtom is null", () => {
    const store = createStore()
    renderWithStore(store)
    expect(screen.queryByText(/Loading/i)).toBeNull()
  })

  test("shows loading state when opened", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation((url) => {
        const urlStr = String(url)
        if (urlStr.includes("/files/list")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                entries: [],
                separator: "/",
              }),
              { status: 200 },
            ),
          )
        }
        return Promise.resolve(
          new Response(JSON.stringify({ mode: "browse" }), {
            status: 200,
          }),
        )
      })
    const store = createStore()
    store.set(fileExplorerAtom, {
      path: "/movies",
      pickerOnSelect: null,
    })
    renderWithStore(store)
    expect(
      await screen.findByText("Folder is empty."),
    ).toBeInTheDocument()
    fetchSpy.mockRestore()
  })

  test("renders entries returned by the server", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation((url) => {
        const urlStr = String(url)
        if (urlStr.includes("/files/list")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                separator: "/",
                entries: [
                  {
                    name: "Movie.mkv",
                    isFile: true,
                    isDirectory: false,
                    size: 10_000_000,
                    duration: "1:48:30",
                    mtime: "2024-01-15T10:00:00Z",
                  },
                ],
              }),
              { status: 200 },
            ),
          )
        }
        return Promise.resolve(
          new Response(JSON.stringify({ mode: "trash" }), {
            status: 200,
          }),
        )
      })

    const store = createStore()
    store.set(fileExplorerAtom, {
      path: "/movies",
      pickerOnSelect: null,
    })
    renderWithStore(store)
    expect(
      await screen.findByText(/Movie\.mkv/),
    ).toBeInTheDocument()
    fetchSpy.mockRestore()
  })

  test("closes when ✕ is clicked", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation((url) => {
        const urlStr = String(url)
        if (urlStr.includes("/files/list")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                entries: [],
                separator: "/",
              }),
              { status: 200 },
            ),
          )
        }
        return Promise.resolve(
          new Response(JSON.stringify({ mode: "browse" }), {
            status: 200,
          }),
        )
      })
    const store = createStore()
    store.set(fileExplorerAtom, {
      path: "/movies",
      pickerOnSelect: null,
    })
    renderWithStore(store)
    await screen.findByText("Folder is empty.")
    await userEvent.click(screen.getByTitle("Close"))
    expect(store.get(fileExplorerAtom)).toBeNull()
    fetchSpy.mockRestore()
  })

  test("shows PICKER badge and Use this folder button in picker mode", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ entries: [], separator: "/" }),
          { status: 200 },
        ),
      )
    const store = createStore()
    store.set(fileExplorerAtom, {
      path: "/movies",
      pickerOnSelect: () => {},
    })
    renderWithStore(store)
    expect(
      await screen.findByText("PICKER"),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", {
        name: /Use this folder/i,
      }),
    ).toBeInTheDocument()
    fetchSpy.mockRestore()
  })

  test("shows Delete selected footer in picker mode and triggers DELETE /files", async () => {
    const deleteCalls: Array<{
      method: string
      body: unknown
    }> = []
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation((url, init) => {
        const urlStr = String(url)
        const method = (init?.method ?? "GET").toUpperCase()
        if (
          urlStr.endsWith("/files") &&
          method === "DELETE"
        ) {
          deleteCalls.push({
            method,
            body: init?.body
              ? JSON.parse(String(init.body))
              : null,
          })
          return Promise.resolve(
            new Response(
              JSON.stringify({
                results: [
                  {
                    path: "/movies/Movie.mkv",
                    isOk: true,
                  },
                ],
              }),
              { status: 200 },
            ),
          )
        }
        if (urlStr.includes("/files/list")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                separator: "/",
                entries: [
                  {
                    name: "Movie.mkv",
                    isFile: true,
                    isDirectory: false,
                    size: 1000,
                    duration: null,
                    mtime: null,
                  },
                ],
              }),
              { status: 200 },
            ),
          )
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({ mode: "permanent" }),
            { status: 200 },
          ),
        )
      })
    const confirmSpy = vi
      .spyOn(window, "confirm")
      .mockReturnValue(true)
    const store = createStore()
    store.set(fileExplorerAtom, {
      path: "/movies",
      pickerOnSelect: () => {},
    })
    renderWithStore(store)
    const row = await screen.findByText(/Movie\.mkv/)
    expect(row).toBeVisible()
    const deleteBtn = screen.getByRole("button", {
      name: /Delete selected/i,
    })
    expect(deleteBtn).toBeVisible()
    expect(deleteBtn).toBeDisabled()
    await userEvent.click(
      screen.getByTitle("Select all files"),
    )
    expect(deleteBtn).not.toBeDisabled()
    await userEvent.click(deleteBtn)
    expect(confirmSpy).toHaveBeenCalled()
    expect(deleteCalls).toHaveLength(1)
    expect(deleteCalls[0]?.body).toEqual({
      paths: ["/movies/Movie.mkv"],
    })
    fetchSpy.mockRestore()
    confirmSpy.mockRestore()
  })

  test("breadcrumb for /media/Anime has no double slash", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation((url) => {
        const urlStr = String(url)
        if (urlStr.includes("/files/list")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                entries: [],
                separator: "/",
              }),
              { status: 200 },
            ),
          )
        }
        return Promise.resolve(
          new Response(JSON.stringify({ mode: "trash" }), {
            status: 200,
          }),
        )
      })
    const store = createStore()
    store.set(fileExplorerAtom, {
      path: "/media/Anime",
      pickerOnSelect: null,
    })
    renderWithStore(store)
    await screen.findByText("Folder is empty.")
    expect(screen.queryByText("//")).toBeNull()
    expect(
      screen.getByRole("button", { name: "/" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "media" }),
    ).toBeInTheDocument()
    fetchSpy.mockRestore()
  })

  test("clicking an image row (cover.jpg) sets imagePreviewModalAtom and leaves audio/video atoms untouched", async () => {
    const fetchSpy = mockListing([
      {
        name: "cover.jpg",
        isFile: true,
        isDirectory: false,
      },
    ])
    const store = createStore()
    store.set(fileExplorerAtom, {
      path: "/music/Album",
      pickerOnSelect: null,
    })
    renderWithStore(store)
    const row = await screen.findByRole("button", {
      name: /cover\.jpg/,
    })
    await userEvent.click(row)
    expect(store.get(imagePreviewModalAtom)).toStrictEqual({
      path: "/music/Album/cover.jpg",
    })
    expect(store.get(audioPreviewModalAtom)).toBeNull()
    expect(store.get(videoPreviewModalAtom)).toBeNull()
    fetchSpy.mockRestore()
  })

  test("clicking an audio row (.flac) sets audioPreviewModalAtom and leaves image/video atoms untouched", async () => {
    const fetchSpy = mockListing([
      {
        name: "01 Primal Planet.flac",
        isFile: true,
        isDirectory: false,
      },
    ])
    const store = createStore()
    store.set(fileExplorerAtom, {
      path: "/music/Album",
      pickerOnSelect: null,
    })
    renderWithStore(store)
    const row = await screen.findByRole("button", {
      name: /01 Primal Planet\.flac/,
    })
    await userEvent.click(row)
    expect(store.get(audioPreviewModalAtom)).toStrictEqual({
      path: "/music/Album/01 Primal Planet.flac",
    })
    expect(store.get(imagePreviewModalAtom)).toBeNull()
    expect(store.get(videoPreviewModalAtom)).toBeNull()
    fetchSpy.mockRestore()
  })

  test("clicking a video row (.mkv) still sets videoPreviewModalAtom (regression guard)", async () => {
    const fetchSpy = mockListing([
      {
        name: "movie.mkv",
        isFile: true,
        isDirectory: false,
      },
    ])
    const store = createStore()
    store.set(fileExplorerAtom, {
      path: "/movies",
      pickerOnSelect: null,
    })
    renderWithStore(store)
    const row = await screen.findByRole("button", {
      name: /movie\.mkv/,
    })
    await userEvent.click(row)
    expect(store.get(videoPreviewModalAtom)).toStrictEqual({
      path: "/movies/movie.mkv",
    })
    expect(store.get(audioPreviewModalAtom)).toBeNull()
    expect(store.get(imagePreviewModalAtom)).toBeNull()
    fetchSpy.mockRestore()
  })

  test("icon column shows 🎵/🖼️/🎬/📄 for audio/image/video/other rows", async () => {
    const fetchSpy = mockListing([
      {
        name: "song.flac",
        isFile: true,
        isDirectory: false,
      },
      {
        name: "cover.jpg",
        isFile: true,
        isDirectory: false,
      },
      {
        name: "movie.mkv",
        isFile: true,
        isDirectory: false,
      },
      {
        name: "notes.txt",
        isFile: true,
        isDirectory: false,
      },
    ])
    const store = createStore()
    store.set(fileExplorerAtom, {
      path: "/mixed",
      pickerOnSelect: null,
    })
    renderWithStore(store)
    expect(
      await screen.findByText(/🎵 song\.flac/),
    ).toBeVisible()
    expect(screen.getByText(/🖼️ cover\.jpg/)).toBeVisible()
    expect(screen.getByText(/🎬 movie\.mkv/)).toBeVisible()
    expect(screen.getByText(/📄 notes\.txt/)).toBeVisible()
    fetchSpy.mockRestore()
  })

  test("breadcrumb for G:\\Anime renders drive letter and folder", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation((url) => {
        const urlStr = String(url)
        if (urlStr.includes("/files/list")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                entries: [],
                separator: "\\",
              }),
              { status: 200 },
            ),
          )
        }
        return Promise.resolve(
          new Response(JSON.stringify({ mode: "trash" }), {
            status: 200,
          }),
        )
      })
    const store = createStore()
    store.set(fileExplorerAtom, {
      path: "G:\\Anime",
      pickerOnSelect: null,
    })
    renderWithStore(store)
    await screen.findByText("Folder is empty.")
    expect(
      screen.getByRole("button", { name: "G:" }),
    ).toBeInTheDocument()
    expect(screen.getByText("Anime")).toBeInTheDocument()
    fetchSpy.mockRestore()
  })
})
