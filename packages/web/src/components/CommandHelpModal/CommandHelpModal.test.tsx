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
import { commandsAtom } from "../../state/commandsAtom"
import {
  commandHelpCommandNameAtom,
  commandHelpModalOpenAtom,
} from "../../state/uiAtoms"
import { CommandHelpModal } from "./CommandHelpModal"

const mockCommand = {
  summary: "Encodes video with ffmpeg.",
  fields: [
    {
      name: "input",
      label: "Input file",
      type: "path",
      required: true,
    },
    {
      name: "preset",
      label: "Encoding preset",
      type: "string",
    },
  ],
}

const makeStore = (
  commandName: string | null,
  isOpen = commandName !== null,
) => {
  const store = createStore()
  store.set(commandHelpCommandNameAtom, commandName)
  store.set(commandHelpModalOpenAtom, isOpen)
  store.set(commandsAtom, { ffmpeg: mockCommand as never })
  return store
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("CommandHelpModal", () => {
  test("renders nothing when closed (isOpen=false)", () => {
    const store = makeStore("ffmpeg", false)
    const { container } = render(
      <Provider store={store}>
        <CommandHelpModal />
      </Provider>,
    )
    expect(container.firstChild).toBeNull()
  })

  test("renders nothing when commandName atom is null", () => {
    const store = makeStore(null, true)
    const { container } = render(
      <Provider store={store}>
        <CommandHelpModal />
      </Provider>,
    )
    expect(container.firstChild).toBeNull()
  })

  test("renders the modal title with command name", () => {
    const store = makeStore("ffmpeg")
    render(
      <Provider store={store}>
        <CommandHelpModal />
      </Provider>,
    )
    expect(screen.getByText(/Help:/)).toBeInTheDocument()
  })

  test("renders the command summary", () => {
    const store = makeStore("ffmpeg")
    render(
      <Provider store={store}>
        <CommandHelpModal />
      </Provider>,
    )
    expect(
      screen.getByText("Encodes video with ffmpeg."),
    ).toBeInTheDocument()
  })

  test("renders all field entries", () => {
    const store = makeStore("ffmpeg")
    render(
      <Provider store={store}>
        <CommandHelpModal />
      </Provider>,
    )
    expect(
      screen.getByText("Input file"),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Encoding preset"),
    ).toBeInTheDocument()
  })

  test("shows required badge for required fields", () => {
    const store = makeStore("ffmpeg")
    render(
      <Provider store={store}>
        <CommandHelpModal />
      </Provider>,
    )
    expect(screen.getByText("required")).toBeInTheDocument()
  })

  test("close button sets isOpen atom to false", async () => {
    const user = userEvent.setup()
    const store = makeStore("ffmpeg")
    render(
      <Provider store={store}>
        <CommandHelpModal />
      </Provider>,
    )
    await user.click(
      screen.getByRole("button", { name: /✕ close/i }),
    )
    expect(store.get(commandHelpModalOpenAtom)).toBe(false)
    expect(screen.queryByText(/Help:/)).toBeNull()
  })

  test("backdrop click sets isOpen atom to false", async () => {
    const user = userEvent.setup()
    const store = makeStore("ffmpeg")
    render(
      <Provider store={store}>
        <CommandHelpModal />
      </Provider>,
    )
    await user.click(screen.getByTestId("modal-backdrop"))
    expect(store.get(commandHelpModalOpenAtom)).toBe(false)
  })
})
