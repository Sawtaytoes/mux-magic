import { createStaticHandler } from "@charcuterie/server"
import { app as apiApp } from "@mux-magic/api/src/api/hono-routes.js"
import { Hono } from "hono"

interface BuildServerOptions {
  mode: "development" | "production"
  webDistDir: string
}

// Returns the assembled Hono root.
//
// In production: /api/* and /* (SPA from packages/web/dist/) are
// registered. The result is callable directly: `root.fetch(req)`.
//
// In development: /api/* is registered, /* is left for the caller —
// `wireViteMiddleware` adds it so Vite can serve the SPA in middleware
// mode with HMR over the same port.
//
// Storybook is no longer handled here; run it separately via
// `yarn workspace @mux-magic/web storybook` (default port 6006).
export const buildServer = async (
  options: BuildServerOptions,
): Promise<Hono> => {
  const root = new Hono()

  // 1. /api/* — API sub-app mounted in-process. No proxy.
  root.route("/api", apiApp)

  // 2. /* — SPA. Dev mode defers to Vite (caller wires it later).
  //
  // The hand-rolled version of this used to live here: a content-type
  // map, a traversal guard, a `readFile` of the whole asset into the
  // heap, and `no-cache, no-store, must-revalidate` on every response
  // — including the content-hashed bundle, which is why production
  // re-downloaded 1.2 MB of uncompressed JS on every single page load.
  //
  // `@charcuterie/server` replaces all of it and adds the two things
  // that version never had: negotiated `.br`/`.gz` (paired with
  // `precompressAssets()` in packages/web/vite.config.ts) and a cache
  // policy that tells the truth about which files are immutable.
  if (options.mode === "production") {
    root.use(
      "*",
      createStaticHandler({ rootDir: options.webDistDir }),
    )
  }

  return root
}
