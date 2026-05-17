# Worker 65 — regex-flags-and-sample-tester

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/65-regex-flags-and-sample-tester`
**Worktree:** `.claude/worktrees/65_regex-flags-and-sample-tester/`
**Phase:** 4
**Depends on:** 63 (done — establishes `RenameRegexField` + exposes `fileFilterRegex` / `folderFilterRegex` in the UI)
**Parallel with:** any worker that doesn't touch [packages/server/src/api/schemas.ts](../../packages/server/src/api/schemas.ts), [packages/server/src/app-commands/copyFiles.ts](../../packages/server/src/app-commands/copyFiles.ts), [packages/server/src/app-commands/moveFiles.ts](../../packages/server/src/app-commands/moveFiles.ts), [packages/web/src/commands/commands.ts](../../packages/web/src/commands/commands.ts), [packages/web/src/components/RenameRegexField/](../../packages/web/src/components/RenameRegexField/), or [packages/web/src/jobs/yamlCodec.ts](../../packages/web/src/jobs/yamlCodec.ts).

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Context

Worker 63 ([63_copy-and-move-files-regex-ui.md](63_copy-and-move-files-regex-ui.md)) surfaced `fileFilterRegex` / `folderFilterRegex` / `renameRegex` in the `copyFiles` / `moveFiles` UI cards. Three real gaps emerged while authoring per-series anime sync YAML:

1. **No regex flags.** `applyRenameRegex` at [copyFiles.ts:38-47](../../packages/server/src/app-commands/copyFiles.ts#L38-L47) calls `new RegExp(pattern)` — no flags arg, no UI control. Users who try the `(?i)` Python-style inline form get a runtime `Invalid group` error because V8 only supports the **scoped** form `(?i:...)` (Node 22+) and not the bare prefix. This blocks ingest of releases with inconsistent capitalization across release groups.
2. **String-only schema doesn't compose `pattern + flags`.** `fileFilterRegex` and `folderFilterRegex` are bare `z.string().optional()` ([schemas.ts:79-90](../../packages/server/src/api/schemas.ts#L79-L90)). `renameRegex` is `{ pattern, replacement }` ([schemas.ts:52-67](../../packages/server/src/api/schemas.ts#L52-L67)). Neither carries `flags`. Adding it cleanly requires bumping both to object shapes with back-compat.
3. **No way to verify a regex without running the job.** Users have to copy/paste a known release filename, dry-run, watch the output, iterate. Painful when authoring 6+ per-series patterns. The user's original `animeSeriesList` TS source kept a sample filename as a comment per series (`// Daemons.of.the.Shadow.Realm.S01E03.Dera.and.Hana.1080p...`); the equivalent should live in the template as structured data with live validation, not as a comment that decays.

## Your Mission

Three coupled additions across schema, UI, and YAML codec — all backward-compatible with Worker 63's wire format via the same `legacyFieldRenames`-style adapter from [yamlCodec.ts](../../packages/web/src/jobs/yamlCodec.ts).

### 1. Schema — `flags` + `sample` everywhere

Extend the three regex schema shapes in [packages/server/src/api/schemas.ts](../../packages/server/src/api/schemas.ts):

```ts
const regexWithFlagsSchema = z.object({
  pattern: z.string().describe("Regular expression pattern."),
  flags: z
    .string()
    .optional()
    .regex(/^[gimsuy]*$/, "Flags must be subset of g/i/m/s/u/y")
    .describe("Optional regex flags (e.g. \"i\" for case-insensitive)."),
  sample: z
    .string()
    .optional()
    .describe(
      "Optional sample filename used by the UI's live-match preview. " +
      "Persisted in the template as documentation; ignored at runtime.",
    ),
})

const renameRegexWithFlagsSchema = regexWithFlagsSchema.extend({
  replacement: z
    .string()
    .describe(
      "Replacement string. Capture groups available as $1, $2, … " +
      "Named groups via $<name>.",
    ),
})
```

