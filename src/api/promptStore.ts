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

  if (!resolve) return false

  pendingPrompts.delete(promptId)
  resolve(index)

  return true
}

export const resetPromptStore = (): void => {
  pendingPrompts.clear()
}
