import {
  cleanup,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"
import { FingerprintRunResults } from "./FingerprintRunResults"
import { buildFingerprintMatch } from "./fingerprintFixtures"
import {
  buildAcoustIdSubmissionPlans,
  findFingerprintMatches,
  isFingerprintMatch,
} from "./fingerprintResultTypes"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const stubSubmitEndpoint = () =>
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        error: null,
        isOk: true,
        submissions: [{ submissionId: 7 }],
      }),
      { status: 200 },
    ),
  )

describe(isFingerprintMatch.name, () => {
  test("accepts a matched record", () => {
    expect(
      isFingerprintMatch(buildFingerprintMatch()),
    ).toBe(true)
  })

  test.each([
    ["null", null],
    [
      "an unmatched record",
      { fingerprint: "AQAD", kind: "unmatched" },
    ],
    ["a failed record", { kind: "failed", reason: "boom" }],
    [
      "a duplicate group",
      { copies: [], isDuplicateGroup: true },
    ],
  ])("rejects %s", (_label, entry) => {
    expect(isFingerprintMatch(entry)).toBe(false)
  })
})

describe(findFingerprintMatches.name, () => {
  test("picks matches out of a mixed results stream", () => {
    expect(
      findFingerprintMatches([
        buildFingerprintMatch(),
        { fingerprint: "AQAD", kind: "unmatched" },
        { kind: "failed", reason: "boom" },
      ]),
    ).toHaveLength(1)
  })
})

describe(buildAcoustIdSubmissionPlans.name, () => {
  // ⚠️ A fingerprint sent with no recording id adds a public entry
  // linked to nothing. It helps nobody and still counts as a write under
  // the owner's account.
  test("leaves out a match with no MusicBrainz recording", () => {
    expect(
      buildAcoustIdSubmissionPlans([
        buildFingerprintMatch({ hasRecording: false }),
      ]),
    ).toEqual([])
  })

  test("carries the fingerprint, duration and recording id", () => {
    expect(
      buildAcoustIdSubmissionPlans([
        buildFingerprintMatch({ filename: "01.flac" }),
      ]),
    ).toEqual([
      {
        durationSeconds: 210.4,
        fingerprint: "AQAD-01.flac",
        musicBrainzRecordingId: "recording-01.flac",
      },
    ])
  })
})

describe(FingerprintRunResults.name, () => {
  test("counts what was identified and what can be contributed", () => {
    render(
      <FingerprintRunResults
        matches={[
          buildFingerprintMatch({ filename: "01.flac" }),
          buildFingerprintMatch({
            filename: "02.flac",
            hasRecording: false,
          }),
        ]}
      />,
    )

    expect(
      screen.getByText(
        /2 files identified by fingerprint\. 1 carries/u,
      ),
    ).toBeVisible()
  })

  test("submits only the linked fingerprints", async () => {
    const user = userEvent.setup()
    const fetchSpy = stubSubmitEndpoint()
    render(
      <FingerprintRunResults
        matches={[
          buildFingerprintMatch({ filename: "01.flac" }),
          buildFingerprintMatch({
            filename: "02.flac",
            hasRecording: false,
          }),
        ]}
      />,
    )

    await user.click(
      screen.getByRole("button", {
        name: /Contribute to AcoustID/u,
      }),
    )

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })
    expect(
      JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body)),
    ).toEqual({
      submissions: [
        {
          durationSeconds: 210.4,
          fingerprint: "AQAD-01.flac",
          musicBrainzRecordingId: "recording-01.flac",
        },
      ],
    })
  })

  // Nothing to say means no button. Offering a public database write
  // that would carry no information is worse than offering nothing.
  test("withholds the button when nothing is contributable", () => {
    render(
      <FingerprintRunResults
        matches={[
          buildFingerprintMatch({ hasRecording: false }),
        ]}
      />,
    )

    expect(
      screen.queryByRole("button", {
        name: /Contribute to AcoustID/u,
      }),
    ).toBeNull()
  })

  // AcoustID queues rather than applying at once, so saying "done" would
  // overstate what happened.
  test("says the submissions are queued, not applied", async () => {
    const user = userEvent.setup()
    stubSubmitEndpoint()
    render(
      <FingerprintRunResults
        matches={[buildFingerprintMatch()]}
      />,
    )

    await user.click(
      screen.getByRole("button", {
        name: /Contribute to AcoustID/u,
      }),
    )

    expect(
      await screen.findByText(/pending/u),
    ).toBeVisible()
  })

  test("a rejected submission shows AcoustID's own reason", async () => {
    const user = userEvent.setup()
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error:
            "AcoustID submission error 4: invalid API key",
          isOk: false,
          submissions: [],
        }),
        { status: 200 },
      ),
    )
    render(
      <FingerprintRunResults
        matches={[buildFingerprintMatch()]}
      />,
    )

    await user.click(
      screen.getByRole("button", {
        name: /Contribute to AcoustID/u,
      }),
    )

    expect(
      await screen.findByText(/invalid API key/u),
    ).toBeVisible()
  })

  test("renders nothing when the run identified nothing", () => {
    const { container } = render(
      <FingerprintRunResults matches={[]} />,
    )

    expect(container).toBeEmptyDOMElement()
  })
})
