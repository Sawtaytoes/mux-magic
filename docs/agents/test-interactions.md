# Test Interaction Conventions

Tests should describe what a **human user** does and sees, not what the DOM contains. Pick the simulation tier and the assertion that matches the user's perspective.

## Prefer `user-event` over `fireEvent`

- **Default:** drive interactions with `@testing-library/user-event` (`await user.click(...)`, `await user.type(...)`, `await user.keyboard(...)`, `await user.tripleClick(...)`). `user-event` simulates real focus/selection/keyboard sequencing — a human clicking, focusing, typing — which catches bugs `fireEvent` skips.
- **`fireEvent.*` is a last resort.** Reach for it ONLY when (a) you need to fire an event no human can produce (`drop`, `paste` with a synthetic `DataTransfer`, `wheel`), or (b) you've documented a known framework race that `user-event` cannot work around — and even then, leave a comment explaining why a real user gesture isn't being used. "I couldn't get user-event to work" is not a reason; it's a signal to redesign the test.
- **Don't substitute `fireEvent.change` for typing.** An `<input>` that a human types into MUST be tested with `user.type` / `user.keyboard`. If `user.type` is dropping keystrokes, the failure is a real framework constraint (see "Replacing controlled input contents" below) and the test needs redesign, not a `fireEvent.change` workaround.

## Replacing controlled input contents

Vitest runs the web tests in browser mode (real chromium via Playwright). With React controlled inputs whose `onChange` writes to a **Jotai atom** (not local `useState`), the atom update re-renders the input's parent on every keystroke, which races vitest-browser's keystroke timing — `user.clear(input)` then `user.type(input, "abc")` can land only the last keystroke.

Recipes, in order of preference:

1. **Type fresh.** Start the test with the input's atom value at `""` and `await user.type(input, "newvalue")`. No clearing needed. This is also the more meaningful flow to test (new variable, user types initial value).
2. **End-to-end via Playwright e2e.** If pre-filled-then-replaced is the genuine user flow, cover it in `e2e/*.spec.ts` where Playwright's native `locator.fill()` doesn't have the race.
3. **Don't test the keystroke roundtrip in unit tests.** Assert atom→input data binding instead (`renderCard({ value: "74759" }); expect(input).toHaveValue("74759")`), then rely on the e2e for the type-and-persist flow.

Local-state inputs (`useState` inside the same component as the `<input>`) don't have this race — `user.type` works normally because the re-render is local and synchronous. The trap is specifically global-store-backed controlled inputs.

## Prefer `.toBeVisible()` over `.toBeInTheDocument()`

Default to `expect(node).toBeVisible()`. A human sees the element only if it's rendered AND not hidden by `display: none` / `visibility: hidden` / `hidden` attribute / a zero-size box / an ancestor that hides it. `.toBeInTheDocument()` passes for an element that's mounted-but-invisible, which is a test that says "the DOM contains X" rather than "the user can see X" — and that's the bug bullseye for accessibility regressions and CSS-driven UI breaks.

Use `.toBeInTheDocument()` only when you're deliberately asserting a hidden-by-design element exists (off-screen live regions for screen readers, prefetch placeholders, conditional offscreen mounts) and add a comment naming the reason.

## Prefer positive operations

- **`array.every(predicate)`** over `!array.some(opposite)`. Reads as "all match" instead of "none don't match."
- **`array.find(predicate)`** over `array.filter(predicate)[0]`.
- **`array.some(predicate)`** over `array.filter(predicate).length > 0`.
- **Equality** over double-negation. `value === expected` over `!(value !== expected)`.

Negation buried in a chain reads as a riddle; positive forms read as a statement. Save negation for cases where the negative is genuinely the simpler concept being expressed.

## Test-assertion style

Prefer `expect(spy).toHaveBeenCalledWith(...)` / `.toHaveBeenNthCalledWith(n, ...)` / `.toHaveBeenLastCalledWith(...)` over reaching into `.mock.calls[i]?.[j]`. Use `expect.objectContaining({...})` / `expect.stringContaining(...)` / `expect.anything()` matchers when you only care about a partial shape. The `.mock.calls` accessor is the escape hatch — reserve it for cases where you need to extract a captured callback and invoke it.
