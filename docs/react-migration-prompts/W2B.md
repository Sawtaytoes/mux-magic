# W2B spawn prompt (Bundle B — enum / language)

Paste the block below into a fresh Claude Code session opened in `d:\Projects\Personal\media-tools`.

---

You are Worker W2B in the React Migration Recovery for media-tools.

**Working directory:** `d:\Projects\Personal\media-tools`
**Branch:** `react-migration` (already checked out — do not switch)
**Your model:** Haiku 4.5 with thinking ON
**Your bundle (3 fields):** `EnumField`, `LanguageCodeField`, `LanguageCodesField`

W2A, W2C, W2D are running in parallel with you on the same branch — they own disjoint field types but share `RenderFields.tsx` (one `case` block each). `git pull --rebase origin react-migration` before every push.

## Required reading before doing anything

1. [docs/react-migration-recovery-handout.md](../react-migration-recovery-handout.md) — Universal Rules + WORKER W2B section.
2. [docs/react-migration-checklist.md](../react-migration-checklist.md) — current state, W0b's directory audit, W1's deliverables.
3. [packages/web/src/components/RenderFields/RenderFields.tsx](../../packages/web/src/components/RenderFields/RenderFields.tsx) — your three `case` blocks: `enum` (line 61), `languageCode` (line 73), `languageCodes` (line 81).
4. [packages/web/src/commands/__fixtures__/commands.ts](../../packages/web/src/commands/__fixtures__/commands.ts) — `FIXTURE_COMMANDS_BUNDLE_B` is yours.
5. [packages/web/src/components/EnumPicker/EnumPicker.tsx](../../packages/web/src/components/EnumPicker/EnumPicker.tsx) — already Jotai-wired; reference for the picker pattern.

## Critical context (from W0b + W1)

**Existing partials per W0b's audit:**
- `packages/web/src/components/EnumField/` — **partial**: `EnumField.tsx` has a real React trigger button BUT it calls `window.enumPicker?.open(…)`. No test, no stories. **Extend, don't recreate** — swap the `window.*` call for the atom pattern below.
- `packages/web/src/components/LanguageCodeField/` — **partial**: `LanguageCodeField.tsx` has a real React text input BUT it calls `window.setParam?.(…)`. No test, no stories. **Extend, don't recreate**.
- `packages/web/src/components/LanguageCodesField/` — does not exist; create from scratch.

**EnumField wires to the existing EnumPicker.** `enumPickerStateAtom` lives at `packages/web/src/state/pickerAtoms.ts:37`. When the user clicks your trigger, set the atom; EnumPicker reads it and opens the popover at the anchor. Selection writes back via `useBuilderActions().setParam`. See `EnumPicker.tsx` lines 121 and 194 for the reference pattern (`const { setParam } = useBuilderActions()`).

**LanguageCodeField + LanguageCodesField:** read the legacy implementations at `packages/web/public/builder/js/fields/language-code-field.js` and `language-codes-field.js`. Both deal with ISO 639 codes — keep validation parity exact. If there's a shared validator, port it to a helper in `packages/web/src/commands/` or co-locate with the field.

**Dispatcher contract (from RenderFields.tsx lines 40–134):**

Each `case` currently looks like:
```tsx
case "enum":
  return <TodoField type="enum" field={field} step={step} />
```
Replace with:
```tsx
case "enum":
  return <EnumField field={field} step={step} />
```
Props every component receives: `field: CommandField`, `step: Step`. Import types from `../../types`.

**Param dispatch pattern (replaces `window.setParam`):**

```ts
import { useBuilderActions } from "../../hooks/useBuilderActions"
const { setParam } = useBuilderActions()
setParam(step.id, field.name, value)
```
Pushes history (undo) automatically. **Do not** use `window.setParam` or any window-bridge call.

**Reading current value:** `step.params[field.name]` (already on the `step` prop).

## Your tasks (per-field recipe, repeat 3 times)

For each of `EnumField`, `LanguageCodeField`, `LanguageCodesField`:

1. Read the legacy source: `packages/web/public/builder/js/fields/enum-field.js`, `language-code-field.js`, `language-codes-field.js`.
2. Create or extend at `packages/web/src/components/<Field>/<Field>.tsx`. Props: `{ field: CommandField, step: Step }`. Use `useBuilderActions().setParam`. For EnumField: also use `useSetAtom(enumPickerStateAtom)` to open the picker.
3. Write `<Field>.test.tsx` with **explicit inline assertions** (no snapshots). Use `FIXTURE_COMMANDS_BUNDLE_B` for test data.
4. Write `<Field>.stories.tsx`.
5. Edit `RenderFields.tsx` with the `Edit` tool — surgical replacement of your `case` block only.
6. Manual smoke: `yarn dev`, open `/builder`, pick a command exposing each field type (`changeTrackLanguages` has `enum` and `languageCodes`; `setDisplayWidth` has `enum`), verify each renders and edits update the YAML.
7. Pre-push gate: `yarn test run && yarn typecheck && yarn lint`.
8. `git pull --rebase origin react-migration`.
9. Commit and push:
   - `feat(fields): port EnumField from vanilla JS to React (uses enumPickerStateAtom)`
   - `feat(fields): port LanguageCodeField from vanilla JS to React`
   - `feat(fields): port LanguageCodesField from vanilla JS to React`

## Checklist updates (Universal Rule #8)

- At start: mark W2B 🔄 In Progress.
- Per commit: append to Progress Log.
- At end: mark W2B ✅ Done with a one-line summary.

## Forbidden (Universal Rule #4)

No snapshot/VRT tests. Inline expected values only.

## When done

Reply with: 3 commit SHAs, confirmation that the legacy `window.enumPicker` call in EnumField is gone, confirmation that LanguageCode validation parity is preserved, pre-push gate state, any blockers.
