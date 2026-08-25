import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

// Both tag modules are mocked BEFORE the route imports them. The real
// reader parses container bytes and the real writer calls taglib-sharp;
// neither belongs in a route test, and both have their own suites against
// ffmpeg-generated fixtures.
vi.mock(
  "@mux-magic/core/src/music/tags/readAudioTags.js",
  () => ({ readAudioTags: vi.fn() }),
)
vi.mock(
  "@mux-magic/core/src/music/tags/writeAudioTags.js",
  () => ({ writeAudioTags: vi.fn() }),
)

import { readAudioTags } from "@mux-magic/core/src/music/tags/readAudioTags.js"
import { writeAudioTags } from "@mux-magic/core/src/music/tags/writeAudioTags.js"
import {
  buildHoldingDestination,
  musicRoutes,
} from "./musicRoutes.js"

const postTags = (body: unknown) =>
  musicRoutes.request("/music/tags", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  })

const mockCurrentTags = (tags: Record<string, unknown>) => {
  vi.mocked(readAudioTags).mockResolvedValue({
    info: {
      fileSizeBytes: 1024,
      filePath: "/music/01.flac",
      hasEmbeddedCoverArt: false,
    },
    tags,
  } as Awaited<ReturnType<typeof readAudioTags>>)
}

describe("POST /music/tags", () => {
  beforeEach(() => {
    vi.mocked(readAudioTags).mockReset()
    vi.mocked(writeAudioTags).mockReset()
    vi.mocked(writeAudioTags).mockResolvedValue(undefined)
  })

  test("writes the reviewed tag set and reports which fields changed", async () => {
    mockCurrentTags({ title: "Track 01" })

    const response = await postTags({
      filePath: "/music/01.flac",
      tags: {
        artist: "Public Enemy",
        title: "Bring the Noise",
      },
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      changedFields: ["title", "artist"],
      error: null,
      isOk: true,
    })
    expect(writeAudioTags).toHaveBeenCalledTimes(1)
  })

  test("a file already carrying the values is not rewritten", async () => {
    mockCurrentTags({ title: "Bring the Noise" })

    const response = await postTags({
      filePath: "/music/01.flac",
      tags: { title: "Bring the Noise" },
    })

    await expect(response.json()).resolves.toEqual({
      changedFields: [],
      error: null,
      isOk: true,
    })
    expect(writeAudioTags).not.toHaveBeenCalled()
  })

  test("a dry run reports the change and writes nothing", async () => {
    mockCurrentTags({ title: "Track 01" })

    const response = await postTags({
      filePath: "/music/01.flac",
      isDryRun: true,
      tags: { title: "Bring the Noise" },
    })

    await expect(response.json()).resolves.toMatchObject({
      changedFields: ["title"],
      isOk: true,
    })
    expect(writeAudioTags).not.toHaveBeenCalled()
  })

  // The modal renders one row per request and needs the reason as data. A
  // thrown status would give the row "HTTP 400" and nothing about why.
  test("a failed write is a 200 carrying isOk:false and the reason", async () => {
    mockCurrentTags({})
    vi.mocked(writeAudioTags).mockRejectedValue(
      new Error("EACCES: permission denied"),
    )

    const response = await postTags({
      filePath: "/music/01.flac",
      tags: { title: "Bring the Noise" },
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      changedFields: [],
      error: "EACCES: permission denied",
      isOk: false,
    })
  })

  test("a relative path is refused before the file is opened", async () => {
    mockCurrentTags({})

    const response = await postTags({
      filePath: "music/01.flac",
      tags: { title: "Bring the Noise" },
    })

    await expect(response.json()).resolves.toMatchObject({
      isOk: false,
    })
    expect(readAudioTags).not.toHaveBeenCalled()
    expect(writeAudioTags).not.toHaveBeenCalled()
  })

  test("fields absent from the request are left alone rather than cleared", async () => {
    mockCurrentTags({
      album: "It Takes a Nation of Millions",
      title: "Track 01",
    })

    await postTags({
      filePath: "/music/01.flac",
      tags: { title: "Bring the Noise" },
    })

    expect(
      vi.mocked(writeAudioTags).mock.calls[0][0].tags,
    ).toEqual({ title: "Bring the Noise" })
  })
})

