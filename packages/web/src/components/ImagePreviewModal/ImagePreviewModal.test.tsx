import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, test } from "vitest"
import { ImagePreviewModal } from "./ImagePreviewModal"
import { imagePreviewModalAtom } from "./imagePreviewModalAtom"

afterEach(() => {
  cleanup()
})

const renderWithStore = (
  store: ReturnType<typeof createStore>,
) =>
  render(
    <Provider store={store}>
      <ImagePreviewModal />
    </Provider>,
  )

describe("ImagePreviewModal", () => {
  test("renders nothing when atom is null", () => {
    const store = createStore()
    renderWithStore(store)
    expect(
      document.getElementById("image-modal"),
    ).toBeNull()
  })

  test("renders an <img> pointing at /files/stream when atom is set", () => {
    const store = createStore()
    store.set(imagePreviewModalAtom, {
      path: "/music/cover.jpg",
    })
    renderWithStore(store)
    const img = document.getElementById(
      "image-modal-img",
    ) as HTMLImageElement | null
    expect(img).not.toBeNull()
    expect(img?.tagName).toBe("IMG")
    expect(img?.getAttribute("src")).toBe(
      "/api/files/stream?path=%2Fmusic%2Fcover.jpg",
    )
    expect(img).toBeVisible()
  })

  test("Close button clears the atom", async () => {
    const user = userEvent.setup()
    const store = createStore()
    store.set(imagePreviewModalAtom, {
      path: "/music/cover.png",
    })
    renderWithStore(store)
    await user.click(screen.getByTitle("Close"))
    expect(store.get(imagePreviewModalAtom)).toBeNull()
  })

  test("backdrop click clears the atom", async () => {
    const user = userEvent.setup()
    const store = createStore()
    store.set(imagePreviewModalAtom, {
      path: "/music/cover.png",
    })
    renderWithStore(store)
    const backdrop = document.getElementById(
      "image-modal",
    ) as HTMLElement
    await user.click(backdrop)
    expect(store.get(imagePreviewModalAtom)).toBeNull()
  })
})
