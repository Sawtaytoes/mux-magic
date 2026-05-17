import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createStore, Provider } from "jotai"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

import { videoPreviewModalAtom } from "../../components/VideoPreviewModal/videoPreviewModalAtom"
import { VideoPreviewModal } from "./VideoPreviewModal"

// FileVideoPlayer probes /version and /files/audio-codec on mount. Keep
// the test focused on VideoPreviewModal's responsibility (atom → render
// + close → atom-clear) by stubbing fetch to a benign no-op response.
beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({}), { status: 200 }),
  )
})

const renderWithStore = (
  store: ReturnType<typeof createStore>,
) =>
  render(
    <Provider store={store}>
      <VideoPreviewModal />
    </Provider>,
  )

describe("VideoPreviewModal", () => {
  test("renders nothing when videoPreviewModalAtom is null", () => {
    const store = createStore()
    renderWithStore(store)
    expect(
      document.getElementById("video-modal"),
    ).toBeNull()
  })

  test("renders the video player when atom is set, independent of any other modal being open", () => {
    const store = createStore()
    store.set(videoPreviewModalAtom, {
      path: "/movies/Movie.mkv",
    })
    renderWithStore(store)
    // The path is shown in the FileVideoPlayer title bar.
    expect(
      screen.getByText("/movies/Movie.mkv"),
    ).toBeInTheDocument()
    expect(
      document.getElementById("video-modal"),
    ).not.toBeNull()
  })

  test("clearing the atom unmounts the modal", async () => {
    const store = createStore()
    store.set(videoPreviewModalAtom, {
      path: "/movies/Movie.mkv",
    })
    const { rerender } = renderWithStore(store)
    expect(
      document.getElementById("video-modal"),
    ).not.toBeNull()
    store.set(videoPreviewModalAtom, null)
    rerender(
      <Provider store={store}>
        <VideoPreviewModal />
      </Provider>,
    )
    expect(
      document.getElementById("video-modal"),
    ).toBeNull()
  })

  test("clicking the Close button clears the atom", async () => {
    const user = userEvent.setup()
    const store = createStore()
    store.set(videoPreviewModalAtom, {
      path: "/movies/Movie.mkv",
    })
    renderWithStore(store)
    await user.click(screen.getByTitle("Close"))
    expect(store.get(videoPreviewModalAtom)).toBeNull()
  })
})
