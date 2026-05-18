import { load, YAMLException } from "js-yaml"

// Server-side structural validator for template YAML bodies. This is
// the same shape contract `loadYamlFromText` in
// packages/web/src/jobs/yamlCodec.ts accepts: an object with a `steps`
// key (array, or an explicit null treated as empty), or a top-level
// array. The web loader does the *semantic* validation (command name
// known to the registry, field types, link references) at apply time —
// the server doesn't have access to web's Commands registry and there
// is no value in dragging it across the package boundary just to fail
// here when the web side will fail the same way a moment later.
//
// Why have this at all: prevents the API from persisting plain-text
// junk as a "template", so list/get endpoints return things that the
// web loader has at least a fighting chance to render.

const MAX_TEMPLATE_BYTES = 1_000_000

export type ValidationResult =
  | { isValid: true }
  | {
      isValid: false
      error: "invalid yaml"
      details: string
    }

const fail = (details: string): ValidationResult => ({
  isValid: false,
  error: "invalid yaml",
  details,
})

const isPlainObject = (
  value: unknown,
): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value)

export const validateTemplateYaml = (
  yaml: string,
): ValidationResult => {
  // Size cap is a defence-in-depth ceiling. The store's file is small
  // by design (flat templates list); 1 MB per template is already
  // generous and protects the parser from pathological deeply-nested
  // YAML denial-of-service payloads.
  if (yaml.length > MAX_TEMPLATE_BYTES) {
    return fail(
      `template yaml too large (${yaml.length} bytes; cap ${MAX_TEMPLATE_BYTES})`,
    )
  }

  if (yaml.trim().length === 0) {
    return fail("template yaml is empty")
  }

  // js-yaml `load` throws YAMLException on syntax errors and returns
  // the parsed JS value otherwise (object / array / scalar / null).
  // We deliberately use `load` not `loadAll` — multi-document YAML is
  // not part of the template shape contract.
  const tryParse = (): unknown => {
    try {
      return load(yaml)
    } catch (error) {
      const message =
        error instanceof YAMLException
          ? error.message
          : error instanceof Error
            ? error.message
            : String(error)
      throw new Error(message)
    }
  }

  const parsed = (():
    | unknown
    | { __parseError: string } => {
    try {
      return tryParse()
    } catch (error) {
      return {
        __parseError:
          error instanceof Error
            ? error.message
            : String(error),
      }
    }
  })()

  if (
    isPlainObject(parsed) &&
    typeof (parsed as Record<string, unknown>)
      .__parseError === "string"
  ) {
    return fail(
      (parsed as { __parseError: string }).__parseError,
    )
  }

  if (Array.isArray(parsed)) {
    // Top-level array form — the oldest legacy shape `loadYamlFromText`
    // still accepts. The web loader treats it as a plain steps array.
    return { isValid: true }
  }

  if (!isPlainObject(parsed)) {
    return fail(
      "expected a YAML mapping or list at the top level",
    )
  }

  if (!("steps" in parsed)) {
    return fail("template yaml is missing the 'steps' key")
  }

  const steps = parsed.steps
  // `steps: ~` parses to `null` — round-trips cleanly through the web
  // loader as an empty sequence, so accept it. Anything non-array,
  // non-null is wrong.
  if (steps !== null && !Array.isArray(steps)) {
    return fail("'steps' must be a YAML list")
  }

  return { isValid: true }
}
