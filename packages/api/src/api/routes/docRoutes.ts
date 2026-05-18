import type { OpenAPIHono } from "@hono/zod-openapi"
import { Scalar } from "@scalar/hono-api-reference"
import { createMarkdownFromOpenApi } from "@scalar/openapi-to-markdown"

import { openApiDocs } from "../openApiDocConfig.js"

export const addDocRoutes = async (
  honoRoutes: OpenAPIHono,
) => {
  // Worker 29 mounts this sub-app under /api/*, so the canonical
  // schema URL is `${PUBLIC_URL}/api/openapi.json` (or, when
  // PUBLIC_URL is unset, the relative form `/api/openapi.json` — the
  // server is same-origin with the SPA).
  const schemaUrl = process.env.PUBLIC_URL
    ? `${process.env.PUBLIC_URL.replace(/\/+$/, "")}/api/openapi.json`
    : "/api/openapi.json"

  honoRoutes.get("/", Scalar({ url: schemaUrl }))

  honoRoutes.doc("/openapi.json", openApiDocs)

  const content =
    honoRoutes.getOpenAPI31Document(openApiDocs)

  const markdown = await createMarkdownFromOpenApi(
    JSON.stringify(content),
  )

  honoRoutes.get("/llms.txt", async (context) => {
    return context.text(markdown)
  })
}
