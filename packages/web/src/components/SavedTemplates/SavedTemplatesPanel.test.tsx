import {
  cleanup,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { createStore, Provider } from "jotai"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

import { COMMANDS } from "../../commands/commands"
import { commandsAtom } from "../../state/commandsAtom"
import { pathsAtom } from "../../state/pathsAtom"
import { stepsAtom } from "../../state/stepsAtom"
import { templatesAtom } from "../../state/templatesAtoms"
import { SavedTemplatesPanel } from "./SavedTemplatesPanel"

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  cleanup()
})

const okJson = (data: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  )

const renderPanel = () => {
  const store = createStore()
  store.set(commandsAtom, COMMANDS)
  store.set(stepsAtom, [])
  store.set(pathsAtom, [
    {
      id: "basePath",
      label: "basePath",
      value: "",
      type: "path",
    },
  ])
  render(
    <Provider store={store}>
      <SavedTemplatesPanel />
    </Provider>,
  )
  return store
}

describe("SavedTemplatesPanel", () => {
  test("shows the empty-state message before any templates exist", async () => {
    fetchMock.mockReturnValueOnce(okJson({ templates: [] }))
    renderPanel()
    expect(
      await screen.findByText("No saved templates yet."),
    ).toBeInTheDocument()
  })

  test("renders fetched templates as rows", async () => {
    fetchMock.mockReturnValueOnce(
      okJson({
        templates: [
          {
            id: "movie-workflow",
            name: "Movie Workflow",
            description: "First pass",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
          {
            id: "anime-flow",
            name: "Anime Flow",
            updatedAt: "2026-01-02T00:00:00.000Z",
          },
        ],
      }),
    )
    renderPanel()
    expect(
      await screen.findByText("Movie Workflow"),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Anime Flow"),
    ).toBeInTheDocument()
  })

  test("silently falls back to the empty state when the list endpoint fails", async () => {
    // Passive failures during the initial list fetch are deliberately
    // not surfaced as a `role="alert"` — see the comment on
    // `surfaceActionError` in SavedTemplatesPanel.tsx. A red alert on
    // every page load in deployments where the api isn't reachable
    // leaks into unrelated specs (`getByRole("alert")` then matches two
    // elements) and clutters the sidebar for users who don't use
    // templates. The empty-state copy stands in.
    fetchMock.mockReturnValueOnce(
      Promise.resolve(
        new Response("server fell over", { status: 500 }),
      ),
    )
    renderPanel()
    expect(
      await screen.findByText("No saved templates yet."),
    ).toBeInTheDocument()
    expect(screen.queryByRole("alert")).toBeNull()
  })

  test("the Save current button opens the modal", async () => {
    fetchMock.mockReturnValueOnce(okJson({ templates: [] }))
    const store = renderPanel()
    await screen.findByText("No saved templates yet.")
    // Modal absent before click
    expect(
      screen.queryByRole("dialog", {
        name: "Save sequence as template",
      }),
    ).toBeNull()
    const saveButton = screen.getByRole("button", {
      name: "Save current",
    })
    saveButton.click()
    await waitFor(() => {
      expect(
        screen.getByRole("dialog", {
          name: "Save sequence as template",
        }),
      ).toBeInTheDocument()
    })
    // Templates list still empty.
    expect(store.get(templatesAtom)).toEqual([])
  })
})
