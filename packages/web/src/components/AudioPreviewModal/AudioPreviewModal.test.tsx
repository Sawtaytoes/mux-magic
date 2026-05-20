import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, test } from "vitest"
import { AudioPreviewModal } from "./AudioPreviewModal"
import { audioPreviewModalAtom } from "./audioPreviewModalAtom"

afterEach(() => {
  cleanup()
})

const renderWithStore = (
  store: ReturnType<typeof createStore>,
) =>
  render(
    <Provider store={store}>
      <AudioPreviewModal />
    </Provider>,
  )

describe("AudioPreviewModal", () => {
  test("renders nothing when atom is null", () => {
    const store = createStore()
    renderWithStore(store)
    expect(
      document.getElementById("audio-modal"),
    ).toBeNull()
  })

  test("renders an <audio> element pointing at /files/stream when atom is set", () => {
    const store = createStore()
    store.set(audioPreviewModalAtom, {
      path: "/music/01 Primal Planet.flac",
    })
    renderWithStore(store)
    const audio = document.getElementById(
      "audio-modal-player",
    ) as HTMLAudioElement | null
    expect(audio).not.toBeNull()
    expect(audio?.tagName).toBe("AUDIO")
    expect(audio?.getAttribute("src")).toBe(
      "/api/files/stream?path=%2Fmusic%2F01+Primal+Planet.flac",
    )
    expect(audio).toBeVisible()
  })

  test("Close button clears the atom", async () => {
    const user = userEvent.setup()
    const store = createStore()
    store.set(audioPreviewModalAtom, {
      path: "/music/song.mp3",
    })
    renderWithStore(store)
    await user.click(screen.getByTitle("Close"))
    expect(store.get(audioPreviewModalAtom)).toBeNull()
  })

  test("backdrop click clears the atom", async () => {
    const user = userEvent.setup()
    const store = createStore()
    store.set(audioPreviewModalAtom, {
      path: "/music/song.mp3",
    })
    renderWithStore(store)
    const backdrop = document.getElementById(
      "audio-modal",
    ) as HTMLElement
    await user.click(backdrop)
    expect(store.get(audioPreviewModalAtom)).toBeNull()
  })
})
