import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

import type { LookupState } from "../LookupModal/types"
import { LookupReleaseStage } from "./LookupReleaseStage"

const setParamMock = vi.fn()
vi.mock("../../hooks/useBuilderActions", () => ({
  useBuilderActions: () => ({ setParam: setParamMock }),
}))

beforeEach(() => {
  setParamMock.mockClear()
})

afterEach(() => {
  cleanup()
})

const baseState: LookupState = {
  lookupType: "dvdcompare",
  stepId: "step-1",
  fieldName: "dvdCompareId",
  companionNameField: "dvdCompareName",
  stage: "release",
  searchTerm: "Soldier",
  searchError: null,
  results: null,
  formatFilter: "Blu-ray 4K",
  selectedGroup: {
    baseTitle: "Soldier",
    year: "1998",
    variants: [{ id: "74759", variant: "Blu-ray 4K" }],
  },
  selectedVariant: "Blu-ray 4K",
  selectedFid: "74759",
  releases: null,
  releasesDebug: null,
  releasesError: null,
  isLoading: false,
}

describe("LookupReleaseStage", () => {
  test("renders the loading state while releases are being fetched", () => {
    render(
      <LookupReleaseStage
        state={{ ...baseState, isLoading: true }}
        onClose={() => {}}
      />,
    )
    expect(
      screen.getByText("Loading releases…"),
    ).toBeInTheDocument()
  })

  test("coerces a non-string releasesError into a string so React does not crash", () => {
    // Regression: the server sometimes returned an error object
    // ({name, message}) which React refused to render as a child,
    // crashing the modal. The component must now coerce it.
    render(
      <LookupReleaseStage
        state={{
          ...baseState,
          releasesError: {
            name: "Error",
            message: "boom",
          } as unknown as string,
        }}
        onClose={() => {}}
      />,
    )
    // The output is whatever String({…}) produces — main point is no crash.
    expect(
      screen.getByText(/\[object Object\]|Error|boom/),
    ).toBeInTheDocument()
  })

  test("renders the empty-state message when there are no releases", () => {
    render(
      <LookupReleaseStage
        state={{ ...baseState, releases: [] }}
        onClose={() => {}}
      />,
    )
    expect(
      screen.getByText("No releases found."),
    ).toBeInTheDocument()
  })

  test("renders all releases and clicking one writes 4 fields (number id, name, number hash, label) — never an object", () => {
    render(
      <LookupReleaseStage
        state={{
          ...baseState,
          releases: [
            {
              hash: "1",
              label:
                "Blu-ray ALL America - Arrow Films - Limited Edition [2026]",
            },
            {
              hash: "2",
              label:
                "Blu-ray ALL Canada - Arrow Films - Limited Edition [2026]",
            },
          ],
        }}
        onClose={() => {}}
      />,
    )

    fireEvent.click(
      screen.getByText(
        "Blu-ray ALL America - Arrow Films - Limited Edition [2026]",
      ),
    )

    // Confirm all four setParam writes happened with the right field names + primitive values.
    const writes = setParamMock.mock.calls.map(
      ([, name, value]) => ({ name, value }),
    )
    expect(writes).toEqual(
      expect.arrayContaining([
        { name: "dvdCompareId", value: 74759 },
        { name: "dvdCompareName", value: "Soldier" },
        { name: "dvdCompareReleaseHash", value: 1 },
        {
          name: "dvdCompareReleaseLabel",
          value:
            "Blu-ray ALL America - Arrow Films - Limited Edition [2026]",
        },
      ]),
    )
    // No setParam call may write an object — that produced "[object Object]".
    for (const { value } of writes) {
      expect(
        typeof value === "object" && value !== null,
      ).toBe(false)
    }
  })
})
