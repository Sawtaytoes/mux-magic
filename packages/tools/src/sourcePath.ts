// Canonical "Source Path" concept.
//
// Every command that takes a primary input directory exposes its value as a
// field named `sourcePath` (via this constant) and renders it under the label
// "Source Path". Centralising the spelling here keeps server schemas, the
// CLI's option name, the web field-builder, and the YAML codec's legacy-rename
// map all in agreement — a single rename here would still ripple if any
// caller hardcoded the string.

export const SOURCE_PATH_FIELD_NAME = "sourcePath" as const
export const SOURCE_PATH_LABEL = "Source Path" as const

// Canonical: an absolute filesystem path. Today the validation layer is
// nominal — every string is a SourcePath. The alias documents intent at
// callsites and gives a single place to tighten later (e.g. brand the type)
// without a codebase-wide replace.
export type SourcePath = string
