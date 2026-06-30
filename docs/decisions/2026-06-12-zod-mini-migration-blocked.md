# 2026-06-12 — zod/mini migration is BLOCKED — do not retry

- **Status:** Accepted (records a BLOCKED outcome)
- **Date decided:** 2026-06-12
- **Area:** server/api
- **Source:** worker 76, commit `a2a43e71` (Phase-0 spike, RED)

## Decision

The `packages/core` + `packages/api` import sites stay on **chained zod** (`from "zod"`). The proposed migration to the tree-shakeable `zod/mini` sub-entrypoint is **blocked** and parked, not in progress.

## What we rejected — DO NOT revert to this

Do not migrate route/schema files to `zod/mini`. The Phase-0 spike proved it RED: `@asteasolutions/zod-to-openapi@8.5.0` (under `@hono/zod-openapi`) calls `zodSchema.meta()` on every schema during OpenAPI doc generation, and `zod/mini` schemas have no `.meta()` method → `TypeError: zodSchema.meta is not a function`. There is no in-scope common ancestor to patch.

## Why it must not be re-litigated

The bundle-size / tree-shaking win is real and tempting, so an agent will be drawn to re-attempt it. It is unblocked **only** when `zod-to-openapi` gains `zod/mini` support OR the route layer is replaced. Until then, re-attempting just rediscovers the same `TypeError`.
