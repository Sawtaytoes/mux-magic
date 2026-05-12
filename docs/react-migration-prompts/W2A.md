# W2A spawn prompt (Bundle A — primitives)

Paste the block below into a fresh Claude Code session opened in `d:\Projects\Personal\media-tools`.

---

You are Worker W2A in the React Migration Recovery for media-tools.

**Working directory:** `d:\Projects\Personal\media-tools`
**Branch:** `react-migration` (already checked out — do not switch)
**Your model:** Haiku 4.5 with thinking ON
**Your bundle (3 fields):** `BooleanField`, `NumberField`, `StringField`

W2B, W2C, W2D are running in parallel with you on the same branch — they own disjoint field types but share `RenderFields.tsx` (one `case` block each). `git pull --rebase origin react-migration` before every push.

## Required reading before doing anything

1. [docs/react-migration-recovery-handout.md](../react-migration-recovery-handout.md) — Universal Rules + WORKER W2A section.
2. [docs/react-migration-checklist.md](../react-migration-checklist.md) — current state, W0b's directory audit, W1's deliverables.
3. [packages/web/src/components/RenderFields/RenderFields.tsx](../../packages/web/src/components/RenderFields/RenderFields.tsx) — the dispatcher. Your three `case` blocks live here.
4. [packages/web/src/commands/__fixtures__/commands.ts](../../packages/web/src/commands/__fixtures__/commands.ts) — `FIXTURE_COMMANDS_BUNDLE_A` is yours. Import from here in tests.

## Critical context (from W0b + W1)

**Existing partials per W0b's audit:**
- `packages/web/src/components/NumberField/` — **partial**: `NumberField.tsx` has a real number input with `companionNameField` support, BUT it calls `window.setParam?.(…)` and `window.scheduleReverseLookup?.(…)`. There's also a `NumberField.test.tsx` with 4 inline-assertion tests. **Extend, don't recreate** — but swap the `window.*` calls for the React pattern below.
- `packages/web/src/components/BooleanField/` and `StringField/` — do not exist; create from scratch.

**`window.scheduleReverseLookup` has no atom equivalent yet.** It's a legacy bridge tied to NumberWithLookupField semantics (which is W2D's territory). For W2A's plain `NumberField`, drop the reverse-lookup call entirely — a plain `<input type="number">` doesn't need it. If reverse-lookup is required for NumberField (verify by reading the legacy `packages/web/public/builder/js/fields/number-field.js`), coordinate with W2D before adding atom infrastructure.

**No `string` case in the W1 dispatcher.** RenderFields has cases for `boolean`, `number`, etc., but `string` falls through to the default branch (which renders `<TodoField type="string(${field.type})" .../>`). You will need to **add a new `case "string":`** to the dispatcher when porting StringField. Place it alphabetically near the other primitives.

**Dispatcher contract (from RenderFields.tsx lines 40–134):**

Each `case` currently looks like:
```tsx
case "boolean":
  return <TodoField type="boolean" field={field} step={step} />
```
Replace with:
```tsx
case "boolean":
  return <BooleanField field={field} step={step} />
```
Props every component receives: `field: CommandField`, `step: Step`. Import types from `../../types`.

**Param dispatch pattern (replaces `window.setParam`):**

```ts
import { useBuilderActions } from "../../hooks/useBuilderActions"

const { setParam } = useBuilderActions()
// ...
setParam(step.id, field.name, value)
```
This pushes history (undo support) automatically. **Do not** use `window.setParam`, `window.mediaTools.*`, or any window-bridge call. EnumPicker.tsx is a clean reference for the pattern.

**Reading the current value:** `step.params[field.name]` — already on the `step` prop the dispatcher passes you. No atom read needed for the value itself.

**`field.required`, `field.default`, `field.companionNameField`, `field.visibleWhen`:** all defined on `CommandField` in `packages/web/src/types.ts`. RenderFields already filters `visibleWhen` and `hidden` before calling the dispatcher — you only worry about the others.

## Your tasks (per-field recipe, repeat 3 times)

For each of `BooleanField`, `NumberField`, `StringField`:

1. Read the legacy source: `packages/web/public/builder/js/fields/boolean-field.js`, `number-field.js`, `string-field.js`.
2. Create or extend at `packages/web/src/components/<Field>/<Field>.tsx`. Props: `{ field: CommandField, step: Step }`. Use `useBuilderActions().setParam`. Render the appropriate `<input>` element with Tailwind v4 classes matching the legacy builder styling (read `packages/web/src/styles/builderStyles.css` if needed).
3. Write `<Field>.test.tsx` with **explicit inline assertions** — no `toMatchSnapshot`, no `toMatchInlineSnapshot`. Use `FIXTURE_COMMANDS_BUNDLE_A` from `__fixtures__/commands.ts` as test data. For NumberField, the existing 4 tests are a starting point — keep them passing.
4. Write `<Field>.stories.tsx`. Wrap stories in the global Jotai Provider (already done by `.storybook/preview.tsx`).
5. Edit `packages/web/src/components/RenderFields/RenderFields.tsx` with the `Edit` tool — surgical replacement of the matching `case` block only. **For StringField, ADD a new `case "string":` block** (it doesn't exist yet).
6. Manual smoke: `yarn dev`, open `/builder`, pick a command whose `commands.ts` definition includes a field of your type (e.g. `flattenOutput` has `boolean` + `path`; `setDisplayWidth` has `number` + `boolean`), verify the field renders and edits update the YAML output (check via `YamlModal`).
7. Pre-push gate: `yarn test run && yarn typecheck && yarn lint` — all three must pass.
8. `git pull --rebase origin react-migration`.
9. Commit and push:
   - `feat(fields): port BooleanField from vanilla JS to React`
   - `feat(fields): port NumberField from vanilla JS to React` (mention if you dropped `scheduleReverseLookup`)
   - `feat(fields): port StringField + add 'string' case to RenderFields dispatcher`

## Checklist updates (Universal Rule #8)

- At start: mark W2A as 🔄 In Progress in [docs/react-migration-checklist.md](../react-migration-checklist.md).
- Per commit: append one line to the Progress Log.
- At end: mark W2A as ✅ Done with a one-line summary.

## Forbidden (Universal Rule #4)

No `toMatchSnapshot`, `toMatchInlineSnapshot`, `toHaveScreenshot`. Inline expected values only. See [AGENTS.md](../../AGENTS.md) "Forbidden test styles".

## When done

Reply with: 3 commit SHAs, decision on `scheduleReverseLookup` for NumberField, confirmation that StringField's new `case "string":` is in the dispatcher, pre-push gate state, any blockers.
