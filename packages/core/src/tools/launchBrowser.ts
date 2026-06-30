import { platform } from "node:os"

import {
  type Browser,
  chromium,
  type Page,
} from "playwright"

// DVDCompare bot-blocks some clients by User-Agent. Headless Chromium's
// default UA advertises "HeadlessChrome/<version>", which is an easy signal
// for bot-protection to single out. Override every page's UA with a plain
// desktop-Chrome string so the browser path presents the same realistic
// client as the plain-fetch path (see DVDCOMPARE_USER_AGENT in
// searchDvdCompare.ts — kept in sync here to avoid a circular import).
export const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

export const launchBrowser = (): Promise<Browser> =>
  chromium.launch({
    // --no-sandbox: required when running as root in a Docker container.
    // --disable-dev-shm-usage: Docker's default /dev/shm is 64MB which
    //   isn't enough for Chromium and causes opaque "Target closed" errors.
    //   Both flags are no-ops on macOS hosts and irrelevant on Windows.
    args:
      platform() === "win32"
        ? []
        : ["--no-sandbox", "--disable-dev-shm-usage"],
    headless: true,
  })

// Open a new page on a fresh context that advertises the desktop-Chrome
// User-Agent (see BROWSER_USER_AGENT) instead of the default
// "HeadlessChrome" string, so bot-protection that filters on UA treats the
// scraper like a normal browser.
export const newPageWithUserAgent = async (
  browser: Browser,
): Promise<Page> => {
  const context = await browser.newContext({
    userAgent: BROWSER_USER_AGENT,
  })
  return context.newPage()
}

// DVDCompare and similar ad-supported pages keep network activity going long
// after the DOM is interactive — third-party ad tags hold the `load` event
// open past Playwright's 30s default and trigger Timeout 30000ms exceeded
// errors. Every navigation in this codebase only needs the parsed DOM, so
// route them all through this helper to wait on `domcontentloaded` instead.
export const gotoPage = (
  page: Page,
  url: string,
): Promise<unknown> =>
  page.goto(url, { waitUntil: "domcontentloaded" })

// Run an action that triggers a navigation (typically a form-submit click)
// and resolve once the resulting navigation reaches `domcontentloaded`.
// `networkidle` is the wrong wait on ad-heavy pages — third-party tags
// keep the network busy past the default 30s timeout. Built on
// `waitForNavigation` (deprecated but still supported) because, when
// composed with the action via `Promise.all`, it explicitly registers
// for the *next* navigation rather than racing against the current
// page's already-reached load state the way `waitForLoadState` would.
export const performAndWaitForNavigation = async (
  page: Page,
  triggerAction: () => Promise<unknown>,
): Promise<void> => {
  await Promise.all([
    page.waitForNavigation({
      waitUntil: "domcontentloaded",
    }),
    triggerAction(),
  ])
}
