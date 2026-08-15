import "./loadEnv.js"
import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import openapiTS, { astToString } from "openapi-typescript"

import { app } from "./api/hono-routes.js"
import { openApiDocs } from "./api/openApiDocConfig.js"

// The typed `paths` surface the web app consumes via
// `@charcuterie/logic/openapi` (createApiClient<paths>). It is generated
// from the live Hono OpenAPI document and committed to the repo — Biome
// (`**/*.generated.ts`) and ESLint (`packages/web/src/api/schema.generated.ts`)
// both ignore it. See docs/decisions for the generated-schemas convention.
const generatedSchemaPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../web/src/api/schema.generated.ts",
)

const generateInternalApiSchemas = async () => {
  const schema = app.getOpenAPI31Document(openApiDocs)

  const ast = await openapiTS(
    schema as Parameters<typeof openapiTS>[0],
  )

  await mkdir(dirname(generatedSchemaPath), {
    recursive: true,
  })

  await writeFile(generatedSchemaPath, astToString(ast))

  console.log("Updated internal API schemas.")
}

generateInternalApiSchemas().catch((error) => {
  console.error(error)

  process.exit(1)
})
