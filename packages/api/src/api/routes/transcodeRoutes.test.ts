import { type Observable, of } from "rxjs"
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

// Hoisted mock for getMediaInfo so individual tests can swap the tracks
// it returns (e.g. a video-only VC-1 file vs. an H.264 file with audio).
// Typed loosely (Record tracks) so per-test fixtures with Video/Audio
// fields don't narrow to `never[]`.
type MockMediaInfo = {
  media: { track: Array<Record<string, unknown>> }
}
const { getMediaInfoMock } = vi.hoisted(() => ({
  getMediaInfoMock: vi.fn<() => Observable<MockMediaInfo>>(
    () => of({ media: { track: [] } }),
  ),
}))

// Validation-layer tests for /transcode/audio. The streaming encode
// flow lives behind RxJS + ffmpeg and is exercised manually rather than
// mocked here — these tests cover the input validation gates that
// decide whether a request even reaches the encoder.
//
// Mock buildFfmpegArgs and the temp store so that even if a validation
// slip lets a request through, the test never spawns ffmpeg.
// Mock getMediaInfo so HEAD tests don't attempt to spawn MediaInfo.exe.
vi.mock(
  "@mux-magic/core/src/cli-spawn-operations/runFfmpegAudioTranscode.js",
  () => ({
    buildFfmpegArgs: vi.fn(() => []),
  }),
)

vi.mock(
  "@mux-magic/core/src/tools/transcodeTempStore.js",
  () => ({
    mimeTypeForCodec: (_codec: string) => "video/mp4",
  }),
)

vi.mock(
  "@mux-magic/core/src/tools/getMediaInfo.js",
  () => ({
    getMediaInfo: getMediaInfoMock,
  }),
)

import { transcodeRoutes } from "./transcodeRoutes.js"

const get = (path: string) => transcodeRoutes.request(path)

const head = (path: string) =>
  transcodeRoutes.request(path, { method: "HEAD" })

afterEach(() => {
  vi.clearAllMocks()
  // Restore the default empty-track response between tests.
  getMediaInfoMock.mockReturnValue(
    of({ media: { track: [] } }),
  )
})

describe("GET /transcode/audio — input validation", () => {
  test("rejects missing path with 400", async () => {
    const response = await get("/transcode/audio")

    expect(response.status).toBe(400)
    const body = (await response.json()) as {
      error: string
    }
    expect(body.error).toMatch(/path/i)
  })

  test("rejects relative paths with 403 (path-safety)", async () => {
    const response = await get(
      "/transcode/audio?path=movie.mkv&codec=opus",
    )

    expect(response.status).toBe(403)
    const body = (await response.json()) as {
      error: string
    }
    expect(body.error).toMatch(/absolute/i)
  })

  test("rejects invalid codec with 400", async () => {
    const response = await get(
      "/transcode/audio?path=/media/movie.mkv&codec=mp3",
    )

    expect(response.status).toBe(400)
    const body = (await response.json()) as {
      error: string
    }
    expect(body.error).toMatch(/codec/i)
  })

  test("rejects bitrate above the 512k cap with 400", async () => {
    const response = await get(
      "/transcode/audio?path=/media/movie.mkv&codec=opus&bitrate=999k",
    )

    expect(response.status).toBe(400)
    const body = (await response.json()) as {
      error: string
    }
    expect(body.error).toMatch(/bitrate|cap/i)
  })

  test("rejects malformed bitrate with 400", async () => {
    const response = await get(
      "/transcode/audio?path=/media/movie.mkv&codec=opus&bitrate=fast",
    )

    expect(response.status).toBe(400)
  })
})

describe("HEAD /transcode/audio", () => {
  // Use a platform-appropriate absolute path so validateReadablePath
  // doesn't reject the path on Windows (where `/media/...` isn't
  // considered absolute) — the route now mirrors /files/stream's
  // path-safety, which accepts any absolute traversal-free path.
  const validPath =
    process.platform === "win32"
      ? "C:/test/movie.mkv"
      : "/media/movie.mkv"

  test("returns headers only with the codec's MIME for a valid absolute path", async () => {
    const response = await head(
      `/transcode/audio?path=${encodeURIComponent(validPath)}&codec=opus`,
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe(
      "video/mp4",
    )
    // HEAD per HTTP spec returns no body; verify by checking the
    // response body is empty.
    const text = await response.text()
    expect(text).toBe("")
  })

  test("HEAD honors path-safety rejection too", async () => {
    const response = await head(
      "/transcode/audio?path=relative.mkv&codec=opus",
    )

    expect(response.status).toBe(403)
  })

  test("HEAD with codec=aac returns video/mp4", async () => {
    const response = await head(
      `/transcode/audio?path=${encodeURIComponent(validPath)}&codec=aac`,
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe(
      "video/mp4",
    )
  })

  test("reports X-Has-Audio: false for a video-only VC-1 source (re-encodes to avc1)", async () => {
    getMediaInfoMock.mockReturnValue(
      of({
        media: {
          track: [
            { "@type": "General", Duration: "59.1" },
            { "@type": "Video", Format: "VC-1" },
          ],
        },
      }),
    )

    const response = await head(
      `/transcode/audio?path=${encodeURIComponent(validPath)}&codec=opus`,
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("X-Has-Audio")).toBe(
      "false",
    )
    expect(response.headers.get("X-Duration")).toBe("59.1")
    // Non-H.264 video re-encodes, so the advertised OUTPUT codec is H.264.
    expect(response.headers.get("X-Video-Codec")).toBe(
      "avc1.640029",
    )
  })

  test("reports X-Has-Audio: true and copies an H.264 source's codec", async () => {
    getMediaInfoMock.mockReturnValue(
      of({
        media: {
          track: [
            { "@type": "General", Duration: "120" },
            {
              "@type": "Video",
              Format: "AVC",
              Format_Profile: "High",
              Format_Level: "4.1",
            },
            { "@type": "Audio", Format: "AC-3" },
          ],
        },
      }),
    )

    const response = await head(
      `/transcode/audio?path=${encodeURIComponent(validPath)}&codec=opus`,
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("X-Has-Audio")).toBe("true")
    expect(response.headers.get("X-Video-Codec")).toBe(
      "avc1.640029",
    )
  })
})
