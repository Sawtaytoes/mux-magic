try {
  process.loadEnvFile()
} catch {}

// Worker 29 collapsed the SPA + API onto a single port (default 3000).
// The historical PORT / WEB_PORT split is gone; e2e talks to one origin.
export const port = Number(process.env.PORT ?? 3000)

export const baseUrl = `http://localhost:${port}`

// Kept for callers that haven't been swept yet (kept the same value as
// baseUrl); follow-up worker can drop this once /api-prefix migration
// has settled.
export const apiBaseUrl = baseUrl
export const webBaseUrl = baseUrl
