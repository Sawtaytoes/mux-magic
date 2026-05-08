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
      `[promptStore] resolvePrompt: no pending prompt for id ${promptId}; `
      + `pending=${Array.from(pendingPrompts.keys()).join(",") || "(none)"}`,
    )
    return false
  }

  console.log(`[promptStore] resolvePrompt fired for id ${promptId} index=${index}`)
  pendingPrompts.delete(promptId)
  resolve(index)

  return true
}

export const resetPromptStore = (): void => {
  pendingPrompts.clear()
}
