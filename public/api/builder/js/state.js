// Shared state accessors. Stage 1 of the builder refactor still keeps
// the canonical `paths` array (and `steps`, `stepCounter`) inside the
// inline <script> in index.html — extracted modules read/write them
// through this module's getters and setters, which delegate to the
// window.mediaTools bridge that the inline script populates.
//
// The bridge defines `paths` / `steps` / `stepCounter` as accessor
// properties on window.mediaTools, so assigning through them reaches
// back into the inline scope. As more components migrate, the actual
// storage moves into this file and the bridge collapses to two-way
// passthroughs that finally go away.

export function getPaths() {
  return window.mediaTools.paths
}

export function getSteps() {
  return window.mediaTools.steps
}

export function setPaths(newPaths) {
  window.mediaTools.paths = newPaths
}

export function setSteps(newSteps) {
  window.mediaTools.steps = newSteps
}

export function getStepCounter() {
  return window.mediaTools.stepCounter
}

export function setStepCounter(newCounter) {
  window.mediaTools.stepCounter = newCounter
}