describe(buildHoldingDestination.name, () => {
  // Flattening instead would make `Disc 1/01 Intro.flac` and
  // `Disc 2/01 Intro.flac` collide, and the second move would land on
  // the first one — destroying the copy this route exists to preserve.
  test("mirrors the folder structure below the scanned root", () => {
    expect(
      buildHoldingDestination({
        filePath:
          "/media/Music/Nova Harbour/Tidewater/Disc 2/01 Intro.flac",
        holdingFolderPath: "/media/Duplicates-Holding",
        sourceRootPath: "/media/Music",
      }),
    ).toBe(
      "/media/Duplicates-Holding/Nova Harbour/Tidewater/Disc 2/01 Intro.flac",
    )
  })

  test("two same-named tracks from different discs do not collide", () => {
    const buildFor = (discFolder: string) =>
      buildHoldingDestination({
        filePath: `/media/Music/Album/${discFolder}/01 Intro.flac`,
        holdingFolderPath: "/media/Holding",
        sourceRootPath: "/media/Music",
      })

    expect(buildFor("Disc 1")).not.toBe(buildFor("Disc 2"))
  })

  // `relative` would otherwise produce a `../..` chain that climbs back
  // out of the holding folder, which is the traversal this whole surface
  // refuses.
  test("a file outside the scanned root keeps only its name", () => {
    expect(
      buildHoldingDestination({
        filePath: "/somewhere/else/01 Intro.flac",
        holdingFolderPath: "/media/Holding",
        sourceRootPath: "/media/Music",
      }),
    ).toBe("/media/Holding/01 Intro.flac")
  })
})

const postAcoustIdSubmit = (body: unknown) =>
  musicRoutes.request("/music/acoustid/submit", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  })

const postSeedRelease = (body: unknown) =>
  musicRoutes.request("/music/musicbrainz/seed-release", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  })

describe("POST /music/acoustid/submit", () => {
  // AcoustID queues a submission the moment it accepts one, so there is
  // no "preview" request that leaves the public database untouched. A
  // dry run therefore must not reach the network at all.
  test("a dry run sends nothing to AcoustID", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")

    const response = await postAcoustIdSubmit({
      isDryRun: true,
      submissions: [
        {
          durationSeconds: 212,
          fingerprint: "AQAD",
          musicBrainzRecordingId: "recording-1",
        },
      ],
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      isOk: true,
      submissions: [],
    })
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  // The modal renders one panel per request and needs the reason as
  // data; a thrown status would give it "HTTP 500" and nothing about
  // which key is wrong.
  test("a failure comes back as data, not a status code", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: 4, message: "invalid API key" },
          status: "error",
        }),
      ),
    )
    vi.stubEnv("ACOUSTID_API_KEY", "application-key")
    vi.stubEnv("ACOUSTID_USER_API_KEY", "account-key")

    const response = await postAcoustIdSubmit({
      submissions: [
        { durationSeconds: 212, fingerprint: "AQAD" },
      ],
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      isOk: false,
      submissions: [],
    })
    vi.unstubAllEnvs()
  })
})

describe("POST /music/musicbrainz/seed-release", () => {
  // ⚠️ Returns HTML, not a URL. A seed passed as query parameters is
  // ignored and the release editor opens completely empty — it reads its
  // seed from a form POST body.
  test("returns a self-submitting form, not a link", async () => {
    const response = await postSeedRelease({
      albumArtistName: "Nova Harbour",
      releaseTitle: "Tidewater",
      tracks: [
        {
          lengthMilliseconds: 210_000,
          title: "Slack Water",
          trackNumber: 1,
        },
      ],
    })
    const html = await response.text()

    expect(response.status).toBe(200)
    expect(html).toContain('method="POST"')
    expect(html).toContain(
      'action="https://musicbrainz.org/release/add"',
    )
    expect(html).toContain("Slack Water")
  })
})
