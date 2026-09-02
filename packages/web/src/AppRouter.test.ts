import { expect, test } from "vitest"

// Read through Vite's `?raw` rather than `node:fs`, so this file
// stays inside the browser program.
import routerSource from "./AppRouter.tsx?raw"

/**
 * This app is the reason the test exists.
 *
 * Charcuterie's router seams are injected, and an app that never
 * injects them still works — which is how mux-magic rendered
 * `TextLink` and `ButtonLink` for months with no
 * `RouterLinkProvider` anywhere in it. Every press was a FULL PAGE
 * LOAD: the SPA booted again and re-downloaded every lazy page
 * chunk, and nothing reported it, because the right screen still
 * appeared.
 *
 * The scroll seam fails the same way. Back lands at the top of the
 * sequence list, which is still the right list.
 *
 * `AppRouter` renders no page of its own, so no rendering test
 * covers this. The source is the only place to assert it.
 */
test("the router seams are wired at the root", () => {
  // Two assertions rather than one on the whole import line: the
  // formatter is free to wrap it, and a test that breaks on a
  // reformat is a test somebody deletes.
  expect(routerSource).toContain("ReactRouterAdapter")
  expect(routerSource).toContain(
    '"@charcuterie/ui/react-router"',
  )

  expect(routerSource).toContain("<ReactRouterAdapter>")
})

/**
 * Inside the router, because it reads `useLocation()`. A build
 * where it sits outside throws on the first render, but it throws
 * in the browser rather than in CI.
 */
test("the adapter is inside the router", () => {
  const routerAt = routerSource.indexOf("<BrowserRouter>")
  const adapterAt = routerSource.indexOf(
    "<ReactRouterAdapter>",
  )

  expect(routerAt).toBeGreaterThan(-1)
  expect(adapterAt).toBeGreaterThan(routerAt)
})
