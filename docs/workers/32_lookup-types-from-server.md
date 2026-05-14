# Worker 32 — lookup-types-from-server

**Status:** ✅ **done** — shipped in PR #104 (commit `9f5339cc`, merged into `feat/mux-magic-revamp`). See [Outcome](#outcome) below for what landed vs. what this prompt originally specified.

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `worker/32-lookup-types-from-server`
**Worktree:** `.claude/worktrees/32_lookup-types-from-server/`
**Phase:** 2 (CLI extraction window — placed here for scheduling, not because it depends on the CLI restructure)
**Depends on:** 01 (rebrand), 06 (webtypes-eslint-guard)
**Parallel with:** any worker that doesn't touch [packages/server/src/api/types.ts](../../packages/server/src/api/types.ts), [schemas.ts](../../packages/server/src/api/schemas.ts), or any file under [packages/web/src/components/LookupModal/](../../packages/web/src/components/LookupModal/) / [LookupSearchStage/](../../packages/web/src/components/LookupSearchStage/) / [LookupVariantStage/](../../packages/web/src/components/LookupVariantStage/) / [LookupReleaseStage/](../../packages/web/src/components/LookupReleaseStage/) / [NumberWithLookupField/](../../packages/web/src/components/NumberWithLookupField/).

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Tests must cover the change scope. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Your Mission

[packages/web/src/components/LookupModal/types.ts](../../packages/web/src/components/LookupModal/types.ts) currently declares its own normalized search-result shape and a `LookupType` enum, with an `eslint-disable-next-line no-restricted-syntax` bypassing the [webtypes-eslint-guard](06_webtypes-eslint-guard.md) rule worker 06 installed:

```ts
export type LookupType = "mal" | "anidb" | "tvdb" | "tmdb" | "dvdcompare"

// eslint-disable-next-line no-restricted-syntax -- web-only normalized search result; not in server/api-types (server emits per-provider types)
export type LookupSearchResult = {
  malId?: number
  aid?: number
  tvdbId?: number
  movieDbId?: number
  name?: string
  nameJapanese?: string
  title?: string
  year?: string
}
```

The disable comment is the audit trail for a deliberate workaround: the server emits *per-provider* response types (`SearchMalResponse`, `SearchAnidbResponse`, …) and the web flattens them into a single union shape for the picker. That worked because the union was small, but the recent lookup-overhaul commit (`863d4a87`) made the picker render `nameJapanese` and the per-provider response items now diverge enough that the flattened web type is drifting from what the server actually emits — a silent contract slip the eslint guard exists precisely to prevent.

**Goal:** delete the disable, delete the web-declared shapes that duplicate server types, and have the web import canonical types from `@mux-magic/server` (or wherever Phase 2 ends up putting shared types).

Three concrete deliverables:

1. **Server-side canonical union type** `LookupSearchResult` exported from [packages/server/src/api/types.ts](../../packages/server/src/api/types.ts), defined as the discriminated union of per-provider result-item types.
2. **`LookupType` extracted on the server**, sourced from the existing `Lookup*Request` schemas (each already carries the provider key).
3. **Web side** ([LookupModal/types.ts](../../packages/web/src/components/LookupModal/types.ts)) imports both, deletes its local copies + the `eslint-disable` comment.

