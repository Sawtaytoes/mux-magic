import { afterEach, describe, expect, test, vi } from "vitest"

// Validation-layer tests for /transcode/audio. The streaming encode
// flow lives behind RxJS + ffmpeg and is exercised manually rather than
// mocked here — these tests cover the input validation gates that
// decide whether a request even reaches the encoder.
//
// Mock buildFfmpegArgs and the temp store so that even if a validation
// slip lets a request through, the test never spawns ffmpeg.
vi.mock("../../cli-spawn-operations/runFfmpegAudioTranscode.js", () => ({
  buildFfmpegArgs: vi.fn(() => []),
}))

vi.mock("../../tools/transcodeTempStore.js", () => ({
  mimeTypeForCodec: (_codec: string) => "video/mp4",
}))

import { transcodeRoutes } from "./transcodeRoutes.js"

const get = (path: string) => transcodeRoutes.request(path)

const head = (path: string) => transcodeRoutes.request(path, { method: "HEAD" })

afterEach(() => {
  vi.clearAllMocks()
})

describe("GET /transcode/audio — input validation", () => {
  test("rejects missing path with 400", async () => {
    const response = await get("/transcode/audio")

    expect(response.status).toBe(400)
    const body = await response.json() as { error: string }
    expect(body.error).toMatch(/path/i)
  })

  test("rejects relative paths with 403 (path-safety)", async () => {
    const response = await get("/transcode/audio?path=movie.mkv&codec=opus")

    expect(response.status).toBe(403)
    const body = await response.json() as { error: string }
    expect(body.error).toMatch(/absolute/i)
  })

  test("rejects invalid codec with 400", async () => {
    const response = await get("/transcode/audio?path=/media/movie.mkv&codec=mp3")

    expect(response.status).toBe(400)
    const body = await response.json() as { error: string }
    expect(body.error).toMatch(/codec/i)
  })

  test("rejects bitrate above the 512k cap with 400", async () => {
    const response = await get("/transcode/audio?path=/media/movie.mkv&codec=opus&bitrate=999k")

    expect(response.status).toBe(400)
    const body = await response.json() as { error: string }
    expect(body.error).toMatch(/bitrate|cap/i)
  })

  test("rejects malformed bitrate with 400", async () => {
    const response = await get("/transcode/audio?path=/media/movie.mkv&codec=opus&bitrate=fast")

    expect(response.status).toBe(400)
  })
})

describe("HEAD /transcode/audio", () => {
  // Use a platform-appropriate absolute path so validateReadablePath
  // doesn't reject the path on Windows (where `/media/...` isn't
  // considered absolute) — the route now mirrors /files/stream's
  // path-safety, which accepts any absolute traversal-free path.
  const validPath = process.platform === "win32"
    ? "C:/test/movie.mkv"
    : "/media/movie.mkv"

  test("returns headers only with the codec's MIME for a valid absolute path", async () => {
    const response = await head(`/transcode/audio?path=${encodeURIComponent(validPath)}&codec=opus`)

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("video/mp4")
    // HEAD per HTTP spec returns no body; verify by checking the
    // response body is empty.
    const text = await response.text()
    expect(text).toBe("")
  })

  test("HEAD honors path-safety rejection too", async () => {
    const response = await head("/transcode/audio?path=relative.mkv&codec=opus")

    expect(response.status).toBe(403)
  })

  test("HEAD with codec=aac returns video/mp4", async () => {
    const response = await head(`/transcode/audio?path=${encodeURIComponent(validPath)}&codec=aac`)

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("video/mp4")
  })
})
