import { API_PORT } from "../tools/envVars.js"

export const openApiDocs = {
  openapi: "3.1.0",
  info: {
    title: "Media Tools API",
    version: "1.0.0",
    description:
      "API for media file processing and analysis",
  },
  servers: [
    process.env.REMOTE_SERVER_URL
      ? {
          url: `${process.env.REMOTE_SERVER_URL}`,
          description: "Remote API server",
        }
      : {
          url: `http://localhost:${API_PORT}`,
          description: "Local API server",
        },
  ],
}
