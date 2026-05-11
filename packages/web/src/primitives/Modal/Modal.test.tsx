import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, test, vi } from "vitest"
import { Modal } from "./Modal"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const renderModal = (isOpen: boolean, onClose = vi.fn()) =>
  render(
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="Test modal">
      <div>
        <p>Modal content</p>
        <button type="button">Inner button</button>
      </div>
    </Modal>,
  )

describe("Modal visibility", () => {
  test("renders nothing when isOpen is false", () => {
    renderModal(false)
    expect(
      screen.queryByTestId("modal-backdrop"),
    ).toBeNull()
    expect(screen.queryByText("Modal content")).toBeNull()
  })

  test("renders children when isOpen is true", () => {
    renderModal(true)
    expect(screen.getByText("Modal content")).toBeInTheDocument()
    expect(
      screen.getByRole("dialog", { name: "Test modal" }),
    ).toBeInTheDocument()
  })
})

describe("Modal close interactions", () => {
  test("backdrop click calls onClose", () => {
    const onClose = vi.fn()
    renderModal(true, onClose)
    fireEvent.click(screen.getByTestId("modal-backdrop"))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test("click inside content does not call onClose", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderModal(true, onClose)
    await user.click(screen.getByText("Modal content"))
    expect(onClose).not.toHaveBeenCalled()
  })

  test("Esc key calls onClose", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderModal(true, onClose)
    await user.keyboard("{Escape}")
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test("Esc key does nothing when modal is closed", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderModal(false, onClose)
    await user.keyboard("{Escape}")
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe("Modal accessibility", () => {
  test("dialog has correct aria-label", () => {
    renderModal(true)
    const dialog = screen.getByRole("dialog")
    expect(dialog).toHaveAttribute("aria-label", "Test modal")
    expect(dialog).toHaveAttribute("aria-modal", "true")
  })
})
