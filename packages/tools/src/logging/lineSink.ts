import type { LogRecord } from "./logger.js"

const RESERVED_KEYS = new Set(["level", "msg"])

const pad = (value: number, width: number): string =>
  String(value).padStart(width, "0")

const formatTimestamp = (date: Date): string =>
  `[${pad(date.getHours(), 2)}:${pad(date.getMinutes(), 2)}:${pad(
    date.getSeconds(),
    2,
  )}.${pad(date.getMilliseconds(), 3)}]`

const formatValue = (value: unknown): string => {
  if (value === null) {
    return "null"
  }
  if (typeof value === "string") {
    return /\s/.test(value) ? `"${value}"` : value
  }
  if (
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value)
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

const renderField = ([key, value]: [
  string,
  unknown,
]): string => `${key}=${formatValue(value)}`

const isRenderableEntry =
  (excludedKeys: ReadonlySet<string>) =>
  ([key, value]: [string, unknown]): boolean =>
    !excludedKeys.has(key) && value !== undefined

const joinFields = (fields: readonly string[]): string =>
  fields.length > 0 ? ` ${fields.join(" ")}` : ""

const TAG_MODE_EXCLUDED_KEYS: ReadonlySet<string> = new Set(
  [...RESERVED_KEYS, "tag"],
)

// When a record carries a `tag` field (set by the `logInfo/logError/logWarning`
// bridge in api mode), render as `[ts] [TAG] msg` so the SSE feed stays byte-
// identical to today's chalk-stripped console-patch output. Anything else
// renders in the structured form `[ts] level field=value... msg`.
export const formatLogLine = (
  record: LogRecord,
  now: Date = new Date(),
): string => {
  if (typeof record.tag === "string") {
    const extraPart = joinFields(
      Object.entries(record)
        .filter(isRenderableEntry(TAG_MODE_EXCLUDED_KEYS))
        .map(renderField),
    )
    return `${formatTimestamp(now)} [${record.tag}]${extraPart} ${record.msg}`
  }

  const fieldPart = joinFields(
    Object.entries(record)
      .filter(isRenderableEntry(RESERVED_KEYS))
      .map(renderField),
  )
  return `${formatTimestamp(now)} ${record.level}${fieldPart} ${record.msg}`
}
