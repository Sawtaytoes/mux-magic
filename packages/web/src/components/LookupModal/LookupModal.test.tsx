import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, test } from "vitest"

afterEach(() => {
  cleanup()
})

import { lookupModalAtom } from "../../state/uiAtoms"
import { LookupModal } from "./LookupModal"

const renderWithStore = (
  store: ReturnType<typeof createStore>,
) =>
  render(
    <Provider store={store}>
      <LookupModal />
    </Provider>,
  )

const baseState = {
  lookupType: "mal" as const,
  stepId: "step-1",
  fieldName: "malId",
  stage: "search" as const,
  searchTerm: "",
  searchError: null,
  results: null,
  formatFilter: "all",
  selectedGroup: null,
  selectedVariant: null,
  selectedFid: null,
  releases: null,
  releasesDebug: null,
  releasesError: null,
  loading: false,
}

describe("LookupModal", () => {
  test("renders nothing when lookupModalAtom is null", () => {
    const store = createStore()
    renderWithStore(store)
    expect(screen.queryByText(/Look up/i)).toBeNull()
  })

  test("renders the MAL lookup title when open", () => {
    const store = createStore()
    store.set(lookupModalAtom, baseState)
    renderWithStore(store)
    expect(
      screen.getByText("Look up MAL ID"),
    ).toBeInTheDocument()
  })

  test("renders the search input", () => {
    const store = createStore()
    store.set(lookupModalAtom, baseState)
    renderWithStore(store)
    expect(
      screen.getByPlaceholderText("Search…"),
    ).toBeInTheDocument()
  })

  test("updates searchTerm as user types", async () => {
    const store = createStore()
    store.set(lookupModalAtom, baseState)
    renderWithStore(store)
    await userEvent.type(
      screen.getByPlaceholderText("Search…"),
      "Evangelion",
    )
    expect(store.get(lookupModalAtom)?.searchTerm).toBe(
      "Evangelion",
    )
  })

  test("closes the modal when ✕ is clicked", async () => {
    const store = createStore()
    store.set(lookupModalAtom, baseState)
    renderWithStore(store)
    await userEvent.click(screen.getByTitle("Close"))
    expect(store.get(lookupModalAtom)).toBeNull()
  })

  test("shows Back button only in variant and release stages", () => {
    const store = createStore()
    store.set(lookupModalAtom, {
      ...baseState,
      stage: "variant" as const,
    })
    renderWithStore(store)
    expect(
      screen.getByRole("button", { name: /← Back/i }),
    ).toBeInTheDocument()
  })

  test("shows DVDCompare format filter buttons for dvdcompare lookup type", () => {
    const store = createStore()
    store.set(lookupModalAtom, {
      ...baseState,
      lookupType: "dvdcompare" as const,
    })
    renderWithStore(store)
    expect(
      screen.getByRole("button", { name: "Blu-ray 4K" }),
    ).toBeInTheDocument()
  })
})
