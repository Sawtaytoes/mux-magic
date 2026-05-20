import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react"
import { afterEach, describe, expect, test } from "vitest"
import { ConvertLosslessRunResults } from "./ConvertLosslessRunResults"
import type {
  ConvertLosslessRunResultsData,
  ConvertLosslessSkippedRecord,
} from "./findConvertLosslessResults"

afterEach(() => {
  cleanup()
})

const buildData = (
  overrides: Partial<ConvertLosslessRunResultsData> = {},
): ConvertLosslessRunResultsData => ({
  converted: [],
  skipped: [],
  ...overrides,
})

describe("ConvertLosslessRunResults", () => {
  test("renders nothing when both bins are empty", () => {
    const { container } = render(
      <ConvertLosslessRunResults data={buildData()} />,
    )
    expect(container.firstChild).toBeNull()
  })

  describe("non-audit (real run)", () => {
    test('uses "converted" / "skipped" wording and shows source → destination for converted entries', () => {
      render(
        <ConvertLosslessRunResults
          data={buildData({
            converted: [
              {
                kind: "converted",
                source: "/music/a.wav",
                destination: "/music/a.flac",
              },
            ],
            skipped: [
              {
                kind: "skipped",
                source: "/music/b.wav",
                reason: "float-pcm",
              },
            ],
          })}
        />,
      )
      expect(screen.getByText("converted")).toBeVisible()
      expect(screen.getByText("skipped")).toBeVisible()
      // Real-run "Converted" group starts collapsed (the boring
      // expected case); expand it so the entries become visible.
      const convertedSummary =
        screen.getByText("Converted (1)")
      expect(convertedSummary).toBeVisible()
      fireEvent.click(convertedSummary)
      // Source → destination rendered as one <li> with mixed
      // text + span nodes; match against the joined textContent.
      const convertedRow = screen.getByText(
        (_, element) =>
          element?.tagName === "LI" &&
          /a\.wav.*→.*a\.flac/u.test(
            element.textContent ?? "",
          ),
      )
      expect(convertedRow).toBeVisible()
      // Skipped group uses non-audit wording.
      expect(screen.getByText(/^Skipped — /)).toBeVisible()
      // No "would" wording in a real run.
      expect(
        screen.queryByText(/would convert/i),
      ).toBeNull()
    })
  })

  describe("audit mode (audit-only records present)", () => {
    test('uses "would convert" / "would skip" wording and lists every compatible file by name', () => {
      const data = buildData({
        skipped: [
          {
            kind: "skipped",
            source: "/music/a-compatible.wav",
            reason: "audit-only",
          },
          {
            kind: "skipped",
            source: "/music/b-compatible.wav",
            reason: "audit-only",
          },
          {
            kind: "skipped",
            source: "/music/c-float.wav",
            reason: "float-pcm",
          },
        ],
      })
      render(<ConvertLosslessRunResults data={data} />)

      // Count chips reflect the would-convert vs would-skip
      // partitioning — NOT a single combined skip count.
      expect(
        screen.getByText("would convert"),
      ).toBeVisible()
      expect(screen.getByText("would skip")).toBeVisible()

      // The 2 audit-only files appear under "Would convert (2)" —
      // the regression case: previously hidden, making the audit
      // look like "all are float-pcm."
      expect(
        screen.getByText("Would convert (2)"),
      ).toBeVisible()
      expect(
        screen.getByText("a-compatible.wav"),
      ).toBeVisible()
      expect(
        screen.getByText("b-compatible.wav"),
      ).toBeVisible()

      // The float file appears under the "Would skip" group, not
      // "Skipped" — confirms the audit-mode label sweep.
      expect(
        screen.getByText(/^Would skip — /),
      ).toBeVisible()
      expect(screen.getByText("c-float.wav")).toBeVisible()

      // Audit banner is present so the user can't miss the mode.
      const banner = document.querySelector(
        "[data-cl-audit-banner]",
      )
      expect(banner).not.toBeNull()
    })

    test("an audit run with ONLY audit-only records (zero float/DSD) still shows the would-convert list", () => {
      // Before this fix: audit-only was filtered out of both
      // counts and listings, so an all-compatible folder rendered
      // as "0 converted • 0 skipped" with nothing else — the
      // panel disappeared entirely and the user had no idea the
      // audit had run.
      const data = buildData({
        skipped: [
          {
            kind: "skipped",
            source: "/music/x.wav",
            reason: "audit-only",
          },
          {
            kind: "skipped",
            source: "/music/y.wav",
            reason: "audit-only",
          },
        ],
      })
      render(<ConvertLosslessRunResults data={data} />)

      expect(
        screen.getByText("Would convert (2)"),
      ).toBeVisible()
      expect(screen.getByText("x.wav")).toBeVisible()
      expect(screen.getByText("y.wav")).toBeVisible()

      // The would-skip count is 0 (no float/DSD) but the chip is
      // still present so the user has a complete picture.
      const wouldSkipChip = screen
        .getByText("would skip")
        .closest("span")
      expect(wouldSkipChip?.textContent).toContain("0")
    })

    test("count is partitioned correctly: would-convert (audit-only) + would-skip (float-pcm) do NOT collapse into one number", () => {
      // The exact shape of the user-reported regression:
      // ~20 compatible + 124 float should NOT render as
      // "124 skipped, all float-pcm" — instead "20 would
      // convert • 124 would skip."
      const auditOnly: ConvertLosslessSkippedRecord[] =
        Array.from({ length: 20 }, (_, index) => ({
          kind: "skipped" as const,
          source: `/music/ok-${String(index).padStart(2, "0")}.wav`,
          reason: "audit-only" as const,
        }))
      const float: ConvertLosslessSkippedRecord[] =
        Array.from({ length: 124 }, (_, index) => ({
          kind: "skipped" as const,
          source: `/music/float-${String(index).padStart(3, "0")}.wav`,
          reason: "float-pcm" as const,
        }))
      render(
        <ConvertLosslessRunResults
          data={buildData({
            skipped: auditOnly.concat(float),
          })}
        />,
      )

      expect(
        screen.getByText("Would convert (20)"),
      ).toBeVisible()
      // Reason label includes the count; matching the (124)
      // pins the float partition explicitly.
      expect(
        screen.getByText(/Would skip — .*\(124\)$/),
      ).toBeVisible()
    })
  })
})
