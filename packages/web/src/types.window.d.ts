declare global {
  interface Window {
    // Populated by packages/server/scripts/build-command-descriptions.ts at build time.
    getCommandFieldDescription?: (args: {
      commandName: string
      fieldName: string
    }) => string
    // Registered by FileExplorerModal on mount; called by PromptModal video rows.
    openVideoModal?: (absolutePath: string) => void
    // Injected into index.html by the Hono web server at request time (see
    // packages/web/src/server.ts). Set via REMOTE_SERVER_URL env var.
    __API_BASE__?: string
  }
}

export {}
