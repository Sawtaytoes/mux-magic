import { PORT } from "../tools/port.js"

export const openApiDocs = {
  openapi: "3.1.0",
  info: {
    title: "Media Tools API",
    version: "1.0.0",
    description:
      "API for media file processing and analysis",
  },
  servers: [
    process.env.REMOTE_SERVER_DOMAIN
      ? {
          url: `${process.env.REMOTE_SERVER_DOMAIN}:${PORT}`,
          description: "Remote API server",
        }
      : {
          url: `http://localhost:${PORT}`,
          description: "Local API server",
        },
  ],
}
