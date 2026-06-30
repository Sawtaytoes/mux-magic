import { spawn } from "node:child_process"
import { logInfo } from "@mux-magic/tools"
import { ffmpegPath as defaultFfmpegPath } from "../tools/appPaths.js"

// Probes ONCE whether this host has a working NVIDIA NVENC H.264 encoder,
// caching the result for the process lifetime.
//
// ffmpeg can be *built* with nvenc yet have no usable GPU/driver at runtime
// (a CPU-only container, a host without an NVIDIA card), so `-encoders` /
// `-hwaccels` lie. The only reliable signal is to actually run a tiny encode
// and check it exits cleanly. When this returns false the transcode falls
// back to CPU libx264 — so the same image runs on GPU and non-GPU boxes.
//
// Set FFMPEG_DISABLE_NVENC=true to force the CPU path regardless of hardware.

let nvencProbe: Promise<boolean> | null = null

const PROBE_TIMEOUT_MS = 10_000

const runNvencProbe = (
  ffmpegPath: string,
): Promise<boolean> =>
  new Promise((resolve) => {
    // 256x256 sits above NVENC's minimum frame dimension — a smaller frame
    // fails encoder init for an unrelated reason and would false-negative.
    const child = spawn(ffmpegPath, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "lavfi",
      "-i",
      "color=c=black:s=256x256:d=0.1",
      "-c:v",
      "h264_nvenc",
      "-f",
      "null",
      "-",
    ])
    const timer = setTimeout(() => {
      child.kill()
      resolve(false)
    }, PROBE_TIMEOUT_MS)
    child.on("error", () => {
      clearTimeout(timer)
      resolve(false)
    })
    child.on("exit", (code) => {
      clearTimeout(timer)
      resolve(code === 0)
    })
  })

export const getIsNvencAvailable = (
  ffmpegPath: string = defaultFfmpegPath,
): Promise<boolean> => {
  if (process.env.FFMPEG_DISABLE_NVENC === "true") {
    return Promise.resolve(false)
  }
  if (nvencProbe === null) {
    nvencProbe = runNvencProbe(ffmpegPath).then(
      (isAvailable) => {
        logInfo(
          "NVENC",
          isAvailable
            ? "NVIDIA NVENC available — GPU video transcode enabled"
            : "no usable NVENC — CPU (libx264) video transcode",
        )
        return isAvailable
      },
    )
  }
  return nvencProbe
}
