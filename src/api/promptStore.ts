const pendingPrompts = new Map<string, (index: number) => void>()

export const registerPrompt = (
  promptId: string,
): Promise<number> => (
  new Promise<number>((resolve) => {
    pendingPrompts.set(promptId, resolve)
  })
)

export const resolvePrompt = (
  promptId: string,
  index: number,
): boolean => {
  const resolve = pendingPrompts.get(promptId)

  if (!resolve) {
    console.error(
      `[promptStore] resolvePrompt MISS for id=${promptId.slice(0, 8)}; `
      + `pending=[${Array.from(pendingPrompts.keys()).map((k) => k.slice(0, 8)).join(",") || "none"}]`,
    )
    return false
  }

  console.log(`[promptStore] resolvePrompt HIT id=${promptId.slice(0, 8)} index=${index}`)
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
  if (pendingPrompts.has(promptId)) {
    console.error(
      `[promptStore] cancelPrompt removed pending id=${promptId.slice(0, 8)} `
      + `(observable was unsubscribed before the user answered)`,
    )
  }
  pendingPrompts.delete(promptId)
}

export const resetPromptStore = (): void => {
  pendingPrompts.clear()
}
