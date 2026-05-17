import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

// jsdom doesn't implement window.matchMedia. Without a stub, any component
// that subscribes to a media query crashes on mount under vitest.
if (
  typeof window !== "undefined" &&
  typeof window.matchMedia !== "function"
) {
  window.matchMedia = (query) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}

afterEach(() => {
  cleanup()
})
