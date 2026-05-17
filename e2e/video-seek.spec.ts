import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { platform, tmpdir } from "node:os"
import { join, resolve } from "node:path"

import { expect, test } from "@playwright/test"

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

// TODO: worker 58 lifted FileVideoPlayer into the standalone VideoPreviewModal
// (mounted at app-root by BuilderPage) and removed `window.openVideoModal`,
// so the original "no app-root mount" blocker is gone. Re-enabling this suite
// now needs a Playwright-friendly way to set `videoPreviewModalAtom` — either
// driving the UI via FileExplorerModal's row click / PromptModal's Play button,
// or exposing a dev-only setter on window. Out of scope for worker 58.
test.describe
  .skip("MSE video seek", () => {
    // Collect every browser console error so assertions can inspect them.
    const consoleErrors: string[] = []

    test.beforeEach(async ({ page }) => {
      consoleErrors.length = 0
      page.on("console", (msg) => {
        if (msg.type() === "error")
          consoleErrors.push(msg.text())
      })

      // Force the transcode path: claim audio is TrueHD (browser-unsafe).
      await page.route(
        "**/files/audio-codec**",
        (route) => {
          route.fulfill({ json: { audioFormat: "truehd" } })
        },
      )

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

      await page.goto("/builder/")
    })

    test("initial playback starts without MSE errors", async ({
      page,
    }) => {
      await page.evaluate(() => {
        ;(
          window as unknown as Window & {
            openVideoModal: (p: string) => void
          }
        ).openVideoModal("/test/fake-movie.mkv")
      })

      const modal = page.locator("#video-modal")
      await expect(modal).toBeVisible({ timeout: 5_000 })

      // Wait until the video element has buffered enough to play.
      await page.waitForFunction(
        () => {
          const videoEl = document.getElementById(
            "video-modal-player",
          ) as HTMLVideoElement | null
          return (
            (videoEl?.readyState ?? 0) >=
            HTMLMediaElement.HAVE_FUTURE_DATA
          )
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
        "MSE errors during initial playback",
      ).toEqual([])
    })

    test("seek does not throw InvalidStateError", async ({
      page,
    }) => {
      await page.evaluate(() => {
        ;(
          window as unknown as Window & {
            openVideoModal: (p: string) => void
          }
        ).openVideoModal("/test/fake-movie.mkv")
      })

      const modal = page.locator("#video-modal")
      await expect(modal).toBeVisible({ timeout: 5_000 })

      // Wait for initial buffering before seeking.
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
          return (
            videoElement != null && !videoElement.seeking
          )
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
      await page.evaluate(() => {
        ;(
          window as unknown as Window & {
            openVideoModal: (p: string) => void
          }
        ).openVideoModal("/test/fake-movie.mkv")
      })

      await expect(
        page.locator("#video-modal"),
      ).toBeVisible({
        timeout: 5_000,
      })

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
          return (
            videoElement != null && !videoElement.seeking
          )
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
