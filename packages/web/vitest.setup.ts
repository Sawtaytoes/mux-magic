import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

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
