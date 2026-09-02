/**
 * Every browser-mode test dependency, pre-declared so Vite optimizes
 * them all at startup. Spread into `optimizeDeps.include` by
 * `vitest.config.ts`.
 *
 * WHY THIS IS ITS OWN FILE, not an inline array in the Vitest config:
 * `charcuterie-check-optimize-deps` reads this list in a plain Node
 * process, after the suite, and compares it against what the optimizer
 * ACTUALLY optimized. A plain Node process cannot load
 * `vitest.config.ts` — so the list lives here, importable by both.
 *
 * WHY THE LIST MATTERS: without it, Vite discovers deps as tests run,
 * kicks off a re-optimization, and reloads the page mid-test — which
 * nukes React's compiler-runtime cache and triggers `useMemoCache` null
 * errors. The race is invisible after the first run locally (Vite caches
 * the result in `node_modules/.vite`) but reproduces on every CI run,
 * which has no warm cache.
 *
 * Source of truth: `node_modules/.vite/vitest/<hash>/deps/_metadata.json`
 * after a successful run — this list mirrors every top-level entry
 * there. Note that cache lives beside THIS package, not at the repo
 * root; clearing the wrong one gives a warm run that proves nothing.
 *
 * You should not need to maintain this by hand any more: CI runs the
 * parity check after the suite and fails with the exact names to add.
 *
 * @type {readonly string[]}
 */
export const optimizeDepsInclude = [
  "@charcuterie/logic",
  "@charcuterie/logic/browser",
  // Every subpath is its OWN optimizer entry — `@charcuterie/logic`
  // being listed does not cover `/query` or `/openapi`. Both were
  // missing until 2026-08-15 (as was `@charcuterie/ui`), and the race
  // they opened is exactly the one described above: it lost the coin
  // flip on a CI runner and 16 tests failed with `Failed to fetch
  // dynamically imported module: .../react_jsx-dev-runtime.js?v=…`,
  // the re-optimization signature. That incident is why the parity
  // check exists.
  "@charcuterie/logic/openapi",
  "@charcuterie/logic/query",
  "@charcuterie/ui",
  // The react-router seam is a SUBPATH, so it is its own optimizer
  // entry even though `@charcuterie/ui` is listed above. Adding
  // `<ReactRouterAdapter>` to `AppRouter` without this line cost a
  // CI run: the optimizer discovered it mid-suite, reloaded the
  // page, and 19 tests in `useBuilderActions.test.tsx` failed with
  // "Invalid hook call ... more than one copy of React". It passed
  // locally throughout, because a warm `node_modules/.vite` hides
  // the race exactly as the note above says it does.
  "@charcuterie/ui/react-router",
  "@dnd-kit/core",
  "@dnd-kit/sortable",
  "@dnd-kit/utilities",
  "@hono/zod-openapi",
  // Pulled in by Vitest itself rather than by app source, but it is a
  // top-level entry in `_metadata.json` all the same, and this list is
  // defined as mirroring that file. (The `vitest > …` rows there are
  // Vite's naming for transitive deps, not entries — they stay out, and
  // the checker filters them the same way.)
  "expect-type",
  "@tanstack/react-query",
  "@testing-library/jest-dom/vitest",
  "@testing-library/react",
  "@testing-library/user-event",
  "jotai",
  "jotai/utils",
  "js-yaml",
  "react",
  "react-dom",
  "react-dom/client",
  "react-router",
  "react/compiler-runtime",
  "react/jsx-dev-runtime",
  "react/jsx-runtime",
]
