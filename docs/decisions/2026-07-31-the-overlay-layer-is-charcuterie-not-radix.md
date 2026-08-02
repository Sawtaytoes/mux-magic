# 2026-07-31 — The overlay layer is `@charcuterie/ui`, not Radix

- **Status:** Accepted
- **Date decided:** 2026-07-31
- **Area:** web
- **Source:** charcuterie M6b (`feat/m6b-charcuterie-ui`); charcuterie's plan names deleting this re-export as M6b's defining act

## Decision

`packages/web/src/primitives/Popover/Popover.tsx` — a six-line re-export of
`@radix-ui/react-popover` — is **deleted**, and `@radix-ui/react-popover` is
removed from `packages/web/package.json`. Overlays in this app come from
`@charcuterie/ui`: `Popover`, `Modal`, `Menu`, `Tooltip`.

## What we rejected — DO NOT revert to this

Adding a Radix package. The re-export's own comment said it was for "Wave D+
components (StepCard, GroupCard) where the trigger IS a React element", and
[docs/workers/zindex-radix-consolidation.md](../workers/zindex-radix-consolidation.md)
planned to move the Wave C pickers onto it and to add `@radix-ui/react-dialog`
beside it. None of that happened: at deletion the module had **zero importers**
— `StepCard` and `GroupCard` never adopted it — so the dependency was a 40 KB
tree of code the bundle carried for a file nothing imported.

The specific drift to avoid is "we need a popover, install Radix." The reason
is not preference:

- **A component that owns the state you also own is two owners for one fact.**
  Radix's `open`/`onOpenChange` is the same shape as the `<details open>`
  problem `JobStepsDisclosure` needed a ref, an effect and an echo-guard to
  work around. `@charcuterie/ui` overlays are told what is true and never
  decide it.
- **`@charcuterie/ui`'s `Modal` is a real `<dialog>` with `showModal()`**, so
  the focus trap, Escape, scroll lock and the top layer come from the platform.
  That is what retires `zIndex.ts`'s modal keys; a portal-based dialog cannot,
  because it is still ordering itself against everything else by hand.

## Why it must not be re-litigated

The point of a shared component layer is that there is one answer to "where do
overlays come from". Keeping a second, unused one alive is how a codebase ends
up with two focus traps that disagree — which is exactly the bug this repo
already hit once, when `PathPicker` rendered behind `EditVariablesModal`.

The seven comboboxes (`PortalDropdown`, `CommandPicker`, `LinkPicker`,
`EnumPicker`, `PathPicker`, `AssFieldPicker`, `RenameTargetPicker`) are **not**
covered by this and were deliberately left on their hand-rolled positioning:
they are a text input filtering a listbox, which is charcuterie's P2. They
migrate when `Combobox` exists, not to Radix in the meantime.
