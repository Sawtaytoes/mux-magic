import { writeFile } from 'node:fs/promises'
import openapiTS, { astToString } from 'openapi-typescript'

import { tvdbApiSchemaUrl } from './tools/tvdbApi.js'

const generateExternalApiSchemas = () => (
  openapiTS(
    new URL(tvdbApiSchemaUrl),
  )
  .then((
    ast,
  ) => (
    writeFile(
      './packages/server/src/schema.generated/tvdbApiSchema.ts',
      astToString(ast),
    )
  ))
  .then(() => {
    console
    .log(
      "Updated external API schemas."
    )
  })
  .catch((
    error,
  ) => {
    console
    .error(
      error
    )
  })
)

generateExternalApiSchemas()
