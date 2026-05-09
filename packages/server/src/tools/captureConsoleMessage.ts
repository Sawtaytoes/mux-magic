import { MockInstance, vi } from "vitest"

export const captureConsoleMessage = <TaskResponse>(
  logType: (
    | "error"
    | "info"
    | "log"
    | "warn"
  ),
  task: (
    consoleSpy: MockInstance,
  ) => TaskResponse,
) => {
  const consoleSpy = (
    vi
    .spyOn(
      console,
      logType,
    )
    .mockImplementation(
      () => {}
    )
  )

  const taskResponse = (
    task(
      consoleSpy,
    )
  )

  if (taskResponse instanceof Promise) {
    taskResponse
    .finally(() => {
      consoleSpy
      .mockClear()
    })
  }
  else {
    consoleSpy
    .mockClear()
  }

  return taskResponse
}
