import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { platform, tmpdir } from "node:os"
import { join, resolve } from "node:path"

import { expect, type Page, test } from "@playwright/test"

const isWindows = platform() === "win32"
const localFfmpegPath = resolve(
  import.meta.dirname,
  "../apps.downloaded/ffmpeg/bin/ffmpeg.exe",
)
const ffmpegPath =
  isWindows && existsSync(localFfmpegPath)
    ? localFfmpegPath
    : "ffmpeg"

// 60-second synthetic fMP4: blue 320×240 H.264 High@L4.1 + Opus 48 kHz stereo.
// Generated once for the whole suite; each test reads from this buffer.
let syntheticFmp4: Buffer

test.beforeAll(() => {
  const outPath = join(tmpdir(), "pw-mse-seek-test.mp4")
  execFileSync(ffmpegPath, [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "color=c=blue:size=320x240:rate=24",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:sample_rate=48000",
    "-t",
    "60",
    "-map",
    "0:v:0",
    "-c:v",
    "libx264",
    "-profile:v",
    "high",
    "-level",
    "4.1",
    "-map",
    "1:a:0",
    "-ac",
    "2",
    "-c:a",
    "libopus",
    "-b:a",
    "128k",
    "-movflags",
    "frag_keyframe+empty_moov+default_base_moof",
    "-f",
    "mp4",
    outPath,
  ])
  syntheticFmp4 = readFileSync(outPath)
})

// `window.openVideoModal` is gone (worker 58 lifted FileVideoPlayer into the
// standalone VideoPreviewModal, mounted at app-root by BuilderPage), and this
// suite sat skipped waiting for a replacement. The replacement is the real UI:
// a builder step with a path field → Browse → click the video row, which is
// what sets `videoPreviewModalAtom`. No test-only hook in production code.
const VIDEO_FOLDER = "/movies"
const VIDEO_FILE_NAME = "fake-movie.mkv"

// A sequence whose one step has a populated path field. The field needs a
// value: the explorer does not fetch a listing for an empty path.
const BUILDER_SEQ = Buffer.from(
  [
    "steps:",
    "  - id: step-alpha",
    "    command: copyFiles",
    "    params:",
    `      sourcePath: ${VIDEO_FOLDER}`,
  ].join("\n"),
  "utf8",
).toString("base64")

async function openVideoPreview(page: Page) {
  await page
    .getByRole("button", { name: "Browse folders" })
    .first()
    .click()
  await page
    .getByRole("button", {
      name: new RegExp(VIDEO_FILE_NAME),
    })
    .click()
  await expect(page.locator("#video-modal")).toBeVisible({
    timeout: 5_000,
  })
}

// Resolves once the player has buffered enough to play.
async function waitForPlayableVideo(page: Page) {
  await page.waitForFunction(
    () => {
      const videoElement = document.getElementById(
        "video-modal-player",
      ) as HTMLVideoElement | null
      return (
        (videoElement?.readyState ?? 0) >=
        HTMLMediaElement.HAVE_FUTURE_DATA
      )
    },
    { timeout: 20_000 },
  )
}

