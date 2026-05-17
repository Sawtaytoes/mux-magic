# Worker 62 — scale-resolution-scales-style-fields

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/62-scale-resolution-scales-style-fields`
**Worktree:** `.claude/worktrees/62_scale-resolution-scales-style-fields/`
**Phase:** 5
**Depends on:** 01
**Parallel with:** any Phase 5 worker that does not touch [packages/server/src/tools/applyAssRules.ts](../../packages/server/src/tools/applyAssRules.ts), [packages/server/src/tools/assTypes.ts](../../packages/server/src/tools/assTypes.ts), [packages/server/src/api/schemas.ts](../../packages/server/src/api/schemas.ts) (`scaleResolutionRuleSchema`), or [docs/dsl/subtitle-rules.md](../../docs/dsl/subtitle-rules.md).

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Context

The `scaleResolution` rule is documented to "rescale `PlayResX`/`PlayResY` and **proportionally rewrite every style's font sizes, margins, outline, shadow**" ([docs/dsl/subtitle-rules.md:118](../../docs/dsl/subtitle-rules.md#L118)). The implementation in [applyAssRules.ts:565-664](../../packages/server/src/tools/applyAssRules.ts#L565-L664) does **not** do that — it only rewrites `[Script Info]` keys (`PlayResX`, `PlayResY`, `LayoutResX`, `LayoutResY`, `ScaledBorderAndShadow`) and leaves every `[V4+ Styles]` row untouched.

The visible failure mode: a user authoring at 1920×1080 with `MarginV: 90` rescales the file to 640×360 expecting `MarginV` to become `30` (the same 8.3% top/bottom gutter); instead `MarginV` stays at `90`, which is now 25% of the 360-tall canvas. Same problem for `Fontsize`, `Outline`, `Shadow`, `MarginL`, `MarginR`, and `Spacing` — the numeric value is in script-coordinate units, the coordinate space just shrank, but the value didn't track.

ScaledBorderAndShadow doesn't save us here. That flag controls how libass renders border/shadow when the script's PlayRes differs from the **playback** resolution. When we ourselves rewrite the script's PlayRes, the per-style numerics need to move with it.

This worker brings the implementation in line with the docs. After this lands, the same `scaleResolution: from 1920×1080 to 640×360` produces correctly-scaled style rows in one atomic operation.

## Your Mission

Extend `applyScaleResolution` to also scale every non-protected style row's numeric fields by the same `to/from` ratio it applies to `PlayResX/Y`. Add a `ignoredStyleNamesRegexString` field to `ScaleResolutionRule` so signs/songs styles can opt out, mirroring `setStyleFields`.

## Scaling rules

Per style row, scale these fields. Round to nearest integer. Leave non-numeric/missing values alone (no coercion, no insertion).

| Field | Ratio | Notes |
|---|---|---|
| `Fontsize` | `heightRatio` (= `to.height / from.height`) | Vertical type-size convention. |
| `Outline` | `heightRatio` | Border thickness scales with vertical script size. |
| `Shadow` | `heightRatio` | Same. |
| `MarginV` | `heightRatio` | Vertical margin. |
| `MarginL` | `widthRatio` (= `to.width / from.width`) | Horizontal margin. |
| `MarginR` | `widthRatio` | Horizontal margin. |
| `Spacing` | `widthRatio` | Letter spacing is horizontal. |

Do **not** scale: `ScaleX`, `ScaleY` (they're percentages, already resolution-independent), `Angle`, `Alignment`, `BorderStyle`, `Encoding`, `Bold`, `Italic`, `Underline`, `StrikeOut`, or any colour field. Don't touch `Name` or `Fontname` strings either.

If `from` is omitted on the rule (today that means "skip per-file resolution guard"), derive the ratio from the file's *current* `PlayResX`/`PlayResY` to `to.width`/`to.height` — that's the only sensible behavior when the source resolution isn't declared.

## Style protection

Add `ignoredStyleNamesRegexString?: string` to `ScaleResolutionRule` ([assTypes.ts:136-144](../../packages/server/src/tools/assTypes.ts#L136-L144)). Semantics match `setStyleFields`: case-insensitive regex; styles whose `Name` field matches are left entirely unmodified. Default behavior when the field is omitted: scale every style (no protection).

Do **not** hardcode the regex string at the engine level; that's a default-rules concern and lives in [buildDefaultSubtitleModificationRules.ts](../../packages/server/src/tools/buildDefaultSubtitleModificationRules.ts). The engine just honors whatever the rule carries.

## Per-Dialogue-line margins

Out of scope. The `[Events]` section is not touched by any current rule, and the Dialogue-line `MarginL`/`MarginR`/`MarginV` columns (8th/9th/10th fields, where `0` means "use the style default") are part of that section. Adding `[Events]` write support is a separate worker. Document the gap in [subtitle-coverage.md](../../docs/dsl/subtitle-coverage.md).

## Inline override tags

Also out of scope. Tags inside `{...}` blocks in Dialogue text (`\pos(x,y)`, `\fs35`, `\bord0`, `\fad`, etc.) carry numeric values in script-coordinate units that should arguably scale alongside PlayRes, but parsing and rewriting them requires a structured ASS-text walker that doesn't exist in the codebase today. Document this as a known limitation in [subtitle-coverage.md](../../docs/dsl/subtitle-coverage.md) under "When the DSL isn't enough" — users with `\pos`-positioned signs need either manual re-typesetting or a custom TS command after this rule runs.

## Schema work

In [packages/server/src/api/schemas.ts](../../packages/server/src/api/schemas.ts):

- Add `ignoredStyleNamesRegexString: z.string().optional()` to `scaleResolutionRuleSchema`.
- Keep the existing `from`/`to`/`hasLayoutRes`/`hasScaledBorderAndShadow`/`isLayoutResSynced`/`when` shape.

The web builder ([packages/web/src/components/DslRulesBuilder/RuleCard.tsx](../../packages/web/src/components/DslRulesBuilder/RuleCard.tsx)) currently renders only the resolution and flag fields for `scaleResolution`. Add the regex-string text field — copy the same control `setStyleFields` uses for its `ignoredStyleNamesRegexString` field (the controls live side by side, so the parallel is obvious). Story coverage in `DslRulesBuilder.stories.tsx` and matching assertions in `DslRulesBuilder.test.tsx`.

## Engine changes (`applyAssRules.ts`)

In `applyScaleResolution`:

1. Compute `widthRatio` and `heightRatio` once at the top, after the per-file `from:` guard has decided the file qualifies.
2. After the existing `[Script Info]` rewrites, walk every `[V4+ Styles]` section's Style entries. For each entry whose `Name` doesn't match the (optional) `ignoredStyleNamesRegex`, build a `computedFields` object that mirrors `applySetStyleFields`'s structure — except the field values come from `Math.round(currentValue * ratio)` per the table above.
3. Skip the field entirely if the current value isn't a finite number (`Number(currentValue)` → `NaN`). Don't write `"0"` over a non-numeric value; don't write `"NaN"`.
4. Return the new `AssFile` immutably (no mutation — match the rest of the engine's functional style).

Factor a small `scaleStyleRow({ entry, widthRatio, heightRatio })` helper if it keeps `applyScaleResolution` readable; otherwise inline.

## Default-rules interaction

After this lands, the default-rules behavior shifts subtly in the user's favor:

- Today, defaults set `MarginV` based on the **pre-scale** `PlayResY` because defaults run before `scaleResolution`. So a 1080→360 downscale leaves `MarginV=90` stuck at 90.
- After this worker, defaults still set `MarginV=90` at the 1080 stage, but then `scaleResolution` scales every style — including the freshly-defaulted `MarginV` — down to 30. Net effect matches user intuition.

Verify this end-to-end in an integration test (see Tests below). No changes to `buildDefaultSubtitleModificationRules.ts` are required for this worker.

## Docs

Update [docs/dsl/subtitle-rules.md](../../docs/dsl/subtitle-rules.md) `### scaleResolution` section:

