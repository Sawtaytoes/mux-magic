import type { z } from "@hono/zod-openapi"
import type { CommandField, EnumOption } from "./types"

// UI-presentation hints that web layers over what Zod can express. Each
// field gets:
//   - `type`: the render component to use (path/numberWithLookup/etc).
//     This is web-only — Zod doesn't model UI render hints.
//   - `label`, `placeholder`: human-readable presentation strings.
//   - `lookupType`, `companionNameField`, `sourceField`: lookup-modal
//     wiring (e.g. malId field opens a MAL lookup that also writes
//     malName). Web-owned UX.
//   - `linkable`, `visibleWhen`: builder-UI state machinery.
//   - `min`, `max`: numeric UI clamps. Zod's own bounds could feed these
//     in a future iteration; for now they're override-only.
//   - `options`: enum dropdown choices. Auto-derived from `z.enum(...)`
//     when the schema uses one; can be overridden for custom label text.
//   - `default`: ONLY override when web's UX default genuinely differs
//     from the server's. Otherwise leave it absent and let Zod's
//     `.default(...)` flow through — that's how this helper closes the
//     drift hole the audit found.
export type FieldOverrides = Omit<
  CommandField,
  "name" | "description" | "required"
> & {
  // Web can override the schema's .describe() with a UI-friendlier
  // version. When absent, the Zod description is used.
  description?: string
  // Override the derived `required` flag. The helper defaults to
  // `!optional()` from the schema; the UI can declare otherwise when
  // e.g. a lookup-populated id is schema-optional but UI-required
  // (the form refuses to submit until the lookup runs).
  required?: boolean
}

// Walks the Zod node chain (default-wraps, optional-wraps) down to the
// inner schema and pulls out the metadata we care about.
const introspectField = (
  field: z.ZodTypeAny,
): {
  description: string | undefined
  defaultValue: unknown
  isOptional: boolean
  enumOptions: EnumOption[] | undefined
} => {
  let cursor: z.ZodTypeAny = field
  let description: string | undefined = cursor.description
  let defaultValue: unknown
  let isOptional = false

  // Unwrap z.ZodDefault / z.ZodOptional layers until we hit the
  // primitive. Zod 4 stores these on `.def`, but the public type doesn't
  // expose the wrapper-specific fields — we treat the def loosely via
  // `unknown` casts and only read the keys we know are present per type.
  type LooseDef = {
    type: string
    innerType?: z.ZodTypeAny
    defaultValue?: unknown
    entries?: unknown
  }
  const readDef = (node: z.ZodTypeAny): LooseDef =>
    (node as unknown as { def: LooseDef }).def
  while (readDef(cursor).innerType) {
    const def = readDef(cursor)
    if (def.type === "default") {
      const raw = def.defaultValue
      defaultValue =
        typeof raw === "function"
          ? (raw as () => unknown)()
          : raw
    }
    if (def.type === "optional") {
      isOptional = true
    }
    cursor = def.innerType as z.ZodTypeAny
    if (!description && cursor.description)
      description = cursor.description
  }

  // Pull options from z.enum(...) when present.
  const innerDef = readDef(cursor)
  let enumOptions: EnumOption[] | undefined
  if (innerDef.type === "enum" && innerDef.entries) {
    const entries = innerDef.entries as Record<
      string,
      string
    >
    enumOptions = Object.values(entries).map((value) => ({
      value,
      label: value,
    }))
  }

  return {
    description,
    defaultValue,
    isOptional,
    enumOptions,
  }
}

// Curried builder: pass the Zod schema once, then describe each field
// with a name (compile-checked against the schema's keys) and a sparse
// override object. Returns the merged CommandField the existing builder
// UI already understands.
export const fieldBuilder = <
  Schema extends z.ZodObject<z.ZodRawShape>,
>(
  schema: Schema,
) => {
  type Shape = Schema["def"]["shape"]
  type Key = keyof Shape & string
  return (
    name: Key,
    overrides: FieldOverrides,
  ): CommandField => {
    const fieldSchema = schema.def.shape[
      name
    ] as z.ZodTypeAny
    const introspected = introspectField(fieldSchema)
    return {
      name,
      description:
        overrides.description ?? introspected.description,
      required:
        overrides.required ?? !introspected.isOptional,
      // Default precedence: explicit override wins; otherwise pull from
      // the Zod schema. Web tests for `default === undefined` to mean
      // "no default" so we only set it when there is one.
      ...(overrides.default !== undefined ||
      introspected.defaultValue !== undefined
        ? {
            default:
              overrides.default !== undefined
                ? overrides.default
                : introspected.defaultValue,
          }
        : {}),
      options:
        overrides.options ?? introspected.enumOptions,
      ...stripOverrideMetadata(overrides),
    }
  }
}

// Helper to spread overrides without re-applying description / default
// / options / required (those are merged above with introspection
// precedence).
const stripOverrideMetadata = (
  overrides: FieldOverrides,
): Omit<
  FieldOverrides,
  "description" | "default" | "options" | "required"
> => {
  const {
    description: _description,
    default: _default,
    options: _options,
    required: _required,
    ...rest
  } = overrides
  return rest
}
