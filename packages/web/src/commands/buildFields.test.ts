import { z } from "@hono/zod-openapi"
import { describe, expect, test } from "vitest"
import { fieldBuilder } from "./buildFields"

describe("fieldBuilder", () => {
  test("pulls description from the schema when override is silent", () => {
    const schema = z.object({
      sourcePath: z.string().describe("Source directory"),
    })
    const field = fieldBuilder(schema)
    const result = field("sourcePath", { type: "path" })
    expect(result.description).toBe("Source directory")
  })

  test("override wins over schema description", () => {
    const schema = z.object({
      sourcePath: z.string().describe("Source directory"),
    })
    const field = fieldBuilder(schema)
    const result = field("sourcePath", {
      type: "path",
      description: "Pick where your files live",
    })
    expect(result.description).toBe(
      "Pick where your files live",
    )
  })

  test("pulls default value from .default(...) on the schema", () => {
    const schema = z.object({
      isRecursive: z.boolean().default(true),
      depth: z.number().default(3),
    })
    const field = fieldBuilder(schema)
    expect(
      field("isRecursive", { type: "boolean" }).default,
    ).toBe(true)
    expect(field("depth", { type: "number" }).default).toBe(
      3,
    )
  })

  test("override default wins when explicitly given", () => {
    const schema = z.object({
      depth: z.number().default(3),
    })
    const field = fieldBuilder(schema)
    expect(
      field("depth", { type: "number", default: 5 })
        .default,
    ).toBe(5)
  })

  test("required is false when the schema is optional", () => {
    const schema = z.object({
      sourcePath: z.string(),
      tag: z.string().optional(),
    })
    const field = fieldBuilder(schema)
    expect(
      field("sourcePath", { type: "string" }).isRequired,
    ).toBe(true)
    expect(
      field("tag", { type: "string" }).isRequired,
    ).toBe(false)
  })

  test("required override wins when explicitly given", () => {
    const schema = z.object({
      malId: z.number().optional(),
    })
    const field = fieldBuilder(schema)
    expect(
      field("malId", { type: "number", isRequired: true })
        .isRequired,
    ).toBe(true)
  })

  test("auto-derives enum options from z.enum(...)", () => {
    const schema = z.object({
      strategy: z.enum(["merge", "replace", "skip"]),
    })
    const field = fieldBuilder(schema)
    const result = field("strategy", { type: "enum" })
    expect(result.options).toEqual([
      { value: "merge", label: "merge" },
      { value: "replace", label: "replace" },
      { value: "skip", label: "skip" },
    ])
  })

  test("passes through web-only UI hints (lookupType, visibleWhen, min)", () => {
    const schema = z.object({
      malId: z.number().optional(),
    })
    const field = fieldBuilder(schema)
    const result = field("malId", {
      type: "numberWithLookup",
      lookupType: "mal",
      companionNameField: "malName",
      min: 1,
      visibleWhen: { searchTerm: { isEmpty: true } },
    })
    expect(result.lookupType).toBe("mal")
    expect(result.companionNameField).toBe("malName")
    expect(result.min).toBe(1)
    expect(result.visibleWhen).toEqual({
      searchTerm: { isEmpty: true },
    })
  })
})

// Defends against silent server/web default drift for the commands that
// have been migrated to fieldBuilder. Each entry asserts the schema's
// .default(...) value matches what the web UI ships. When a new command
// migrates, add it here so the contract stays enforced.
describe("commands registry default-drift guards", () => {
  test("storeAspectRatioData isRecursive defaults to true", async () => {
    const schemas = await import(
      "@mux-magic/server/api-schemas"
    )
    const shape =
      schemas.storeAspectRatioDataRequestSchema.def.shape
    const def = (
      shape.isRecursive as {
        def: { type: string; defaultValue: unknown }
      }
    ).def
    expect(def.type).toBe("default")
    expect(def.defaultValue).toBe(true)
  })

  test("storeAspectRatioData recursiveDepth defaults to 3", async () => {
    const schemas = await import(
      "@mux-magic/server/api-schemas"
    )
    const shape =
      schemas.storeAspectRatioDataRequestSchema.def.shape
    const def = (
      shape.recursiveDepth as {
        def: { type: string; defaultValue: unknown }
      }
    ).def
    expect(def.type).toBe("default")
    expect(def.defaultValue).toBe(3)
  })
})
