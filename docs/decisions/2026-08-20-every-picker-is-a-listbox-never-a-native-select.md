# 2026-08-20 — Every picker is a `Listbox`; the native `Select` is a hatch we have never needed

- **Status:** Accepted
- **Date decided:** 2026-08-20
- **Area:** web
- **Source:** fleet standard —
  [`Listbox` is the picker in every owned app](https://github.com/Sawtaytoes/charcuterie/blob/master/docs/decisions/2026-08-10-listbox-and-combobox-are-the-default-and-select-is-demoted.md)
  (charcuterie, 2026-08-10) and the owner's restatement of it on 2026-08-20

## Decision

Every one-of-several picker in `packages/web` is a Charcuterie **`Listbox`** —
in practice `Picker`, which is a `Listbox` with its trigger and open state
already attached — or a **`Combobox`** when the list is long enough to want
typing. `@charcuterie/ui`'s native **`Select` is a compatibility hatch and this
app does not use it.** Neither is a raw `<select>`.

The owner, 2026-08-20:

> "I've told you over and over again to use Listbox over Select. I absolutely
> HATE the native select. It looks awful in Windows and other OSes. I want my
> fancy one that we built together Charcuterie-first. […] Listbox is for any
> Select. The native was left there as a compatibility thing and *only* if we
> for some reason need it. We never have."

## What we rejected — DO NOT revert to this

Reaching for `Select` (or a raw `<select>`) because the options are plain
strings. "Rich options" was never the dividing line — rich content is what
`<option>` *cannot* do, not the only reason to prefer a `Listbox`. A plain list
of strings in a `Listbox` is still ours, still identical on every machine in the
house, and still keyboard-accessible.

The four platform arguments for the native control — the mobile OS wheel picker,
autofill, `:invalid`, and submitting a form with no JS on the page — are all
true and none of them has ever applied to this app. If one genuinely does one
day, that is a **new decision with the reason written down**, not a silent call
site choice.

## Notes for the next reader

- `Listbox`'s `selectedValue` is a **seed**, exactly like `Select`'s `value`
  was: the listbox owns the selection after mount. Every call site with a second
  writer therefore keeps its `key` — `RuleCard` (loaded template / undo),
  `ComputeFromOpRow` (index-keyed rows), `ComputeFromEditor`, `RegionVariantField`
  (base code changes) and `SmartMatchModal` (a new candidate re-derives the Plex
  type). Removing one of those keys reintroduces the bug the key was added for.
- A `Picker` is found by its trigger's accessible name, which carries the
  current value: `getByRole("button", { name: /^Rule 1 type: / })`. There is no
  DOM `value` to read; assert `toHaveAccessibleName` instead of `.value`, and
  drive it with a click on the trigger then a click on the `option`.
- **A `Menu` is not a picker.** The Add Variable control stays a `menu`
  ([2026-07-31](2026-07-31-the-add-variable-picker-stays-a-menu.md)) — its items
  *do* something rather than *being* a value.
