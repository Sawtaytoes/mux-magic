import type { ChildProcess } from "node:child_process"

export const childProcessCloseGraceMilliseconds = 10_000

// Calls `onSettled` once, when the process has ended and its output has
// been read.
//
// 'exit' alone is too early: stdout can still hold unread lines, such as
// the last titles or the saved-title count. 'close' alone can be too late:
// it waits for every copy of the stdio pipes, so a helper that inherited
// stdout and outlives a crashed makemkvcon would hold the job open. So this
// waits for 'close', and stops waiting a grace period after 'exit'.
// A process that never started emits 'close' without 'exit'.
export const onChildProcessSettled = ({
  childProcess,
  onSettled,
}: {
  childProcess: ChildProcess
  onSettled: ({
    code,
    signal,
  }: {
    code: number | null
    signal: NodeJS.Signals | null
  }) => void
}) => {
  const settledState = { isSettled: false }

  const settle = ({
    code,
    signal,
  }: {
    code: number | null
    signal: NodeJS.Signals | null
  }) => {
    if (!settledState.isSettled) {
      settledState.isSettled = true
      onSettled({ code, signal })
    }
  }

  childProcess.on("exit", (code, signal) => {
    const graceTimeoutHandle = setTimeout(() => {
      settle({ code, signal })
    }, childProcessCloseGraceMilliseconds)

    childProcess.once("close", () => {
      clearTimeout(graceTimeoutHandle)
    })
  })

  childProcess.on("close", (code, signal) => {
    settle({ code, signal })
  })
}
