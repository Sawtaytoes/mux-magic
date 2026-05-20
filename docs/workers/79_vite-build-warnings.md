# Worker 79 — Vite build warnings: ineffective dynamic import + main-chunk shrink

**Status:** ready
**Track:** web
**Model:** Sonnet
**Effort:** Low-Medium
**Thinking:** ON
**Phase:** 5
**Depends:** —
**Branch:** `worker-79-vite-build-warnings`
**Worktree:** `.claude/worktrees/79_vite-build-warnings/`
**Parallel with:** any worker not touching [packages/web/src/pages/BuilderPage/BuilderPage.tsx](../../packages/web/src/pages/BuilderPage/BuilderPage.tsx) or [packages/web/src/hooks/useBuilderActions.ts](../../packages/web/src/hooks/useBuilderActions.ts).

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first where it's testable; the rest is verified via the production build output. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Why

`yarn build` (Vite 8 / rolldown) currently emits two real warnings and one cosmetic one:

```
(!) Some chunks are larger than 500 kB after minification.
[INEFFECTIVE_DYNAMIC_IMPORT] Warning: src/jobs/yamlCodec.ts is dynamically imported by
src/hooks/useBuilderActions.ts but also statically imported by
src/components/LoadModal/LoadModal.tsx, src/components/SavedTemplates/SavedTemplatesPanel.tsx,
src/components/YamlModal/YamlModal.tsx, src/hooks/useAutoClipboardLoad.ts,
src/hooks/useBuilderActions.ts, ..., dynamic import will not move module into another chunk.
[PLUGIN_TIMINGS] Warning: Your build spent significant time in plugins.
  - @rolldown/plugin-babel (93%)
  - @tailwindcss/vite:generate:build (7%)
```

The Babel-timing warning is **out of scope** — 93% comes from `@vitejs/plugin-react`'s React Compiler preset wired in [vite.config.ts:9-15](../../packages/web/vite.config.ts#L9-L15); no native rolldown/swc port of `babel-plugin-react-compiler` exists yet. Don't touch the compiler config.

The other two are real:

### 1. `INEFFECTIVE_DYNAMIC_IMPORT` is a dead async round-trip

