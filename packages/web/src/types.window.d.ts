declare global {
  interface Window {
    // Populated by packages/server/scripts/build-command-descriptions.ts at build time.
    getCommandFieldDescription?: (args: {
      commandName: string
      fieldName: string
    }) => string
    // Registered by FileExplorerModal on mount; called by PromptModal video rows.
    openVideoModal?: (absolutePath: string) => void
  }
}

export {}
