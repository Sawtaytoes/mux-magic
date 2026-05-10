// Thin shim — ProgressUtils is loaded as a global by /progress-utils.js.
// Re-export it so ES-module code can import it by name instead of reading
// window.ProgressUtils, making the dependency explicit and testable.
export const ProgressUtils = window.ProgressUtils
