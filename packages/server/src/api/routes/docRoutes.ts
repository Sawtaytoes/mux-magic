import { OpenAPIHono } from "@hono/zod-openapi"
import { Scalar } from "@scalar/hono-api-reference"
import { createMarkdownFromOpenApi } from "@scalar/openapi-to-markdown"

import { PORT } from "../../tools/port.js"

export const addDocRoutes = async (honoRoutes: OpenAPIHono) => {
  honoRoutes.get("/docs", Scalar({ url: "/openapi.json" }))

  const openApiDocs = {
    openapi: "3.1.0",
    info: {
      title: "Media Tools API",
      version: "1.0.0",
      description: "API for media file processing and analysis",
    },
    servers: [
      (
        process.env.REMOTE_SERVER_DOMAIN
        ? {
          url: `${process.env.REMOTE_SERVER_DOMAIN}:${PORT}`,
          description: "Remote API server",
        }
        : {
          url: `http://localhost:${PORT}`,
          description: "Local API server",
        }
      ),
    ],
  }

  honoRoutes.doc("/openapi.json", openApiDocs)

  const content = honoRoutes.getOpenAPI31Document(
    openApiDocs
  )

  const markdown = await createMarkdownFromOpenApi(
    JSON.stringify(content)
  )

  honoRoutes.get("/llms.txt", async (context) => {
    return context.text(markdown)
  })
}

