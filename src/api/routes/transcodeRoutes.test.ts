import { afterEach, describe, expect, test, vi } from "vitest"

// Validation-layer tests for /transcode/audio. The acquire → encode →
// serve flow lives behind RxJS + ffmpeg + the temp-store and is
// exercised manually rather than mocked here — these tests cover the
// input validation gates that decide whether a request even reaches the
// encoder.
//
// Mock runFfmpegAudioTranscode and the temp store so that even if a
// validation slip lets a request through, the test never spawns ffmpeg
// or writes to os.tmpdir().
vi.mock("../../cli-spawn-operations/runFfmpegAudioTranscode.js", () => ({
  runFfmpegAudioTranscode: vi.fn(() => ({ subscribe: vi.fn() })),
}))

vi.mock("../../tools/transcodeTempStore.js", () => ({
  mimeTypeForCodec: (codec: string) => (
    codec === "opus"
    ? "video/webm"
    : "video/mp4"
  ),
  transcodeTempStore: {
    acquire: vi.fn(() => ({ isFresh: false, tempPath: "/tmp/never-used" })),
    markReady: vi.fn(async () => {}),
    release: vi.fn(async () => {}),
    invalidate: vi.fn(async () => {}),
    cleanupOnShutdown: vi.fn(),
    __resetForTests: vi.fn(),
    __snapshotForTests: vi.fn(() => []),
  },
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
    expect(body.error).toMatch(/absolute|allowed media root/i)
  })

  test("rejects paths outside /media with 403", async () => {
    const response = await get("/transcode/audio?path=/etc/passwd&codec=opus")

    expect(response.status).toBe(403)
    const body = await response.json() as { error: string }
    expect(body.error).toMatch(/allowed media root/i)
  })

  test("rejects path traversal with 403", async () => {
    const response = await get("/transcode/audio?path=/media/../etc/passwd&codec=opus")

    expect(response.status).toBe(403)
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
  // The /media root is POSIX-only — path-safety rejects it as
  // non-absolute on Windows. Skip the success-path HEAD tests on
  // Windows; the production deployment is the Linux Docker image.
  const isPosix = process.platform !== "win32"

  test.skipIf(!isPosix)("returns headers only with the codec's MIME for a valid /media path", async () => {
    const response = await head("/transcode/audio?path=/media/movie.mkv&codec=opus")

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("video/webm")
    // HEAD per HTTP spec returns no body; verify by checking the content
    // length zero or that reading the stream returns empty.
    const text = await response.text()
    expect(text).toBe("")
  })

  test("HEAD honors path-safety rejection too", async () => {
    const response = await head("/transcode/audio?path=/etc/passwd&codec=opus")

    expect(response.status).toBe(403)
  })

  test.skipIf(!isPosix)("HEAD with codec=aac returns video/mp4", async () => {
    const response = await head("/transcode/audio?path=/media/movie.mkv&codec=aac")

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("video/mp4")
  })
})
