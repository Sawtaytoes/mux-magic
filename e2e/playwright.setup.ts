try {
  process.loadEnvFile()
} catch {}

export const port = Number(process.env.PORT ?? 3000)
export const webPort = Number(
  process.env.WEB_PORT ?? (process.env.CI ? 4173 : 5173),
)

export const apiBaseUrl = `http://localhost:${port}`
export const webBaseUrl = `http://localhost:${webPort}`
