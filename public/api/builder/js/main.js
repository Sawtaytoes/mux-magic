// Builder entrypoint. Imports extracted modules, registers delegated
// listeners on the steps container, and exposes the transitional
// `window.mediaTools` namespace so anything still living in the inline
// <script> in index.html can call into the modules.
//
// This namespace shrinks as more components migrate — the long-term
// goal is for it to disappear entirely once the inline script is gone.

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
  toggleLoad,
  loadYaml,
  loadYamlFromText,
} from './components/load-panel.js'
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
import { pathVarOptionText, refreshPathVarOptions } from './util/path-var-options.js'

window.mediaTools = window.mediaTools || {}

// Outbound bridge — names the inline script (or an HTML onclick) calls
// into. The reverse direction (paths/steps getters, renderAll, etc.) is
// populated by the inline script in index.html.
Object.assign(window.mediaTools, {
  renderPathVarCard,
  addPath,
  setPathLabel,
  setPathValue,
  removePath,
  pathVarOptionText,
  refreshPathVarOptions,
  toYamlStr,
  updateYaml,
  openYamlModal,
  closeYamlModal,
  copyYaml,
  toggleLoad,
  loadYaml,
  loadYamlFromText,
  togglePageMenu,
  copyStepYaml,
  copyGroupYaml,
  pasteCardAt,
  attachSortables,
})

attachPageHeaderListeners()

// Delegate path-var-card events on the steps list. Bound once; survives
// every renderAll since the parent is never replaced.
const stepsEl = document.getElementById('steps-el')
if (stepsEl) attachPathVarListeners(stepsEl)

// Initial bootstrap. Inline script defines initPaths / restoreFromUrl /
// renderAll (function declarations are hoisted, so the bridge entries
// are assigned before this runs). We deferred the calls out of the
// inline script so renderAll → renderPathVarCard finds the extracted
// module ready.
window.mediaTools.initPaths()
window.mediaTools.restoreFromUrl()
window.mediaTools.renderAll()
