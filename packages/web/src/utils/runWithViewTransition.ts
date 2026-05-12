import { flushSync } from "react-dom"

// ─── runWithViewTransition ───────────────────────────────────────────────────
//
// Run a synchronous DOM mutation (typically a Jotai atom dispatch) inside
// the browser's View Transitions API so the before/after layout cross-fades
// instead of snapping. Falls back to a direct call when the API is
// unavailable (Firefox, older browsers).
//
// Pattern reused by every "this changes the visible card order" action:
//   - StepCard ↑/↓/delete/paste
//   - GroupCard ↑/↓/delete/paste
//   - RuleCard ↑/↓ (inside the DSL rules builder)
//   - InsertDivider's insert/paste handlers in BuilderSequenceList
//
// `flushSync` is required because View Transitions take their "after"
// snapshot synchronously when the callback returns; React's default
// batched updates would otherwise commit AFTER the snapshot was taken,
// leaving the transition with nothing to animate.
//
// Do NOT pass an async function — flushSync only runs the synchronous
// portion. If the work needs to await something, await first, then call
// runWithViewTransition around just the sync state update.

export const runWithViewTransition = (
  fn: () => void,
): Promise<void> => {
  if (document.startViewTransition) {
    return document.startViewTransition(() => {
      flushSync(fn)
    }).finished
  }
  fn()
  return Promise.resolve()
}