- The claim "proportionally rewrites every style's font sizes, margins, outline, shadow" is now true — leave the prose, but expand the field table to enumerate exactly which fields scale by `widthRatio` vs `heightRatio`.
- Add the new `ignoredStyleNamesRegexString` field row.
- Add a note that `[Events]` Dialogue-line margins and inline override tags are NOT scaled, with a pointer to [subtitle-coverage.md](../../docs/dsl/subtitle-coverage.md).

Update [docs/dsl/subtitle-coverage.md](../../docs/dsl/subtitle-coverage.md) to add `[Events]` per-line margins and inline override tag args (`\pos`, `\fs`, `\bord`, etc.) to the "When the DSL isn't enough" list, since users running `scaleResolution` on files with hand-typeset signs will hit this.

## Tests (per test-coverage discipline)

In [packages/server/src/tools/assFileTools.test.ts](../../packages/server/src/tools/assFileTools.test.ts) (or a sibling test file alongside `applyAssRules.ts` if cleaner — match repo convention):

- **Style-field scaling math:** 1080→360 file with `Fontsize=24`, `Outline=2`, `Shadow=1`, `MarginV=90`, `MarginL=200`, `MarginR=200`, `Spacing=0` → after scale: `Fontsize=8`, `Outline=1` (Math.round(2/3) = 1), `Shadow=0` (Math.round(1/3) = 0), `MarginV=30`, `MarginL=67`, `MarginR=67`, `Spacing=0`. Assert each field individually.
- **Asymmetric ratios:** non-uniform scale (e.g. 1920×1080 → 1280×720, so widthRatio=2/3, heightRatio=2/3 — pick a case where the ratios differ, e.g. 1920×1080 → 1280×1080 widthRatio=2/3, heightRatio=1) so width-axis vs height-axis fields produce different scaled values.
- **`from:` guard:** file whose `PlayResX/Y` doesn't match `from` is untouched — styles AND scriptInfo both pristine.
- **`from:` omitted:** file with `PlayResX=1920`, `PlayResY=1080`, rule `to: { width: 640, height: 360 }` and no `from:` → styles scale based on current PlayRes.
- **Non-numeric values left alone:** a style row with `Fontsize="auto"` (synthetic bad input) → field stays `"auto"`, no `"NaN"` written.
- **`ignoredStyleNamesRegexString` honored:** anchored regex `"^(signs?|op\\d*|ed\\d*|opening|ending)$"` against styles named `Sign`, `OP`, `OP1`, `Default`, `top`, `overlap` → only `Sign`, `OP`, `OP1` are protected; `top` and `overlap` get scaled.
- **`ignoredStyleNamesRegexString` omitted:** every style gets scaled.
- **Immutability:** input `assFile` reference is not mutated; result is a new object with all changed sections/entries replaced.
- **Integration with defaults:** end-to-end test running through `applyAssRules` with `hasDefaultRules`-equivalent rules ahead of `scaleResolution` — confirm that a default-set `MarginV=90` gets scaled to `30` after the scale rule fires. Document the rule-order dependency as the test's name (e.g. `scaleResolution scales style fields set by earlier rules`).

