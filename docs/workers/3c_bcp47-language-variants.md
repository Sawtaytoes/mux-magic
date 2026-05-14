# Worker 3c — bcp47-language-variants

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/3c-bcp47-language-variants`
**Worktree:** `.claude/worktrees/3c_bcp47-language-variants/`
**Phase:** 4
**Depends on:** 08 (LanguageCodesField rebuild), 20 (CLI extract — schema location may have moved)
**Parallel with:** 28, 29, 2a, 2b, 2c, 2d, 38, 3b (no file overlap with any of them)

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Background

Some movies need locale-specific language tags the current system can't express. The two motivating cases are `zh-CN` (Simplified Chinese — Mainland) vs `zh-HK` (Traditional — Hong Kong); the same problem applies to `pt-BR` vs `pt-PT`, `en-GB` vs `en-US`, etc.

Switching from 3-letter (`chi`) to 2-letter (`zh`) does **not** solve this — both ISO 639-1 and ISO 639-2 are language-only standards. Regional/script differentiation lives in BCP 47 (RFC 5646), which sits on top of either: `zh-Hans-CN`, `zh-Hant-HK`, etc.

mkvmerge/mkvpropedit have supported BCP 47 since v60 (Dec 2021) via a parallel `language-ietf` track property that coexists with the legacy ISO 639-2 `language` property. **ffmpeg in this repo is not a language-arg boundary** — every active ffmpeg invocation uses index-based `-map` selectors, never language metadata flags. The only tools that consume language codes here are mkvmerge + mkvpropedit, both of which fully support BCP 47.

### Approach — Augment, not replace

Keep the ISO 639-2 3-letter code as the canonical "base language" and the comparison/filter key everywhere it's already used. Add an optional BCP 47 extension (`ietf` field) on top, surfaced only when the user picks a base language with known regional variants. Emit both to mkvtools.

**Why augment:**

- Existing string-equality checks (`track.properties.language === "und"`, `=== "eng"`, etc.) keep working — no coercion needed.
- mkvmerge's `--audio-tracks chi,eng` filter syntax in [replaceTracksMkvMerge.ts](../../packages/server/src/cli-spawn-operations/replaceTracksMkvMerge.ts) and [keepSpecifiedLanguageTracks.ts](../../packages/server/src/cli-spawn-operations/keepSpecifiedLanguageTracks.ts) needs a stable 3-letter key — preserved for free.
- Lookup sources (TVDB, AniDB, MAL) emit 2/3-letter codes — no inbound translation table required; `ietf` stays `null` for lookup-derived data.
- Existing stored project files stay valid (the `ietf` field is optional).
- Schema diff is additive — one optional field per language slot — instead of a sweeping rewrite of every `z.enum(iso6392LanguageCodes)` site.
- Mirrors how mkvmerge itself models the data (two parallel track properties).

### Why not enumerate all of BCP 47

BCP 47 is a grammar, not a finite enum: ~8,000 language subtags × ~250 region subtags × ~200 script subtags × variants. A curated `as const` array of ~25–40 entries covers all known media-workflow needs. If something outside the curated set ever surfaces, defer to a parser package (`bcp-47`); do not enumerate the full IANA registry up front.

## Your Mission

### Data model

A language slot becomes an object instead of a bare string:

```ts
type LanguageSelection = {
  code: Iso6392LanguageCode      // existing 3-letter — required, the canonical key
  ietf?: Bcp47VariantTag         // new — optional BCP 47 refinement
}
```

For UI/API compatibility, accept the legacy bare-string form on input via a Zod `z.union` and normalize to the object form internally. Existing payloads and stored state keep parsing without migration.

### Curated BCP 47 variant registry

New file: `packages/web/src/data/bcp47Variants.ts` — `as const` array of curated entries, keyed by base 3-letter code:

```ts
export const BCP47_VARIANTS = [
  { base: "chi", tag: "zh-Hans",        name: "Simplified" },
  { base: "chi", tag: "zh-Hant",        name: "Traditional" },
  { base: "chi", tag: "zh-Hans-CN",     name: "Simplified — China" },
  { base: "chi", tag: "zh-Hans-SG",     name: "Simplified — Singapore" },
  { base: "chi", tag: "zh-Hant-HK",     name: "Traditional — Hong Kong" },
  { base: "chi", tag: "zh-Hant-TW",     name: "Traditional — Taiwan" },
  { base: "chi", tag: "zh-Hant-MO",     name: "Traditional — Macau" },
  { base: "por", tag: "pt-BR",          name: "Brazil" },
  { base: "por", tag: "pt-PT",          name: "Portugal" },
  { base: "eng", tag: "en-US",          name: "United States" },
  { base: "eng", tag: "en-GB",          name: "United Kingdom" },
  { base: "eng", tag: "en-AU",          name: "Australia" },
  { base: "eng", tag: "en-CA",          name: "Canada" },
  { base: "spa", tag: "es-ES",          name: "Spain" },
  { base: "spa", tag: "es-MX",          name: "Mexico" },
  { base: "spa", tag: "es-419",         name: "Latin America" },
  { base: "fre", tag: "fr-FR",          name: "France" },
  { base: "fre", tag: "fr-CA",          name: "Canada" },
  { base: "ger", tag: "de-DE",          name: "Germany" },
  { base: "ger", tag: "de-AT",          name: "Austria" },
  { base: "ger", tag: "de-CH",          name: "Switzerland" },
  { base: "srp", tag: "sr-Cyrl",        name: "Cyrillic script" },
  { base: "srp", tag: "sr-Latn",        name: "Latin script" },
  // ~25-40 entries total — extend as media-specific needs surface
] as const

