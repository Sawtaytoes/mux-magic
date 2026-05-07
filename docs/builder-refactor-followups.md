# Builder Refactor — Handoff Notes

## What's done

`public/api/builder/index.html` was a single 3300-line monolith holding markup, CSS, and ~2900 lines of inline JS. We're breaking it apart into ES module components under `public/api/builder/js/`. Two stages have shipped; ~10–13 more components remain.

**Current state:**

```
public/api/builder/
├── index.html                    3501 lines (still has the inline <script>)
└── js/
    ├── main.js                     58   (entrypoint + window.mediaTools bridge)
    ├── state.js                    17   (getPaths, getSteps — pass-through)
    ├── util/
    │   ├── esc.js                   9
    │   └── path-var-options.js     26   (pathVarOptionText, refreshPathVarOptions)
    └── components/
        ├── path-var-card.js       122   ← stage 1
        ├── path-var-card.test.ts  ~150  (12 cases, real Chromium)
        └── yaml-modal.js           80   ← stage 2
```

**Tests:** 41 files / 372 tests under vitest v4 with `@vitest/browser-playwright`. Two projects (`node` for `src/`, `browser` for `public/`) defined inline in `vitest.config.ts` under `test.projects`.

**Relevant recent commits to read for context** (`git log` to confirm hashes — they may shift if rebased):

- `b0d3db8` — refactor(builder): extract path-variable card into ES modules (stage 1)
- `439c8ac` — test(builder): vitest browser mode + first component test for path-var-card
- `ff94e86` — refactor(builder): extract yaml-modal into its own ES module (stage 2)
- `bcf5bba` — chore(deps): bump vitest 2.1 → 4.1; migrate workspace + browser provider

## Conventions (apply to every extraction)

