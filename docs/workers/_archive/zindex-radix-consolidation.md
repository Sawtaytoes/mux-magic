# Follow-up: Z-Index Consolidation via Radix Primitives

The centralized z-index scale at `packages/web/src/constants/zIndex.ts` exists because Wave C pickers and the custom `Modal` primitive both portal to `document.body` and need explicit layering (a popover invoked from inside a modal must sit *above* that modal, or it is unreachable — this caused a real bug where `PathPicker` rendered behind `EditVariablesModal`). Two follow-up migrations would obsolete most of those constants:

1. **Migrate Wave C pickers to `@radix-ui/react-popover`.** `PathPicker`, `CommandPicker`, `EnumPicker`, and `LinkPicker` use custom fixed-positioning portals because their trigger sites were legacy DOM elements during the wave transition. Once trigger sites are React-element-based, the existing `Popover` primitive (`packages/web/src/primitives/Popover/Popover.tsx`, already a Radix re-export and used by Wave D `StepCard` / `GroupCard`) replaces the custom positioning. Radix manages z-index itself.
2. **Replace the custom `Modal` primitive with `@radix-ui/react-dialog`.** Install the package, then swap call sites of `packages/web/src/primitives/Modal/Modal.tsx`. Radix Dialog provides focus trap, escape handling, scroll lock, and layering — so `Z_INDEX.modalBackdrop` / `Z_INDEX.modal` can be dropped.

After both, retire whichever keys in `zIndex.ts` are no longer referenced. `drawer` / `drawerBackdrop` / `sticky` / `dropdown` will likely stay because they describe non-portaled layers Radix doesn't manage.

This is **not** part of the existing React-migration wave taxonomy; the original Wave E (PageHeader, LookupModal, RunSequence) is unrelated. Treat it as a post-Final cleanup PR or its own mini-wave once the rest of the migration is stable.
