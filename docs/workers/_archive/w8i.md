# WORKER W8I — setStyleFields Autocomplete Dropdowns

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `react-migration`
**Parallel with:** W8B W8C W8D W8E W8F W8G W8H W8J

---

## Universal Rules

1. **Branch:** all work on `react-migration`. No new branches.

2. **TDD workflow — mandatory:**
   - Write the test first. The test must fail before you write any fix code.
   - Commit the failing test: `test(<area>): failing test for <bug description>`
   - Write the minimum code to make the test pass.
   - Commit the fix: `fix(<area>): <description>`
   - Do not skip the failing-first step.

3. **Pre-push gate — every push, no exceptions:**
   ```bash
   yarn test run
   yarn typecheck
   yarn lint
   ```

4. **E2E gate — run before marking Done:**
   ```bash
   yarn test:e2e
   ```
   If no e2e suite exists yet, note it in the checklist and continue.

5. **Test rules:** No snapshot tests. No screenshot tests. Assertions must be explicit
   inline values (`expect(x).toBe("literal")` or `expect(x).toEqual({ key: "value" })`).

6. **Commit-and-push as you go.** Small logical chunks.

7. **Update `docs/react-migration-checklist.md`** at start (🔄 In Progress) and end
   (✅ Done) of your worker section. Include one progress-log line per push.

8. **Yarn only.** Never npm or npx.

---

## Bug B14 — Your Mission

In the DSL rule builder for the `setStyleFields` command, two plain text inputs should
become autocomplete dropdowns with a custom-value fallback:

1. **"Field" name input** — the ASS style field being set (e.g. `Fontname`, `Fontsize`,
   `PrimaryColour`). Valid values are the fixed `[V4+ Styles]` column names from the ASS
   specification.
2. **"property" input** (shown when `computed` is checked) — the metadata property to
   read the value from. Valid values depend on the `scope` dropdown:
   - `scope: scriptInfo` → `[Script Info]` known keys
   - `scope: style` → `[V4+ Styles]` known field names (same set as #1)

Both inputs must still allow custom/arbitrary values that aren't in the list.

## Known ASS field sets

Define these as constants in a new file
`packages/web/src/components/DslRulesBuilder/assFields.ts`:

```ts
// ASS [Script Info] known keys
export const SCRIPT_INFO_FIELDS = [
  "Title", "ScriptType", "WrapStyle", "PlayResX", "PlayResY",
  "ScaledBorderAndShadow", "YCbCr Matrix", "LastStyleStorage",
  "Video File", "Video Aspect Ratio", "Video Zoom", "Video Position",
] as const

// ASS [V4+ Styles] column names
export const STYLE_FIELDS = [
  "Name", "Fontname", "Fontsize",
  "PrimaryColour", "SecondaryColour", "OutlineColour", "BackColour",
  "Bold", "Italic", "Underline", "StrikeOut",
  "ScaleX", "ScaleY", "Spacing", "Angle",
  "BorderStyle", "Outline", "Shadow", "Alignment",
  "MarginL", "MarginR", "MarginV", "Encoding",
] as const
```

## UI pattern — use the existing EnumField / EnumPicker

**Do NOT use native `<datalist>`.** The project already has `EnumField` + `EnumPicker`
which provides a searchable/filterable dropdown with keyboard navigation. Reuse that.

Read these files first to understand the pattern:
- `packages/web/src/components/EnumField/EnumField.tsx` — the trigger button
- `packages/web/src/components/EnumPicker/EnumPicker.tsx` — the portal dropdown
- `packages/web/src/state/pickerAtoms.ts` — `enumPickerStateAtom`

The "Field" and "property" inputs should become `EnumField`-style trigger buttons that
open `EnumPicker` with the appropriate options list. Since `EnumPicker` is driven by a
Jotai atom (`enumPickerStateAtom`) and currently reads options from the step's command
field definition, you will need to either:
- **Option A:** Pass the `assFields` options list directly to an `enumPickerStateAtom`
  write that accepts a static options array (extend the atom if needed), OR
- **Option B:** Render a self-contained local dropdown (not portal-based) that reuses
  the same visual style as `EnumPicker` but is driven by local state.

Read `EnumField.tsx` and `EnumPicker.tsx` fully before deciding. Choose whichever
requires fewer changes while staying visually consistent. Both fields must still allow
typing a custom value not in the list.

## TDD steps

1. Write tests asserting:
   - Clicking the "Field" trigger opens a picker showing `"Fontname"` as an option.
   - Clicking the "property" trigger with `scope="scriptInfo"` shows `"PlayResY"`.
   - Clicking the "property" trigger with `scope="style"` shows `"PrimaryColour"` instead.
   - Selecting an option updates the field value.
   - Typing a custom value not in the list still saves correctly.
   These tests must fail first.
2. Create `assFields.ts` with the two constant arrays.
3. Update the `setStyleFields` rule component to use `EnumField`/`EnumPicker` (or a
   local variant) for both the "Field" and "property" inputs.
4. Verify tests pass.

## Files

- `packages/web/src/components/DslRulesBuilder/assFields.ts` (new)
- `packages/web/src/components/EnumField/EnumField.tsx` (read for pattern)
- `packages/web/src/components/EnumPicker/EnumPicker.tsx` (read for pattern)
- The `setStyleFields` rule component in `packages/web/src/components/DslRulesBuilder/`
  (find via grep for `setStyleFields` in that directory)

---

## Verification checklist

Before marking Done:

- [ ] Failing test committed before fix code
- [ ] `yarn test run` — all tests pass
- [ ] `yarn typecheck` — clean
- [ ] `yarn lint` — clean
- [ ] `yarn test:e2e` — passes (or noted in checklist if suite absent)
- [ ] New tests cover the exact regression scenario
- [ ] Checklist row updated to ✅ Done in `docs/react-migration-checklist.md`
- [ ] Pushed to `origin/react-migration`
