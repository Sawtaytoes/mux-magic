import { render, screen } from "@testing-library/react"
import { describe, expect, test, vi } from "vitest"
import { LookupReleaseStage } from "./LookupReleaseStage"

vi.mock("../../hooks/useBuilderActions", () => ({
  useBuilderActions: () => ({
    setParam: vi.fn(),
  }),
}))

const baseState = {
  lookupType: "dvdcompare" as const,
  stepId: "step-1",
  fieldName: "release",
  stage: "release" as const,
  searchTerm: "test",
  searchError: null,
  results: null,
  formatFilter: "all" as const,
  selectedGroup: null,
  selectedVariant: null,
  selectedFid: null,
  releases: null,
  releasesDebug: null,
  releasesError: null,
  isLoading: false,
}

describe("LookupReleaseStage", () => {
  test("renders loading state", () => {
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

  test("renders error message when releasesError is a string", () => {
    render(
      <LookupReleaseStage
        state={{
          ...baseState,
          releasesError: "Network error occurred",
        }}
        onClose={() => {}}
      />,
    )
    expect(
      screen.getByText("Network error occurred"),
    ).toBeInTheDocument()
  })

  test("converts error object to string before rendering", () => {
    render(
      <LookupReleaseStage
        state={{
          ...baseState,
          releasesError: {
            message: "Server error",
          } as unknown as string,
        }}
        onClose={() => {}}
      />,
    )
    // Should render the stringified object, not fail with React error
    expect(
      screen.getByText(/error|object/i),
    ).toBeInTheDocument()
  })

  test("renders no releases message when releases array is empty", () => {
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

  test("renders releases list when data is available", () => {
    render(
      <LookupReleaseStage
        state={{
          ...baseState,
          releases: [
            { hash: "hash1", label: "Blu-ray Release" },
            { hash: "hash2", label: "DVD Release" },
          ],
        }}
        onClose={() => {}}
      />,
    )
    expect(
      screen.getByText("Select a release:"),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Blu-ray Release"),
    ).toBeInTheDocument()
    expect(
      screen.getByText("DVD Release"),
    ).toBeInTheDocument()
  })
})
