# Worker 7a — smartmatch-plex-suffix-selector

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/7a-smartmatch-plex-suffix-selector`
**Worktree:** `.claude/worktrees/7a_smartmatch-plex-suffix-selector/`
**Phase:** 3 (NSF interactive flow)
**Depends on:** 58 (SmartMatchModal exists), 6f (custom-name edit exists — per-row state shape is settled)
**Parallel with:** workers that don't touch `packages/web/src/components/SmartMatchModal/`

---

## Universal Rules (TL;DR)

Worktree-isolated. Yarn only. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. See [AGENTS.md](../../AGENTS.md).

---

## Context

The v1.0.0 legacy `specials-mapping-modal.js` included a per-row Plex extra-type suffix `<select>` dropdown beneath the candidate name picker. The dropdown listed nine Plex extra types (`— no type —`, `Trailer`, `Featurette`, `Interview`, `Behind the Scenes`, `Scene`, `Deleted Scene`, `Short`, `Other`) with matching URL-slug suffixes (`-trailer`, `-featurette`, `-interview`, `-behindthescenes`, `-scene`, `-deleted`, `-short`, `-other`).

Worker 58 Part B ported the core SmartMatchModal but explicitly deferred the Plex-suffix selector. This deferral is documented in `packages/web/src/components/SmartMatchModal/SmartMatchModal.mdx` line 12: "The Plex-suffix selector remains deferred to a follow-up worker."

Worker 6f added the per-row ✏ custom-name edit and settled the row state shape. This worker adds the Plex suffix selector on top of that settled shape.

**Why this matters:** Users who use Plex's extras system need filenames ending in Plex-recognized suffixes (e.g. `Commentary with Director -featurette`) for Plex to correctly type and display the extra. Without the suffix picker, the user must rename files by hand after Apply or know to type the suffix into the ✏ edit field — neither is obvious.

---

## Your Mission

Add the Plex extra-type suffix selector to each row in `SmartMatchModal`. The final rename target is `<base name> <suffix>` where suffix is the selected Plex type slug (empty string = no suffix = no change from base name).

### Behavior spec

1. **Suffix row placement:** Below the candidate picker / custom-name input, show a secondary row with a compact `<select>` labeled "Plex type:" listing the nine options. The suffix row is hidden when no candidate is selected AND the custom-name input is empty (the row would affect nothing). Show it as soon as a candidate name exists (either via picker or custom-name).

2. **Pre-selection:** On row render, call `extractSuffixFromStem(filename)` to read back any existing Plex suffix from the current filename. Pre-select that option so re-running NSF on already-named files keeps the existing suffix type. Fall back to `inferSuffixFromName(candidateName)` (keyword heuristic) when no suffix is found in the current filename.

3. **Apply behavior:** The final rename target for each row is:
   - If suffix is `''` (no type): `<base name>` (unchanged from the picker/custom value)
   - If suffix is non-empty: `<base name> <suffix>` (e.g. `Commentary with Director -featurette`)

4. **State:** Add `plexSuffix: string` to the `SmartMatchRow` type in `smartMatchTypes.ts`. The field is independent from `selectedCandidateName` and `customName` — the user can combine any of the three.

### Nine Plex extra types

```ts
export const PLEX_EXTRA_TYPES = [
  { suffix: '', label: '— no type —' },
  { suffix: '-trailer', label: 'Trailer' },
  { suffix: '-featurette', label: 'Featurette' },
  { suffix: '-interview', label: 'Interview' },
  { suffix: '-behindthescenes', label: 'Behind the Scenes' },
  { suffix: '-scene', label: 'Scene' },
  { suffix: '-deleted', label: 'Deleted Scene' },
  { suffix: '-short', label: 'Short' },
  { suffix: '-other', label: 'Other' },
] as const
```

### Helpers (pure, test these)

```ts
// Extract the Plex suffix from an existing filename stem, or '' if none.
// Checks the nine known suffixes by trying .endsWith() on the lowercased stem.
export const extractSuffixFromStem = (stem: string): string => { ... }