export type Bcp47VariantTag = (typeof BCP47_VARIANTS)[number]["tag"]
```

Mirror the file in `packages/server/src/tools/bcp47Variants.ts` (or export from `@mux-magic/tools` after worker 39 / 20 if that's already merged) so server-side Zod validates against the same list.

### Server changes

1. **New file:** `packages/server/src/tools/bcp47Variants.ts` (or shared export from `@mux-magic/tools`). Exports `BCP47_VARIANTS`, `bcp47VariantTags`, `Bcp47VariantTag`.

2. **[packages/server/src/api/schemas.ts](../../packages/server/src/api/schemas.ts)** — extend the three language-array slots (`audioLanguages`, `subtitlesLanguages`, `videoLanguages`):
   ```ts
   const languageSelectionSchema = z.union([
     z.enum(iso6392LanguageCodes),                    // legacy bare-string form
     z.object({
       code: z.enum(iso6392LanguageCodes),
       ietf: z.enum(bcp47VariantTags).optional(),
     }),
   ]).transform(normalizeLanguageSelection)            // → { code, ietf? }
   ```
   This keeps existing API clients working.

3. **[packages/server/src/cli-spawn-operations/updateTrackLanguage.ts](../../packages/server/src/cli-spawn-operations/updateTrackLanguage.ts)** — change the input type from `Iso6392LanguageCode` to `LanguageSelection`. Build args:
   ```ts
   const args = [
     "--edit", `track:@${trackId}`,
     "--set", `language=${selection.code}`,
     ...(selection.ietf ? ["--set", `language-ietf=${selection.ietf}`] : []),
   ]
   ```
   mkvpropedit accepts both properties. Setting `language-ietf` causes it to derive `language` automatically, but we set both explicitly so the file remains well-formed for older mkvtoolnix readers.

4. **[packages/server/src/cli-spawn-operations/replaceTrackById.ts](../../packages/server/src/cli-spawn-operations/replaceTrackById.ts)** — extend the `--language` flag construction at lines 35–38 to emit BCP 47 when present:
   ```ts
   "--language", `${trackId}:${selection.ietf ?? convertIso6391ToIso6392(selection.code)}`
   ```
   mkvmerge's `--language` accepts either form per track.

5. **[packages/server/src/cli-spawn-operations/defineLanguageForUndefinedTracks.ts](../../packages/server/src/cli-spawn-operations/defineLanguageForUndefinedTracks.ts)** — line 24 `=== "und"` stays as-is (we still write `language=…` for the legacy property; `"und"` is also a valid BCP 47 base). Line 33: emit both `language=` and (if present) `language-ietf=`.

6. **[packages/server/src/cli-spawn-operations/replaceTracksMkvMerge.ts](../../packages/server/src/cli-spawn-operations/replaceTracksMkvMerge.ts)** + **[packages/server/src/cli-spawn-operations/keepSpecifiedLanguageTracks.ts](../../packages/server/src/cli-spawn-operations/keepSpecifiedLanguageTracks.ts)** — `--audio-tracks` / `--subtitle-tracks` are *filter* flags, not language-setters. They keep using the 3-letter `code` (read from `selection.code` instead of the bare string). No semantic change.

7. **[packages/server/src/tools/getTrackLanguages.ts](../../packages/server/src/tools/getTrackLanguages.ts)** — when MediaInfo XML reports a `Language` field that's BCP 47 (contains `-`), populate `{ code: deriveBase(tag), ietf: tag }` instead of just `code`. Use a small `deriveBase` helper that strips region/script and maps the leading 2-letter via the existing [convertIso6391ToIso6392.ts](../../packages/server/src/tools/convertIso6391ToIso6392.ts).

8. **[packages/server/src/api/types.ts](../../packages/server/src/api/types.ts)** — surface `LanguageSelection` type for downstream consumers.

### Web changes

9. **New file:** `packages/web/src/data/bcp47Variants.ts` (see Data model section).

10. **[packages/web/src/components/LanguageCodeField/LanguageCodeField.tsx](../../packages/web/src/components/LanguageCodeField/LanguageCodeField.tsx)** — accept and emit `LanguageSelection`. Render the existing dropdown for `code` unchanged, plus a sibling `<RegionVariantField>` that appears **only** when `code` has entries in `BCP47_VARIANTS`. Default state: dropdown empty = no `ietf` set.

11. **New:** `packages/web/src/components/LanguageCodeField/RegionVariantField.tsx` — small select component. Options: `(none)` + filtered `BCP47_VARIANTS.filter(v => v.base === currentCode)`. Display format: `Simplified — China (zh-Hans-CN)`.

12. **[packages/web/src/components/LanguageCodesField/LanguageCodesField.tsx](../../packages/web/src/components/LanguageCodesField/LanguageCodesField.tsx)** — multi-select variant. Each row gets the same `code + ietf` shape. Display in the chip/pill as `chi · zh-Hant-HK` so the refinement is visible at a glance. Builds on worker 08's tagify autocomplete.

13. **[packages/web/src/components/NumberWithLookupField/NumberWithLookupField.tsx](../../packages/web/src/components/NumberWithLookupField/NumberWithLookupField.tsx)** and **[packages/web/src/components/LookupSearchStage/LookupSearchStage.tsx](../../packages/web/src/components/LookupSearchStage/LookupSearchStage.tsx)** — both touch language during lookup flow. Audit and update where they read/write the language slot to use the new shape. The bare-string legacy form is still accepted by the Zod union.

14. **[packages/web/src/components/LookupModal/types.ts](../../packages/web/src/components/LookupModal/types.ts)** — if any language fields exist on `LookupSearchResult`, widen to `LanguageSelection`.

15. **[packages/web/src/data/orderLanguageOptions.ts](../../packages/web/src/data/orderLanguageOptions.ts)** — no change required. Operates on the base 3-letter list and remains the source for the primary dropdown.

### UI design — Secondary Region/Variant field

When the user picks a base language with no curated variants (e.g. `jpn`), nothing extra renders — the form looks exactly like today. When they pick `chi`, `por`, `eng`, `spa`, `fre`, `ger`, or `srp`, a small secondary select appears below the primary picker with `(none)` as the default first option.

```
Language: [ Chinese (chi)               ▼ ]
Variant : [ (none)                       ▼ ]
          ├─ (none)
          ├─ Simplified (zh-Hans)
          ├─ Simplified — China (zh-Hans-CN)
          ├─ Simplified — Singapore (zh-Hans-SG)
          ├─ Traditional (zh-Hant)
          ├─ Traditional — Hong Kong (zh-Hant-HK)
          ├─ Traditional — Taiwan (zh-Hant-TW)
          └─ Traditional — Macau (zh-Hant-MO)
