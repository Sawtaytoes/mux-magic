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
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route element={<HomePage />} path="/" />
        <Route element={<BuilderPage />} path="/builder" />
        <Route element={<ErrorsPage />} path="/errors" />
        <Route element={<JobsPage />} path="/jobs" />
      </Routes>
    </Suspense>
  </BrowserRouter>
)
