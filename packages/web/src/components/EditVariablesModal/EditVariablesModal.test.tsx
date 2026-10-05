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
  inject,
  test,
} from "vitest"
import { variablesAtom } from "../../state/variablesAtom"
import { EditVariablesModal } from "./EditVariablesModal"
import { editVariablesModalOpenAtom } from "./editVariablesModalOpenAtom"

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

const isNarrowWindow = inject("viewport") === "narrow"

describe("EditVariablesModal", () => {
  test("renders nothing when atom is false", () => {
    renderModal(false)
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  // The modal is the Narrow View's editor. At `lg` (1024px) and wider the
  // sidebar renders the same panel inline, so the modal closes itself the
  // moment it mounts. Of the four test windows only `narrow` is below `lg`;
  // the other three are given the claim that is true there instead.
  //
  // The split is made where the tests are REGISTERED, not with
  // `test.runIf`/`test.skipIf`: a window that cannot hold the modal does not
  // collect those tests at all, so the suite still reports zero skipped
  // (docs/decisions/2026-09-16-a-skipped-test-is-a-defect-and-the-suites-report-zero.md).
  if (isNarrowWindow) {
    test("renders the modal when atom is true", () => {
      renderModal(true)
      expect(screen.getByRole("dialog")).toBeInTheDocument()
    })

    test("modal has accessible label 'Edit Variables'", () => {
      renderModal(true)
      expect(
        screen.getByRole("dialog", {
          name: /edit variables/i,
        }),
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
      expect(store.get(editVariablesModalOpenAtom)).toBe(
        false,
      )
    })

    test("Escape key closes the modal", async () => {
      const user = userEvent.setup()
      const store = renderModal(true)
      expect(store.get(editVariablesModalOpenAtom)).toBe(
        true,
      )
      await user.keyboard("{Escape}")
      expect(store.get(editVariablesModalOpenAtom)).toBe(
        false,
      )
    })

    test("backdrop click closes the modal", async () => {
      const user = userEvent.setup()
      const store = renderModal(true)
      const backdrop = document.querySelector(
        "[role='none']",
      ) as HTMLElement
      await user.click(backdrop)
      expect(store.get(editVariablesModalOpenAtom)).toBe(
        false,
      )
    })
  } else {
    test("closes itself at lg and wider, where the sidebar shows the same panel", () => {
      const store = renderModal(true)
      expect(screen.queryByRole("dialog")).toBeNull()
      expect(store.get(editVariablesModalOpenAtom)).toBe(
        false,
      )
    })
  }
})
