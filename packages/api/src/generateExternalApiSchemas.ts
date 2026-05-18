import "./loadEnv.js"
import { writeFile } from "node:fs/promises"
import { tvdbApiSchemaUrl } from "@mux-magic/core/src/tools/tvdbApi.js"
import openapiTS, { astToString } from "openapi-typescript"

const generateExternalApiSchemas = () =>
  openapiTS(new URL(tvdbApiSchemaUrl))
    .then((ast) =>
      writeFile(
        "./packages/api/src/schema.generated/tvdbApiSchema.ts",
        astToString(ast),
      ),
    )
    .then(() => {
      console.log("Updated external API schemas.")
    })
    .catch((error) => {
      console.error(error)
    })

generateExternalApiSchemas()
