declare global {
  interface Window {
    // Populated by packages/api/scripts/build-command-descriptions.ts at build time.
    getCommandFieldDescription?: (args: {
      commandName: string
      fieldName: string
    }) => string
  }
}

export {}
