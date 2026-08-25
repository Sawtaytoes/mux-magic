import {
  cleanup,
  render,
  screen,
  waitFor,
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

import { DuplicateCompareModal } from "./DuplicateCompareModal"
import { duplicateCompareModalAtom } from "./duplicateCompareModalAtom"
import { buildDuplicateGroup } from "./duplicateFixtures"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const KEPT_PATH =
  "/library/Harbour Lights/Long Way Down/01 Tidewater.flac"
const REDUNDANT_PATH =
  "/library/Harbour Lights/Long Way Down/01 Tidewater.mp3"

const renderModal = (groups = [buildDuplicateGroup()]) => {
  const store = createStore()
  store.set(duplicateCompareModalAtom, {
    groups,
    jobId: "job-1",
    sourcePath: "/library",
    stepId: "step-1",
  })
  return render(
    <Provider store={store}>
      <DuplicateCompareModal />
    </Provider>,
  )
}

const stubResolveEndpoint = () =>
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        destination: "/holding/x.mp3",
        error: null,
        isOk: true,
      }),
      { status: 200 },
    ),
  )

describe(DuplicateCompareModal.name, () => {
  beforeEach(() => {
    stubResolveEndpoint()
  })

  test("shows the copies with the recommended keep already selected", () => {
    renderModal()

    expect(
      screen.getByRole("radio", {
        name: `Keep ${KEPT_PATH}`,
      }),
    ).toBeChecked()
    expect(
      screen.getByRole("radio", {
        name: `Keep ${REDUNDANT_PATH}`,
      }),
    ).not.toBeChecked()
  })

  test("says why the kept copy won", () => {
    renderModal()

    expect(screen.getByText(/Kept because/u)).toBeVisible()
  })

  // The safety default. Only identical audio is proof, so a tag match
  // must not arrive pre-armed.
  test("a tag-only group starts unchecked", () => {
    renderModal([
      buildDuplicateGroup({ matchReason: "tags" }),
    ])

    expect(
      screen.getByRole("checkbox", {
        name: /^Include/u,
      }),
    ).not.toBeChecked()
  })

  test("an identical-audio group starts checked", () => {
    renderModal()

    expect(
      screen.getByRole("checkbox", {
        name: /^Include/u,
      }),
    ).toBeChecked()
  })

  // Nothing moves without somewhere to move it TO. Deleting instead is
  // not an option this surface offers.
  test("confirm stays disabled until a holding folder is given", async () => {
    const user = userEvent.setup()
    renderModal()

    const confirmButton = screen.getByRole("button", {
      name: /Move redundant copies/u,
    })
    expect(confirmButton).toBeDisabled()

    await user.type(
      screen.getByLabelText("Holding folder"),
      "/holding",
    )

    expect(confirmButton).toBeEnabled()
  })

  test("moves only the copies that are not kept", async () => {
    const user = userEvent.setup()
    const fetchSpy = stubResolveEndpoint()
    renderModal()

    await user.type(
      screen.getByLabelText("Holding folder"),
      "/holding",
    )
    await user.click(
      screen.getByRole("button", {
        name: /Move redundant copies/u,
      }),
    )

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })
    expect(
      JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body)),
    ).toMatchObject({
      filePath: REDUNDANT_PATH,
      holdingFolderPath: "/holding",
      sourceRootPath: "/library",
    })
  })

  // Overriding the recommendation has to change which file moves, or the
  // radio is decoration.
  test("overriding the keep changes which copy moves", async () => {
    const user = userEvent.setup()
    const fetchSpy = stubResolveEndpoint()
    renderModal()

    await user.click(
      screen.getByRole("radio", {
        name: `Keep ${REDUNDANT_PATH}`,
      }),
    )
    await user.type(
      screen.getByLabelText("Holding folder"),
      "/holding",
    )
    await user.click(
      screen.getByRole("button", {
        name: /Move redundant copies/u,
      }),
    )

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })
    expect(
      JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body)),
    ).toMatchObject({ filePath: KEPT_PATH })
  })

  test("a failed move lands on its own row", async () => {
    const user = userEvent.setup()
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          destination: null,
          error: "EACCES: permission denied",
          isOk: false,
        }),
        { status: 200 },
      ),
    )
    renderModal()

    await user.type(
      screen.getByLabelText("Holding folder"),
      "/holding",
    )
    await user.click(
      screen.getByRole("button", {
        name: /Move redundant copies/u,
      }),
    )

    expect(
      await screen.findByText(/EACCES: permission denied/u),
    ).toBeVisible()
  })

  test("says so plainly when there are no duplicates", () => {
    renderModal([])

    expect(screen.getByText("No duplicates")).toBeVisible()
  })
})
