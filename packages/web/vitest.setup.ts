import { applyCiAsyncUtilTimeout } from "@charcuterie/vitest-config/testingLibrarySetup.js"
import "@testing-library/jest-dom/vitest"
import { cleanup, configure } from "@testing-library/react"
import { afterEach } from "vitest"

/*
 * `waitFor` keeps its own clock — 1000ms — and `testTimeout` does not
 * reach it. That is the budget `LinkPicker keyboard > Escape closes
 * the picker` blew through on a loaded shared runner while its 3820
 * siblings passed. Charcuterie owns the number; this file supplies
 * Testing Library's `configure`, because a browser project only
 * pre-bundles imports it can see in its own source.
 */
applyCiAsyncUtilTimeout(configure)

/**
 * The same three axes `index.html` carries. `@charcuterie/tokens` scopes
 * every `--color-*` under `[data-scheme]`, so a test document without one
 * resolves them all to nothing — which matters the moment a test reads a
 * computed style, and costs nothing when it does not.
 */
document.documentElement.setAttribute("data-scheme", "dark")
document.documentElement.setAttribute(
  "data-variant",
  "daylight",
)
document.documentElement.setAttribute(
  "data-density",
  "comfortable",
)

afterEach(() => {
  cleanup()
})