// Keyword-match a candidate name to infer a Plex suffix.
export const inferSuffixFromName = (name: string): string => { ... }
```

Place both helpers in `packages/web/src/components/SmartMatchModal/plexExtraTypes.ts` (new file) alongside the `PLEX_EXTRA_TYPES` constant.

---

## Files

### New

- `packages/web/src/components/SmartMatchModal/plexExtraTypes.ts` — `PLEX_EXTRA_TYPES` array, `extractSuffixFromStem`, `inferSuffixFromName`.
- `packages/web/src/components/SmartMatchModal/plexExtraTypes.test.ts` — unit tests for the two helpers.

### Modified

- `packages/web/src/components/SmartMatchModal/smartMatchTypes.ts` — add `plexSuffix: string` to `SmartMatchRow`.
- `packages/web/src/components/SmartMatchModal/SmartMatchModal.tsx` — initialize `plexSuffix` on row creation (via `extractSuffixFromStem` + `inferSuffixFromName`), render suffix `<select>` below each row's picker, wire change handler, compute final rename target in `buildRenameTarget(row)` as `suffix ? \`${base} ${suffix}\` : base`.
- `packages/web/src/components/SmartMatchModal/SmartMatchModal.test.tsx` — add: (a) suffix `<select>` renders for each row; (b) changing the suffix updates the row's `plexSuffix`; (c) Apply uses the suffix in the POST body's `newPath`.
- `packages/web/src/components/SmartMatchModal/SmartMatchModal.stories.tsx` — add a `PlexSuffixPreSelected` story that opens the modal with the first row pre-filled with `-featurette` to make the new UI reviewable.
- `packages/web/src/components/SmartMatchModal/SmartMatchModal.mdx` — add "Per-row Plex suffix" section; remove the "remains deferred" note.
- `docs/workers/MANIFEST.md` — flip to `in-progress` at start, `done` after PR merge.

---

## TDD steps

1. `extractSuffixFromStem` returns `'-featurette'` for `'Commentary - The Making of the Film-featurette'`; returns `''` for `'Behind the Scenes'` (the label, not the slug); returns `'-behindthescenes'` for `'some-file-name-behindthescenes'`.
2. `inferSuffixFromName` returns `'-trailer'` for `'Theatrical Trailer'`; `'-interview'` for `'Cast Interview'`; `'-behindthescenes'` for `'Behind the Scenes'`; `'-other'` for `'Shrek Shorts'`.
3. `SmartMatchModal` — suffix `<select>` is in the document for each row.
4. `SmartMatchModal` — changing the suffix `<select>` to `-deleted` updates the row's `plexSuffix` to `'-deleted'`.
5. `SmartMatchModal` — Apply POSTs `/files/rename` with `newPath` = `<base> -featurette` when suffix is `-featurette` and row is checked.
6. `SmartMatchModal` — Apply POSTs `/files/rename` with `newPath` = `<base>` (no suffix) when suffix is `''`.
7. `SmartMatchModal` — suffix `<select>` is hidden when `selectedCandidateName` is `''` and `customName` is `''`; shown when either has a value.
8. `SmartMatchModal` — re-opening the modal with a filename that already has `-featurette` pre-selects `Featurette` in the suffix `<select>`.

---

## Verification checklist

- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Failing tests written first
- [ ] `plexExtraTypes.ts` has `PLEX_EXTRA_TYPES`, `extractSuffixFromStem`, `inferSuffixFromName`
- [ ] `plexExtraTypes.test.ts` covers all cases in TDD steps 1–2
- [ ] `SmartMatchRow.plexSuffix` field exists in `smartMatchTypes.ts`
- [ ] Suffix `<select>` renders per-row with the nine options
- [ ] Suffix auto-pre-selected from filename; inferred from candidate name as fallback
- [ ] Apply computes `base + suffix` correctly
- [ ] Suffix row hidden when no name is selected
- [ ] New Storybook story `PlexSuffixPreSelected` exists
- [ ] MDX updated; "remains deferred" note removed
- [ ] Standard pre-merge gate clean: `yarn lint → typecheck → test → e2e → lint`
- [ ] PR opened against `feat/mux-magic-revamp`
- [ ] Manifest row → `done`

---

## Out of scope

- **"Save manual name back as candidate"** — not in v1.0.0 behavior; separate worker if ever needed.
- **Server-side suffix validation** — the suffix is appended client-side before POST; the server's rename endpoint does not need to know about Plex types.
- **New Plex extra types** — Plex's list has not changed since v1.0.0. If Plex adds types, that's a separate maintenance PR.
