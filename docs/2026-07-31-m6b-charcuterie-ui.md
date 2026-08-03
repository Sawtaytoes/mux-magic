# M6b — mux-magic consumes `@charcuterie/ui`

**Date:** 2026-07-31
**Branch:** `feat/m6b-charcuterie-ui`, pushed, **not merged** — PRs base on
`feat/mux-magic-revamp`
([locked decision](decisions/2026-05-13-pr-base-branch-is-feat-branch.md)).
**Milestone:** charcuterie M6b, the consumer half of
[M6a](../../charcuterie/docs/2026-07-31-m6a-the-p1-components.md).

`@charcuterie/ui@0.2.0` from the registry, **seven of its nine P1 components**
at **57 render sites**, plus `@charcuterie/tokens` on `<html>`. 26 files
import the package directly. The Radix Popover re-export is deleted.

---

## Gates

| Gate | Result |
| --- | --- |
| `yarn lint:biome` / `yarn lint:eslint` | clean, **988 files** checked |
| `yarn typecheck` | clean |
| `yarn vitest run` | **2794 tests over 363 files** (43 skipped) |
| `yarn e2e` | **62 passed**, 5 skipped (the pre-existing MSE video-seek group) |
| `yarn workspace @mux-magic/web build:storybook` | **exit 0**, **457 entries** across 157 story/docs files |
| `yarn workspace @mux-magic/web test:build-budget` | pass, at a **raised** budget — see below |

The Storybook row is the one to read carefully. `storybook build` writes
`index.json` and `iframe.html` **even when it fails**, so the output directory
cannot tell a working build from a broken one; the exit code is the only
signal. This repo's own entry count had already been reported as fact out of a
build that exited 1. The CI job added here exists for that exit code, plus a
non-empty-index assert for the sibling false-green — a build that *succeeds*
with an empty index because a `stories:` glob stopped matching, which a smoke
run over zero entries reports as "0 entries rendered clean".

---

## The Storybook fix went out on its own PR

