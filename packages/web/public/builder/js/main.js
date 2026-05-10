// Builder entrypoint. Imports all extracted modules, wires up the
// window.mediaTools bridge, and exposes every onclick-referenced function
// as a window global so HTML event attributes resolve correctly.

// ─── Fetch wrapper for dry-run mode hardening ───────────────────────────────
// Auto-append ?fake=X to every same-origin request when isDryRun() is on,
// so mutating endpoints can't accidentally hit the real filesystem. The wrapper
// is a superset — when dry-run is OFF, behavior is identical to today.
const originalFetch = globalThis.fetch
const isDryRunForFetch = () =>
  localStorage.getItem("isDryRun") === "1"
const isDryRunFailureForFetch = () =>
  localStorage.getItem("dryRunScenario") === "failure"
const dryRunQueryString = () =>
  isDryRunForFetch()
    ? `?fake=${isDryRunFailureForFetch() ? "failure" : "1"}`
    : ""
globalThis.fetch = function (resource, init) {
  if (
    typeof resource === "string" &&
    !resource.startsWith("http") &&
    !resource.includes("?") &&
    isDryRunForFetch()
  ) {
    resource = resource + dryRunQueryString()
  }
  return originalFetch.call(this, resource, init)
}

import { COMMANDS } from "./commands.js"
import {
  copyGroupYaml,
  copyStepYaml,
  pasteCardAt,
} from "./components/card-clipboard.js"
import {
  closeCommandHelpModal,
  openCommandHelpModal,
} from "./components/command-help-modal.js"
import { attachSortables } from "./components/drag-and-drop.js"
import { registerDslRulesGlobals } from "./components/dsl-rules-builder.js"
import { attachFieldTooltipListeners } from "./components/field-tooltip.js"
import {
  closeFileExplorerModal,
  closeVideoModal,
  confirmFileExplorerDelete,
  confirmFileExplorerPick,
  openFileExplorer,
  openVideoModal,
  refreshFileExplorer,
} from "./components/file-explorer-modal.js"
import { registerFolderPickerGlobals } from "./components/folder-picker-modal.js"
import { loadYamlFromText } from "./components/load-modal.js"
import {
  attachPageHeaderListeners,
  togglePageMenu,
} from "./components/page-header.js"
import {
  addPath,
  attachPathVarListeners,
  removePath,
  renderPathVarCard,
  setPathLabel,
  setPathValue,
} from "./components/path-var-card.js"
import {
  closeYamlModal,
  copyYaml,
  openYamlModal,
  toYamlStr,
  updateYaml,
} from "./components/yaml-modal.js"
import {
  closeLookupModal,
  kickReverseLookups,
  kickTmdbResolutions,
  lookupGoBack,
  lookupSelectGroup,
  lookupSelectRelease,
  lookupSelectReleaseByIndex,
  lookupSelectSimpleByIndex,
  lookupSelectVariant,
  openLookup,
  runLookupSearch,
  scheduleReverseLookup,
  setLookupFormatFilter,
  setLookupSearchTerm,
  updateLookupLinks,
} from "./lookup-modal.js"
// New modules from the W2b split
import { renderAll } from "./render-all.js"
import {
  attachCopyButtonListener,
  cancelApiRun,
  closeApiRunModal,
  copyApiRunLogs,
  runGroup,
  runOrStopStep,
  runSequence,
  runViaApi,
  syncDryRunUI,
  toggleDryRun,
} from "./run-sequence.js"
import {
  addGroupBlock,
  addPicked,
  addStepToGroup,
  attachSequenceKeyboardShortcuts,
  browsePathField,
  buildParams,
  changeCommand,
  clearStaleStepLinksAfterMove,
  flushScheduledUpdateUrl,
  initFieldMin,
  insertAt,
  insertGroupAt,
  moveGroup,
  moveStep,
  promotePathToPathVar,
  redo,
  refreshLinkedInputs,
  removeGroup,
  removeStep,
  renderAllAnimated,
  restoreFromUrl,
  scheduleUpdateUrl,
  scrollPathVarIntoView,
  scrollStepIntoView,
  setAllCollapsed,
  setGroupChildrenCollapsed,
  setGroupLabel,
  setLink,
  setParam,
  setParamAndRender,
  setParamJson,
  startNewSequence,
  stepAliasBlur,
  stepAliasFocus,
  stepAliasKeydown,
  toggleGroupCollapsed,
  toggleStepActions,
  toggleStepCollapsed,
  undo,
  updateUrl,
} from "./sequence-editor.js"
import {
  findStepById,
  getLinkedValue,
  getPaths,
  getStepCounter,
  getSteps,
  initPaths,
  makeStep,
  randomHex,
  setPaths,
  setStepCounter,
  setSteps,
} from "./sequence-state.js"
import {
  closeStepDrawer,
  getOpenStepId,
  openStepDrawer,
} from "./step-drawer.js"
import { attachModalEscapeListener } from "./util/modal-keys.js"
import {
  pathVarOptionText,
  refreshPathVarOptions,
} from "./util/path-var-options.js"

