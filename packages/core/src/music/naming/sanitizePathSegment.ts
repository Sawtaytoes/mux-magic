import { DEFAULT_NAMING_OPTIONS } from "./defaultNamingScript.js"

const DIRECTORY_SEPARATOR_PATTERN = /[/\\]/g
const LOWEST_PRINTABLE_CODE_POINT = 0x20
const DELETE_CODE_POINT = 0x7f
const WINDOWS_FORBIDDEN_PATTERN = /["*:<>?|]/g
const COMBINING_MARK_PATTERN = /\p{M}/gu
const NON_ASCII_PATTERN = /[^\u0020-\u007e]/g
const SPACE_PATTERN = / /g
const TRAILING_DOTS_AND_SPACES_PATTERN = /[. ]+$/

export const replaceDirectorySeparators = (value: string) =>
  value.replace(DIRECTORY_SEPARATOR_PATTERN, "_")

const toAscii = (value: string) =>
  value
    .normalize("NFKD")
    .replace(COMBINING_MARK_PATTERN, "")
    .replace(NON_ASCII_PATTERN, "_")

const removeControlCharacters = (value: string) =>
  Array.from(value)
    .filter(
      (character) =>
        (character.codePointAt(0) ?? 0) >=
          LOWEST_PRINTABLE_CODE_POINT &&
        character.codePointAt(0) !== DELETE_CODE_POINT,
    )
    .join("")

export const sanitizePathSegment = ({
  segment,
  isAsciiOnly = DEFAULT_NAMING_OPTIONS.isAsciiOnly,
  isSpaceReplaced = DEFAULT_NAMING_OPTIONS.isSpaceReplaced,
  isWindowsCompatible = DEFAULT_NAMING_OPTIONS.isWindowsCompatible,
}: {
  segment: string
  isAsciiOnly?: boolean
  isSpaceReplaced?: boolean
  isWindowsCompatible?: boolean
}) =>
  ((sanitizedSegment: string) => sanitizedSegment || "_")(
    [
      replaceDirectorySeparators,
      removeControlCharacters,
      (value: string) =>
        isWindowsCompatible
          ? value.replace(WINDOWS_FORBIDDEN_PATTERN, "_")
          : value,
      (value: string) =>
        isAsciiOnly ? toAscii(value) : value,
      (value: string) => value.trim(),
      (value: string) =>
        isSpaceReplaced
          ? value.replace(SPACE_PATTERN, "_")
          : value,
      (value: string) =>
        value.replace(TRAILING_DOTS_AND_SPACES_PATTERN, ""),
    ].reduce(
      (value, transform) => transform(value),
      segment,
    ),
  )
