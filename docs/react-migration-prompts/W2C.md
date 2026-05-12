# W2C spawn prompt (Bundle C — arrays + JSON)

Paste the block below into a fresh Claude Code session opened in `d:\Projects\Personal\media-tools`.

---

You are Worker W2C in the React Migration Recovery for media-tools.

**Working directory:** `d:\Projects\Personal\media-tools`
**Branch:** `react-migration` (already checked out — do not switch)
**Your model:** Haiku 4.5 with thinking ON
**Your bundle (3 fields):** `StringArrayField`, `NumberArrayField`, `JsonField`

W2A, W2B, W2D are running in parallel with you on the same branch — they own disjoint field types but share `RenderFields.tsx` (one `case` block each). `git pull --rebase origin react-migration` before every push.

## Required reading before doing anything

1. [docs/react-migration-recovery-handout.md](../react-migration-recovery-handout.md) — Universal Rules + WORKER W2C section.
2. [docs/react-migration-checklist.md](../react-migration-checklist.md) — current state, W0b's directory audit, W1's deliverables.
3. [packages/web/src/components/RenderFields/RenderFields.tsx](../../packages/web/src/components/RenderFields/RenderFields.tsx) — your three `case` blocks: `stringArray` (line 89), `numberArray` (line 97), `json` (line 105).
4. [packages/web/src/commands/__fixtures__/commands.ts](../../packages/web/src/commands/__fixtures__/commands.ts) — `FIXTURE_COMMANDS_BUNDLE_C` is yours.

## Critical context (from W0b + W1)

**All three component directories are absent** per W0b's audit — you create them from scratch.

**Dispatcher contract (from RenderFields.tsx lines 40–134):**

Each `case` currently looks like:
```tsx
case "stringArray":
  return <TodoField type="stringArray" field={field} step={step} />
```
Replace with:
```tsx
case "stringArray":
  return <StringArrayField field={field} step={step} />
```
Props every component receives: `field: CommandField`, `step: Step`. Import types from `../../types`.

**Param dispatch pattern (replaces `window.setParam`):**

```ts
import { useBuilderActions } from "../../hooks/useBuilderActions"
const { setParam } = useBuilderActions()
setParam(step.id, field.name, value)
```
Pushes history (undo) automatically. **Do not** use `window.setParam` or any window-bridge call.

**Reading current value:** `step.params[field.name]` (already on the `step` prop). Cast appropriately: `as string[]`, `as number[]`, `as Record<string, unknown>` (or parse it).

## JsonField — special note (parity is the goal)

The legacy `json-field.js` likely has multi-line input, parse-error display, and validation rules. **Match legacy behavior exactly** — don't improve error messages or relax validation, even if the legacy version feels rough. W4 verifies parity against W0c's fixtures, and JSON fields appear in several commands (`modifySubtitleMetadata` has 43 lines of input.json — JSON-heavy). Test edge cases:
- Empty string vs `{}`
- Malformed JSON (single quotes, trailing commas) — what does legacy do?
- Whitespace-only input
- Nested objects

## Your tasks (per-field recipe, repeat 3 times)

For each of `StringArrayField`, `NumberArrayField`, `JsonField`:

1. Read the legacy source: `packages/web/public/builder/js/fields/string-array-field.js`, `number-array-field.js`, `json-field.js`.
2. Create at `packages/web/src/components/<Field>/<Field>.tsx`. Props: `{ field: CommandField, step: Step }`. Use `useBuilderActions().setParam`. Render appropriate input controls (textarea for arrays/JSON, with whatever UI affordances the legacy version had — add buttons, item rows, etc.).
3. Write `<Field>.test.tsx` with **explicit inline assertions** (no snapshots). Use `FIXTURE_COMMANDS_BUNDLE_C` for test data.
4. Write `<Field>.stories.tsx`.
5. Edit `RenderFields.tsx` with the `Edit` tool — surgical replacement of your `case` block only.
6. Manual smoke: `yarn dev`, open `/builder`, pick commands using each field type (`keepLanguages` has array fields; `modifySubtitleMetadata` has JSON-heavy fields), verify each renders and edits update the YAML.
7. Pre-push gate: `yarn test run && yarn typecheck && yarn lint`.
8. `git pull --rebase origin react-migration`.
9. Commit and push:
   - `feat(fields): port StringArrayField from vanilla JS to React`
   - `feat(fields): port NumberArrayField from vanilla JS to React`
   - `feat(fields): port JsonField from vanilla JS to React (parity with legacy validation)`

## Checklist updates (Universal Rule #8)

- At start: mark W2C 🔄 In Progress.
- Per commit: append to Progress Log.
- At end: mark W2C ✅ Done with a one-line summary.

## Forbidden (Universal Rule #4)

No snapshot/VRT tests. Inline expected values only.

## When done

Reply with: 3 commit SHAs, JsonField parity decisions (what edge-case behavior did you preserve from legacy?), pre-push gate state, any blockers.
