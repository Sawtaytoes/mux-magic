export const delayForMilliseconds = (
  milliseconds: number,
) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds)
  })

// The tail of the chain is held on a single-key object rather than a
// reassigned binding, the same lazy-holder shape `templateRoutes` uses.
type ChainHolder = {
  current: Promise<unknown>
}

const attachToChain = <TaskResult>({
  chainHolder,
  minimumIntervalMilliseconds,
  taskPromise,
}: {
  chainHolder: ChainHolder
  minimumIntervalMilliseconds: number
  taskPromise: Promise<TaskResult>
}) =>
  Object.assign(chainHolder, {
    current: taskPromise.then(
      () =>
        delayForMilliseconds(minimumIntervalMilliseconds),
      () =>
        delayForMilliseconds(minimumIntervalMilliseconds),
    ),
  })

export const createRateLimiter = ({
  minimumIntervalMilliseconds,
}: {
  minimumIntervalMilliseconds: number
}) =>
  ((chainHolder: ChainHolder) => ({
    schedule: <TaskResult>(
      task: () => PromiseLike<TaskResult> | TaskResult,
    ) =>
      ((taskPromise: Promise<TaskResult>) =>
        attachToChain({
          chainHolder,
          minimumIntervalMilliseconds,
          taskPromise,
        }) && taskPromise)(
        chainHolder.current.then(() => task()),
      ),
  }))({ current: Promise.resolve() })

export type RateLimiter = ReturnType<
  typeof createRateLimiter
>
