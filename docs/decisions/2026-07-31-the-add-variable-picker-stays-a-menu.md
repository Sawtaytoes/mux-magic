# 2026-07-31 — The Add Variable picker stays a `menu`, not a `listbox`

- **Status:** Accepted
- **Date decided:** 2026-07-31
- **Area:** web
- **Source:** charcuterie M6b (`feat/m6b-charcuterie-ui`); reverses the claim in `@charcuterie/ui`'s `Menu` docstring

## Decision

`VariablesPanel`'s "Add Variable" picker is a `role="menu"` over `menuitem`s
and stays one. It is built on `@charcuterie/ui`'s `Menu`. Its items are
**not** `option`s and the container is **not** a `listbox`.

## What we rejected — DO NOT revert to this

Changing it to a listbox. `@charcuterie/ui`'s `Menu` docstring names this
component by name as the counter-example it was written against:

> mux-magic's `TypePicker` is the fleet's one attempt at telling them
> apart — it renders `role="menu"` over items that set a value, which is a
> listbox wearing the wrong role.

Measured against the distinction that docstring itself draws — a `menuitem`
**does** something, an `option` **is** something you are choosing — the old
markup had the role right and the library note is wrong about this call site:

- Choosing "Path" **adds a path variable**. A card appears at the bottom of
  the panel and the picker closes. Nothing is "set".
- **Nothing is selected afterwards.** There is no `aria-selected` state to
  report, no value the control holds, and no way to reopen it and see what
  was picked last time — reopening offers the same list minus whatever now
  exists.
- Its items are **not alternatives**. Adding a Path variable and a TMDB ID
  variable are both possible, and adding one does not un-add the other. A
  listbox has to answer "which one is selected?"; here there is no answer.

The seven controls that *are* a listbox wearing the wrong clothes —
`PortalDropdown`, `CommandPicker`, `LinkPicker`, `EnumPicker`, `PathPicker`,
`AssFieldPicker`, `RenameTargetPicker` — are comboboxes, are charcuterie's
P2, and were deliberately left alone.

## Why it must not be re-litigated

A screen reader announces "menu, 4 items" for one and "listbox, selected, 2
of 4" for the other. Announcing a *selection* for a control that holds none
is worse than the original defect, and an agent driving the app would be told
about state that does not exist.

What *was* wrong with the old picker is everything except the role: an inline
panel with no relationship to its trigger, no roving focus, no Escape, no
outside-press, and a hand-rolled **Cancel** button standing in for all three.
`Menu` supplies them, and the tests in `VariablesPanel.test.tsx` pin the role,
the trigger-derived name, Escape, and focus-on-open.
