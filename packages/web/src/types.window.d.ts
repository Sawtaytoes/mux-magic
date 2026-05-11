declare global {
  interface Window {
    getCommandFieldDescription?: (args: {
      commandName: string
      fieldName: string
    }) => string
    openVideoModal?: (absolutePath: string) => void
    pasteCardAt?: (args: { itemIndex?: number; parentGroupId?: string }) => void
    copyGroupYaml?: (groupId: string) => void
    runGroup?: (groupId: string) => void
    runOrStopStep?: (stepId: string) => void
    copyStepYaml?: (stepId: string) => void
  }
}

export {}
