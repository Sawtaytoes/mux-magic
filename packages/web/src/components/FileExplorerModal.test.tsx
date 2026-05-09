import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createStore, Provider } from "jotai"
import { describe, expect, it, vi } from "vitest"
import { fileExplorerAtom } from "../state/uiAtoms"
import { FileExplorerModal } from "./FileExplorerModal"

const renderWithStore = (store: ReturnType<typeof createStore>) =>
  render(
    <Provider store={store}>
      <FileExplorerModal />
    </Provider>,
  )

describe("FileExplorerModal", () => {
  it("renders nothing when fileExplorerAtom is null", () => {
    const store = createStore()
    renderWithStore(store)
    expect(screen.queryByText(/Loading/i)).toBeNull()
  })

  it("shows loading state when opened", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ entries: [], separator: "/" }), { status: 200 }),
      )
    const store = createStore()
    store.set(fileExplorerAtom, { path: "/movies", pickerOnSelect: null })
    renderWithStore(store)
    expect(await screen.findByText("Folder is empty.")).toBeInTheDocument()
    fetchSpy.mockRestore()
  })

  it("renders entries returned by the server", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
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
      return Promise.resolve(new Response(JSON.stringify({ mode: "trash" }), { status: 200 }))
    })

    const store = createStore()
    store.set(fileExplorerAtom, { path: "/movies", pickerOnSelect: null })
    renderWithStore(store)
    expect(await screen.findByText(/Movie\.mkv/)).toBeInTheDocument()
    fetchSpy.mockRestore()
  })

  it("closes when ✕ is clicked", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ entries: [], separator: "/" }), { status: 200 }),
      )
    const store = createStore()
    store.set(fileExplorerAtom, { path: "/movies", pickerOnSelect: null })
    renderWithStore(store)
    await screen.findByText("Folder is empty.")
    await userEvent.click(screen.getByTitle("Close"))
    expect(store.get(fileExplorerAtom)).toBeNull()
    fetchSpy.mockRestore()
  })

  it("shows PICKER badge and Use this folder button in picker mode", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ entries: [], separator: "/" }), { status: 200 }),
      )
    const store = createStore()
    store.set(fileExplorerAtom, {
      path: "/movies",
      pickerOnSelect: () => {},
    })
    renderWithStore(store)
    expect(await screen.findByText("PICKER")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Use this folder/i })).toBeInTheDocument()
    fetchSpy.mockRestore()
  })
})
