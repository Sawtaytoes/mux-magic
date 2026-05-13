import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, test } from "vitest"
import { variablesAtom } from "../../state/variablesAtom"
import { editVariablesModalOpenAtom } from "./editVariablesModalOpenAtom"
import { EditVariablesModal } from "./EditVariablesModal"

const renderModal = (isOpen = false) => {
  const store = createStore()
  store.set(editVariablesModalOpenAtom, isOpen)
  store.set(variablesAtom, [])
  render(
    <Provider store={store}>
      <EditVariablesModal />
    </Provider>,
  )
  return store
}

afterEach(() => {
  cleanup()
})

describe("EditVariablesModal", () => {
  test("renders nothing when atom is false", () => {
    renderModal(false)
    expect(
      screen.queryByRole("dialog"),
    ).toBeNull()
  })

  test("renders the modal when atom is true", () => {
    renderModal(true)
    expect(
      screen.getByRole("dialog"),
    ).toBeInTheDocument()
  })

  test("modal has accessible label 'Edit Variables'", () => {
    renderModal(true)
    expect(
      screen.getByRole("dialog", { name: /edit variables/i }),
    ).toBeInTheDocument()
  })

  test("modal contains the heading 'Variables'", () => {
    renderModal(true)
    expect(
      screen.getByRole("heading", { name: /variables/i }),
    ).toBeInTheDocument()
  })

  test("close button sets atom to false", async () => {
    const user = userEvent.setup()
    const store = renderModal(true)
    await user.click(
      screen.getByRole("button", { name: /close/i }),
    )
    expect(store.get(editVariablesModalOpenAtom)).toBe(false)
  })

  test("Escape key closes the modal", async () => {
    const user = userEvent.setup()
    const store = renderModal(true)
    expect(store.get(editVariablesModalOpenAtom)).toBe(true)
    await user.keyboard("{Escape}")
    expect(store.get(editVariablesModalOpenAtom)).toBe(false)
  })

  test("backdrop click closes the modal", async () => {
    const user = userEvent.setup()
    const store = renderModal(true)
    const backdrop = document.querySelector(
      "[role='none']",
    ) as HTMLElement
    await user.click(backdrop)
    expect(store.get(editVariablesModalOpenAtom)).toBe(false)
  })
})
