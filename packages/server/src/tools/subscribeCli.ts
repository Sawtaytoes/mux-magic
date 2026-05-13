// Default observer for `yarn media <command>` style CLI invocations.
// The observable's logAndRethrowPipelineError at the bottom of every app-command
// already logged the error with its `[name]` prefix, so the error
// handler here just needs to terminate cleanly with a non-zero exit
// code — no second log line.
export const subscribeCli = () => ({
  complete: () => {
    console.timeEnd("Command Runtime")
    process.exit()
  },
  error: () => {
    console.timeEnd("Command Runtime")
    process.exit(1)
  },
})
