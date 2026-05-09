import { describe, expect, test } from "vitest"
import { z } from "@hono/zod-openapi"

import * as schemas from "./schemas.js"
import { commandConfigs } from "./routes/commandRoutes.js"

// Spot-checks the assumption the build-command-descriptions extractor
// depends on: every request schema in commandRoutes is a Zod object
// whose `.shape` fields carry .describe(...) text retrievable via
// z.globalRegistry. If someone removes a describe() the regenerated
// bundle silently loses tooltips — these assertions tip them off in
// CI instead.

const unwrapSchema = (
  schema: z.ZodTypeAny,
): z.ZodTypeAny => {
  const definition = schema._def as {
    innerType?: z.ZodTypeAny
    schema?: z.ZodTypeAny
  } | undefined

  if (!definition) {
    return schema
  }

  if (definition.innerType) {
    return unwrapSchema(definition.innerType)
  }

  if (definition.schema) {
    return unwrapSchema(definition.schema)
  }

  return schema
}

const getDescription = (
  schema: z.ZodTypeAny,
): (string | undefined) => {
  const direct = z.globalRegistry.get(schema) as { description?: string } | undefined

  if (direct?.description) {
    return direct.description
  }

  const unwrapped = unwrapSchema(schema)
  const unwrappedMeta = z.globalRegistry.get(unwrapped) as { description?: string } | undefined

  return unwrappedMeta?.description
}

describe("schema-driven command descriptions", () => {
  test("every command schema is a Zod object exposing .shape", () => {
    Object.entries(commandConfigs).forEach(([commandName, configuration]) => {
      const objectSchema = configuration.schema as { shape?: Record<string, z.ZodTypeAny> }

      expect(
        objectSchema.shape,
        `Expected ${commandName}'s schema to be a Zod object — got ${configuration.schema.constructor?.name}`,
      ).toBeDefined()
    })
  })

  test("flattenOutput surfaces both fields with their describe() text", () => {
    const sourcePathDescription = getDescription(
      schemas.flattenOutputRequestSchema.shape.sourcePath,
    )
    const deleteSourceFolderDescription = getDescription(
      schemas.flattenOutputRequestSchema.shape.deleteSourceFolder,
    )

    expect(sourcePathDescription).toContain("copied up one level")
    expect(deleteSourceFolderDescription).toContain("Delete the source folder after copying")
  })

  test("modifySubtitleMetadata surfaces the long hasDefaultRules description", () => {
    const hasDefaultRulesDescription = getDescription(
      schemas.modifySubtitleMetadataRequestSchema.shape.hasDefaultRules,
    )

    expect(hasDefaultRulesDescription).toContain("buildDefaultSubtitleModificationRules")
  })
})
