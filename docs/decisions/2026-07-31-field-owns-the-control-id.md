# 2026-07-31 — `Field` owns the control id; `${step.id}-${field.name}` is not a contract

- **Status:** Accepted
- **Date decided:** 2026-07-31
- **Area:** web
- **Source:** charcuterie M6b (`feat/m6b-charcuterie-ui`); relates to `212661fe`

## Decision

A command field's control gets its `id` from `@charcuterie/ui`'s `Field`,
which generates one with `useUniqueId` and clones it onto the control. The
`${step.id}-${field.name}` scheme is no longer how a label finds its control.

Where a deterministic id is still rendered (`PathField`, `StringArrayField`,
`NumberWithLookupField`), it is there for the app's own DOM lookups — the
path picker anchors to `#${step.id}-${field.name}` — and **not** for label
association.

## What we rejected — DO NOT revert to this

Restoring `FieldLabel`'s `htmlFor={`${stepId}-${field.name}`}`, or adding an
`id` prop to `CommandFieldControl` so the old string comes back.

Commit `212661fe` moved this scheme from `${step.command}-${field.name}` to
`${step.id}-${field.name}` because two cards of the same command shared HTML
ids and a label click toggled the wrong card's checkbox. That fix was right
about the **problem** — ids must be unique per rendered control — and it
solved it by making the string more unique, which left the string as a
contract sixteen call sites had to honour independently. **Eight of them did
not**, and rendered a `<label for>` pointing at an id nothing in the document
had.

`useUniqueId` is per instance, so it cannot collide at all — which is the
same guarantee `212661fe` wanted, obtained by construction rather than by
convention. `JsonField.test.tsx`'s assertion that the id is literally
`"step-1-testJson"` was pinning the proxy, not the property; `JsonField` is
not a `Field` caller and keeps its id, but the general rule is above.

## Why it must not be re-litigated

A dangling `for` is not a degraded label, it is **no** label: the control is
announced as an unnamed textbox and the label text as loose prose. There is
no gate that can see it — the attribute is present and correctly spelled, and
axe has no rule for a `for` that resolves to nothing on a control with no
other name. Handing id generation to the component that renders both ends is
the only version where the two cannot disagree.