[useBuilderActions.ts:9](../../packages/web/src/hooks/useBuilderActions.ts#L9) does a static import:

```ts
import { toYamlStr } from "../jobs/yamlCodec"
```

…and then [useBuilderActions.ts:453-455](../../packages/web/src/hooks/useBuilderActions.ts#L453-L455) does:

```ts
const { loadYamlFromText } = await import("../jobs/yamlCodec")
```

Because the same file (and four siblings: `LoadModal.tsx`, `SavedTemplatesPanel.tsx`, `YamlModal.tsx`, `useAutoClipboardLoad.ts`) already pull `yamlCodec` into the static graph, the dynamic `import()` resolves to the already-loaded module record — no chunk split, just an unnecessary microtask round-trip inside `pasteCardAt`.

### 2. Main chunk is 1.03 MB raw / 287 kB gzip

Every top-level modal is statically imported by [BuilderPage.tsx:6-23](../../packages/web/src/pages/BuilderPage/BuilderPage.tsx#L6-L23) — `LoadModal`, `YamlModal`, `SequenceRunModal`, `SmartMatchModal`, `FileExplorerModal`, `EditVariablesModal`, `CommandHelpModal`, `LookupModal`, `PromptModal`, `AudioPreviewModal`, `ImagePreviewModal`, `VideoPreviewModal`. None of them render on first paint — they're all gated by jotai atoms that start closed. Hoisting them behind `React.lazy(...)` + a `<Suspense fallback={null}>` boundary keeps the initial chunk lean without changing UX (a modal opens within microseconds of the user clicking, and the prefetch headers Vite emits on `<link rel="modulepreload">` keep the cost invisible on hot networks).

`yamlCodec` (which transitively pulls `js-yaml` and the schema) is itself a strong candidate to split off — it's used only by `LoadModal`, `YamlModal`, `SavedTemplatesPanel`, `useAutoClipboardLoad`, and the BuilderPage URL-hydration effect. Once the modals lazy-load, the codec naturally moves with them; only `BuilderPage.tsx`'s `loadYamlFromText` URL-hydration import remains in the main graph (and that's a one-time effect — also lazy-import it locally inside the `useEffect`).

## What

Two coordinated edits, each independently shippable but bundled here because both serve the same warning. TDD: vitest assertions on chunk split aren't easy, so this worker leans on a **production build artifact assertion** instead — a new `packages/web/src/__build-budget__/build-budget.test.ts` that runs `vite build` (or reads from an already-built `dist/`) and asserts:

1. The main `index-*.js` chunk is < **220 kB gzip** (drop from 287 kB; gives headroom but proves the split happened).
2. At least one `LoadModal-*.js` / `YamlModal-*.js` / `SequenceRunModal-*.js` async chunk exists.
3. `dist/` build has zero `INEFFECTIVE_DYNAMIC_IMPORT` warnings (parse stderr/stdout).

Use `node:child_process` `spawnSync("yarn", ["build"], …)` from inside the test; cache by build hash if it slows the suite. Skip when `process.env.SKIP_BUILD_BUDGET === "1"` so local watch-mode `vitest` runs aren't blocked. **Wire the test into CI explicitly** (it can be expensive locally).

### Edit 1 — fix the ineffective dynamic import

[useBuilderActions.ts:9](../../packages/web/src/hooks/useBuilderActions.ts#L9) — add `loadYamlFromText` to the static import:

```ts
import { loadYamlFromText, toYamlStr } from "../jobs/yamlCodec"
```

[useBuilderActions.ts:453-455](../../packages/web/src/hooks/useBuilderActions.ts#L453-L455) — drop the `await import(...)`:

```ts
// before
const { loadYamlFromText } = await import("../jobs/yamlCodec")
// after — just call loadYamlFromText directly; it's already in scope
```

The whole `pasteCardAt` callback stops needing the inner `await` for the codec — keep the function `async` because `navigator.clipboard.readText()` is still async.

### Edit 2 — lazy-load BuilderPage's modal subtree

In [BuilderPage.tsx](../../packages/web/src/pages/BuilderPage/BuilderPage.tsx) replace the static modal imports with `React.lazy`:

```ts
import { lazy, Suspense, useEffect } from "react"

const LoadModal           = lazy(() => import("../../components/LoadModal/LoadModal").then(m => ({ default: m.LoadModal })))
const YamlModal           = lazy(() => import("../../components/YamlModal/YamlModal").then(m => ({ default: m.YamlModal })))
const SequenceRunModal    = lazy(() => import("../../components/SequenceRunModal/SequenceRunModal").then(m => ({ default: m.SequenceRunModal })))
const SmartMatchModal     = lazy(() => import("../../components/SmartMatchModal/SmartMatchModal").then(m => ({ default: m.SmartMatchModal })))
const FileExplorerModal   = lazy(() => import("../../components/FileExplorerModal/FileExplorerModal").then(m => ({ default: m.FileExplorerModal })))
const EditVariablesModal  = lazy(() => import("../../components/EditVariablesModal/EditVariablesModal").then(m => ({ default: m.EditVariablesModal })))
const CommandHelpModal    = lazy(() => import("../../components/CommandHelpModal/CommandHelpModal").then(m => ({ default: m.CommandHelpModal })))
const LookupModal         = lazy(() => import("../../components/LookupModal/LookupModal").then(m => ({ default: m.LookupModal })))
const PromptModal         = lazy(() => import("../../components/PromptModal/PromptModal").then(m => ({ default: m.PromptModal })))
const AudioPreviewModal   = lazy(() => import("../../components/AudioPreviewModal/AudioPreviewModal").then(m => ({ default: m.AudioPreviewModal })))
const ImagePreviewModal   = lazy(() => import("../../components/ImagePreviewModal/ImagePreviewModal").then(m => ({ default: m.ImagePreviewModal })))
const VideoPreviewModal   = lazy(() => import("../../components/VideoPreviewModal/VideoPreviewModal").then(m => ({ default: m.VideoPreviewModal })))
```

Wrap the modal JSX block in a single `<Suspense fallback={null}>` — each modal is internally gated by an atom, so `null` is the correct placeholder (nothing renders until the user actually opens one).

The `loadYamlFromText` + `buildSequenceObject` import at [BuilderPage.tsx:29-32](../../packages/web/src/pages/BuilderPage/BuilderPage.tsx#L29-L32) is the *only* remaining static path that pulls `yamlCodec` into the main chunk from the page level. Move it inside the URL-hydration `useEffect`:

```ts
useEffect(() => {
  void (async () => {
    const { buildSequenceObject, loadYamlFromText } = await import("../../jobs/yamlCodec")
    // …existing decode + hydration logic…
  })()
}, [store])
```

The other static `yamlCodec` consumers (`LoadModal`, `YamlModal`, `SavedTemplatesPanel`, `useAutoClipboardLoad`) become part of the lazy-modal subtree once `BuilderPage` stops importing them eagerly, so `yamlCodec` itself naturally lands in an async chunk — no separate dynamic-import wrapper needed there.

### Out of scope

- `@rolldown/plugin-babel` timing (97% is React Compiler — keep the compiler).
- `chunkSizeWarningLimit` raise — fix the underlying chunk instead.
- Route-based code splitting beyond modals (single-page app today; the BuilderPage *is* the route).
- Splitting non-modal components (`CommandPicker`, `LinkPicker`, `BuilderSequenceList`, `PageHeader`) — they render on first paint, must stay eager.
- Renaming/refactoring the modal atoms.

## Files

- [packages/web/src/hooks/useBuilderActions.ts](../../packages/web/src/hooks/useBuilderActions.ts) — Edit 1.
- [packages/web/src/pages/BuilderPage/BuilderPage.tsx](../../packages/web/src/pages/BuilderPage/BuilderPage.tsx) — Edit 2 (lazy modals + Suspense + URL-effect dynamic codec import).
- `packages/web/src/__build-budget__/build-budget.test.ts` — new test asserting chunk budget + warning-free build (skip-able via `SKIP_BUILD_BUDGET=1`).
- [packages/web/vite.config.ts](../../packages/web/vite.config.ts) — **no changes expected**; leave the React Compiler preset alone.

## Acceptance

- `yarn workspace @mux-magic/web build` runs with **zero** `INEFFECTIVE_DYNAMIC_IMPORT` warnings.
- Main `index-*.js` gzip size drops below ~220 kB (was 287 kB).
- At least 6 of the 12 listed modals each have their own emitted async chunk (visible in `dist/assets/`).
- `yarn dev` still renders the BuilderPage; opening each modal works with no console error (`<Suspense fallback={null}>` covers the load-in).
- The chunk-size warning either disappears, or `chunkSizeWarningLimit` is **not** raised as a workaround.
- All existing e2e (`yarn e2e`) pass — including the YAML paste-card flow that depends on `pasteCardAt`.
- `yarn lint` and `yarn typecheck` clean.

## Plain-English what-now-happens

Once this lands:

1. User loads the BuilderPage. The browser fetches `index-*.js` (~200 kB gzip, down from 287) plus a couple of inlined small chunks. No modal code is in there.
2. Vite emits `<link rel="modulepreload">` for the modal chunks so they hop into the HTTP cache while the page hydrates.
3. User clicks "Load…". `LoadModal-*.js` (already preloaded) resolves instantly, `<Suspense>` swaps from `null` to the modal, and `yamlCodec-*.js` (now an async chunk shared by Load/Yaml/SavedTemplates/useAutoClipboardLoad) loads alongside.
4. User pastes a card. `pasteCardAt` calls `loadYamlFromText` directly — no `await import()`, no microtask. The codec is already in the lazy-modal chunk that loaded with whichever modal triggered the action.
5. `yarn build` reports clean output: no `INEFFECTIVE_DYNAMIC_IMPORT`, no chunk > 500 kB. The Babel-timing line remains (compiler stays; that's a future workstream).

## Notes

- The `.then(m => ({ default: m.X }))` shape is needed because every modal is a **named** export, not default. Don't switch the components to default exports — the project has a one-component-per-file convention with named exports (see worker 07).
- `React.lazy` requires the imported module's `default` field to be a component. The `.then` adapter is the lightest cost; alternatives (separate index re-export files, default-exporting the modals) cost more code than they save.
- If the build-budget test ends up flaky on CI (Vite cache variance), gate it behind `RUN_BUILD_BUDGET=1` and run it only on `feat/mux-magic-revamp` → master PRs, not every push.
- Memory says workers flip their own MANIFEST row to `done` after merge — do that as the final step.