Replace the existing `renameRegexSchema` with `renameRegexWithFlagsSchema`. Replace the bare `fileFilterRegex: z.string().optional()` and `folderFilterRegex: z.string().optional()` with `regexWithFlagsSchema.optional()`.

**Back-compat read path.** Old YAML in the wild carries `fileFilterRegex: "^foo$"` (a string) and `renameRegex: { pattern, replacement }` (no flags, no sample). Both must continue to parse. Two options:

- **Server-side**: use a Zod `union` of the old `z.string()` form and the new object form, with a `.transform()` to normalize. Same for `renameRegex` — union of old 2-key and new 4-key object.
- **Codec-side**: read-time normalization in [packages/web/src/jobs/yamlCodec.ts](../../packages/web/src/jobs/yamlCodec.ts) before the server sees it. The existing `legacyFieldRenames` map (see [reference-yaml-codec-location memory](../agents/AGENTS.md)) is the right pattern, just slightly extended to also handle string → object promotion.

Pick the server-side `union` + `transform` approach. The schema is the source of truth; the codec stays a pure encode/decode. Test fixtures in the parity-fixture suite must still pass without modification.

**Write path.** When `flags` is absent and `sample` is absent, the canonical write form should still be the old shape (string for filter, 2-key object for rename) to keep YAML diffs small for users who don't need the new fields. The schema's `transform` handles this in reverse via `output` shape, or write a small `serializeRegex` helper in the codec.

### 2. Server handler — pass flags through

