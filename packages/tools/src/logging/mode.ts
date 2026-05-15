// Logging mode controls how the user-friendly helpers
// (`logInfo` / `logError` / `logWarning` in ./logMessage.ts) deliver their
// output. The structured logger (`getLogger`) is always available regardless
// of mode — the mode only governs the legacy helpers' delivery path.
//
//   "cli"        — chalk-coloured `[TAG] message` console output. No
//                  structured emission. Default; preserves historical
//                  behaviour for any consumer that does not opt in.
//   "api"        — emit a structured `LogRecord` (with a `tag` field) to
//                  the registered sinks. No chalk console output. Used by
//                  the API server, where the log surface is the web UI's
//                  job-log SSE feed, not a human terminal.
//   "cli-debug"  — both. Lets a CLI run capture structured records (for
//                  debug logging to a file, for example) without losing
//                  the user-facing console output.

export type LoggingMode = "cli" | "api" | "cli-debug"

let currentMode: LoggingMode = "cli"

export const setLoggingMode = (mode: LoggingMode): void => {
  currentMode = mode
}

export const getLoggingMode = (): LoggingMode => currentMode

export const __resetLoggingModeForTests = (): void => {
  currentMode = "cli"
}
