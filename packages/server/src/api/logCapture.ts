import { AsyncLocalStorage } from "node:async_hooks"

import { appendJobLog } from "./jobStore.js"

// ---------------------------------------------------------------------------
// Async-context tracking
//
// AsyncLocalStorage propagates through Promises, setTimeout, and EventEmitter
// callbacks, so log lines produced anywhere in an observable pipeline are
// routed to the correct job without a shared mutable variable.
// ---------------------------------------------------------------------------

const jobContext = new AsyncLocalStorage<string>()

export const withJobContext = <T>(
  jobId: string,
  fn: () => T,
): T => jobContext.run(jobId, fn)

export const getActiveJobId = (): string | undefined =>
  jobContext.getStore()

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
  const jobId = jobContext.getStore()

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
      const jobId = jobContext.getStore()
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