At [copyFiles.ts:38-47](../../packages/server/src/app-commands/copyFiles.ts#L38-L47), change:

```ts
new RegExp(renameRegex.pattern)
```

to:

```ts
new RegExp(renameRegex.pattern, renameRegex.flags)
```

Same change in two more spots in `copyFiles.ts` (the file-filter at line 90 and the folder-filter at line 211-212) and the equivalent spots in [moveFiles.ts](../../packages/server/src/app-commands/moveFiles.ts).

Throw at command-start time (not per-file) if any regex fails to compile, surfacing the user's pattern + flags in the error message. Today's per-file failure surfaces only as a generic `SyntaxError` mid-job. Pre-validate by constructing each `RegExp` once at the top of the handler.

### 3. UI — slash-delimited regex display + flags input + sample tester

Extend `RenameRegexField` ([packages/web/src/components/RenameRegexField/RenameRegexField.tsx](../../packages/web/src/components/RenameRegexField/RenameRegexField.tsx)) from a two-input component to a four-control component:

- **Pattern input**: text field, with optional "show as `/pattern/flags`" toggle that renders the value as a JS-regex-literal view (e.g. `/foo\d+/i`) — purely a presentation overlay; the underlying value stays the bare pattern string + separate flags. The toggle is a small button in the field header (`Aa /…/`) that flips between "Plain" and "Slash" modes. Default to Plain.
- **Flags input**: small text field next to pattern (3-char width is plenty), accepts the standard JS regex flag chars `g i m s u y`. Validate inline; show a red dot + tooltip on invalid chars without throwing. Mirror the `fileFilterRegex` and `folderFilterRegex` fields' flag handling — share a `RegexFieldHelpers.ts` module.
- **Replacement input**: unchanged from worker 63.
- **Sample filename input**: new field labeled "Test against (optional)" beneath the replacement. Free-text. Persists in the template's YAML via the `sample` schema field.
- **Live match preview**: rendered immediately under the sample input. Updates on every keystroke of pattern/flags/replacement/sample. Three states:
  - Empty sample → no preview shown (component collapses).
  - Sample present, no match → red badge "No match" + the parsed pattern echoed back.
  - Sample present, match → green badge "Match" + the predicted output filename (sample run through `String.replace(new RegExp(pattern, flags), replacement)`) + the captured groups listed below as `{ groupName: value }` for quick inspection.

This is purely client-side — the live preview uses the browser's `RegExp` engine. No server round-trip.

**For `fileFilterRegex` and `folderFilterRegex`**: today they're bare `string` fields rendered by the `string` dispatch arm of `FieldDispatcher`. Promote them to a new field type `regexWithFlags` that renders the same shape as `RenameRegexField` minus the replacement and minus the sample → live-match-preview's "predicted output" (since filters don't transform; they just match/no-match). Reuse the shared `RegexFieldHelpers.ts`.

Update [packages/web/src/commands/commands.ts](../../packages/web/src/commands/commands.ts) — the `copyFiles` and `moveFiles` cards from worker 63 — to flip those fields to `type: "regexWithFlags"`.

### 4. Codec — read promotion + write canonicalization

In [packages/web/src/jobs/yamlCodec.ts](../../packages/web/src/jobs/yamlCodec.ts):

**Read** (`load` direction): when a `copyFiles` / `moveFiles` step's `fileFilterRegex` is a bare string, promote it to `{ pattern: <string>, flags: undefined, sample: undefined }` before handing to the runtime model. When `renameRegex` is `{ pattern, replacement }` (no flags/sample), promote to the 4-key shape. Mirror the existing `legacyFieldRenames` pattern in scope and style.

**Write** (`save` direction): when `flags` and `sample` are both `undefined` (or empty strings), emit the legacy shape (string for filter, 2-key object for rename). When either is set, emit the full object. This keeps YAML diffs small for users who only ever use `pattern + replacement`.

Add a unit-tested round-trip: legacy YAML → loaded model → saved → identical legacy YAML. New-features YAML → loaded → saved → identical new YAML. Mixed YAML (some steps legacy, some new) → loaded → saved → each step preserves its own shape.

## Files

### New

- `packages/web/src/components/RenameRegexField/RegexFieldHelpers.ts` — shared flag validation + slash-delimited display logic.
- `packages/web/src/components/RegexWithFlagsField/RegexWithFlagsField.tsx` — for `fileFilterRegex` and `folderFilterRegex`. Smaller sibling to `RenameRegexField`.
- `packages/web/src/components/RegexWithFlagsField/RegexWithFlagsField.test.tsx`
- `packages/web/src/components/RegexWithFlagsField/RegexWithFlagsField.stories.tsx`
- `packages/web/src/components/RegexWithFlagsField/RegexWithFlagsField.mdx`

### Modified

- `packages/server/src/api/schemas.ts` — bump regex schemas to objects with `flags` + `sample`, with `union + transform` for back-compat.
- `packages/server/src/app-commands/copyFiles.ts` — pass `flags` through every `new RegExp` site; pre-validate at handler start.
- `packages/server/src/app-commands/moveFiles.ts` — same.
- `packages/server/src/api/routes/commandRoutes.ts` — verify the schema's transform output reaches the handlers correctly; no changes expected if `union + transform` is set up right.
- `packages/web/src/jobs/yamlCodec.ts` — read promotion + write canonicalization for the regex fields.
- `packages/web/src/components/RenameRegexField/RenameRegexField.tsx` — extend from 2-input to 4-input + slash-form toggle + live-match preview.
- `packages/web/src/components/RenameRegexField/RenameRegexField.test.tsx` — coverage for flags, sample-driven preview, slash toggle.
- `packages/web/src/components/RenderFields/FieldDispatcher.tsx` — wire the new `regexWithFlags` case.
- `packages/web/src/commands/commands.ts` — `copyFiles` and `moveFiles` cards: flip `fileFilterRegex` / `folderFilterRegex` from `type: "string"` to `type: "regexWithFlags"`.
- `packages/web/public/command-descriptions.js` — note the new flags + sample fields.
- `docs/workers/MANIFEST.md` — flip to `in-progress` at start, `done` after PR merge.

### Pattern templates to mirror

- Read-time back-compat → [yamlCodec.ts](../../packages/web/src/jobs/yamlCodec.ts) — `legacyFieldRenames` map.
- Union + transform for schema back-compat → search the repo for existing `z.union([...]).transform(...)` if any; otherwise the standard Zod pattern is fine.
- Client-side live preview → no direct precedent in the repo; nearest analogue is `JsonField` which echoes structured input back inline.
- Slash-delimited regex display → none in repo yet; design from scratch but keep it a presentation overlay, not a storage format.

## TDD steps

1. **Schema test, back-compat**: existing fixtures with bare-string `fileFilterRegex` and 2-key `renameRegex` parse without error after the schema change. **FAILS** until union + transform lands.
2. **Schema test, new shape**: object-form fixtures with `flags: "i"` and `sample: "..."` parse and round-trip.
3. **Handler test, flags applied**: `copyFiles` with `fileFilterRegex: { pattern: "FOO", flags: "i" }` matches `foo.mkv`. **FAILS** until the handler passes flags through.
4. **Handler test, invalid flags fail fast**: `flags: "z"` (unknown flag) → command errors at start with a clear message naming the field and the offending flag char.
5. **Codec test, write canonicalization**: round-trip a step with only `pattern + replacement` (no flags, no sample) → output YAML uses the legacy 2-key shape (small diff).
6. **Codec test, write expansion**: round-trip a step with `flags: "i"` → output YAML uses the 4-key shape.
7. **Component test, flags input**: typing into the flags input updates `step.params.renameRegex.flags`.
8. **Component test, sample preview match**: setting `sample` to a string that matches the pattern → green "Match" badge + transformed output + captured groups listed.
9. **Component test, sample preview no-match**: setting `sample` to a non-matching string → red "No match" badge.
10. **Component test, slash-form toggle**: clicking the toggle flips presentation between "pattern + flags" two-field view and `/pattern/flags` single-field view; the underlying value is identical.
11. **Manual web smoke**: open the builder, drop a `copyFiles` step, paste a release filename into "Test against", confirm live match + capture-group breakdown updates as you edit the pattern.

## Verification checklist

- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Failing tests written first (schema back-compat, handler flag pass-through, codec round-trip, component preview)
- [ ] Schema: `flags` + `sample` everywhere with union + transform for back-compat
- [ ] Handler: `new RegExp(pattern, flags)` at every site; pre-validation at handler start
- [ ] Codec: legacy YAML round-trips unchanged; new YAML round-trips full
- [ ] `RenameRegexField` upgraded: flags input + sample tester + live preview + slash-form toggle
- [ ] `RegexWithFlagsField` component triple shipped for `fileFilterRegex` / `folderFilterRegex`
- [ ] Command cards updated to `type: "regexWithFlags"` for filters
- [ ] `command-descriptions.js` regenerated/updated
- [ ] Manual web smoke per TDD step 11
- [ ] Existing parity fixtures pass unmodified
- [ ] Standard pre-merge gate clean: `yarn lint → typecheck → test → e2e → lint`
- [ ] PR opened against `feat/mux-magic-revamp`
- [ ] Manifest row → `done`

## Out of scope

- **Conditional segments in replacement strings** (e.g. `${episodeName ? - $<episodeName>}`). Real need but requires an expression parser; defer until a release group with inconsistent presence actually shows up.
- **Server-side regex test endpoint**. Client-side preview using the browser's `RegExp` is sufficient for filename patterns and avoids a round-trip per keystroke.
- **History / saved-samples list**. The `sample` field is per-step, persisted in the template. If users want a library of test cases, that's a separate feature.
- **Regex highlighting / syntax coloring in the pattern input**. Nice-to-have; keep out of scope unless a small library already exists in the repo.
- **AniDB / TMDB / other id-aware match preview**. Filename-only; no metadata lookups.
- **Migrating the renameRegex out of `copyFiles` / `moveFiles`** in favor of the new standalone `renameFiles` command from worker 66. Leave both paths alive; deprecation (if ever) is a future worker.
