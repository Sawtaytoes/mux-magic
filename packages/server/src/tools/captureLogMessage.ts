import { captureConsoleMessage } from "./captureConsoleMessage.js"
import { createLogMessage } from "./logMessage.js"

export const captureLogMessage = <TaskResponse>(
  logType: Parameters<typeof createLogMessage>[0]["logType"],
  task: Parameters<typeof captureConsoleMessage<TaskResponse>>[1],
) => (
  captureConsoleMessage(
    logType,
    task,
  )
)
