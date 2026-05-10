import { mkdir, writeFile } from 'node:fs/promises'
import openapiTS, { astToString } from 'openapi-typescript'

import { app } from './api/hono-routes.js'
import { openApiDocs } from './api/openApiDocConfig.js'

const generateInternalApiSchemas = async () => {
  const schema = app.getOpenAPI31Document(openApiDocs)

  const ast = await openapiTS(schema as Parameters<typeof openapiTS>[0])

  await mkdir(
    '../../packages/web/src/api',
    { recursive: true },
  )

  await writeFile(
    '../../packages/web/src/api/internalSchemas.generated.ts',
    astToString(ast),
  )

  console
  .log(
    'Updated internal API schemas.',
  )
}

generateInternalApiSchemas()
.catch((
  error,
) => {
  console
  .error(error)

  process
  .exit(1)
})
