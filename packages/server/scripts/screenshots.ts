/**
 * Screenshot capture script for README documentation.
 *
 * Launches headless Chromium, drives both the Jobs UI and the Sequence Builder
 * UI using the ?mock=1 MSW toggle (no real server data needed), and writes
 * full-page PNGs to docs/images/.
 *
 * Run with:
 *   yarn screenshots
 *
 * Prerequisites: the api-server must be running (yarn api-server or yarn
 * api-dev-server in another terminal) and the Playwright Chromium browser
 * must be installed (yarn install-playwright-browser).
 *
 * The script reads PORT from .env (falls back to 3000) to match the same
 * port-sniffing logic used in playwright.config.ts.
 */

import { mkdirSync, readFileSync } from "node:fs"
import { chromium, type Page } from "playwright"

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const port = (() => {
  try {
    const env = readFileSync(".env", "utf8")
    const match = /^PORT\s*=\s*(\d+)\s*$/m.exec(env)
    if (match) return Number(match[1])
  } catch {}
  return 3000
})()

const baseURL = `http://localhost:${port}`

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wait for network to be mostly idle after navigation / interaction. */
async function settle(page: Page, ms = 800) {
  await page.waitForTimeout(ms)
}
// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

;(async () => {
  mkdirSync("docs/images", { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  })

  try {
    // -----------------------------------------------------------------------
    // 1. Jobs UI — running + completed + failed jobs (via ?mock=1)
    // -----------------------------------------------------------------------
    {
      const page = await context.newPage()
      await page.goto(`${baseURL}/?mock=1`, {
        waitUntil: "networkidle",
      })

      // Wait for at least one job card to appear (the mock SSE stream pushes
      // jobs to the client immediately after the service worker activates).
      await page.waitForSelector(".job", {
        timeout: 10_000,
      })
      await settle(page)

      await page.screenshot({
        path: "docs/images/jobs.png",
        fullPage: true,
      })
      console.info("  saved docs/images/jobs.png")
      await page.close()
    }

    // -----------------------------------------------------------------------
    // 2. Sequence Builder — empty state
    // -----------------------------------------------------------------------
    {
      const page = await context.newPage()
      await page.goto(`${baseURL}/builder/?mock=1`, {
        waitUntil: "networkidle",
      })

      // Wait for the page heading to confirm the app has mounted.
      await page.waitForSelector("h1", { timeout: 10_000 })
      await settle(page, 600)

      await page.screenshot({
        path: "docs/images/builder-empty.png",
        fullPage: true,
      })
      console.info("  saved docs/images/builder-empty.png")
      await page.close()
    }

    // -----------------------------------------------------------------------
    // 3. Sequence Builder — a two-step sequence
    // -----------------------------------------------------------------------
    {
      // Encode a small pre-built sequence into the ?seq= URL param the same
      // way the builder encodes it (JSON → base64). This avoids UI clicks for
      // building the sequence in this script and gives a stable, reproducible
      // screenshot regardless of picker ordering changes.
      const seq = {
        paths: {
          source: {
            label: "Source folder",
            value: "D:\\Media\\Anime\\Show",
          },
        },
        steps: [
          {
            id: "step1",
            command: "keepLanguages",
            params: {
              sourcePath: "@source",
              audioLanguages: ["jpn"],
              subtitlesLanguages: ["eng"],
            },
          },
          {
            id: "step2",
            command: "extractSubtitles",
            params: {
              sourcePath: {
                linkedTo: "step1",
                output: "folder",
              },
            },
          },
        ],
      }
      const b64 = Buffer.from(JSON.stringify(seq)).toString(
        "base64",
      )
      const url = `${baseURL}/builder/?mock=1&seq=${encodeURIComponent(b64)}`

      const page = await context.newPage()
      await page.goto(url, { waitUntil: "networkidle" })

      // Wait for step cards to appear.
      await page.waitForSelector('[id^="step-"]', {
        timeout: 10_000,
      })
      await settle(page, 600)

      await page.screenshot({
        path: "docs/images/builder.png",
        fullPage: true,
      })
      console.info("  saved docs/images/builder.png")
      await page.close()
    }

    // -----------------------------------------------------------------------
    // 4. Sequence Builder — YAML modal open
    // -----------------------------------------------------------------------
    {
      const seq = {
        paths: {
          source: {
            label: "Source folder",
            value: "D:\\Media\\Anime\\Show",
          },
        },
        steps: [
          {
            id: "step1",
            command: "keepLanguages",
            params: {
              sourcePath: "@source",
              audioLanguages: ["jpn"],
              subtitlesLanguages: ["eng"],
            },
          },
          {
            id: "step2",
            command: "extractSubtitles",
            params: {
              sourcePath: {
                linkedTo: "step1",
                output: "folder",
              },
            },
          },
        ],
      }
      const b64 = Buffer.from(JSON.stringify(seq)).toString(
        "base64",
      )
      const url = `${baseURL}/builder/?mock=1&seq=${encodeURIComponent(b64)}`

      const page = await context.newPage()
      await page.goto(url, { waitUntil: "networkidle" })

      await page.waitForSelector('[id^="step-"]', {
        timeout: 10_000,
      })
      await settle(page, 400)

      // Open the YAML modal.
      await page
        .getByRole("button", { name: "View YAML" })
        .click()
      await page.waitForSelector("#yaml-modal", {
        timeout: 5_000,
      })
      await settle(page, 300)

      await page.screenshot({
        path: "docs/images/builder-yaml.png",
        fullPage: true,
      })
      console.info("  saved docs/images/builder-yaml.png")
      await page.close()
    }

    console.info("\nAll screenshots saved to docs/images/")
  } finally {
    await browser.close()
  }
})()
