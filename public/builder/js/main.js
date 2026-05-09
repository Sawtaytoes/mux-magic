// Builder entrypoint. Imports all extracted modules, wires up the
// window.mediaTools bridge, and exposes every onclick-referenced function
// as a window global so HTML event attributes resolve correctly.

import {
  renderPathVarCard,
  attachPathVarListeners,
  addPath,
  setPathLabel,
  setPathValue,
  removePath,
} from './components/path-var-card.js'
import {
  toYamlStr,
  updateYaml,
  openYamlModal,
  closeYamlModal,
  copyYaml,
} from './components/yaml-modal.js'
import {
  openLoadModal,
  closeLoadModal,
  loadYamlFromText,
} from './components/load-modal.js'
import {
  togglePageMenu,
  attachPageHeaderListeners,
} from './components/page-header.js'
import {
  copyStepYaml,
  copyGroupYaml,
  pasteCardAt,
} from './components/card-clipboard.js'
import { attachSortables } from './components/drag-and-drop.js'
import { attachFieldTooltipListeners } from './components/field-tooltip.js'
import {
  openCommandHelpModal,
  closeCommandHelpModal,
} from './components/command-help-modal.js'
import { attachModalEscapeListener } from './util/modal-keys.js'
import {
  openFileExplorer,
  refreshFileExplorer,
  closeFileExplorerModal,
  confirmFileExplorerDelete,
  confirmFileExplorerPick,
  openVideoModal,
  closeVideoModal,
} from './components/file-explorer-modal.js'
import { pathVarOptionText, refreshPathVarOptions } from './util/path-var-options.js'
import { openStepDrawer, closeStepDrawer, getOpenStepId } from './step-drawer.js'
import { isDrawerMode } from './step-renderer.js'

// New modules from the W2b split
import { renderAll } from './render-all.js'
import {
  steps as _steps, paths as _paths,
  setSteps, setPaths, setStepCounter,
  getPaths, getSteps, getStepCounter,
  initPaths, randomHex, makeStep, getLinkedValue, findStepById,
} from './sequence-state.js'
import { registerDslRulesGlobals } from './components/dsl-rules-builder.js'
import { registerFolderPickerGlobals } from './components/folder-picker-modal.js'
import { COMMANDS } from './commands.js'
import {
  updateUrl,
  scheduleUpdateUrl,
  restoreFromUrl,
  undo,
  redo,
  startNewSequence,
  addPicked,
  insertAt,
  addGroupBlock,
  insertGroupAt,
  addStepToGroup,
  removeStep,
  removeGroup,
  moveStep,
  moveGroup,
  clearStaleStepLinksAfterMove,
  toggleStepCollapsed,
  toggleGroupCollapsed,
  setGroupChildrenCollapsed,
  setAllCollapsed,
  setGroupLabel,
  stepAliasFocus,
  stepAliasKeydown,
  stepAliasBlur,
  toggleStepActions,
  setParam,
  setParamAndRender,
  setParamJson,
  promotePathToPathVar,
  initFieldMin,
  flushScheduledUpdateUrl,
  browsePathField,
  setLink,
  refreshLinkedInputs,
  changeCommand,
  buildParams,
  scrollStepIntoView,
  scrollPathVarIntoView,
  renderAllAnimated,
  attachSequenceKeyboardShortcuts,
} from './sequence-editor.js'
import {
  commandPicker,
  enumPicker,
  linkPicker,
  onPathFieldBlur,
  onPathFieldFocus,
  onPathFieldInput,
  pathPickerKeydown,
  pathPickerSelectByIndex,
  attachPathPickerDismissal,
  schedulePathLookup,
} from './pickers.js'
import {
  runOrStopStep,
  runSequence,
  runGroup,
  runViaApi,
  closeApiRunModal,
  cancelApiRun,
  copyApiRunLogs,
  attachCopyButtonListener,
  toggleDryRun,
  syncDryRunUI,
} from './run-sequence.js'
import {
  openLookup,
  closeLookupModal,
  lookupGoBack,
  runLookupSearch,
  lookupSelectSimpleByIndex,
  lookupSelectGroup,
  lookupSelectVariant,
  lookupSelectRelease,
  lookupSelectReleaseByIndex,
  scheduleReverseLookup,
  updateLookupLinks,
  kickReverseLookups,
  kickTmdbResolutions,
  setLookupFormatFilter,
  setLookupSearchTerm,
} from './lookup-modal.js'

window.mediaTools = window.mediaTools || {}

// ─── window.mediaTools bridge ─────────────────────────────────────────────────
// State accessors — expose live getter/setter properties so components
// that read window.mediaTools.paths / .steps always get the current arrays.
Object.defineProperty(window.mediaTools, 'paths', {
  get: () => getPaths(),
  set: (v) => { setPaths(v) },
  configurable: true,
})
Object.defineProperty(window.mediaTools, 'steps', {
  get: () => getSteps(),
  set: (v) => { setSteps(v) },
  configurable: true,
})
Object.defineProperty(window.mediaTools, 'stepCounter', {
  get: () => getStepCounter(),
  set: (v) => { setStepCounter(v) },
  configurable: true,
})
Object.defineProperty(window.mediaTools, 'COMMANDS', {
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

  // load-modal
  loadYamlFromText,
  openLoadModal,
  closeLoadModal,

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
  schedulePathLookup,
  pathPickerKeydown,
  renderAllAnimated,

  // run-sequence
  closeApiRunModal,

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

// yaml / load modal
window.openYamlModal = openYamlModal
window.closeYamlModal = closeYamlModal
window.copyYaml = copyYaml
window.openLoadModal = openLoadModal
window.closeLoadModal = closeLoadModal

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

// path / pickers
Object.assign(window, {
  onPathFieldBlur,
  onPathFieldFocus,
})
window.onPathFieldInput = onPathFieldInput
window.pathPickerKeydown = pathPickerKeydown
window.pathPickerSelectByIndex = pathPickerSelectByIndex

// Expose picker objects so HTML onkeydown/oninput in index.html can call:
//   commandPicker.filter(this.value) / commandPicker.keydown(event) etc.
window.commandPicker = commandPicker
window.enumPicker = enumPicker
window.linkPicker = linkPicker

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
window.lookupSelectReleaseByIndex = lookupSelectReleaseByIndex
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
attachPathPickerDismissal()
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
const stepsEl = document.getElementById('steps-el')
if (stepsEl) attachPathVarListeners(stepsEl)

// Flush pending URL/path-var updates and blur any focused input when the user
// refreshes or closes the tab. This ensures number field values (which save
// on `onchange`/blur) and debounced path-var edits are not lost.
window.addEventListener('beforeunload', () => {
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
