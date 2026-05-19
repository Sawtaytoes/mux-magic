# Worker 71 — PortalDropdown max-height: surface more options at once

**Status:** ready
**Track:** web
**Model:** Haiku
**Effort:** Low
**Thinking:** OFF
**Depends:** — (touches the shared `PortalDropdown` primitive)

## Why

The SmartMatch "Rename to" picker can only show ~4 options at a time before scrolling. The cap lives in [PortalDropdown.tsx:4](../../packages/web/src/components/PortalDropdown/PortalDropdown.tsx#L4):

```ts
const MAX_HEIGHT_PX = 192
```

Each option in the new RenameTargetPicker is two stacked rows (name + meta) plus padding, around ~48px tall. At a 192px cap that's barely 4 entries visible before the rest are hidden behind a scrollbar. On a typical Shrek 2 Blu-ray run there are 11+ candidates per row — the user has to scroll past most of them every time they want to compare.

The 192px constant was sized for the original PortalDropdown consumers (LanguageCodeField, SubtitleTypesField) where each option is a single one-line label. Now that RenameTargetPicker renders two-row options, the constant no longer matches the actual content density.

## What

Three coordinated changes, all minimal:

1. **Bump `MAX_HEIGHT_PX`** from `192` to something like `400` so the dropdown can grow up to roughly 8–10 of the taller RenameTargetPicker options before the user has to scroll. The viewport-aware clamp in the existing layout calculation will still cap it to the available space above/below the anchor, so it won't bleed off-screen on small windows.

2. **Make it overridable per consumer.** Some pickers (LanguageCodeField's two-line option, e.g.) might want a different cap than the SmartMatch picker. Add an optional `maxHeightPx?: number` prop on `PortalDropdown` that defaults to the new module-level constant. Consumers that want a different cap pass it in. Easier than coordinating one global value across consumers with different option densities.

3. **Confirm the viewport-aware fallback still works** when the cap is large but the viewport is small. The existing `MIN_HEIGHT_PX = 64` floor stays. The `useLayoutEffect` already caps `maxHeight` to `available` space above/below the anchor — so bumping the constant doesn't break narrow-viewport behavior. Add a story showing a tall dropdown clamped by a narrow viewport so the behavior is reviewable.

## Out of scope

- Variable-height items (each option auto-sizing). The current PortalDropdown assumes uniform item height — fine for now.
- A "show all" expand affordance. If the user truly needs to see 30+ candidates without scrolling that's a different UX problem and likely an inline list, not a dropdown.

## Files

- [packages/web/src/components/PortalDropdown/PortalDropdown.tsx](../../packages/web/src/components/PortalDropdown/PortalDropdown.tsx) — bump the constant, accept optional `maxHeightPx` prop, thread it through the layout calc.
- [packages/web/src/components/SmartMatchModal/RenameTargetPicker.tsx](../../packages/web/src/components/SmartMatchModal/RenameTargetPicker.tsx) — optionally pass a higher `maxHeightPx` (e.g. `480` for the densest case).
- A new Storybook story under `PortalDropdown.stories.tsx` (or extend the existing `RenameTargetPicker.stories.tsx`) with 12+ candidates so the new height is reviewable.

## Acceptance

- The SmartMatch picker shows 8+ options without scrolling on a normal viewport.
- The dropdown still flips up / down based on available space (no regression on existing PortalDropdown behavior).
- Per-consumer override prop works — passing `maxHeightPx={300}` clamps to 300, regardless of the global default.
- Storybook story for the dense case exists.

## Notes

The dropdown screenshot in the conversation (Image 2 on the rename-modal turn) shows the issue: 11 candidates total, only ~4 visible.
