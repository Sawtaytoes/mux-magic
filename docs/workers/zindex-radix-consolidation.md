# Follow-up: Z-Index Consolidation

> **Superseded 2026-07-31 (charcuterie M6b).** The Radix half of this plan is
> dead: `packages/web/src/primitives/Popover/Popover.tsx` — the thin
> `@radix-ui/react-popover` re-export both items below were written around —
> has been **deleted**, and `@radix-ui/react-popover` is no longer a
> dependency. The overlay layer this app consolidates onto is
> `@charcuterie/ui`'s `Popover` and `Modal`. See
> [decisions/2026-07-31-the-overlay-layer-is-charcuterie-not-radix.md](../decisions/2026-07-31-the-overlay-layer-is-charcuterie-not-radix.md).
>
> The z-index observation itself still stands and is restated below.

The centralized z-index scale at `packages/web/src/constants/zIndex.ts` exists
because Wave C pickers and the custom `Modal` primitive both portal to
`document.body` and need explicit layering (a popover invoked from inside a
modal must sit *above* that modal, or it is unreachable — this caused a real
bug where `PathPicker` rendered behind `EditVariablesModal`).

Two follow-up migrations would obsolete most of those constants:

1. **Migrate the Wave C pickers off their custom fixed-positioning portals.**
   `PathPicker`, `CommandPicker`, `EnumPicker`, and `LinkPicker` position by
   hand because their trigger sites were legacy DOM elements during the wave
   transition. They are all **comboboxes** — a text input filtering a listbox —
   which is charcuterie's P2, not P1, so they were left alone by M6b on
   purpose. When P2 lands they take `Combobox` and the positioning goes with
   it.
2. **Replace the custom `Modal` primitive with `@charcuterie/ui`'s `Modal`.**
   It is a real `<dialog>` with `showModal()`, so focus trap, Escape, scroll
   lock and the top layer come from the platform rather than from a portal —
   which is what lets `Z_INDEX.modalBackdrop` / `Z_INDEX.modal` be dropped
   entirely. The top layer is above every `z-index`, so there is nothing left
   to order.

After both, retire whichever keys in `zIndex.ts` are no longer referenced.
`drawer` / `drawerBackdrop` / `sticky` / `dropdown` will likely stay because
they describe non-portaled layers nothing else manages.

This is **not** part of the existing React-migration wave taxonomy; the
original Wave E (PageHeader, LookupModal, RunSequence) is unrelated. Treat it
as its own mini-wave once charcuterie's P2 lands.