```

The variant field clears whenever the base language changes (so picking `chi` → `por` after having `zh-Hant-HK` selected resets variant to `(none)`).

### Reuse / do NOT duplicate

- `convertIso6391ToIso6392` at [packages/server/src/tools/convertIso6391ToIso6392.ts](../../packages/server/src/tools/convertIso6391ToIso6392.ts) — reuse for `deriveBase` when parsing a `zh-…` tag back to `chi`.
- `ISO_639_2_LANGUAGES` at [packages/web/src/data/iso639-2.ts](../../packages/web/src/data/iso639-2.ts) — remains the primary registry.
- `buildOrderedLanguageOptions` at [packages/web/src/data/orderLanguageOptions.ts](../../packages/web/src/data/orderLanguageOptions.ts) — reused as-is for the base dropdown.
- Worker 08's tagify autocomplete in `LanguageCodesField` — the multi-select tag rendering and filter logic stays; only the chip shape and emitted value change.

## TDD steps

1. **Write failing tests** (commit `test(bcp47-language): failing tests for variant field + schema union`):
   - `deriveBase` helper: `zh-Hant-HK` → `chi`, `pt-BR` → `por`, `en` → `eng`, unknown → fall-through to existing 6391→6392.
   - Zod schema test: feed both `"eng"` (bare string) and `{ code: "chi", ietf: "zh-Hant-HK" }` to the union; both parse and normalize to the object form.
   - `RegionVariantField`: renders nothing for `jpn`, renders 7 options for `chi`, resets to `(none)` when base changes.
2. Add the curated `bcp47Variants.ts` to web + server.
3. Wire the Zod union + transform; surface the `LanguageSelection` type.
4. Update the four mkvtools spawn-operations files.
5. Update `getTrackLanguages.ts` for inbound BCP 47 parsing.
6. Implement `RegionVariantField`; wire it into `LanguageCodeField` + `LanguageCodesField`.
7. Audit lookup-flow call sites; widen the language slot wherever it's stored.
8. Verify all tests pass; run the full gate.

## Files

### New
- `packages/web/src/data/bcp47Variants.ts`
- `packages/server/src/tools/bcp47Variants.ts` (or single source from `@mux-magic/tools`)
- `packages/web/src/components/LanguageCodeField/RegionVariantField.tsx`
- Tests + stories for all of the above

### Modified
- [packages/server/src/api/schemas.ts](../../packages/server/src/api/schemas.ts)
- [packages/server/src/api/types.ts](../../packages/server/src/api/types.ts)
- [packages/server/src/cli-spawn-operations/updateTrackLanguage.ts](../../packages/server/src/cli-spawn-operations/updateTrackLanguage.ts)
- [packages/server/src/cli-spawn-operations/replaceTrackById.ts](../../packages/server/src/cli-spawn-operations/replaceTrackById.ts)
- [packages/server/src/cli-spawn-operations/defineLanguageForUndefinedTracks.ts](../../packages/server/src/cli-spawn-operations/defineLanguageForUndefinedTracks.ts)
- [packages/server/src/cli-spawn-operations/replaceTracksMkvMerge.ts](../../packages/server/src/cli-spawn-operations/replaceTracksMkvMerge.ts)
- [packages/server/src/cli-spawn-operations/keepSpecifiedLanguageTracks.ts](../../packages/server/src/cli-spawn-operations/keepSpecifiedLanguageTracks.ts)
- [packages/server/src/tools/getTrackLanguages.ts](../../packages/server/src/tools/getTrackLanguages.ts)
- [packages/web/src/components/LanguageCodeField/LanguageCodeField.tsx](../../packages/web/src/components/LanguageCodeField/LanguageCodeField.tsx)
- [packages/web/src/components/LanguageCodesField/LanguageCodesField.tsx](../../packages/web/src/components/LanguageCodesField/LanguageCodesField.tsx)
- [packages/web/src/components/NumberWithLookupField/NumberWithLookupField.tsx](../../packages/web/src/components/NumberWithLookupField/NumberWithLookupField.tsx)
- [packages/web/src/components/LookupSearchStage/LookupSearchStage.tsx](../../packages/web/src/components/LookupSearchStage/LookupSearchStage.tsx)
- [packages/web/src/components/LookupModal/types.ts](../../packages/web/src/components/LookupModal/types.ts)

## Verification checklist

- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Failing tests committed first
- [ ] `deriveBase` round-trips known BCP 47 tags
- [ ] Zod union accepts both legacy bare strings and the new object form
- [ ] mkvpropedit output sets BOTH `language` and `language-ietf` when `ietf` is present (verify with `mkvmerge -i --identification-format json output.mkv` — track has `language: "chi"` and `language_ietf: "zh-Hant-HK"`)
- [ ] `--audio-tracks chi` filter still works on a file that has only `chi` audio (didn't break the comparison key)
- [ ] Non-variant language (`jpn`) round-trips with no `language-ietf` set
- [ ] UI: picking `Japanese` shows no variant field; picking `Chinese` shows the 7-option variant field; changing base resets variant to `(none)`
- [ ] Previously-saved project state (legacy bare-string form) loads, renders, and round-trips without forcing an `ietf` value
- [ ] TVDB / AniDB lookup result flows through as `{ code: "eng" }` with no false-positive `ietf` attached
- [ ] Standard gates clean
- [ ] PR opened against `feat/mux-magic-revamp`
- [ ] Manifest row → `done`

## Out of scope

- Full IANA registry validation (`bcp-47` / `language-tags` npm package). Defer until a movie actually needs a tag outside the curated set.
- Free-text custom BCP 47 input. Curated dropdown only.
- ffmpeg language-metadata flags (not used in this repo today).
- Migrating stored project files (legacy form keeps working via Zod `z.union`).
- Adding the `language-ietf` property to extracted-subtitle filenames (worker 3b's domain — coordinate if 3b lands first).