test.describe("MSE video seek", () => {
  // Collect every browser console error so assertions can inspect them.
  const consoleErrors: string[] = []

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0
    page.on("console", (msg) => {
      if (msg.type() === "error")
        consoleErrors.push(msg.text())
    })

    // The MSE pipeline only runs when the experimental transcode flag is
    // on. The server default is off and the player mirrors that on a
    // failed probe, so without this stub the player falls back to
    // /files/stream over a path that does not exist and nothing ever
    // buffers — which is what this suite is here to measure.
    await page.route("**/features**", (route) => {
      route.fulfill({
        json: {
          isExperimentalFfmpegTranscodingEnabled: true,
        },
      })
    })

    // Force the transcode path: claim audio is TrueHD (browser-unsafe).
    await page.route("**/files/audio-codec**", (route) => {
      route.fulfill({ json: { audioFormat: "truehd" } })
    })

    // Return a known codec string + duration for HEAD, serve the synthetic
    // fMP4 for every GET regardless of ?start= (offset is handled client-side
    // via timestampOffset, so the same bytes work for every seek position).
    await page.route("**/transcode/audio**", (route) => {
      if (route.request().method() === "HEAD") {
        route.fulfill({
          status: 200,
          headers: {
            "Content-Type": "video/mp4",
            "Cache-Control": "no-store",
            "X-Duration": "60",
            "X-Video-Codec": "avc1.640029",
            // The fixture carries an Opus track. Without this the
            // player builds a video-only SourceBuffer and the append
            // fails with "Audio stream codec opus doesn't match
            // SourceBuffer codecs" before anything buffers.
            "X-Has-Audio": "true",
          },
        })
      } else {
        route.fulfill({
          status: 200,
          headers: {
            "Content-Type": "video/mp4",
            "Cache-Control": "no-store",
          },
          body: syntheticFmp4,
        })
      }
    })

    // The explorer lists whatever the API returns. One video file is
    // all this suite needs, and it keeps the test off the real disk.
    await page.route("**/files/list**", (route) => {
      route.fulfill({
        json: {
          separator: "/",
          entries: [
            {
              name: VIDEO_FILE_NAME,
              isFile: true,
              isDirectory: false,
              size: 1024,
              duration: null,
              mtime: null,
            },
          ],
        },
      })
    })
    await page.route("**/files/delete-mode**", (route) => {
      route.fulfill({ json: { mode: "trash" } })
    })

    await page.goto(
      `/builder/?seq=${encodeURIComponent(BUILDER_SEQ)}`,
    )
  })

  test("initial playback starts without MSE errors", async ({
    page,
  }) => {
    await openVideoPreview(page)

    // Wait until the video element has buffered enough to play.
    await waitForPlayableVideo(page)

    const mseErrors = consoleErrors.filter(
      (error) =>
        error.includes("InvalidStateError") ||
        error.includes("[MSE]"),
    )
    expect(
      mseErrors,
      "MSE errors during initial playback",
    ).toEqual([])
  })

  test("seek does not throw InvalidStateError", async ({
    page,
  }) => {
    await openVideoPreview(page)

    // Wait for initial buffering before seeking.
    await waitForPlayableVideo(page)

    // Seek immediately after HAVE_FUTURE_DATA — this is the window where
    // Chrome's appendState is PARSING_MEDIA_SEGMENT (set by the pump's last
    // appendBuffer) but updating is already false. Without sb.abort() this
    // throws InvalidStateError on the timestampOffset assignment.
    await page.evaluate(() => {
      const videoElement = document.getElementById(
        "video-modal-player",
      ) as HTMLVideoElement
      videoElement.currentTime = 5
    })

    // The player must exit seeking state (spinner clears) within 15 s.
    await page.waitForFunction(
      () => {
        const videoElement = document.getElementById(
          "video-modal-player",
        ) as HTMLVideoElement | null
        return videoElement != null && !videoElement.seeking
      },
      { timeout: 15_000 },
    )

    const mseErrors = consoleErrors.filter(
      (error) =>
        error.includes("InvalidStateError") ||
        error.includes("[MSE]"),
    )
    expect(mseErrors, "MSE errors after seek").toEqual([])
  })

  test("rapid seeks resolve without errors", async ({
    page,
  }) => {
    await openVideoPreview(page)

    await waitForPlayableVideo(page)

    // Fire three seeks in quick succession to exercise the activeVersion
    // staleness protection and timestampOffset ordering.
    await page.evaluate(() => {
      const videoElement = document.getElementById(
        "video-modal-player",
      ) as HTMLVideoElement
      videoElement.currentTime = 10
      setTimeout(() => {
        videoElement.currentTime = 20
      }, 100)
      setTimeout(() => {
        videoElement.currentTime = 5
      }, 200)
    })

    // Wait for the last seek (to 5 s) to settle.
    await page.waitForFunction(
      () => {
        const videoElement = document.getElementById(
          "video-modal-player",
        ) as HTMLVideoElement | null
        return videoElement != null && !videoElement.seeking
      },
      { timeout: 20_000 },
    )

    const mseErrors = consoleErrors.filter(
      (error) =>
        error.includes("InvalidStateError") ||
        error.includes("[MSE]"),
    )
    expect(
      mseErrors,
      "MSE errors after rapid seeks",
    ).toEqual([])
  })
})