1. **ES modules** via `<script type="module" src="/builder/js/main.js"></script>`. No globals from extracted code. The script tag URL has the `/builder/...` prefix because hono serves `public/api/` at root — see [src/api/hono-routes.ts:15](../src/api/hono-routes.ts#L15).

2. **Render functions return HTML strings.** No `<template>` element, no DOM-node return values. Matches the existing inline style and lets `renderAll` keep using `innerHTML` concatenation.

3. **Event delegation via `data-action="..."` attributes**, not inline `onclick`. One delegated listener attached once to a stable parent (e.g., `#steps-el`) survives every `renderAll`. Pattern:

   ```html
   <input data-action="set-path-label" data-pv-id="${pv.id}" type="text" value="${esc(pv.label)}" />
   ```
   ```js
   container.addEventListener('input', (e) => {
     const t = e.target
     if (!t?.dataset?.action) return
     if (t.dataset.action === 'set-path-label') {
       setPathLabel(t.dataset.pvId, t.value)
     }
     // ...
   })
   ```

4. **Shared state imports from `state.js`.** Right now `state.js` exports `getPaths()` / `getSteps()` that pass through `window.mediaTools.paths` / `.steps`. Inline still owns the actual arrays. Don't try to move ownership in a single big-bang — the right time is after most components have migrated, when there are few remaining inline references to `paths`/`steps`.

5. **Two-direction `window.mediaTools` bridge.** Already populated by both sides:
   - **Inline → modules** (set at the bottom of the inline `<script>`): `paths` & `steps` getters, plus `renderAll`, `refreshLinkedInputs`, `scheduleUpdateUrl`, `scrollPathVarIntoView`, `schedulePathLookup`, `pathPickerKeydown`, `randomHex`, `initPaths`, `restoreFromUrl`, `buildParams`. Add to this block when an extracted module calls back into something that's still inline.
   - **Modules → inline** (set in `main.js`): every export the inline script (or an HTML `onclick`) needs to call. Add the new module's exports to the `Object.assign(window.mediaTools, { ... })` block here.
   
   The bridge shrinks as more components migrate. Anything still inline at the end of the migration becomes the LAST module to extract.

6. **Thin forwarders preserve inline call sites.** Instead of hunting down every `updateYaml()` / `setParam()` reference in the inline script, replace the original inline function with a one-liner forwarder:

   ```js
   function updateYaml() { return window.mediaTools.updateYaml() }
   ```

   Function declarations hoist, so other inline functions still resolve `updateYaml` at call time and find the forwarder. The forwarder looks up `window.mediaTools.updateYaml` at call time too — by then `main.js` (deferred) has populated it. HTML `onclick="updateYaml()"` attributes also keep working unchanged.

   Forwarders go away as more components migrate and the inline script gets shorter.

7. **Module timing.** Inline `<script>` runs synchronously during HTML parse. `<script type="module">` runs deferred — *after* the inline script finishes. So:
   - Inline must finish setting up its outbound bridge entries (renderAll, etc.) before main.js executes. Function declarations are hoisted, so the bridge-population block at the end of the inline script can reference any inline `function`.
   - Initial bootstrap (`initPaths()` / `restoreFromUrl()` / `renderAll()`) lives in main.js, **not** at the bottom of the inline script — otherwise renderAll would fire before the extracted modules' renderers (`renderPathVarCard`, etc.) are wired into the bridge.

## Recipe for one extraction

Each commit follows the same four steps. Aim for ~one component per commit.

1. **Write the module** under `public/api/builder/js/components/<name>.js`. Imports `state.js` accessors and any util modules; reaches into still-inline helpers via `bridge()` (a `const bridge = () => window.mediaTools` shorthand).

2. **Add to main.js bridge.** Import the new module's exports, drop them into the `Object.assign(window.mediaTools, { ... })` block. If the module reaches into something still inline that the bridge doesn't already expose, add it to the inline script's outbound block too.

3. **Replace inline functions with forwarders.** Delete the original function bodies; leave a one-line `function X(...args) { return window.mediaTools.X(...args) }` so the inline call sites and any HTML `onclick`s keep working.

4. **Verify + commit.** Run `yarn test --run` (both projects), spot-check the page in a browser if running, then commit. One module = one commit.

### Adding a test

Optional per stage but cheap — costs ~15 min per component. Test file lives next to the module (e.g., `<name>.test.ts`). Pattern from `path-var-card.test.ts`:

```ts
import { describe, test, expect, beforeEach, vi } from "vitest"

let mediaTools

beforeEach(() => {
  mediaTools = {
    paths: [/* ... */],
    steps: [/* ... */],
    // mock anything the component reaches via bridge():
    renderAll: vi.fn(),
    updateYaml: vi.fn(),
    // ...
  }
  window.mediaTools = mediaTools
})

test("...", async () => {
  // Dynamic import — beforeEach has populated the bridge before
  // the component's first call. Vitest caches the module across
  // tests, but since the component reads window.mediaTools at
  // call time (not import time), the per-test bridge applies.
  const { someFn } = await import("./component-name.js")
  someFn()
  expect(mediaTools.someBridgedHelper).toHaveBeenCalled()
})
```

Use `@testing-library/dom` queries (`getByRole`, `getByText`, etc.) for DOM assertions. Tests run in real Chromium, so `document.body.appendChild(root)` works as expected — remember to `root.remove()` at the end so subsequent tests start clean.

## Suggested extraction order

Independently scoped — pick any. Order is by ascending entanglement so the gnarly stuff lands when surrounding context is clearer:

1. **`load-modal`** — `openLoadModal`, `closeLoadModal`, `loadYamlFromText`. Mirrors `yaml-modal`'s shape; the modal markup lives next to `yaml-modal` near the bottom of `<body>`.
2. **`page-header`** — `togglePageMenu`, click-outside listener, the Esc handler that currently lives in inline near line ~1850. The header markup itself stays in `index.html`. Some HTML `onclick`s currently call `window.mediaTools.X()` inline (see `Add Path` button) — those become delegated listeners after this stage.
3. **`api-run-modal`** — `runViaApi`, `cancelApiRun`, `closeApiRunModal`, `copyApiRunLogs`. SSE-driven (uses `createTolerantEventSource`); slightly more dependencies but well-bounded.
4. **`command-picker`** — `openCmdPicker`, `closeCmdPicker`, `cmdPickerKeydown` and the filtered list popover. Has its own state (`cmdPickerState`) so a small `command-picker-state.js` may help.
5. **`lookup-modal`** — series, movie, anime lookup modals (`openLookup`, `closeLookupModal`, `submitLookup`, etc.). Several `lookupModal*` helpers — could be one module or split per kind.
6. **`step-fields`** — `renderFields`, `renderPathField`, `renderStepOutputPicker`, `renderEnumField`, `renderNumericField`, plus `setParam`, `setParamJson`, `setLink`, `promotePathToPathVar`, `onPathFieldInput`. Heavy with cross-cutting concerns; migrate after most surrounding pieces are out.
7. **`step-card`** *(last)* — `renderStep`, `renderStatusBadge`, `makeStep`, `addPicked`, `insertAt`, `removeStep`, `moveStep`, the alias inline-edit handlers (`stepAliasFocus` / `Keydown` / `Blur`), `runStep`, `cancelStep`, plus `buildParams` and `getLinkedValue` (currently in the bridge as inline → modules). Extracting this collapses most of what's left in the inline script. Once it's out, `state.js` can take real ownership of `steps` / `paths` and the bridge largely disappears.

## Pending tech decisions

### TS for client modules — JSDoc, not compile

Current `.js` modules don't have type checking. Recommendation: add JSDoc annotations and have `tsc --noEmit` cover them. No build step, no compile.

Steps when someone gets to this:

1. Add to root `tsconfig.json` (or a separate `tsconfig.client.json` referenced from it):
   ```json
   {
     "compilerOptions": {
       "allowJs": true,
       "checkJs": true,
       "noEmit": true
     },
     "include": ["public/api/builder/js/**/*.js"]
   }
   ```
2. Annotate the modules' exports with JSDoc:
   ```js
   /**
    * @typedef {{ id: string, label: string, value: string }} PathVar
    */
   /**
    * @param {PathVar} pv
    * @param {boolean} isFirst
    * @returns {string}
    */
   export function renderPathVarCard(pv, isFirst) { ... }
   ```
3. `yarn typecheck` already runs `tsc --noEmit` — same command will start checking the JS too.

The `.test.ts` files don't need changes; vitest's transformer already handles them.

### Vitest v4 — DONE

Already landed in `bcf5bba`. Three breaking changes navigated:

- `defineWorkspace` removed → projects defined inline under `test.projects` in `vitest.config.ts`.
- `browser.provider` is a factory now → `@vitest/browser-playwright` package added; `provider: playwright()`.
- `browser.name: 'chromium'` → `browser.instances: [{ browser: 'chromium' }]`.

Plus `publicDir: false` on the browser project to silence vite's "files in public/ served at root" warning.

## Gotchas to watch for

### Tailwind `.flex` overrides custom `display: none`

Bit me twice during stage 1 (page-actions and step-actions). If a container has `class="page-actions flex items-center"`, your custom `.page-actions { display: none }` rule **does not win** — both selectors have equal specificity, and Tailwind's stylesheet is injected after the inline `<style>` block, so `.flex { display: flex }` wins.

Fix: don't put Tailwind's `flex` utility on the custom-class container. Define `display: flex` (and align/gap) in your own CSS instead. Then the container's display is *yours* and the responsive `display: none` overrides cleanly.

### `display: contents` drops `margin-left: auto`

Used `display: contents` on group/row wrappers to dissolve them into the inline header at wide widths. But `display: contents` removes the element from layout, so any `ml-auto` / `margin-left: auto` on a child of the dissolved wrapper has no effect — there's no flex container child to push.

Workaround: put `ml-auto` on the wrapper that *isn't* dissolved (e.g., `.page-menu-controls.ml-auto`), or move the auto-margin to a leaf element that survives.

### a11y for testing-library queries

Icon-only buttons (`<button>✕</button>`) have no accessible name, so `getByRole('button', { name: /remove/i })` fails. Add `aria-label="Remove path variable"` next to the existing `title="..."` and queries find them. Cheap a11y win and keeps tests legible.

### Failure screenshots are gitignored

Vitest browser mode writes `__screenshots__/<test>/<case>.png` next to the test file when an assertion fails. Already in `.gitignore` (`**/__screenshots__/`). Don't accidentally commit them.

## What `state.js` looks like after the migration

Today `state.js` is a thin pass-through. End state:

```js
let _paths = [/* base path */]
let _steps = []
let _stepCounter = 0

export function getPaths() { return _paths }
export function getSteps() { return _steps }
export function setPaths(arr) { _paths = arr }
export function setSteps(arr) { _steps = arr }
export const generateStepId = () => `step${++_stepCounter}`

// undo/redo, COMMANDS, anything else inline owns today
```

The transition: each component extraction removes inline references to the bridged getters; once nothing inline references `paths` / `steps` directly, replace `let paths = []` in the inline script with `const { getPaths, setPaths } = window.mediaTools.state` (or extract that last bit to a module too). Don't try to do this until step-card is out — too many call sites.

## What good looks like at the end

A `public/api/builder/index.html` that's just markup + `<style>` block + a tiny inline `<script>` doing nothing but the bridge (and ideally not even that). Every interactive piece lives in a small, named, testable module under `js/`.

The inline `<script>` is currently 3500 lines. Each successful component extraction trims 100–500 lines. We've removed ~170 so far across stages 1–2. Step-card alone will probably take out 800+. Estimate: 6–8 more focused commits to get under 200 lines, then the inline script is just bridge plumbing that can be deleted in a final pass.
