import babel from "@rolldown/plugin-babel"
import tailwindcss from "@tailwindcss/vite"
import react, {
  reactCompilerPreset,
} from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// Dev-only proxy: in development the Vite server runs on 5173 (this
// file's `server.port`) and the Hono API server runs separately on
// PORT (default 3000). The React app makes fetches to API paths like
// `/files/list`, `/jobs/stream`, etc. — without proxying, Vite serves
// the SPA index.html as a fallback for unknown routes and the JSON.parse
// call in the consumer fails with `Unexpected token '<'`.
//
// Production is unaffected because Hono serves both the API and the
// built Vite output as one process — no separate ports, no proxy needed.
//
// When REMOTE_SERVER_URL is set (e.g. https://example.com/api), the
// frontend uses it as the API base URL and makes absolute cross-origin
// requests directly — the dev proxy is bypassed in that case.
//
// Honors PORT env var so anyone overriding the API port locally still
// works.
const apiPort = Number(process.env.PORT ?? 3000)
const apiTarget = `http://localhost:${apiPort}`

// Paths that belong to the Hono API server, not the Vite SPA. Keep this
// list in lockstep with packages/server/src/api/*Routes.ts files.
const apiPaths = [
  "/files",
  "/commands",
  "/queries",
  "/jobs",
  "/sequences",
  "/server-id",
  "/transcode",
  "/version",
  "/openapi.json",
]

export default defineConfig({
  plugins: [
    react(),
    babel({
      presets: [reactCompilerPreset({ target: "19" })],
    }),
    tailwindcss(),
  ],
  define: {
    "import.meta.env.VITE_API_BASE": JSON.stringify(
      process.env.REMOTE_SERVER_URL ?? "",
    ),
  },
  server: {
    open: true,
    port: 5173,
    strictPort: true,
    proxy: Object.fromEntries(
      apiPaths.map((path) => [
        path,
        { target: apiTarget, changeOrigin: true },
      ]),
    ),
  },
})
