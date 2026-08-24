import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

import { ReleaseCandidatePicker } from "./ReleaseCandidatePicker"
import type { ScoredReleaseCandidate } from "./tagMatchTypes"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const buildCandidate = ({
  confidence,
  country,
  releaseId,
  releaseTitle,
}: {
  confidence: number
  country?: string
  releaseId: string
  releaseTitle: string
}): ScoredReleaseCandidate => ({
  candidate: {
    artistName: "Nova Harbour",
    country,
    format: "CD",
    label: "Tidewater Records",
    releaseId,
    releaseTitle,
    source: "musicbrainz",
    trackCount: 11,
    year: "2019",
  },
  confidence,
  proposedTags: { album: releaseTitle },
})

const fourCandidates = [
  buildCandidate({
    confidence: 0.92,
    country: "GB",
    releaseId: "release-gb-cd",
    releaseTitle: "Harbour Lights",
  }),
  buildCandidate({
    confidence: 0.74,
    country: "JP",
    releaseId: "release-jp-cd",
    releaseTitle: "Harbour Lights (Japan)",
  }),
  buildCandidate({
    confidence: 0.51,
    country: "US",
    releaseId: "release-us-digital",
    releaseTitle: "Harbour Lights (Deluxe)",
  }),
]

// Six candidates trips the Combobox branch.
const sixCandidates = fourCandidates.concat([
  buildCandidate({
    confidence: 0.4,
    releaseId: "release-4",
    releaseTitle: "Harbour Lights (Reissue)",
  }),
  buildCandidate({
    confidence: 0.3,
    releaseId: "release-5",
    releaseTitle: "Harbour Lights (Promo)",
  }),
  buildCandidate({
    confidence: 0.2,
    releaseId: "release-6",
    releaseTitle: "Harbour Lights (Test Pressing)",
  }),
])

describe("ReleaseCandidatePicker", () => {
  test("the trigger's accessible name carries the selected release", () => {
    render(
      <ReleaseCandidatePicker
        ariaLabel="Release for 03 signal fires.flac"
        candidates={fourCandidates}
        isDisabled={false}
        onSelect={() => {}}
        selectedReleaseId="release-jp-cd"
      />,
    )
    expect(
      screen.getByRole("button", {
        name: /^Release for 03 signal fires\.flac: /,
      }),
    ).toHaveAccessibleName(
      "Release for 03 signal fires.flac: Harbour Lights (Japan)",
    )
  })

  test("picking an option commits its release id", async () => {
    const user = userEvent.setup()
    const handleSelect = vi.fn()
    render(
      <ReleaseCandidatePicker
        ariaLabel="Release for 03 signal fires.flac"
        candidates={fourCandidates}
        isDisabled={false}
        onSelect={handleSelect}
        selectedReleaseId="release-gb-cd"
      />,
    )
    await user.click(
      screen.getByRole("button", {
        name: /^Release for 03 signal fires\.flac: /,
      }),
    )
    await user.click(
      screen.getByRole("option", {
        name: /Harbour Lights \(Deluxe\)/,
      }),
    )
    expect(handleSelect).toHaveBeenCalledWith(
      "release-us-digital",
    )
  })

  test("an option carries the facts that separate two releases", async () => {
    const user = userEvent.setup()
    render(
      <ReleaseCandidatePicker
        ariaLabel="Release for 03 signal fires.flac"
        candidates={fourCandidates}
        isDisabled={false}
        onSelect={() => {}}
        selectedReleaseId="release-gb-cd"
      />,
    )
    await user.click(
      screen.getByRole("button", {
        name: /^Release for 03 signal fires\.flac: /,
      }),
    )
    const optionName =
      screen
        .getByRole("option", { name: /GB/ })
        .getAttribute("aria-label") ??
      screen.getByRole("option", { name: /GB/ })
        .textContent ??
      ""
    // Country, format, year, track count and label are the facts that
    // stop a wrong match, so every one of them is on the option.
    expect(optionName).toContain("Harbour Lights")
    expect(optionName).toContain("Nova Harbour")
    expect(optionName).toContain("GB")
    expect(optionName).toContain("CD")
    expect(optionName).toContain("2019")
    expect(optionName).toContain("11 tracks")
    expect(optionName).toContain("Tidewater Records")
  })

  test("six or more candidates render the searchable Combobox", async () => {
    const user = userEvent.setup()
    render(
      <ReleaseCandidatePicker
        ariaLabel="Release for 03 signal fires.flac"
        candidates={sixCandidates}
        isDisabled={false}
        onSelect={() => {}}
        selectedReleaseId="release-gb-cd"
      />,
    )
    await user.click(
      screen.getByRole("button", {
        name: /^Release for 03 signal fires\.flac: /,
      }),
    )
    expect(
      screen.getByPlaceholderText("Search releases…"),
    ).toBeVisible()
  })

  test("under six candidates there is no search field", async () => {
    const user = userEvent.setup()
    render(
      <ReleaseCandidatePicker
        ariaLabel="Release for 03 signal fires.flac"
        candidates={fourCandidates}
        isDisabled={false}
        onSelect={() => {}}
        selectedReleaseId="release-gb-cd"
      />,
    )
    await user.click(
      screen.getByRole("button", {
        name: /^Release for 03 signal fires\.flac: /,
      }),
    )
    expect(
      screen.queryByPlaceholderText("Search releases…"),
    ).toBeNull()
  })

  test("a disabled picker does not open", async () => {
    const user = userEvent.setup()
    render(
      <ReleaseCandidatePicker
        ariaLabel="Release for 03 signal fires.flac"
        candidates={fourCandidates}
        isDisabled
        onSelect={() => {}}
        selectedReleaseId="release-gb-cd"
      />,
    )
    await user.click(
      screen.getByRole("button", {
        name: /^Release for 03 signal fires\.flac: /,
      }),
    )
    expect(screen.queryAllByRole("option")).toEqual([])
  })
})