## TDD steps

1. **Red — math tests.** Commit `test(server): failing tests for scaleResolution style-field scaling`.
2. **Green — extend `applyScaleResolution`** with the style-row walker; non-numeric guard; ratio table.
3. **Red — regex protection test.** Commit `test(server): scaleResolution honors ignoredStyleNamesRegexString`.
4. **Green — wire the regex option through the type + schema + engine.**
5. **Red — `from`-omitted, asymmetric-ratio, and immutability tests.** Commit.
6. **Green — fill any gaps surfaced by those tests.**
7. **Red — integration test asserting defaults+scaleResolution composition.** Commit.
8. **Green — verify the integration test passes (no engine change should be needed if step 2 was correct).**
9. **Docs pass:** update `subtitle-rules.md` and `subtitle-coverage.md`. Builder UI changes + story + test for the new field.

## Definition of done

- [ ] All TDD steps land as red-then-green commit pairs
- [ ] `applyScaleResolution` scales every documented style field by the documented ratio
- [ ] `ScaleResolutionRule` type + zod schema include `ignoredStyleNamesRegexString` (optional)
- [ ] Web builder renders + round-trips the new field (story, test, parity fixture if there is one for this rule)
- [ ] [docs/dsl/subtitle-rules.md](../../docs/dsl/subtitle-rules.md) `scaleResolution` table reflects per-field axis + new regex field
- [ ] [docs/dsl/subtitle-coverage.md](../../docs/dsl/subtitle-coverage.md) lists `[Events]` per-line margins and inline override tag args as out-of-scope for the DSL
- [ ] Manual smoke: take a real 1920×1080 fansub `.ass`, run `scaleResolution: 1920×1080 → 640×360` (no other rules), confirm `MarginV` 90→30, `MarginL/R` 200→67, `Fontsize` 24→8 across non-protected styles
- [ ] Manual smoke: same file with `hasDefaultRules: true` + `scaleResolution` afterwards — confirm defaults' `MarginV=90` ends up as `30` in the output, no manual override rule needed
- [ ] Standard gate clean (`lint → typecheck → test → e2e → lint`)
- [ ] PR opened against `feat/mux-magic-revamp`
- [ ] [docs/workers/MANIFEST.md](MANIFEST.md) row updated to `done`

## Out of scope (deferred to future workers)

- Rewriting per-Dialogue-line `MarginL`/`MarginR`/`MarginV` columns when non-zero — requires `[Events]` write support.
- Rewriting numeric args inside inline `{...}` override tags in Dialogue text (`\pos(x,y)`, `\fs`, `\bord`, `\shad`, `\fad`, `\move`, `\fsp`, etc.) — requires a structured override-tag parser.
- Fixing the unanchored `signs?|op|ed|opening|ending` regex in `buildDefaultSubtitleModificationRules.ts` (separate worker — small change, but worth its own commit so the regex fix doesn't get tangled with the engine change).
- Making `applyAssRules`'s `fileMetadata` snapshot reactive so subsequent `computeFrom` rules see post-`scaleResolution` `PlayResX/Y` (separate worker — touches `applyAssRules`'s reduce shape, not the same blast radius).
