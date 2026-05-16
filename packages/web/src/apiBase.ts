// API base URL for all fetch calls. Always absolute so dev and prod
// behave the same — no Vite proxy, no same-origin assumption.
//
// Resolution order:
// 1. `window.__API_BASE__` — injected by packages/web/src/server.ts at
//    request time when REMOTE_SERVER_URL is set in the web server's env
//    (and by Playwright's webServer config during e2e).
// 2. `http://localhost:3000` — the Hono API server's default port. Used
//    by `vite dev` where no server injects the global.
export const apiBase: string =
  window.__API_BASE__ ?? "http://localhost:3000"
