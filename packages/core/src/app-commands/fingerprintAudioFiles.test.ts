import { vol } from "memfs"
import { firstValueFrom, of, throwError } from "rxjs"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

import { runFpcalc } from "../cli-spawn-operations/runFpcalc.js"
import { fingerprintAudioFiles } from "./fingerprintAudioFiles.js"

vi.mock("../cli-spawn-operations/runFpcalc.js", () => ({
  runFpcalc: vi.fn(),
}))

const buildLookupBody = ({
  recordingId = "recording-1",
  score = 0.98,
}: {
  recordingId?: string
  score?: number
} = {}) =>
  JSON.stringify({
    results: [
      {
        id: "acoust-id-1",
        recordings: [
          {
            artists: [
              { id: "artist-1", name: "Ace of Base" },
            ],
            duration: 212,
            id: recordingId,
            title: "All That She Wants",
          },
        ],
        score,
      },
    ],
    status: "ok",
  })

describe(fingerprintAudioFiles.name, () => {
  beforeEach(() => {
    vol.reset()
    vi.mocked(runFpcalc).mockReset()
    // The lookup builds its own request body, so it needs the application
    // key even when the fetcher is a stub.
    vi.stubEnv("ACOUSTID_API_KEY", "test-application-key")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test("attaches the AcoustID recordings to each file", async () => {
    vol.fromJSON({ "/inbox/track01.mp3": "x" })
    vi.mocked(runFpcalc).mockReturnValue(
      of({ durationSeconds: 212.4, fingerprint: "AQAD" }),
    )

    const records = await firstValueFrom(
      fingerprintAudioFiles({
        cachedFetch: () =>
          Promise.resolve({
            body: buildLookupBody(),
            isFromCache: false,
          }),
        sourcePath: "/inbox",
      }),
    )

    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      acoustId: "acoust-id-1",
      filename: "track01.mp3",
      fingerprint: "AQAD",
      kind: "matched",
      score: 0.98,
    })
  })

  // The whole point of the phase: a file whose tags say nothing still
  // gets identified, because the fingerprint comes from the audio.
  test("identifies an untagged file, which the MusicBrainz match cannot", async () => {
    vol.fromJSON({ "/inbox/track01.mp3": "x" })
    vi.mocked(runFpcalc).mockReturnValue(
      of({ durationSeconds: 212, fingerprint: "AQAD" }),
    )

    const records = await firstValueFrom(
      fingerprintAudioFiles({
        cachedFetch: () =>
          Promise.resolve({
            body: buildLookupBody(),
            isFromCache: false,
          }),
        sourcePath: "/inbox",
      }),
    )

    expect(
      records[0].kind === "matched" &&
        records[0].recordings[0].recordingId,
    ).toBe("recording-1")
  })

  test("a score under the floor is an unmatched row, not a bad match", async () => {
    vol.fromJSON({ "/inbox/track01.mp3": "x" })
    vi.mocked(runFpcalc).mockReturnValue(
      of({ durationSeconds: 212, fingerprint: "AQAD" }),
    )

    const records = await firstValueFrom(
      fingerprintAudioFiles({
        cachedFetch: () =>
          Promise.resolve({
            body: buildLookupBody({ score: 0.2 }),
            isFromCache: false,
          }),
        sourcePath: "/inbox",
      }),
    )

    expect(records[0]).toMatchObject({
      fingerprint: "AQAD",
      kind: "unmatched",
    })
  })

  test("caps the recordings offered per row", async () => {
    vol.fromJSON({ "/inbox/track01.mp3": "x" })
    vi.mocked(runFpcalc).mockReturnValue(
      of({ durationSeconds: 212, fingerprint: "AQAD" }),
    )

    const records = await firstValueFrom(
      fingerprintAudioFiles({
        cachedFetch: () =>
          Promise.resolve({
            body: JSON.stringify({
              results: [
                {
                  id: "acoust-id-1",
                  recordings: Array.from(
                    { length: 13 },
                    (_unused, index) => ({
                      id: `recording-${index}`,
                      title: "All That She Wants",
                    }),
                  ),
                  score: 0.99,
                },
              ],
              status: "ok",
            }),
            isFromCache: false,
          }),
        recordingLimit: 3,
        sourcePath: "/inbox",
      }),
    )

    expect(
      records[0].kind === "matched" &&
        records[0].recordings.length,
    ).toBe(3)
  })

  // A folder of 200 tracks with one truncated download is the normal
  // case. Killing the run over it would mean the other 199 never reach
  // the table.
  test("one unreadable file becomes a row, and the rest still run", async () => {
    vol.fromJSON({
      "/inbox/broken.mp3": "x",
      "/inbox/good.mp3": "x",
    })
    vi.mocked(runFpcalc).mockImplementation(
      ({ filePath }: { filePath: string }) =>
        filePath.includes("broken")
          ? throwError(
              () => new Error("fpcalc exited with code 3"),
            )
          : of({
              durationSeconds: 212,
              fingerprint: "AQAD",
            }),
    )

    const records = await firstValueFrom(
      fingerprintAudioFiles({
        cachedFetch: () =>
          Promise.resolve({
            body: buildLookupBody(),
            isFromCache: false,
          }),
        sourcePath: "/inbox",
      }),
    )

    expect(
      records
        .map((record) => record.kind)
        .toSorted((first, second) =>
          first.localeCompare(second),
        ),
    ).toEqual(["failed", "matched"])
  })

  // The key is genuinely required, and the failure has to name WHICH of
  // AcoustID's two keys is missing rather than surfacing an HTTP error.
  test("a missing application key is a row with a readable reason", async () => {
    vol.fromJSON({ "/inbox/track01.mp3": "x" })
    vi.stubEnv("ACOUSTID_API_KEY", "")
    vi.mocked(runFpcalc).mockReturnValue(
      of({ durationSeconds: 212, fingerprint: "AQAD" }),
    )

    const records = await firstValueFrom(
      fingerprintAudioFiles({
        cachedFetch: () =>
          Promise.resolve({
            body: buildLookupBody(),
            isFromCache: false,
          }),
        sourcePath: "/inbox",
      }),
    )

    expect(records[0]).toMatchObject({ kind: "failed" })
    expect(
      records[0].kind === "failed" && records[0].reason,
    ).toMatch(/ACOUSTID_API_KEY is not set/u)
  })

  test("ignores files that are not audio", async () => {
    vol.fromJSON({
      "/inbox/cover.jpg": "x",
      "/inbox/track01.mp3": "x",
    })
    vi.mocked(runFpcalc).mockReturnValue(
      of({ durationSeconds: 212, fingerprint: "AQAD" }),
    )

    const records = await firstValueFrom(
      fingerprintAudioFiles({
        cachedFetch: () =>
          Promise.resolve({
            body: buildLookupBody(),
            isFromCache: false,
          }),
        sourcePath: "/inbox",
      }),
    )

    expect(
      records.map((record) => record.filename),
    ).toEqual(["track01.mp3"])
  })
})
