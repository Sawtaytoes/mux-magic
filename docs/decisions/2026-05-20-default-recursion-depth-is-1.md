# 2026-05-20 — Default recursion depth is 1 (not v1.0.0's 2)

- **Status:** Accepted
- **Date decided:** 2026-05-20 (schema wording finalized in `212661fe`; convention present from `614aa343` / `998649e3`)
- **Area:** core / server/api
- **Source:** schema descriptions in `packages/api/src/api/schemas.ts`; recovered during the 2026-06-30 behavioral-parity sweep

## Decision

Every command that takes `isRecursive` + `recursiveDepth` defaults to a recursion depth of **1**. The schema default is `recursiveDepth: 0`, and `0` means "use the default depth of 1" — encoded in handlers as `recursiveDepth || 1` and documented identically across the schemas ("0 = default depth of 1; mirrors deleteFilesByExtension"). So a recursive operation with no explicit depth descends **one** level; callers who want deeper pass an explicit `recursiveDepth` (e.g. `3`).

Commands following this: `deleteFilesByExtension` (the reference), `convertLosslessToFlac`, `modifySubtitleMetadata`, `getSubtitleMetadata`, and any future recursive command.

## What we rejected — DO NOT revert to this

v1.0.0 defaulted to depth **2** (`recursiveDepth || 2`; its schema said "default depth of 2"). Do **not** "restore" depth 2 after seeing the `2 → 1` change in a diff against `server-v1.0.0`. The change is deliberate and self-consistent: the handler code and the schema description were updated together, across every recursive command. It is not drift.

## Why it must not be re-litigated

A future agent diffing against v1.0.0 will see `|| 2` → `|| 1` with no decision record and read it as a regression — **one audit already did exactly that** (it flagged `deleteFilesByExtension` before the schema docs were checked). Reverting silently changes how many nested levels *every* recursive command touches. The default is 1 by design; if one specific command genuinely needs a deeper default, that's a per-command decision made explicitly, never a blanket revert. Code matches its own schema docs everywhere — trust the schema, not the v1 diff.