[#167](https://github.com/Sawtaytoes/mux-magic/pull/167), against
`feat/mux-magic-revamp`, so it is not trapped behind this migration.

The brief said `master` was clean and the revamp branch had introduced the
breakage. **It had not.** `origin/master` carries all nine
`@storybook/blocks` imports on the same Storybook 10 — every branch of this
repo has had a broken Storybook build for as long as the imports have
existed. Basing the fix on `master` would have contradicted a locked
decision, so it rides the integration branch and reaches `master` at the next
phase boundary like everything else.

---

## What migrated

| Component | Sites | Where |
| --- | --- | --- |
| `Select` | **11** | `RegionVariantField`, `ErrorsPanel`, `VariableCard`, `SmartMatchModal`, and six in `DslRulesBuilder` |
| `Accordion` | **11** | `JobCard` ×2, `JobStepsDisclosure`, `JobLogsDisclosure`, `StepLogs`, `GenericRunResults`, `ConvertLosslessRunResults`, `WhenBuilder`, `ApplyIfBuilder`, `ErrorRow`, `PredicatesManager` |
| `Field` | **11** | via `CommandFieldControl` |
| `Tooltip` | **20** | every command field, via `CommandFieldControl` (11), `CommandFieldGroup` (8) and `BooleanField` |
| `LogViewer` | **2** | `JobLogsDisclosure`, `StepLogs` — via `DisclosedLogViewer` at the time; directly since `ui@1.0.0` deleted the workaround (see below) |
| `Menu` | **1** | `VariablesPanel`'s type picker |
| `SortableTableHeader` | **1**, four columns | `FileExplorerModal` |

Deleted: `FieldLabel`, `FieldTooltip` (130 hand-rolled lines),
`primitives/Popover` and the `@radix-ui/react-popover` dependency.

Two local wrappers exist because `Field` does not cover the shape:
`CommandFieldControl` (11 fields with one control) and `CommandFieldGroup`
(8 whose control is several elements). See
[the library-gap section](#four-things-the-library-got-wrong-under-a-real-consumer).

### What was deliberately left

- **The seven comboboxes** — `PortalDropdown`, `CommandPicker`, `LinkPicker`,
  `EnumPicker`, `PathPicker`, `AssFieldPicker`, `RenameTargetPicker`. A text
  input filtering a listbox is charcuterie's **P2**. Untouched, including
  their hand-rolled positioning.
- **`BooleanField` is not a `Field` caller.** `Field` renders `label` above
  `control` in a `flex-col`, which is right for a text input and wrong for a
  checkbox — stacking every boolean in a step card doubles its height. A
  wrapping `<label>` is also the one association that needs no `for`, so
  there was no dangling-id bug to fix there. What *was* broken is below.
- **The app's ~1000 `*-slate-*` utilities.** The page canvas moved to
  `surface-base` / `content-primary` because token-coloured components have
  to sit on something that answers to the same scheme; converting the rest is
  its own milestone. `data-scheme` is pinned to `dark` — a scheme toggle that
  repaints only the shared components is worse than none.

---

## Six defects that were live, and what could see them: nothing

Measured in a real Chromium against both branches, same commands, same
viewport (`feat/mux-magic-revamp` on :3222, this branch on :3111):

| | baseline | after |
| --- | --- | --- |
| `<label for>` resolving to **nothing** | **4** | **0** |
| `<label>` nested inside a `<label>` | **5** | **0** |
| `[aria-expanded]` on the same card | 3 | 5 |
| tooltip reachable in 40 Tab presses | **never** | yes, and Escape closes it |

### 1. A `for` that pointed at nothing

charcuterie recorded this as "`FieldLabel` renders a `<label>` with no
`htmlFor` at all". **It has one.** What it does not have is a control at the
other end: it wrote `htmlFor={`${stepId}-${field.name}`}` and left each of
its sixteen callers to render an element with that id, and **eight did not**
(`RegexWithFlagsField`, `FolderTagsField`, `SubtitleRulesField`,
`LanguageCodesField`, `SubtitleTypesField`, `LanguageCodeField`,
`FolderMultiSelectField`, `RenameRegexField`).

A dangling `for` is not a degraded label, it is *no* label — the control is
announced as an unnamed textbox and the label text as loose prose. There is
no gate that can see it: the attribute is present and correctly spelled, and
axe has no rule for a `for` that resolves to nothing on a control with no
other name. `Field` closes it by construction —
[decision](decisions/2026-07-31-field-owns-the-control-id.md).

### 2. A `<label>` inside a `<label>`

`BooleanField` wrapped its checkbox in a `<label>` and rendered `FieldLabel`
— itself a `<label>`, carrying a `for` pointing at the same input — inside
it. `<label>` forbids descendant `<label>` elements outright. Five instances
on one step card. Neither typecheck, lint, nor axe reports it.

### 3. A tooltip no keyboard could reach

`FieldTooltip` bound `onPointerEnter` / `onPointerLeave` and no `onFocus`, on
a `<span role="none">` that was not focusable, with no `aria-describedby`
anywhere and no Escape. Forty Tab presses across the whole card, twice, never
opened it. WCAG 2.1.1 and 1.4.13, on the only place a field's explanation
lived.

### 4. `aria-sort` existed nowhere in this repo

`FileExplorerModal` rendered the direction as
`{sortDirection === "asc" ? "▲" : "▼"}` on a bare `<th onClick>`. A screen
reader announces that as "black up-pointing triangle" if the font has it, and
this sandbox's headless Chromium does not — so the same glyph measures
**blank** in a screenshot. The header was also unfocusable, and the unsorted
columns said nothing at all: an absent `aria-sort` means "not sortable", so
omitting it told a screen-reader user the other three columns could not be
sorted either. axe has no rule for this, because a table without `aria-sort`
is simply not sorted as far as the accessibility tree knows.

### 5. Two owners for one fact, three times

`JobStepsDisclosure` reconciled `<details>`'s `open` with a Jotai atom using
a ref to reach past React, an effect to push state into the DOM, and a guard
to swallow the echo. All three deleted.

The same bug was **already written down** in `e2e/dsl-rules.spec.ts`, as a
note explaining that "the React-controlled `<details>`'s `open` attribute is
lost on re-render, making children appear hidden to Playwright even when they
are in the DOM". That was not a Playwright quirk.

And `<summary>` cannot be disabled: `WhenBuilder` / `ApplyIfBuilder`'s
read-only previews had only `open={false}`, so a user could click them open,
at which point `onToggleDetails` was a no-op and nothing pushed them shut.
`isDisabled` is what `<details>` could never express.

### 6. An auto-scroll that followed nothing

```tsx
useEffect(() => {
  const pane = paneRef.current
  if (pane) pane.scrollTop = pane.scrollHeight
}, [])          // ← empty deps
```

Ran once, on mount, when the pane was empty and `scrollHeight` *was*
`clientHeight`. `StepLogs` was worse — a `<pre>` holding the whole buffer
joined into one text node, with no following and no cap.

---

## Four things the library got wrong under a real consumer

### `Field` and `Tooltip` cannot nest, and nothing says so

Both are slot components: each clones props onto its one child. So
`<Field><Tooltip><input/></Tooltip></Field>` makes `Field` clone `id`,
`aria-describedby`, `aria-invalid` and `required` onto `Tooltip`, which has a
closed prop list and **drops all four silently**. The field renders, the
label points at nothing, and every assertion about the control's own props
passes because they never arrived. That is the failure `Select`'s own
docstring warns about, arriving from the other direction — and it applies to
every wrapper between a slot component and the real control, which is why
`TagInputBase` now forwards its leftover props too.

`DescribedControl` is the adapter that lets both reach the same `<input>`.
**The library should say that two slot components cannot be composed, or give
them a shared merge contract.**

### `Field` has no group mode, and five fields need one

`RegexWithFlagsField` (pattern + flags), `SubtitleRulesField`,
`RenameRegexField` (rule rows), `FolderMultiSelectField` (chips + a browse
button) and `PathField` (an input plus two picker buttons) have no single
control. `Field` renders a real `<label htmlFor>`, so pointing it at one of
several either resolves to nothing — the bug being fixed — or silently claims
to name the other three. `CommandFieldGroup` is a `<span>` label plus a
`role="group"`; it should be a mode of `Field`.

Second-order: because `Field` renders a `<label>`, the help affordance inside
it **cannot be a button** — `<label>` forbids labelable descendants, and a
button inside one also activates the labelled control on click. So the two
wrappers necessarily use different affordances: the tooltip hangs off the
control in `CommandFieldControl` and off a real `?` button in
`CommandFieldGroup`.

### **`LogViewer` never follows when it mounts inside a collapsed `Accordion`**

The one to fix first. `AccordionSection` renders its panel `hidden` rather
than unmounting it, and says why: "the fleet's log panes are exactly that".
`LogViewer` follows the tail from an effect that reads `scrollHeight`. Inside
a `hidden` panel there is no layout. Measured on a 60-line pane:

```
while collapsed : scrollTop 0   scrollHeight 0     clientHeight 0
after expanding : scrollTop 0   scrollHeight 976   clientHeight 254
```

The effect ran once, while `scrollHeight` was `0`. Its dependencies are
`isFollowing` and `shownLines`, neither of which changes when the panel is
revealed — so it never runs again and the pane opens on the **top** of the
log. **That is mux-magic's original `}, [])` bug, rebuilt out of two
components whose individual decisions are both right**, and it is invisible
to both components' own tests: `LogViewer`'s mount visible, `Accordion`'s
with content that does not measure itself.

`DisclosedLogViewer` works around it by not mounting the pane until the
section has been opened once. The component wants an effect keyed on
visibility, or an `IntersectionObserver`.

> **✅ Fixed upstream 2026-08-02, and the workaround is gone.**
> `@charcuterie/ui@1.0.0` fixes this in the library with a `ResizeObserver`
> on the pane, live only while following — per spec it does not fire at
> `observe()` time for an element that is not being rendered, so *gaining a
> box is the first callback*, which is precisely the reveal. Not an
> `IntersectionObserver`, which this section guessed at: that answers "is it
> on screen", and a pane below the fold on a long page is not intersecting
> yet has perfectly good layout.
>
> `DisclosedLogViewer` is **deleted**. `JobLogsDisclosure` and `StepLogs`
> render `Accordion` and `LogViewer` directly, and the regression coverage
> lives in `StepLogs.test.tsx`, which measures the tail rather than
> asserting the pane was withheld — `scrollTop 722 / scrollHeight 976 /
> clientHeight 254` after the reveal, versus `scrollTop 0` and a 722px gap
> with the fix stubbed out.

### `TypePicker` is a menu, and the `Menu` docstring says otherwise

`@charcuterie/ui`'s `Menu` names this component as "a listbox wearing the
wrong role". Measured against the distinction that docstring itself draws —
a `menuitem` **does** something, an `option` **is** something you are
choosing — the old markup had the role right. Kept as a menu;
[decision](decisions/2026-07-31-the-add-variable-picker-stays-a-menu.md).

---

## Two smaller findings

**`Select` owns no value, and three sites have a second writer.** Uncontrolled
is right where the user is the only writer, which is eight of eleven. The
other three take a `key` that re-seeds the DOM — most importantly
`SmartMatchModal`'s Plex type, where picking a different candidate re-derives
the suffix (commit `bcb0f0b3`). An uncontrolled select would have silently
reverted that fix with a green typecheck. Keyed on the **candidate**, not the
suffix, so the user's own change does not remount the control under their
focus. Its regression test caught it, then failed a second time for a
different reason: it captured the select once and re-read `.value`, and a
remount makes that node stale.

**Two direct DOM writes deleted.** `WhenBuilder` and `ApplyIfBuilder` reset
their "+ Add clause…" pickers with `event.target.value = ""`. Neither needs
it: the picked clause leaves `availableClauses` on the same commit, so the
browser falls back to the disabled placeholder by itself.

---

## Five test-only handles removed

`data-log-id`, `data-step-logs-body`, `data-plex-suffix-select`,
`data-details-key`, and the dead `data-generic-run-results` / `data-kind`.
Each was a `data-testid` under another name — the practice
`sourceRules.test.ts` bans, not the spelling. Eighteen query sites in
`SmartMatchModal.test.tsx` alone now use the control's accessible name, which
is what Playwright and a screen reader both use.

Two suites were asserting the wrong thing entirely and are the tell for two
of the defects above:

- `VariablesPanel.test.tsx` asked for `getByRole("button")` on the type
  picker's items — a menu whose items answer to `button` is a menu that is
  not a menu.
- `PredicatesManager.test.tsx` asserted `-rotate-90` on a chevron's `class`,
  four times, because the **icon was the state**. The trigger had no
  `aria-expanded`.

`PredicatesManager` is worth its own note: it is the **eleventh** disclosure
and the brief listed ten, because it was never a `<details>` — a grep for
`<details>` walks straight past it.

---

## The bundle

`@charcuterie/ui` + `@charcuterie/logic` + `@floating-ui/react` cost
**+21.90 kB gz** on the main chunk (253.28 → 275.18, same build, gzip level
9). The budget moved 260 → **280**, with the reason written into the
constant.

It is not slack. Tree-shaking already works — `MediaTile`, `Skeleton`,
`SegmentedControl`, `EmptyState`, `LiveStatusIndicator`, `Toast` and
`FileDropZone` appear nowhere in the chunk — and `Tooltip` is on **every
command field**, so `@floating-ui/react` is a first-paint dependency. Moving
`@charcuterie/ui` into a `manualChunks` entry would shrink `index-*.js`
without shortening the critical path by a byte, which is gaming the gate
rather than passing it.

---

## Screenshots

In `__screenshots__/` (gitignored — scratch, not deliverables), each driven
to the state that changed rather than a default render:

| File | State |
| --- | --- |
| `03-accordion-expanded.png` | the `When` accordion expanded, `aria-expanded="true"`, `role="group"` panel, and the `+ Add clause…` `Select` back on its placeholder after a pick |
| `04-add-variable-menu-open.png` | the type picker open: `role="menu"`, six `menuitem`s, focus on the first, named "Add variable" by its trigger, zero `listbox`/`option` |
| `05-table-sorted.png` | `Name` sorted ascending **with keyboard focus on it** — the old bare `<th onClick>` could not be reached at all |
| `06-steplogs-following-tail.png` | the log pane pinned to its tail (`scrollTop 722 / scrollHeight 976`), showing lines 45–59 |
| `07-steplogs-jump-to-latest.png` | scrolled away, **Jump to latest** offered |
| `08-jobcard-accordions-expanded.png` | `Params`, `Results (1)` and `Logs` all expanded on one card |
| `10-tooltip-from-keyboard.png` | the description open after the 20th **Tab**, `aria-describedby` matching the tip's id — on the baseline, forty Tabs never opened it |

---

## What M6b did not do

- The seven comboboxes. P2.
- The `*-slate-*` palette. Its own milestone; the components are token-coloured
  and the page canvas is, the rest is not.
- A light mode. `data-scheme` is pinned to `dark`.
- `Toast`, `ToastRegion`, `FileDropZone` — the three P1 components M6a itself
  recorded as having no React consumer. They still have none here.
