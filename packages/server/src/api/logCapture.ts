import {
  formatLogLine,
  type LoggerContext,
  loggingContext,
  registerLogSink,
  withLoggingContext,
} from "@mux-magic/tools"

import { appendJobLog } from "./jobStore.js"

// ---------------------------------------------------------------------------
// Async-context tracking
//
// The single AsyncLocalStorage instance lives in @mux-magic/tools so the
// structured logger and `withJobContext` share one context object. Anywhere
// that used to read `jobContext.getStore()` now reads
// `loggingContext.getStore()?.jobId`. If you ever split these apart again,
// fix `installLogBridge` below and every call to `getActiveJobId`.
// ---------------------------------------------------------------------------

export const withJobContext = <T>(
  jobId: string,
  fn: () => T,
): T => withLoggingContext({ jobId }, fn)

export const getActiveJobId = (): string | undefined =>
  loggingContext.getStore()?.jobId

// ---------------------------------------------------------------------------
// ANSI strip
// ---------------------------------------------------------------------------

export const stripAnsi = (ansiString: string): string =>
  ansiString.replace(
    // biome-ignore lint/suspicious/noControlCharactersInRegex: I believe this hex character is required for identifying ANSI strings.
    /\x1B\[(?:[0-9]{1,3}(?:;[0-9]{1,2}(?:;[0-9]{1,3})?)?)?[mGKHFJsu]/g,
    "",
  )

// ---------------------------------------------------------------------------
// Console patch — call installLogCapture() once at server startup.
//
// Acts as the migration fallback for worker 41: any `console.*` call inside
// a job context that we have not yet rewritten to `getLogger().info(...)`
// keeps flowing through this path with no visible change to the SSE feed.
// ---------------------------------------------------------------------------

export const originalConsole = {
  error: console.error.bind(console),
  info: console.info.bind(console),
  log: console.log.bind(console),
  warn: console.warn.bind(console),
}

const ts = (): string => {
  const now = new Date()
  const hh = String(now.getHours()).padStart(2, "0")
  const mm = String(now.getMinutes()).padStart(2, "0")
  const ss = String(now.getSeconds()).padStart(2, "0")
  const ms = String(now.getMilliseconds()).padStart(3, "0")
  return `[${hh}:${mm}:${ss}.${ms}]`
}

const capture = (args: unknown[]): void => {
  const jobId = getActiveJobId()

  if (!jobId) {
    return
  }

  const line = stripAnsi(
    args
      .map((arg) =>
        arg instanceof Error
          ? (arg.stack ?? arg.message)
          : String(arg),
      )
      .join(" "),
  ).trim()

  if (!line) {
    return
  }

  appendJobLog(jobId, `${ts()} ${line}`)
}

export const installLogCapture = (): void => {
  for (const method of [
    "log",
    "info",
    "warn",
    "error",
  ] as const) {
    console[method] = (...args: unknown[]) => {
      const jobId = getActiveJobId()
      if (jobId) {
        capture(args)
      } else {
        originalConsole[method](...args)
      }
    }
  }
}

export const uninstallLogCapture = (): void => {
  for (const method of [
    "log",
    "info",
    "warn",
    "error",
  ] as const) {
    console[method] = originalConsole[method]
  }
}

// ---------------------------------------------------------------------------
// Structured-logger bridge
//
// Registers a LogSink with @mux-magic/tools that turns every structured
// LogRecord with a jobId into a single appendJobLog line. Records produced
// outside a job context (no jobId) are dropped by this sink — other sinks
// (the future /api/logs/structured SSE feed; worker 2b's error store for
// `level: "error"` records) may still consume them.
// ---------------------------------------------------------------------------

let unregisterBridge: (() => void) | null = null

export const installLogBridge = (): void => {
  if (unregisterBridge) {
    return
  }
  unregisterBridge = registerLogSink((record) => {
    if (typeof record.jobId !== "string") {
      return
    }
    appendJobLog(record.jobId, formatLogLine(record))
  })
}

export const uninstallLogBridge = (): void => {
  if (unregisterBridge) {
    unregisterBridge()
    unregisterBridge = null
  }
}

export type { LoggerContext }
export { loggingContext }
