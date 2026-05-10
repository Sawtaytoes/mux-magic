import type { OpenAPIHono } from "@hono/zod-openapi"
import { Scalar } from "@scalar/hono-api-reference"
import { createMarkdownFromOpenApi } from "@scalar/openapi-to-markdown"

import { openApiDocs } from "../openApiDocConfig.js"

export const addDocRoutes = async (
  honoRoutes: OpenAPIHono,
) => {
  honoRoutes.get("/docs", Scalar({ url: "/openapi.json" }))

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
