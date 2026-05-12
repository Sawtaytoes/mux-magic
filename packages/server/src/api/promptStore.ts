const pendingPrompts = new Map<
  string,
  (index: number) => void
>()

export const registerPrompt = (
  promptId: string,
): Promise<number> =>
  new Promise<number>((resolve) => {
    pendingPrompts.set(promptId, resolve)
  })

export const resolvePrompt = (
  promptId: string,
  index: number,
): boolean => {
  const resolve = pendingPrompts.get(promptId)

  if (!resolve) return false

  pendingPrompts.delete(promptId)
  resolve(index)

  return true
}

// Drop a pending prompt without resolving it. Called by
// getUserSearchInput's observable teardown when the surrounding
// chain is unsubscribed (job cancelled, parallel sibling failed,
// etc.) so the in-flight prompt entry doesn't leak in pendingPrompts
// forever. Idempotent — silently no-ops if the prompt was already
// resolved or cancelled.
export const cancelPrompt = (promptId: string): void => {
  pendingPrompts.delete(promptId)
}

export const resetPromptStore = (): void => {
  pendingPrompts.clear()
}