`LookupVariant` / `LookupGroup` / `LookupRelease` are also data shapes the server originates (DVDCompare's grouped-variant-and-release model); promote those to top-level exports too if not already, and migrate the web to import them.

## What stays web-only

Do **not** move `LookupState` or `LookupStage` to the server. `LookupState` is the picker's runtime state machine — `stage`, `searchTerm`, `searchError`, `isLoading`, `companionNameField`, etc. — and `LookupStage = "search" | "variant" | "release"` is the state-machine cursor. Those are UI concerns and stay in [LookupModal/types.ts](../../packages/web/src/components/LookupModal/types.ts). The migration target for this worker is *data shapes* only.

## Background — current shape

### Web (current)

[packages/web/src/components/LookupModal/types.ts](../../packages/web/src/components/LookupModal/types.ts) — 69 lines, used by:
- `LookupModal.tsx` / `.stories.tsx`
- `LookupSearchStage` / `LookupVariantStage` / `LookupReleaseStage`
- `NumberWithLookupField.tsx`
- `runReverseLookup.ts`
- `lookupModalAtom.ts`

Local types this worker eliminates from the web:
- `LookupType` (line 8)
- `LookupSearchResult` (line 18) — has the eslint-disable
- `LookupVariant` (line 31)
- `LookupGroup` (line 36)
- `LookupRelease` (line 42)

Stays:
- `LookupStage`
- `LookupState`

### Server (current)

[packages/server/src/api/types.ts](../../packages/server/src/api/types.ts) — already exports per-provider response types as `z.infer` of the corresponding schemas:

```ts
export type SearchMalResponse        = z.infer<typeof schemas.searchMalResponseSchema>
export type SearchAnidbResponse      = z.infer<typeof schemas.searchAnidbResponseSchema>
export type SearchTvdbResponse       = z.infer<typeof schemas.searchTvdbResponseSchema>
export type SearchMovieDbResponse    = z.infer<typeof schemas.searchMovieDbResponseSchema>
export type SearchDvdCompareResponse = z.infer<typeof schemas.searchDvdCompareResponseSchema>

export type LookupMalRequest          = z.infer<typeof schemas.lookupMalRequestSchema>
export type LookupAnidbRequest        = z.infer<typeof schemas.lookupAnidbRequestSchema>
export type LookupTvdbRequest         = z.infer<typeof schemas.lookupTvdbRequestSchema>
export type LookupMovieDbRequest      = z.infer<typeof schemas.lookupMovieDbRequestSchema>
export type LookupDvdCompareRequest   = z.infer<typeof schemas.lookupDvdCompareRequestSchema>
export type LookupDvdCompareReleaseRequest = z.infer<typeof schemas.lookupDvdCompareReleaseRequestSchema>

export type NameLookupResponse  = z.infer<typeof schemas.nameLookupResponseSchema>
export type LabelLookupResponse = z.infer<typeof schemas.labelLookupResponseSchema>
```

Each `Search*Response` has a `results` array of items. The web's `LookupSearchResult` is intended to be **one item from any of these arrays** — a union.

## Implementation plan

### 1. Server — extract per-provider result-item types

In [packages/server/src/api/types.ts](../../packages/server/src/api/types.ts), add per-provider item types so they can be referenced individually:

```ts
export type SearchMalResult        = SearchMalResponse["results"][number]
export type SearchAnidbResult      = SearchAnidbResponse["results"][number]
export type SearchTvdbResult       = SearchTvdbResponse["results"][number]
export type SearchMovieDbResult    = SearchMovieDbResponse["results"][number]
export type SearchDvdCompareResult = SearchDvdCompareResponse["results"][number]
```

### 2. Server — `LookupSearchResult` discriminated union

```ts
export type LookupSearchResult =
  | SearchMalResult
  | SearchAnidbResult
  | SearchTvdbResult
  | SearchMovieDbResult
  | SearchDvdCompareResult
```

Each branch already has a distinguishing optional ID field (`malId` / `aid` / `tvdbId` / `movieDbId`, plus DVDCompare's id), so the union is structurally discriminable at the call site without adding a tag field.

If the existing per-provider schemas don't already include `nameJapanese`, `name`, `title`, `year` consistently where the picker needs them, **fix the schema** rather than re-declaring on the web. The picker is downstream of the contract — the contract is the source of truth.

### 3. Server — `LookupType` enum

```ts
export const LOOKUP_TYPES = [
  "mal",
  "anidb",
  "tvdb",
  "tmdb",       // matches the existing lookupMovieDbRequestSchema key on the wire
  "dvdcompare",
] as const

export type LookupType = (typeof LOOKUP_TYPES)[number]
```

If any `Lookup*Request` schema currently encodes the provider key as a literal in its `lookupType` field, switch it to `z.enum(LOOKUP_TYPES)` so the wire shape and the TS type share one source.

### 4. Server — `LookupVariant` / `LookupGroup` / `LookupRelease`

These are DVDCompare-specific. Check whether `searchDvdCompareResponseSchema` / `listDvdCompareReleasesResponseSchema` already shape them. If yes, just re-export them under these names. If no, extract them as named schemas first, then export.

### 5. Web — import + delete

[packages/web/src/components/LookupModal/types.ts](../../packages/web/src/components/LookupModal/types.ts) becomes:

```ts
import type {
  LookupGroup,
  LookupRelease,
  LookupSearchResult,
  LookupType,
  LookupVariant,
} from "@mux-magic/server/api-types"  // or wherever Phase 2 ends up

export type { LookupGroup, LookupRelease, LookupSearchResult, LookupType, LookupVariant }

export type LookupStage = "search" | "variant" | "release"

export type LookupState = {
  lookupType: LookupType
  stepId: string
  fieldName: string
  companionNameField: string | null
  stage: LookupStage
  searchTerm: string
  searchError: string | null
  results: LookupSearchResult[] | null
  formatFilter: string
  selectedGroup: LookupGroup | null
  selectedVariant: string | null
  selectedFid: string | null
  releases: LookupRelease[] | null
  releasesDebug: unknown
  releasesError: string | null
  isLoading: boolean
}
```

The `eslint-disable-next-line no-restricted-syntax` and its `-- web-only normalized search result; not in server/api-types ...` comment **must be deleted**. If the lint rule still fires after the migration, the migration is incomplete — do not re-add the disable.

### 6. Web — call-site verification

Search for any web file that constructs a `LookupSearchResult` literal and confirm the literal now satisfies the server union. Likely call sites:
- `NumberWithLookupField.tsx` (search results handler)
- `runReverseLookup.ts` (reverse-lookup mapper)
- `LookupSearchStage.tsx` (display)
- `LookupModal.stories.tsx` / `LookupModal.test.tsx` (fixtures)

If any literal is missing a server-required field, fix the literal — don't widen the server type.

## TDD steps

1. **Failing test:** add a typecheck-only test (`.test.ts` with `expectTypeOf` or a `// @ts-expect-error` line) that asserts `LookupSearchResult` is structurally assignable from a `SearchMalResponse["results"][0]`. With current code (web-declared shape), this fails because the shapes have drifted.
2. **Implement** steps 1-5 above.
3. **Eslint rule fires zero hits** for `LookupModal/types.ts`. `yarn lint:eslint packages/web/src/components/LookupModal/types.ts` returns clean with no `eslint-disable` in the file.
4. **Typecheck passes** without widening: `yarn typecheck` is green at every step.

## Files

- [packages/server/src/api/types.ts](../../packages/server/src/api/types.ts)
- [packages/server/src/api/schemas.ts](../../packages/server/src/api/schemas.ts) (only if a per-provider schema needs new fields to match the union)
- [packages/web/src/components/LookupModal/types.ts](../../packages/web/src/components/LookupModal/types.ts)
- Web call sites: `NumberWithLookupField.tsx`, `runReverseLookup.ts`, `LookupSearchStage.tsx`, plus modal stories/tests as needed

## Verification checklist

- [x] Worktree created
- [x] Manifest row → `in-progress`
- [x] Failing structural-type test first
- [x] Server exports `LookupSearchResult`, `LookupType`, `LookupRelease` *(see [Outcome](#outcome) for `LookupVariant`/`LookupGroup` deviation)*
- [x] Web `LookupModal/types.ts` no longer declares duplicate shapes
- [x] `eslint-disable-next-line no-restricted-syntax` and its trailing comment removed from `LookupModal/types.ts`
- [x] `LookupState` and `LookupStage` remain web-only (state-machine shapes — do NOT move)
- [x] All `LookupSearchResult` literals across the web typecheck against the new union without `as` casts
- [x] Webtypes ESLint guard reports zero violations on the changed files
- [x] Standard pre-merge gate clean (`yarn lint → typecheck → test → e2e → lint`)
- [x] PR opened against `feat/mux-magic-revamp` (#104)
- [x] Manifest row → `done`

## Out of scope

- Changing the actual wire contract (HTTP response bodies) for any lookup endpoint. The migration is structural-types-only; runtime payloads must remain byte-identical so existing YAML sequences keep loading. If a schema needs a new optional field to match the union, add it as optional — never required.
- Touching `LookupState` / `LookupStage` shapes.
- Rewriting the picker UI. The user-facing behavior of `NumberWithLookupField` and `LookupModal` should be unchanged after this worker.
- Adding new lookup providers. The current five (mal/anidb/tvdb/tmdb/dvdcompare) stay the set.

## Why this worker exists

Worker 06 installed the webtypes ESLint guard to catch *exactly* this drift class: web declaring shapes the server is responsible for. The recent lookup overhaul (commit `863d4a87`) added `nameJapanese` to both server schemas (`searchAnidbResultSchema`) and the web's `LookupSearchResult`, in two places, by hand — that's the canonical "drift waiting to happen" pattern the guard prevents. This worker cleans up the one place we knowingly bypassed the guard, eliminating the audit-trail comment and the disable.

## Outcome

Shipped in PR #104 (`9f5339cc feat(worker-32): LookupModal types canonical from @mux-magic/server`) merged into `feat/mux-magic-revamp`.

**Final state matches the original plan with one deliberate scope adjustment:**

- ✅ `LookupSearchResult`, `LookupType`, `LookupRelease` promoted to canonical server exports in [packages/server/src/api/types.ts](../../packages/server/src/api/types.ts).
- ✅ [packages/web/src/components/LookupModal/types.ts](../../packages/web/src/components/LookupModal/types.ts) re-exports those three from `@mux-magic/server/api-types`; the `eslint-disable-next-line no-restricted-syntax` is gone.
- ✅ `LookupState` and `LookupStage` stayed web-only as planned.

**Deviation — `LookupVariant` and `LookupGroup` stayed web-only.** The original prompt grouped these with the canonical data shapes, but during implementation they were correctly identified as a **web-side projection**: `groupDvdCompareResults()` in `LookupSearchStage` synthesizes them by collapsing flat `SearchDvdCompareResult[]` into `baseTitle + year` groups. The server never emits this shape, so moving them would have invented a contract the server doesn't have. The file header on [LookupModal/types.ts:27-29](../../packages/web/src/components/LookupModal/types.ts#L27-L29) documents the rule: "Web-only synthesis: … The server never emits this shape — it stays here." This is the right call — the line between *wire shapes* (server-owned) and *derived view shapes* (web-owned) is what worker 06's guard is ultimately about, and worker 32 ended up making that line sharper than the prompt did.
