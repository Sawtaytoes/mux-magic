// Shared regex helpers for RenameRegexField + RegexWithFlagsField.
//
// All three concerns live in one module so the two components stay in
// sync on the live-preview behavior the user sees (Match badge, captured
// groups, slash-form display, flags validation). If a third regex-field
// shape ever shows up, it imports from here and inherits the same UX.

// JS RegExp constructor accepts any subset of g/i/m/s/u/y. `d` (hasIndices)
// is intentionally excluded — the live preview doesn't surface offsets,
// and rejecting unknown chars at validation time gives the user a clearer
// inline error than the SyntaxError `new RegExp` would otherwise throw.
const ALLOWED_FLAG_CHARS = "gimsuy"

export const validateRegexFlags = (
  flags: string,
): { isValid: boolean; invalidChars: string } => {
  const invalidChars = Array.from(flags)
    .filter((char) => !ALLOWED_FLAG_CHARS.includes(char))
    .filter(
      (char, index, all) => all.indexOf(char) === index,
    )
    .join("")
  return { isValid: invalidChars === "", invalidChars }
}

// Build a RegExp without throwing — the live preview needs to swallow
// per-keystroke errors and just render a "no match" state instead of
// blowing up the React tree.
export const safeBuildRegex = (
  pattern: string,
  flags: string,
): { regex: RegExp | null; error: string | null } => {
  if (pattern === "") {
    return { regex: null, error: null }
  }
  const flagValidation = validateRegexFlags(flags)
  if (!flagValidation.isValid) {
    return {
      regex: null,
      error: `Invalid flag(s): ${flagValidation.invalidChars}`,
    }
  }
  try {
    return { regex: new RegExp(pattern, flags), error: null }
  } catch (cause) {
    return {
      regex: null,
      error:
        cause instanceof Error
          ? cause.message
          : String(cause),
    }
  }
}

// Slash-form display: presents the pattern + flags as a JS regex literal
// `/pattern/flags`. This is presentation-only — the underlying value the
// schema stores stays as separate `pattern` + `flags` strings. Forward-slashes
// inside the pattern are escaped so the literal is unambiguous.
export const formatSlashLiteral = (
  pattern: string,
  flags: string,
): string =>
  `/${pattern.replace(/\//g, "\\/")}/${flags}`

// Inverse of formatSlashLiteral — splits the user's edits to the slash
// literal back into `{ pattern, flags }`. Tolerates a missing leading
// slash (user mid-edit) and unescapes the `\/` sequence.
export const parseSlashLiteral = (
  raw: string,
): { pattern: string; flags: string } => {
  const trimmed = raw.trim()
  const body = trimmed.startsWith("/")
    ? trimmed.slice(1)
    : trimmed
  // Find the LAST unescaped `/`. Reduce char-by-char so we don't get
  // confused by escaped `\/` inside the pattern. `isSkipNext` skips the
  // character immediately after a backslash (the escape).
  const { lastDelimiterIndex } = Array.from(body).reduce<{
    lastDelimiterIndex: number
    isSkipNext: boolean
  }>(
    (state, char, index) => {
      if (state.isSkipNext) {
        return { ...state, isSkipNext: false }
      }
      if (char === "\\") {
        return { ...state, isSkipNext: true }
      }
      if (char === "/") {
        return { ...state, lastDelimiterIndex: index }
      }
      return state
    },
    { lastDelimiterIndex: -1, isSkipNext: false },
  )
  if (lastDelimiterIndex === -1) {
    return { pattern: body.replace(/\\\//g, "/"), flags: "" }
  }
  return {
    pattern: body
      .slice(0, lastDelimiterIndex)
      .replace(/\\\//g, "/"),
    flags: body.slice(lastDelimiterIndex + 1),
  }
}

export type LivePreviewResult =
  | { state: "empty" }
  | { state: "invalid"; message: string }
  | {
      state: "no-match"
      compiledPattern: string
    }
  | {
      state: "match"
      compiledPattern: string
      output: string | null
      groups: Array<{ name: string; value: string }>
    }

// Runs the regex against the sample without throwing. `replacement` is
// optional — filters (no replacement) get a Match/No-match verdict + the
// captured groups; renames get the same plus the predicted output
// filename produced by String.replace.
export const runLivePreview = ({
  pattern,
  flags,
  replacement,
  sample,
}: {
  pattern: string
  flags: string
  replacement?: string
  sample: string
}): LivePreviewResult => {
  if (sample === "") return { state: "empty" }
  const { regex, error } = safeBuildRegex(pattern, flags)
  if (error !== null) return { state: "invalid", message: error }
  if (regex === null) return { state: "empty" }
  const match = regex.exec(sample)
  const compiledPattern = formatSlashLiteral(pattern, flags)
  if (!match) {
    return { state: "no-match", compiledPattern }
  }
  // String.replace with a callback would re-run the engine; passing the
  // raw replacement keeps `$1` / `$<name>` substitution wired through
  // the JS engine for free.
  const output =
    replacement === undefined
      ? null
      : sample.replace(regex, replacement)
  const numericGroups = match.slice(1).map((value, index) => ({
    name: String(index + 1),
    value: value ?? "",
  }))
  const namedGroups = match.groups
    ? Object.entries(match.groups).map(
        ([name, value]) => ({ name, value: value ?? "" }),
      )
    : []
  return {
    state: "match",
    compiledPattern,
    output,
    groups: [...numericGroups, ...namedGroups],
  }
}
