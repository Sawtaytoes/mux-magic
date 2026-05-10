// Global window type augmentations.
// The bridge (bridge.ts) that previously held these declarations has been
// retired. Types for components that are still in transition (Wave B–D) are
// preserved here so TypeScript remains happy during the incremental migration.

interface MediaToolsWindow {
  COMMANDS: Record<string, unknown>
  renderAll: () => void
  updateUrl: () => void
  kickReverseLookups: () => void
  kickTmdbResolutions: () => void
  buildParams: (step: unknown) => unknown
  findStepById: (stepId: string) => unknown
  commandLabel: (name: string) => string
  setPathValue: (id: string, value: string) => void
  applyLookupSelection: (...args: unknown[]) => void
  applyDvdCompareSelection: (...args: unknown[]) => void
  openLoadModal: () => void
  closeLoadModal: () => void
  openYamlModal: () => void
  closeYamlModal: () => void
  openCommandHelpModal: (args: { commandName: string }) => void
  closeCommandHelpModal: () => void
  openApiRunModal: (args: {
    jobId: string | null
    status: string
  }) => void
  closeApiRunModal: () => void
  openLookup: (
    lookupType: string,
    stepId: string,
    fieldName: string,
  ) => void
  closeLookupModal: () => void
  openFileExplorer: (
    path: string,
    options?: { pickerOnSelect?: (path: string) => void },
  ) => void
  closeFileExplorerModal: () => void
  showPromptModal: (
    jobId: string,
    promptData: Record<string, unknown>,
  ) => void
  closePromptModal: () => void
  syncUndoRedo: (canUndo: boolean, canRedo: boolean) => void
  onStepStarted: (stepId: unknown, childJobId: unknown) => void
  onStepFinished: (stepId: unknown, data: unknown) => void
  onStepProgress: (stepId: unknown, data: unknown) => void
  onStepLog: (stepId: unknown, line: string) => void
  onChildStepDone: (stepId: unknown, data: unknown) => void
  onSequenceDone: () => void
  insertStep: (...args: unknown[]) => void
  insertGroup: (...args: unknown[]) => void
  undo: () => void
  redo: () => void
  startNewSequence: () => void
  runSequence: (...args: unknown[]) => void
  runViaApi: (...args: unknown[]) => void
  addPath: (...args: unknown[]) => void
  copyYaml: (...args: unknown[]) => void
  setAllCollapsed: (...args: unknown[]) => void
  pathPickerKeydown: (event: KeyboardEvent) => void
  pathPickerSelectByIndex: (index: number) => void
  schedulePathLookup: (
    inputEl: HTMLElement,
    target: unknown,
    value: string,
  ) => void
}

declare global {
  interface Window {
    mediaTools: Partial<MediaToolsWindow>
    commandLabel?: (name: string) => string
    getCommandFieldDescription?: (args: {
      commandName: string
      fieldName: string
    }) => string
    getCommandSummary?: (args: {
      commandName: string
    }) => string
    openVideoModal?: (path: string) => void
    changeCommand?: (
      stepId: string,
      commandName: string,
    ) => void
    setParam?: (
      stepId: string,
      fieldName: string,
      value: unknown,
    ) => void
    setParamAndRender?: (
      stepId: string,
      fieldName: string,
      value: unknown,
    ) => void
    setParamJson?: (
      stepId: string,
      fieldName: string,
      valueStr: string,
    ) => void
    setLink?: (
      stepId: string,
      fieldName: string,
      value: string,
    ) => void
    refreshLinkPickerTrigger?: (
      stepId: string,
      fieldName: string,
    ) => void
    scheduleReverseLookup?: (
      stepId: string,
      fieldName: string,
      value: string,
    ) => void
    updateLookupLinks?: (
      stepId: string,
      fieldName: string,
      value: string,
    ) => void
    promotePathToPathVar?: (
      stepId: string,
      fieldName: string,
      value: string,
    ) => void
    browsePathField?: (
      stepId: string,
      fieldName: string,
      currentPath: string,
    ) => void
    folderPicker?: {
      openFromEl: (el: HTMLElement) => void
      removeFolder: (
        stepId: string,
        fieldName: string,
        folder: string,
      ) => void
    }
    onPathFieldFocus?: (
      inputEl: HTMLElement,
      stepId: string,
      fieldName: string,
      value: string,
    ) => void
    onPathFieldBlur?: (
      inputEl: HTMLElement,
      stepId: string,
      fieldName: string,
      value: string,
    ) => void
    onPathFieldInput?: (
      inputEl: HTMLElement,
      stepId: string,
      fieldName: string,
      value: string,
    ) => void
    pathPickerKeydown?: (event: KeyboardEvent) => void
    pathPickerSelectByIndex?: (index: number) => void
    commandPicker?: {
      open: (
        anchor: { stepId: string },
        el: HTMLElement,
      ) => void
      close: () => void
    }
    enumPicker?: {
      open: (
        anchor: { stepId: string; fieldName: string },
        el: HTMLElement,
      ) => void
      close: () => void
    }
    linkPicker?: {
      open: (
        anchor: { stepId: string; fieldName: string },
        el: HTMLElement,
      ) => void
      close: () => void
    }
    // Wave D — still legacy-implemented; called from React card components
    runOrStopStep?: (stepId: string) => void
    copyStepYaml?: (stepId: string) => void
    copyGroupYaml?: (groupId: string) => void
    runGroup?: (groupId: string) => void
    pasteCardAt?: (target: {
      itemIndex?: number
      parentGroupId?: string
    }) => void
  }
}

export {}