window.mediaTools = window.mediaTools || {}

// ─── window.mediaTools bridge ─────────────────────────────────────────────────
// State accessors — expose live getter/setter properties so components
// that read window.mediaTools.paths / .steps always get the current arrays.
Object.defineProperty(window.mediaTools, "paths", {
  get: () => getPaths(),
  set: (v) => {
    setPaths(v)
  },
  configurable: true,
})
Object.defineProperty(window.mediaTools, "steps", {
  get: () => getSteps(),
  set: (v) => {
    setSteps(v)
  },
  configurable: true,
})
Object.defineProperty(window.mediaTools, "stepCounter", {
  get: () => getStepCounter(),
  set: (v) => {
    setStepCounter(v)
  },
  configurable: true,
})
Object.defineProperty(window.mediaTools, "COMMANDS", {
  get: () => COMMANDS,
  configurable: true,
})

Object.assign(window.mediaTools, {
  // path-var-card
  renderPathVarCard,
  addPath,
  setPathLabel,
  setPathValue,
  removePath,
  pathVarOptionText,
  refreshPathVarOptions,

  // yaml-modal
  toYamlStr,
  updateYaml,
  openYamlModal,
  closeYamlModal,
  copyYaml,

  // page-header
  togglePageMenu,

  // card-clipboard
  copyStepYaml,
  copyGroupYaml,
  pasteCardAt,

  // drag-and-drop
  attachSortables,

  // file-explorer
  openFileExplorer,
  refreshFileExplorer,
  closeFileExplorerModal,
  confirmFileExplorerDelete,
  confirmFileExplorerPick,
  openVideoModal,
  closeVideoModal,

  // render-all
  renderAll,

  // sequence-state helpers
  initPaths,
  randomHex,
  makeStep,
  getLinkedValue,
  findStepById,

  // sequence-editor
  updateUrl,
  scheduleUpdateUrl,
  restoreFromUrl,
  buildParams,
  refreshLinkedInputs,
  clearStaleStepLinksAfterMove,
  scrollStepIntoView,
  scrollPathVarIntoView,
  renderAllAnimated,

  // load-modal
  loadYamlFromText,

  // run-sequence
  runViaApi,
  runSequence,
  closeApiRunModal,

  // sequence-editor (bridge callables)
  undo,
  redo,
  startNewSequence,
  setAllCollapsed,

  // lookup-modal
  kickTmdbResolutions,
  kickReverseLookups,
})

// ─── window.* globals for HTML onclick attributes ─────────────────────────────

// file-explorer / video modal
window.openFileExplorer = openFileExplorer
window.refreshFileExplorer = refreshFileExplorer
window.closeFileExplorerModal = closeFileExplorerModal
window.confirmFileExplorerDelete = confirmFileExplorerDelete
window.confirmFileExplorerPick = confirmFileExplorerPick
window.openVideoModal = openVideoModal
window.closeVideoModal = closeVideoModal

// yaml modal
window.openYamlModal = openYamlModal
window.closeYamlModal = closeYamlModal
window.copyYaml = copyYaml
// openLoadModal / closeLoadModal are now provided by the React bridge (state/bridge.ts)

// page header
window.togglePageMenu = togglePageMenu

// card clipboard
window.copyStepYaml = copyStepYaml
window.copyGroupYaml = copyGroupYaml
window.pasteCardAt = pasteCardAt

