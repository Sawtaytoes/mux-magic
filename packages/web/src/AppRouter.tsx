import { ReactRouterAdapter } from "@charcuterie/ui/react-router"
import { lazy, Suspense } from "react"
import { BrowserRouter, Route, Routes } from "react-router"

import { RouteFallback } from "./components/RouteFallback/RouteFallback"

/**
 * Every page is split out of the entry chunk.
 *
 * Statically importing all four meant `/errors` — a `<Select>`, a
 * text input and a list of rows — downloaded the entire Sequence
 * Builder before it could paint anything. Compression made that
 * cheaper to ship; it did not make it necessary to ship.
 *
 * `lazy()` wants a module whose `default` is the component and these
 * are named exports, so each loader remaps it. Rolldown names the
 * emitted chunk after the module path on its own, so `dist/assets/`
 * reads as `BuilderPage-*.js` with no chunk-name comment needed.
 */
const BuilderPage = lazy(async () => ({
  default: (await import("./pages/BuilderPage/BuilderPage"))
    .BuilderPage,
}))

const ErrorsPage = lazy(async () => ({
  default: (await import("./pages/ErrorsPage/ErrorsPage"))
    .ErrorsPage,
}))

const HomePage = lazy(async () => ({
  default: (await import("./pages/HomePage/HomePage"))
    .HomePage,
}))

const JobsPage = lazy(async () => ({
  default: (await import("./pages/JobsPage/JobsPage"))
    .JobsPage,
}))

// One boundary around `Routes` rather than one per `Route`: the
// fallback is the same page-shaped skeleton either way, and a
// boundary per route re-mounts it on every navigation.
export const AppRouter = () => (
  <BrowserRouter>
    {/*
      Both of Charcuterie's router seams, wired once.

      The LINK seam: a `TextLink` or `ButtonLink` renders a plain
      `<a href>` unless the app injects its router, and a plain `<a>`
      to an in-app path is a FULL PAGE LOAD — the SPA boots again and
      every lazy chunk above is downloaded a second time.

      The SCROLL seam: `Main` remembers where each history entry was
      scrolled to, so Back returns a long page to where the reader
      left it. No browser does that for an inner scrollport, and
      `Shell` makes `<main>` this app's one vertical scroll region.

      ⚠️ NEITHER SEAM DOES ANYTHING YET, and that is this app's bug,
      not the adapter's. Every in-app link here is still a raw
      `<a href="/jobs">` written by hand — ten of them, across
      `PageHeader`, `HomePage`/`ToolCard`, `JobsPage`, `JobsList` and
      `ErrorsPage`. A raw anchor reloads the document, which throws
      away the history entry the scroll memory keyed on, so there is
      no client-side navigation for either seam to observe. The
      workspace rule is that an owned app navigates with real router
      links; converting those ten is the follow-up that makes this
      wiring live.

      Inside `BrowserRouter`, because it reads `useLocation()`.
      Above `Suspense`, so a lazy page that is still loading does
      not unmount the providers.
    */}
    <ReactRouterAdapter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route element={<HomePage />} path="/" />
          <Route
            element={<BuilderPage />}
            path="/builder"
          />
          <Route element={<ErrorsPage />} path="/errors" />
          <Route element={<JobsPage />} path="/jobs" />
        </Routes>
      </Suspense>
    </ReactRouterAdapter>
  </BrowserRouter>
)
