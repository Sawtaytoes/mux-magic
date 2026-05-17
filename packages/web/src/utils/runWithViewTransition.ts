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
  // Skip the View Transitions path when the document isn't visible — some
  // Chromium contexts (notably vitest's browser-harness iframe under
  // headless CI) drop the update callback when visibility is "hidden", and
  // state correctness here must not depend on the animation running. Apply
  // directly in that case.
  if (
    !document.startViewTransition ||
    document.visibilityState === "hidden"
  ) {
    fn()
    return Promise.resolve()
  }
  const transition = document.startViewTransition(() => {
    flushSync(fn)
  })
  // All three ViewTransition promises reject with AbortError when a
  // transition is skipped (e.g. another transition starts first). Silently
  // catch each one so they don't surface as unhandled rejections in CI.
  transition?.ready?.catch(() => {})
  transition?.updateCallbackDone?.catch(() => {})
  return (transition?.finished ?? Promise.resolve()).catch(
    () => {},
  )
}
