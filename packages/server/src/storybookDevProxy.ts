import { spawn, type ChildProcess } from "node:child_process"
import { setTimeout as delay } from "node:timers/promises"

interface StartStorybookOptions {
  port: number
  webPackageDir: string
}

export interface StorybookHandle {
  child: ChildProcess
  url: string
}

// Spawns `storybook dev` on an internal port. Uses `--no-open` so the
// browser doesn't pop up (we want the front-door's port to be the URL
// the user visits) and `--base /storybook/` so Storybook's own asset
// URLs carry the prefix the front-door mounts it under. The returned
// handle's `url` is what the front-door proxies to at /storybook/*.
//
// Wait-for-ready: poll Storybook's port until it answers. ~30s max.
export const startStorybookDev = async (
  options: StartStorybookOptions,
): Promise<StorybookHandle> => {
  const url = `http://127.0.0.1:${options.port}`
  const child = spawn(
    "yarn",
    [
      "storybook",
      "dev",
      "-p",
      String(options.port),
      "--no-open",
      "--ci",
    ],
    {
      cwd: options.webPackageDir,
      env: {
        ...process.env,
        STORYBOOK_BASE_PATH: "/storybook/",
      },
      shell: process.platform === "win32",
      stdio: ["ignore", "inherit", "inherit"],
    },
  )
  const isReachable = async (): Promise<boolean> => {
    try {
      const response = await fetch(url, { redirect: "manual" })
      return response.status < 500
    } catch {
      return false
    }
  }
  // Total budget ~30s. Poll every 500 ms.
  const totalAttempts = 60
  const readyAttempts = Array.from({ length: totalAttempts })
  const readinessResults = await readyAttempts.reduce<
    Promise<boolean>
  >(async (priorWait, _next) => {
    const wasReady = await priorWait
    if (wasReady) return true
    await delay(500)
    return isReachable()
  }, Promise.resolve(false))
  if (!readinessResults) {
    child.kill()
    throw new Error(
      `Storybook dev did not become reachable on ${url} within 30s`,
    )
  }
  return { child, url }
}
