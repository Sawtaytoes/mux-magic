import { getDefaultStore } from "jotai"
import type {
  FileExplorerState,
  LookupState,
  PathVar,
  PromptData,
  SequenceItem,
} from "../types"
import { pathsAtom } from "./pathsAtom"
import {
  commandPickerStateAtom,
  enumPickerStateAtom,
  linkPickerStateAtom,
  type PathPickerTarget,
  pathPickerStateAtom,
} from "./pickerAtoms"
import { stepCounterAtom, stepsAtom } from "./stepsAtom"
import {
  apiRunModalAtom,
  commandHelpCommandNameAtom,
  commandHelpModalOpenAtom,
  dryRunAtom,
  failureModeAtom,
  fileExplorerAtom,
  loadModalOpenAtom,
  lookupModalAtom,
  promptModalAtom,
  runningAtom,
  yamlModalOpenAtom,
} from "./uiAtoms"

// ─── Window type augmentations ────────────────────────────────────────────────

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // biome-ignore lint/suspicious/noExplicitAny: suppressed during react-migration
    mediaTools: Record<string, any>
    openLoadModal: () => void
    closeLoadModal: () => void
    openYamlModal: () => void
    closeYamlModal: () => void
    openCommandHelpModal: (args: {
      commandName: string
    }) => void
    closeCommandHelpModal: () => void
    openVideoModal?: (path: string) => void
    commandLabel?: (name: string) => string
    getCommandFieldDescription?: (args: {
      commandName: string
      fieldName: string
    }) => string
    getCommandSummary?: (args: {
      commandName: string
    }) => string
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
    // Wave B field bridge functions (legacy-implemented during transition)
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
    // Path picker — called from legacy path field oninput/onfocus/onblur/onkeydown
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
    schedulePathLookup?: (
      inputEl: HTMLElement,
      target: PathPickerTarget,
      value: string,
    ) => void
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

