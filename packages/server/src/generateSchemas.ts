import { writeFile } from 'node:fs/promises'
import openapiTS, { astToString } from 'openapi-typescript'

import { tvdbApiSchemaUrl } from './tools/tvdbApi.js'

const generateSchemas = () => (
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
      "Updated schemas."
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

generateSchemas()