// sequence editor actions
window.undo = undo
window.redo = redo
window.startNewSequence = startNewSequence
window.addPicked = addPicked
window.insertAt = insertAt
window.addGroupBlock = addGroupBlock
window.insertGroupAt = insertGroupAt
window.addStepToGroup = addStepToGroup
window.removeStep = removeStep
window.removeGroup = removeGroup
window.moveStep = moveStep
window.moveGroup = moveGroup
window.toggleStepCollapsed = toggleStepCollapsed
window.toggleGroupCollapsed = toggleGroupCollapsed
window.setGroupChildrenCollapsed = setGroupChildrenCollapsed
window.setAllCollapsed = setAllCollapsed
window.setGroupLabel = setGroupLabel
window.stepAliasFocus = stepAliasFocus
window.stepAliasKeydown = stepAliasKeydown
window.stepAliasBlur = stepAliasBlur
window.toggleStepActions = toggleStepActions
window.setParam = setParam
window.setParamAndRender = setParamAndRender
window.setParamJson = setParamJson
window.promotePathToPathVar = promotePathToPathVar
window.initFieldMin = initFieldMin
window.browsePathField = browsePathField
window.setLink = setLink
window.changeCommand = changeCommand

// run sequence
window.runOrStopStep = runOrStopStep
window.runSequence = runSequence
window.runGroup = runGroup
window.runViaApi = runViaApi
window.cancelApiRun = cancelApiRun
window.copyApiRunLogs = copyApiRunLogs
window.closeApiRunModal = (event) => closeApiRunModal(event)
window.toggleDryRun = toggleDryRun

// lookup modal
window.openLookup = openLookup
window.closeLookupModal = closeLookupModal
window.lookupGoBack = lookupGoBack
window.runLookupSearch = runLookupSearch
window.lookupSelectSimpleByIndex = lookupSelectSimpleByIndex
window.lookupSelectGroup = lookupSelectGroup
window.lookupSelectVariant = lookupSelectVariant
window.lookupSelectRelease = lookupSelectRelease
window.lookupSelectReleaseByIndex =
  lookupSelectReleaseByIndex
window.scheduleReverseLookup = scheduleReverseLookup
window.updateLookupLinks = updateLookupLinks
window.setLookupFormatFilter = setLookupFormatFilter
window.setLookupSearchTerm = setLookupSearchTerm

// path-var-card functions (also exposed via mediaTools but need window.* for onclick)
window.addPath = addPath
window.setPathLabel = setPathLabel
window.setPathValue = setPathValue
window.removePath = removePath

// ─── Drawer experiment globals ────────────────────────────────────────────────
// Only activated when useDrawerStepCards === 'true' in localStorage.
// Exposing these unconditionally is harmless — step-renderer only renders
// the compact cards (which call openStepDrawer) when the flag is on.
window.openStepDrawer = openStepDrawer
window.closeStepDrawer = closeStepDrawer
window.getOpenStepId = getOpenStepId

// ─── Attach listeners and bootstrap ──────────────────────────────────────────

attachPageHeaderListeners()
attachModalEscapeListener()
attachSequenceKeyboardShortcuts()
attachCopyButtonListener()
attachFieldTooltipListeners()
registerDslRulesGlobals()
registerFolderPickerGlobals()

// Help-modal globals — used by the ⓘ button in step-card headers and
// the ✕ Close button in the modal markup itself.
window.openCommandHelpModal = openCommandHelpModal
window.closeCommandHelpModal = closeCommandHelpModal

// Delegate path-var-card events on the steps list.
const stepsEl = document.getElementById("steps-el")
if (stepsEl) attachPathVarListeners(stepsEl)

// Flush pending URL/path-var updates and blur any focused input when the user
// refreshes or closes the tab. This ensures number field values (which save
// on `onchange`/blur) and debounced path-var edits are not lost.
window.addEventListener("beforeunload", () => {
  const active = document.activeElement
  if (active && active !== document.body) {
    active.blur()
  }
  flushScheduledUpdateUrl()
})

// Initial bootstrap
initPaths()
restoreFromUrl()
renderAll()
syncDryRunUI()