export const initBridge = () => {
  const store = getDefaultStore()

  window.mediaTools = window.mediaTools ?? {}

  // Capture the legacy property descriptors that main.js installed (with
  // configurable:true). We keep the legacy setters alive so that writes from
  // either side propagate to the sequence-state.js module variables that
  // render-all.js reads as live ES module bindings.
  const stepsDesc = Object.getOwnPropertyDescriptor(
    window.mediaTools,
    "steps",
  )
  const pathsDesc = Object.getOwnPropertyDescriptor(
    window.mediaTools,
    "paths",
  )
  const counterDesc = Object.getOwnPropertyDescriptor(
    window.mediaTools,
    "stepCounter",
  )

  const legacySetSteps = stepsDesc?.set
  const legacySetPaths = pathsDesc?.set
  const legacySetCounter = counterDesc?.set

  // Seed Jotai atoms from whatever legacy state already exists (URL restore
  // runs before this bridge, so atoms start with the correct initial values).
  if (stepsDesc?.get)
    store.set(stepsAtom, stepsDesc.get() as SequenceItem[])
  if (pathsDesc?.get)
    store.set(pathsAtom, pathsDesc.get() as PathVar[])
  if (counterDesc?.get)
    store.set(stepCounterAtom, counterDesc.get() as number)

  Object.defineProperty(window.mediaTools, "steps", {
    get: () => store.get(stepsAtom),
    set: (value: SequenceItem[]) => {
      legacySetSteps?.(value)
      store.set(stepsAtom, value)
    },
    configurable: true,
    enumerable: true,
  })

  Object.defineProperty(window.mediaTools, "paths", {
    get: () => store.get(pathsAtom),
    set: (value: PathVar[]) => {
      legacySetPaths?.(value)
      store.set(pathsAtom, value)
    },
    configurable: true,
    enumerable: true,
  })

  Object.defineProperty(window.mediaTools, "stepCounter", {
    get: () => store.get(stepCounterAtom),
    set: (value: number) => {
      legacySetCounter?.(value)
      store.set(stepCounterAtom, value)
    },
    configurable: true,
    enumerable: true,
  })

  // Modal open/close: exposed on both window.mediaTools and window.* for HTML
  // onclick="openLoadModal()" attribute compatibility (main.js is gone for these).
  const openLoadModal = () => {
    store.set(loadModalOpenAtom, true)
  }
  const closeLoadModal = () => {
    store.set(loadModalOpenAtom, false)
  }

  window.mediaTools.openLoadModal = openLoadModal
  window.mediaTools.closeLoadModal = closeLoadModal
  window.openLoadModal = openLoadModal
  window.closeLoadModal = closeLoadModal

  // ─── Wave A: YamlModal + CommandHelpModal ─────────────────────────────────

  const openYamlModal = () =>
    store.set(yamlModalOpenAtom, true)
  const closeYamlModal = () =>
    store.set(yamlModalOpenAtom, false)
  const openCommandHelpModal = ({
    commandName,
  }: {
    commandName: string
  }) => {
    store.set(commandHelpCommandNameAtom, commandName)
    store.set(commandHelpModalOpenAtom, true)
  }
  const closeCommandHelpModal = () =>
    store.set(commandHelpModalOpenAtom, false)

  window.mediaTools.openYamlModal = openYamlModal
  window.mediaTools.closeYamlModal = closeYamlModal
  window.mediaTools.openCommandHelpModal =
    openCommandHelpModal
  window.mediaTools.closeCommandHelpModal =
    closeCommandHelpModal
  window.openYamlModal = openYamlModal
  window.closeYamlModal = closeYamlModal
  window.openCommandHelpModal = openCommandHelpModal
  window.closeCommandHelpModal = closeCommandHelpModal

  // ─── Picker bridges ─────────────────────────────────────────────────────────
  // Legacy step-card onclick handlers call window.commandPicker.open(anchor, el)
  // etc. Each bridge captures the trigger element's rect and writes into the
  // corresponding Jotai atom; the React picker component reads it and renders.

  const captureRect = (el: HTMLElement) => {
    const raw = el.getBoundingClientRect()
    return {
      left: raw.left,
      top: raw.top,
      right: raw.right,
      bottom: raw.bottom,
      width: raw.width,
      height: raw.height,
    }
  }

  window.commandPicker = {
    open: (anchor, el) => {
      const current = store.get(commandPickerStateAtom)
      if (
        current &&
        current.anchor.stepId === anchor.stepId
      ) {
        store.set(commandPickerStateAtom, null)
        return
      }
      store.set(commandPickerStateAtom, {
        anchor,
        triggerRect: captureRect(el),
      })
    },
    close: () => store.set(commandPickerStateAtom, null),
  }

  window.enumPicker = {
    open: (anchor, el) => {
      const current = store.get(enumPickerStateAtom)
      if (
        current &&
        current.anchor.stepId === anchor.stepId &&
        current.anchor.fieldName === anchor.fieldName
      ) {
        store.set(enumPickerStateAtom, null)
        return
      }
      store.set(enumPickerStateAtom, {
        anchor,
        triggerRect: captureRect(el),
      })
    },
    close: () => store.set(enumPickerStateAtom, null),
  }

  window.linkPicker = {
    open: (anchor, el) => {
      const current = store.get(linkPickerStateAtom)
      if (
        current &&
        current.anchor.stepId === anchor.stepId &&
        current.anchor.fieldName === anchor.fieldName
      ) {
        store.set(linkPickerStateAtom, null)
        return
      }
      store.set(linkPickerStateAtom, {
        anchor,
        triggerRect: captureRect(el),
      })
    },
    close: () => store.set(linkPickerStateAtom, null),
  }

  // Path picker: triggered by <input> focus/input/blur/keydown in legacy fields.
  // schedulePathLookup is the main entry point; the others are thin wrappers.

  const schedulePathLookup = (
    inputEl: HTMLElement,
    target: PathPickerTarget,
    value: string,
  ) => {
    const trimmed = (value ?? "").trim()
    if (!trimmed) {
      store.set(pathPickerStateAtom, null)
      return
    }
    const trailingSlash = /[\\/]$/.test(trimmed)
    const lastSepIndex = Math.max(
      trimmed.lastIndexOf("/"),
      trimmed.lastIndexOf("\\"),
    )
    const parentPath =
      lastSepIndex <= 0
        ? trimmed
        : trimmed.slice(0, lastSepIndex) || "/"
    const query = trailingSlash
      ? ""
      : lastSepIndex < 0
        ? trimmed
        : trimmed.slice(lastSepIndex + 1)

    const existing = store.get(pathPickerStateAtom)
    if (existing?.debounceTimerId) {
      clearTimeout(existing.debounceTimerId)
    }

    const rawRect = inputEl.getBoundingClientRect()
    const triggerRect = {
      left: rawRect.left,
      top: rawRect.top,
      right: rawRect.right,
      bottom: rawRect.bottom,
      width: rawRect.width,
      height: rawRect.height,
    }

    if (
      existing?.cachedParentPath === parentPath &&
      existing.entries !== null
    ) {
      store.set(pathPickerStateAtom, {
        ...existing,
        inputElement: inputEl,
        target,
        parentPath,
        query,
        triggerRect,
        activeIndex: 0,
        debounceTimerId: null,
      })
      return
    }

    const newRequestToken =
      (existing?.requestToken ?? 0) + 1
    const timerId = setTimeout(() => {
      store.set(pathPickerStateAtom, (prev) => {
        if (!prev) {
          return prev
        }
        return {
          ...prev,
          debounceTimerId: null,
          requestToken: newRequestToken,
        }
      })
    }, 250)

    store.set(pathPickerStateAtom, {
      inputElement: inputEl,
      target,
      parentPath,
      query,
      triggerRect,
      entries:
        existing?.cachedParentPath === parentPath
          ? (existing.entries ?? null)
          : null,
      error: null,
      activeIndex: 0,
      matches: null,
      separator: existing?.separator ?? "/",
      cachedParentPath: existing?.cachedParentPath ?? null,
      requestToken: existing?.requestToken ?? 0,
      debounceTimerId: timerId,
    })
  }

  window.schedulePathLookup = schedulePathLookup
  window.mediaTools.schedulePathLookup = schedulePathLookup

  window.onPathFieldFocus = (
    inputEl,
    stepId,
    fieldName,
    value,
  ) => {
    if (!value) {
      return
    }
    schedulePathLookup(
      inputEl,
      { mode: "step", stepId, fieldName },
      value,
    )
  }

  window.onPathFieldBlur = (
    inputEl,
    stepId,
    fieldName,
    value,
  ) => {
    const trimmed = (value ?? "").replace(/[\\/]+$/, "")
    if (trimmed !== value) {
      ;(inputEl as HTMLInputElement).value = trimmed
      ;(
        window.setParam as
          | ((s: string, f: string, v: unknown) => void)
          | undefined
      )?.(stepId, fieldName, trimmed || undefined)
    }
    store.set(pathPickerStateAtom, null)
  }

  window.onPathFieldInput = (
    inputEl,
    stepId,
    fieldName,
    value,
  ) => {
    schedulePathLookup(
      inputEl,
      { mode: "step", stepId, fieldName },
      value,
    )
  }

  window.pathPickerKeydown = (event) => {
    const state = store.get(pathPickerStateAtom)
    if (!state) {
      return
    }
    if (event.key === "Escape") {
      event.preventDefault()
      const inputEl = state.inputElement as HTMLInputElement
      const trimmed = (inputEl.value ?? "").replace(
        /[\\/]+$/,
        "",
      )
      if (trimmed !== inputEl.value) {
        inputEl.value = trimmed
      }
      if (state.target.mode === "step") {
        const { stepId, fieldName } = state.target
        ;(
          window.setParam as
            | ((s: string, f: string, v: unknown) => void)
            | undefined
        )?.(stepId, fieldName, trimmed || undefined)
        // Clear folderMultiSelect fields whose sourceField matches the changed field.
        const step =
          window.mediaTools.findStepById?.(stepId)
        const commandDef = step?.command
          ? window.mediaTools.COMMANDS?.[step.command]
          : undefined
        let didClearFolders = false
        commandDef?.fields?.forEach(
          (field: {
            name: string
            type: string
            sourceField?: string
          }) => {
            if (
              field.type === "folderMultiSelect" &&
              field.sourceField === fieldName
            ) {
              window.setParam?.(
                stepId,
                field.name,
                undefined,
              )
              didClearFolders = true
            }
          },
        )
        if (didClearFolders) {
          window.mediaTools.renderAll?.()
        }
      } else if (state.target.mode === "pathVar") {
        ;(
          window.mediaTools.setPathValue as
            | ((id: string, v: string) => void)
            | undefined
        )?.(state.target.pathVarId, trimmed)
      }
      store.set(pathPickerStateAtom, null)
      return
    }
    const matches = state.matches ?? []
    if (!matches.length) {
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault()
        store.set(pathPickerStateAtom, null)
      }
      return
    }
    if (event.key === "ArrowDown") {
      event.preventDefault()
      store.set(pathPickerStateAtom, (prev) =>
        prev
          ? {
              ...prev,
              activeIndex:
                (prev.activeIndex + 1) % matches.length,
            }
          : prev,
      )
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      store.set(pathPickerStateAtom, (prev) =>
        prev
          ? {
              ...prev,
              activeIndex:
                (prev.activeIndex - 1 + matches.length) %
                matches.length,
            }
          : prev,
      )
    } else if (
      event.key === "Tab" ||
      event.key === "Enter"
    ) {
      event.preventDefault()
      const entry = matches[state.activeIndex]
      if (entry) {
        // Trigger selection by dispatching a synthetic click — this avoids
        // duplicating the applySelection logic here in the bridge.
        // The PathPicker component handles the actual state update.
        const button = document.querySelector(
          `[data-testid="path-picker"] button:nth-child(${state.activeIndex + 1})`,
        ) as HTMLButtonElement | null
        button?.click()
      }
    }
  }

  window.pathPickerSelectByIndex = (index) => {
    const state = store.get(pathPickerStateAtom)
    if (!state?.matches) {
      return
    }
    const button = document.querySelector(
      `[data-testid="path-picker"] button:nth-child(${index + 1})`,
    ) as HTMLButtonElement | null
    button?.click()
  }

  window.mediaTools.pathPickerKeydown =
    window.pathPickerKeydown
  window.mediaTools.pathPickerSelectByIndex =
    window.pathPickerSelectByIndex

  // ─── Wave E: Lookup modal ─────────────────────────────────────────────────

  window.mediaTools.openLookup = (
    lookupType: string,
    stepId: string,
    fieldName: string,
  ) => {
    store.set(lookupModalAtom, {
      lookupType: lookupType as LookupState["lookupType"],
      stepId,
      fieldName,
      stage: "search",
      searchTerm: "",
      searchError: null,
      results: null,
      formatFilter:
        lookupType === "dvdcompare" ? "Blu-ray 4K" : "all",
      selectedGroup: null,
      selectedVariant: null,
      selectedFid: null,
      releases: null,
      releasesDebug: null,
      releasesError: null,
      loading: false,
    })
  }

  window.mediaTools.closeLookupModal = () =>
    store.set(lookupModalAtom, null)

  // ─── Wave E: File explorer modal ──────────────────────────────────────────

  window.mediaTools.openFileExplorer = (
    path: string,
    options: {
      pickerOnSelect?: (selectedPath: string) => void
    } = {},
  ) => {
    store.set(fileExplorerAtom, {
      path,
      pickerOnSelect: options.pickerOnSelect ?? null,
    } as FileExplorerState)
  }

  window.mediaTools.closeFileExplorerModal = () =>
    store.set(fileExplorerAtom, null)

  // Also expose directly on window for legacy result-card onclick calls.
  ;(
    window as unknown as Record<string, unknown>
  ).openFileExplorer = (
    path: string,
    options?: {
      pickerOnSelect?: (selectedPath: string) => void
    },
  ) => window.mediaTools.openFileExplorer(path, options)

  // ─── Wave E: Run sequence ─────────────────────────────────────────────────

  window.mediaTools.openApiRunModal = ({
    jobId,
    status,
  }: {
    jobId: string | null
    status: string
  }) => {
    store.set(runningAtom, status === "running")
    store.set(apiRunModalAtom, {
      jobId: jobId ?? null,
      status: status as never,
      logs: [],
      childJobId: null,
      childStepId: null,
    })
  }

  window.mediaTools.closeApiRunModal = () => {
    store.set(apiRunModalAtom, null)
    store.set(runningAtom, false)
  }

  // ─── Wave E: Prompt modal ─────────────────────────────────────────────────

  window.mediaTools.showPromptModal = (
    jobId: string,
    promptData: Omit<PromptData, "jobId">,
  ) => {
    store.set(promptModalAtom, { jobId, ...promptData })
  }

  window.mediaTools.closePromptModal = () =>
    store.set(promptModalAtom, null)

  // ─── Wave E: Dry-run sync (legacy → atoms) ────────────────────────────────
  // Seed from localStorage on init so React header reflects persisted state.
  store.set(
    dryRunAtom,
    localStorage.getItem("isDryRun") === "1",
  )
  store.set(
    failureModeAtom,
    localStorage.getItem("dryRunScenario") === "failure",
  )
}
