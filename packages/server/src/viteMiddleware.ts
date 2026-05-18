import type { Server as HttpServer } from "node:http"
import type { Hono } from "hono"
import type { ViteDevServer } from "vite"

interface WireViteOptions {
  root: Hono
  webRoot: string
  httpServer: HttpServer
}

// Boots Vite in middleware mode and bridges its connect-style middleware
// chain into Hono. HMR rides the same http server via `hmr.server`, so
// the SPA, API, and HMR WebSocket all share one port.
//
// Bridging notes:
// - `@hono/node-server` exposes the underlying Node req/res on
//   `c.env.incoming` / `c.env.outgoing`. We pump those through Vite's
//   middlewares; if Vite writes the response, we stop. If it falls
//   through (e.g. nothing matched), Hono's `next()` continues so the
//   request can be 404'd.
// - The `c.finalized` check after the middleware returns catches the
//   case where Vite handled the request asynchronously.
export const wireViteMiddleware = async ({
  root,
  webRoot,
  httpServer,
}: WireViteOptions): Promise<ViteDevServer> => {
  const { createServer: createViteServer } = await import("vite")
  const vite = await createViteServer({
    appType: "spa",
    configFile: `${webRoot}/vite.config.ts`,
    root: webRoot,
    server: {
      hmr: { server: httpServer },
      middlewareMode: true,
    },
  })

  root.use("*", async (c, next) => {
    // @hono/node-server populates `incoming`/`outgoing` on `c.env`.
    // Type as `unknown` first since the shape isn't part of Hono's
    // public types — it's a node-server adapter contract.
    const env = c.env as {
      incoming?: Parameters<typeof vite.middlewares>[0]
      outgoing?: Parameters<typeof vite.middlewares>[1]
    }
    const incoming = env.incoming
    const outgoing = env.outgoing
    if (!incoming || !outgoing) {
      await next()
      return
    }
    await new Promise<void>((resolve, reject) => {
      vite.middlewares(incoming, outgoing, (err?: unknown) => {
        if (err) {
          reject(err instanceof Error ? err : new Error(String(err)))
          return
        }
        resolve()
      })
    })
    if (outgoing.writableEnded) {
      // Mark the Hono context as finalized so the framework doesn't
      // try to emit a second response.
      c.finalized = true
      return
    }
    await next()
  })

  return vite
}
