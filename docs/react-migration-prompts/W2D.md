# W2D spawn prompt (Bundle D — composite, heaviest)

Paste the block below into a fresh Claude Code session opened in `d:\Projects\Personal\media-tools`.

---

You are Worker W2D in the React Migration Recovery for media-tools.

**Working directory:** `d:\Projects\Personal\media-tools`
**Branch:** `react-migration` (already checked out — do not switch)
**Your model:** Haiku 4.5 with thinking ON
**Your bundle (4 fields + 1 picker + 1 builder component):**
- `PathField`
- `NumberWithLookupField`
- `FolderMultiSelectField`
- `SubtitleRulesField`
- `step-output-picker` (port — used by PathField and NumberWithLookupField)
- `DslRulesBuilder` (legacy `dsl-rules-builder.js`) — may escalate, see below

W2A, W2B, W2C are running in parallel with you on the same branch — they own disjoint field types but share `RenderFields.tsx` (one `case` block each). `git pull --rebase origin react-migration` before every push.

## Required reading before doing anything

1. [docs/react-migration-recovery-handout.md](../react-migration-recovery-handout.md) — Universal Rules + WORKER W2D section. Pay particular attention to the **DslRulesBuilder escalation criteria**.
2. [docs/react-migration-checklist.md](../react-migration-checklist.md) — current state, W0b's directory audit, W1's deliverables.
3. [packages/web/src/components/RenderFields/RenderFields.tsx](../../packages/web/src/components/RenderFields/RenderFields.tsx) — your four `case` blocks: `path` (line 49), `numberWithLookup` (line 65), `folderMultiSelect` (line 109), `subtitleRules` (line 117).
4. [packages/web/src/commands/__fixtures__/commands.ts](../../packages/web/src/commands/__fixtures__/commands.ts) — `FIXTURE_COMMANDS_BUNDLE_D` is yours.
5. [packages/web/src/commands/links.ts](../../packages/web/src/commands/links.ts) — `getLinkedValue` lives here (W1 ported). Import; **do not modify**.

## Critical context (from W0b + W1)

**Existing partials per W0b's audit:**
- `packages/web/src/components/PathField/` — **does not exist**. Create from scratch.
- The other three (`NumberWithLookupField`, `FolderMultiSelectField`, `SubtitleRulesField`) also do not exist — all created from scratch.

**`window.scheduleReverseLookup` — this is YOUR field's concept (NumberWithLookupField).** W2A explicitly dropped it for plain NumberField. If the legacy `number-with-lookup-field.js` invokes reverse-lookup (lookup TMDB id → name, or similar), you may need to add atom infrastructure for it. Likely lives next to `pickerAtoms.ts` or as a new file. Coordinate with the orchestrator if scope balloons.

**`getLinkedValue` is in `packages/web/src/commands/links.ts`.** W1 ported it. Use it as-is — multiple of your fields need it for resolving `step.links` references.

**Step-output picker — separate port.** The legacy `packages/web/public/builder/js/fields/step-output-picker.js` is used by PathField and NumberWithLookupField to let the user wire a step's output into another step's input field. There may already be a `LinkPicker` component (Wave C marked done) that does this — **read it first** at `packages/web/src/components/LinkPicker/`. If LinkPicker covers the same UX, reuse it; if not, port `step-output-picker.js` as a fresh React component.

**Dispatcher contract (from RenderFields.tsx lines 40–134):**

Each `case` currently looks like:
```tsx
case "path":
  return <TodoField type="path" field={field} step={step} />
```
Replace with:
```tsx
case "path":
  return <PathField field={field} step={step} />
```
Props every component receives: `field: CommandField`, `step: Step`. Import types from `../../types`.

**Param dispatch pattern (replaces `window.setParam`):**

```ts
import { useBuilderActions } from "../../hooks/useBuilderActions"
const { setParam, setLink } = useBuilderActions()
setParam(step.id, field.name, value)
setLink(step.id, field.name, linkValue)   // when the field has a link
```

**Reading current value:** `step.params[field.name]` and `step.links[field.name]` (already on the `step` prop). Use `getLinkedValue` to resolve.

## DslRulesBuilder — escalation criteria

From the handout's W2D section: read `packages/web/public/builder/js/components/dsl-rules-builder.js` in full **before starting**. If after reading it's clear this is more than a mechanical port — meaning it needs new Jotai atoms beyond the existing ones, new state-shape decisions, or refactoring of shared helpers — **STOP** and add to the checklist:

```
## DslRulesBuilder escalation (W2D)
- Reason: <why this isn't mechanical>
- Recommended: reassign to Sonnet High effort as Phase 2.5
```

Then notify the orchestrator. **Do not push half-finished DslRulesBuilder work.** Ship the other four fields plus step-output-picker first; that already represents a complete bundle delivery. The orchestrator will spawn a Sonnet/Opus session for DslRulesBuilder separately if needed.

## Your tasks (per-field recipe, repeat 4 times + extras)

For each of `PathField`, `NumberWithLookupField`, `FolderMultiSelectField`, `SubtitleRulesField`:

1. Read the legacy source under `packages/web/public/builder/js/fields/`.
2. Create at `packages/web/src/components/<Field>/<Field>.tsx`. Props: `{ field: CommandField, step: Step }`. Import `useBuilderActions`, `getLinkedValue`, any shared helpers.
3. Write `<Field>.test.tsx` with **explicit inline assertions** (no snapshots). Use `FIXTURE_COMMANDS_BUNDLE_D` for test data.
4. Write `<Field>.stories.tsx`.
5. Edit `RenderFields.tsx` with the `Edit` tool — surgical replacement of your `case` block only.
6. Manual smoke: `yarn dev`, open `/builder`, pick commands using each field type (`flattenOutput` has `path`; `modifySubtitleMetadata` has `subtitleRules`), verify renders + edits update YAML.

Plus the extras:

- Port `step-output-picker.js` if `LinkPicker` doesn't cover it. Save at `packages/web/src/components/StepOutputPicker/` (or wherever LinkPicker lives if you decide to extend it).
- Tackle `dsl-rules-builder.js` last — escalate per criteria above if non-mechanical.

Pre-push gate: `yarn test run && yarn typecheck && yarn lint`. `git pull --rebase origin react-migration` before each push.

## Commits (push each immediately)

1. `feat(fields): port PathField from vanilla JS to React`
2. `feat(fields): port NumberWithLookupField (with reverse-lookup atom infrastructure)`
3. `feat(fields): port FolderMultiSelectField from vanilla JS to React`
4. `feat(fields): port SubtitleRulesField from vanilla JS to React`
5. `feat(pickers): port step-output-picker to React` (or `chore: extend LinkPicker to cover step-output-picker scope`)
6. `feat(components): port DslRulesBuilder` — OR a checklist update marking it escalated

## Checklist updates (Universal Rule #8)

- At start: mark W2D 🔄 In Progress.
- Per commit: append to Progress Log.
- At end: mark W2D ✅ Done (or partial ✅ with DslRulesBuilder ⚠️ escalated).

## Forbidden (Universal Rule #4)

No snapshot/VRT tests. Inline expected values only.

## When done

Reply with: list of commit SHAs, decision on step-output-picker (port fresh vs extend LinkPicker), `scheduleReverseLookup` decision for NumberWithLookupField (atom infrastructure added? where?), DslRulesBuilder verdict (mechanical/escalated), pre-push gate state, any blockers.
