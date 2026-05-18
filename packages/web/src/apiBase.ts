// Relative API base for every fetch in the web app. The front-door
// server (packages/server/, worker 29) hosts the SPA and the API on
// the same origin, so this is always relative — there is no longer a
// `window.__API_BASE__` injection step and no localhost fallback. If a
// future deployment needs to point the SPA at a different API host,
// re-introduce a build-time env var injection in the Vite config
// rather than reviving runtime HTML mutation.
export const apiBase = "/api"
