declare global {
  interface Window {
    // Populated by packages/server/scripts/build-command-descriptions.ts at build time.
    getCommandFieldDescription?: (args: {
      commandName: string
      fieldName: string
    }) => string
    // Registered by FileExplorerModal on mount; called by PromptModal video rows.
    openVideoModal?: (absolutePath: string) => void
    // W5 parity-trap: implementation was in deleted legacy sequence-editor.js.
    // Callers in GroupCard + BuilderSequenceList silently no-op until W5 ports to atoms.
    pasteCardAt?: (args: {
      itemIndex?: number
      parentGroupId?: string
    }) => void
    // W5 parity-trap: implementation was in deleted legacy sequence-editor.js.
    // Caller in GroupCard silently no-ops until W5 ports to an atom + API call.
    copyGroupYaml?: (groupId: string) => void
    // W5 parity-trap: implementation was in deleted legacy sequence-editor.js.
    // Caller in GroupCard silently no-ops until W5 ports to an atom + API call.
    runGroup?: (groupId: string) => void
    // W5 parity-trap: implementation was in deleted legacy sequence-editor.js.
    // Caller in StepCard silently no-ops until W5 ports to setStepRunStatusAtom + API call.
    runOrStopStep?: (stepId: string) => void
    // W5 parity-trap: implementation was in deleted legacy sequence-editor.js.
    // Caller in StepCard silently no-ops until W5 ports to an atom + clipboard write.
    copyStepYaml?: (stepId: string) => void
  }
}

export {}
