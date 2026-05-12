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

import { fileExplorerAtom } from "../../components/FileExplorerModal/fileExplorerAtom"
import { FileExplorerModal } from "./FileExplorerModal"

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
