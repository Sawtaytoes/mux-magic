# Worker 76 — zod-mini-migration

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium-High
**Branch:** `feat/mux-magic-revamp/76-zod-mini-migration`
**Worktree:** `.claude/worktrees/76_zod-mini-migration/`
**Phase:** 4
**Depends on:** —
**Parallel with:** any worker that is **not** editing files inside `packages/api/src/api/` or `packages/core/src/`. Schema files are the contended surface — coordinate with workers touching route definitions or `schemas.ts`.

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. Yarn only. See [AGENTS.md](../../AGENTS.md).

---

## Your Mission

Migrate the codebase's zod usage from the default `zod` package entrypoint to the tree-shakeable `zod/mini` entrypoint. The motivation is bundle size + tree-shakeability: `zod/mini` ships the same schema engine with a functional (non-chained) API that pulls in only the validators a file actually uses. The chained `zod` surface drags every method onto every schema prototype, which defeats tree-shaking for SSR / CLI / Storybook bundles.

Both entrypoints ship from the **same `zod@^4` package** (already installed at `^4.4.3` in both [packages/api/package.json:47](../../packages/api/package.json#L47) and [packages/core/package.json:27](../../packages/core/package.json#L27)). No dependency version bump is required for a baseline migration — only import-site changes. **Do not** add a new `zod` dependency or downgrade.

### The `@hono/zod-openapi` interop question to settle first

[packages/api](../../packages/api) consumes `@hono/zod-openapi@^1.4.0`, which exports its own `z` re-export and a `createRoute` helper. That library attaches a `.openapi(name, options?)` method to chained-zod's schema prototype (used both for naming components and for stamping per-field OpenAPI metadata).

**zod and zod/mini are interoperable at the runtime level** — both export from the same `zod@^4` package, both implement the same `$ZodType` base classes from `zod/v4/core`, and **both share the same metadata registries**: `.describe()`, `.meta({ description, example, … })`, and `.register(z.globalRegistry, …)` all work on zod-mini schemas and store into the same global registry that chained zod reads. Confirmed against the official [Zod Mini docs](https://zod.dev/packages/mini) and [library-authors guide](https://zod.dev/library-authors). So `parse()` / `safeParse()` / `z.infer<>` interop is not in question.

The single open question for the spike is: **does `@hono/zod-openapi` v1.x source its OpenAPI metadata from `z.globalRegistry` / `.meta()` (registry-driven, works with mini schemas as-is), or only from the prototype-attached `.openapi()` method (chain-only, mini schemas miss that surface)?** Neither the README nor the npm page documents this; both paths are plausible for a zod v4 era library.

**Phase 0 of this worker is a spike**, not a refactor. Before touching any route file, the worker session must:

1. Write a one-file proof-of-concept at `packages/api/src/api/routes/_zod-mini-spike.ts` (delete before final PR) that imports `createRoute` from `@hono/zod-openapi` and registers a route whose request/response schemas are built with `zod/mini`'s functional API (`z.object`, `z.optional`, `z.string()` + `.check(z.minLength(…))`, `.meta({ description: "…", example: "…" })` in place of `.describe(…)` / `.openapi({…})`).
2. Boot the API and hit `/docs` (or `/openapi.json`) — confirm the schema name, descriptions, examples, and required-field shape come through identically to what chained zod would emit.
3. Document the result in the PR description as one of:
   - **Green:** mini schemas + `.meta()` round-trip through `@hono/zod-openapi`'s OpenAPI emission identically → proceed with the full migration below.
   - **Yellow:** mini schemas validate at runtime but lose OpenAPI metadata (descriptions, component names) → either land the mini migration with a small `mAnnotate(schema, { description, example })` helper that writes to both `z.globalRegistry` and whichever registry `@hono/zod-openapi` reads, or scope this worker down to `packages/core/` + non-route helpers in `packages/api/` only. Decide based on how invasive the workaround is in practice.
   - **Red:** mini schemas break the API's OpenAPI emission with no reasonable workaround (very unlikely given the shared registry) → close as `blocked`, document the failure mode here, and revisit when a fix lands upstream.

The "way to go from zod/mini to zod" the user mentioned is almost certainly this shared-registry path, not a literal schema-cast. The spike confirms which.

### Migration shape (assuming Green or Yellow spike result)

`zod/mini` keeps the same `z.object` / `z.string` / `z.number` / `z.array` / `z.union` / `z.literal` / `z.enum` / `z.record` / `z.tuple` / `z.discriminatedUnion` / `z.unknown` / `z.any` constructors. The differences land on three surfaces:

1. **Modifiers become wrapping functions, not chains.**

    | Chained (`zod`) | Functional (`zod/mini`) |
    | --- | --- |
    | `z.string().optional()` | `z.optional(z.string())` |
    | `z.string().nullable()` | `z.nullable(z.string())` |
    | `z.string().default("x")` | `z.optional(z.string()).check(/*…*/)` *or* leave the default at the consumer — verify per-call site, zod-mini's default story is leaner than chained zod's |
    | `z.string().readonly()` | `z.readonly(z.string())` |
    | `z.string().describe("doc")` | `z.string().register(z.globalRegistry, { description: "doc" })` *or* leave as-is if `@hono/zod-openapi` accepts `.describe()` on mini schemas — verify in spike |

2. **Validators become `.check()` calls with named checkers.**

    | Chained | Functional |
    | --- | --- |
    | `z.string().min(3)` | `z.string().check(z.minLength(3))` |
    | `z.string().max(255)` | `z.string().check(z.maxLength(255))` |
    | `z.string().email()` | `z.email()` *(top-level constructor in zod-mini)* |
    | `z.string().url()` | `z.url()` |
    | `z.string().uuid()` | `z.uuid()` |
    | `z.string().regex(/…/)` | `z.string().check(z.regex(/…/))` |
    | `z.number().int().positive()` | `z.number().check(z.int(), z.positive())` |
    | `z.number().min(0).max(10)` | `z.number().check(z.gte(0), z.lte(10))` |
    | `z.array(x).min(1)` | `z.array(x).check(z.minLength(1))` |

3. **Object methods become function calls.**

    | Chained | Functional |
    | --- | --- |
    | `Schema.extend({ … })` | `z.extend(Schema, { … })` |
    | `Schema.merge(Other)` | `z.extend(Schema, Other.shape)` *(if `.shape` is exposed)* — verify in spike |
    | `Schema.pick({ a: true })` | `z.pick(Schema, { a: true })` |
    | `Schema.omit({ a: true })` | `z.omit(Schema, { a: true })` |
    | `Schema.partial()` | `z.partial(Schema)` |
    | `Schema.required()` | `z.required(Schema)` |

`.parse()`, `.safeParse()`, `.parseAsync()`, and `z.infer<typeof Schema>` are preserved in `zod/mini` — those are the touch points that consumer code outside route definitions actually uses, so call sites that *only* call `.parse()` (e.g. validation in [packages/core/src/tools/buildDefaultSubtitleModificationRules.ts](../../packages/core/src/tools/buildDefaultSubtitleModificationRules.ts) which uses `import type { z } from "zod"` for `z.infer`) require **only** the import-statement swap.

### Direct `from "zod"` import sites (8 today)

```text
packages/api/src/api/resolveSequenceParams.test.ts
packages/api/src/api/routes/errorRoutes.ts
packages/api/src/api/routes/featuresRoutes.ts
packages/api/src/api/routes/jobRoutes.ts
packages/api/src/api/routes/systemRoutes.ts
packages/api/src/api/routes/templateRoutes.ts
packages/api/src/api/routes/versionRoutes.ts
packages/core/src/tools/buildDefaultSubtitleModificationRules.ts
```

Six of these eight are route files that depend on the `@hono/zod-openapi` spike outcome. The two outside that risk surface are:

- [packages/core/src/tools/buildDefaultSubtitleModificationRules.ts](../../packages/core/src/tools/buildDefaultSubtitleModificationRules.ts) — uses only `import type { z } from "zod"` for `z.infer`. Free to migrate first as the smallest test of the new entrypoint.
- [packages/api/src/api/resolveSequenceParams.test.ts](../../packages/api/src/api/resolveSequenceParams.test.ts) — uses only `z.unknown()` as a stub. Trivial swap.

There are also **27 files in `packages/api/src/`** that exercise zod via re-exports of `schemas.ts` (619 chained-method invocations total per a grep sweep). The migration touches each of those call sites whenever the chained method shape changes — that's the bulk of the diff once the route files are converted.

## TDD steps

1. **Spike first** (see "The hard compatibility risk" above). Spike file goes in `packages/api/src/api/routes/_zod-mini-spike.ts`, runs via `yarn tsx packages/api/src/api/routes/_zod-mini-spike.ts`, and is deleted before opening the PR. Capture the result in the PR description.
2. **Pick the smallest possible green path** based on spike outcome:
   - **Green:** sweep `packages/core/` first (1 file), confirm tests stay green, then `packages/api/`'s non-route files (`schemas.ts`, `resolveSequenceParams.ts`, `sequenceRunner.ts`, etc.), then route files in the order errorRoutes → systemRoutes → featuresRoutes → versionRoutes → templateRoutes → jobRoutes (lightest-to-heaviest by chained-method count). Re-run `yarn typecheck` after each file batch.
   - **Yellow:** sweep `packages/core/` + `packages/api/src/api/*.ts` (non-route helpers) only. Route files stay on chained `zod` import. Add a one-line ESLint rule comment in the affected route files explaining why they import from `zod` not `zod/mini` so a future sweep doesn't "fix" them.
   - **Red:** flip MANIFEST status to `blocked` with a one-line note pointing to the spike's failure mode. Do not commit the spike file — only the MANIFEST row update + this `.md` file's "Outcome" addendum.
3. **Verify after each file batch.**
   - `yarn workspace @mux-magic/core typecheck && yarn workspace @mux-magic/core test`
   - `yarn workspace @mux-magic/api typecheck && yarn workspace @mux-magic/api test`
   - If the API package's `generate:external-api-schemas` or `generate:internal-api-schemas` scripts produce committed artifacts (check [packages/api/package.json:20-22](../../packages/api/package.json#L20-L22)), rerun them and inspect the diff — any change to emitted OpenAPI schema descriptions, types, or required-field shapes counts as a regression and must be reconciled, not committed.
4. **e2e gate.** The OpenAPI emission backs `/docs` and is consumed by Scalar (`@scalar/hono-api-reference`) + `openapi-fetch` clients. After the route-file batch, smoke-test `/docs` in a real browser and confirm: schemas render, descriptions are present, request/response examples still appear.
5. **Bundle-size sanity check** (the whole point of the migration). Before/after `yarn workspace @mux-magic/api build` (or whichever build emits the server bundle) — compare bundle size and report the delta in the PR description. If the delta is < 5%, the migration's risk/reward ratio is poor; pause and ask the user before continuing.
6. **Commit cadence.** One commit per package (`refactor(core): migrate to zod/mini`, `refactor(api): migrate non-route schemas to zod/mini`, `refactor(api): migrate route schemas to zod/mini`). Don't combine packages into a single mega-commit — review burden is too high.
7. **Manifest flips** in dedicated `chore(manifest):` commits at start (`in-progress`) and after merge (`done`).

## Files

- [packages/core/src/tools/buildDefaultSubtitleModificationRules.ts](../../packages/core/src/tools/buildDefaultSubtitleModificationRules.ts) — smallest first migration
- [packages/api/src/api/schemas.ts](../../packages/api/src/api/schemas.ts) — 504 chained-method invocations, the centerpiece of the API package's migration
- [packages/api/src/api/resolveSequenceParams.ts](../../packages/api/src/api/resolveSequenceParams.ts)
- [packages/api/src/api/sequenceRunner.ts](../../packages/api/src/api/sequenceRunner.ts)
- [packages/api/src/api/routes/errorRoutes.ts](../../packages/api/src/api/routes/errorRoutes.ts)
- [packages/api/src/api/routes/featuresRoutes.ts](../../packages/api/src/api/routes/featuresRoutes.ts)
- [packages/api/src/api/routes/jobRoutes.ts](../../packages/api/src/api/routes/jobRoutes.ts)
- [packages/api/src/api/routes/systemRoutes.ts](../../packages/api/src/api/routes/systemRoutes.ts)
- [packages/api/src/api/routes/templateRoutes.ts](../../packages/api/src/api/routes/templateRoutes.ts)
- [packages/api/src/api/routes/versionRoutes.ts](../../packages/api/src/api/routes/versionRoutes.ts)
- [packages/api/src/api/routes/sequenceRoutes.ts](../../packages/api/src/api/routes/sequenceRoutes.ts)
- [packages/api/src/api/routes/inputRoutes.ts](../../packages/api/src/api/routes/inputRoutes.ts)
- [packages/api/src/api/routes/commandRoutes.ts](../../packages/api/src/api/routes/commandRoutes.ts)
- [packages/api/src/api/routes/transcodeRoutes.ts](../../packages/api/src/api/routes/transcodeRoutes.ts)
- [packages/api/src/api/routes/logRoutes.ts](../../packages/api/src/api/routes/logRoutes.ts)
- Plus the remaining `schemas.ts`-consuming files in `packages/api/src/api/` and `packages/api/src/fake-data/scenarios/**` (~13 more files; grep for `import .* from "zod"` and re-export chains)

## Out of scope

- **Web package** ([packages/web](../../packages/web)). The web side uses zod only via shared types from `@mux-magic/api/api-schemas` — the surface is consumer-only and migrates automatically when api migrates. No new edits required in `packages/web/`.
- **CLI package** ([packages/cli](../../packages/cli)). Same reasoning — consumes `@mux-magic/core` types only.
- **Bumping zod** to a newer major. Migration is entrypoint-only on the existing `^4.4.3`.
- **Replacing `@hono/zod-openapi`** with a different OpenAPI generator. If the spike returns Red, that's a separate worker's problem.
- **Removing the chained `zod` dep entirely.** `zod/mini` is a sub-entrypoint of the same package — the dep stays. (If the spike returns Yellow and route files keep chained zod, the dep is *required* to stay.)
- **Refactoring `schemas.ts` for organization or correctness.** This is a syntactic migration. Behavior must round-trip identically. The OpenAPI emission must be byte-identical (modulo the `description` storage mechanism, which the spike must confirm round-trips).
- **Tests for the migration itself.** There's no behavior to test — typecheck + existing tests + `/docs` smoke check are the verification.

## Verification checklist

- [ ] Worktree created; MANIFEST row → `in-progress` in its own `chore(manifest):` commit
- [ ] Spike file [packages/api/src/api/routes/_zod-mini-spike.ts](../../packages/api/src/api/routes/_zod-mini-spike.ts) authored, executed, and **deleted** before final PR
- [ ] Spike outcome (Green / Yellow / Red) documented in PR description with reproduction notes
- [ ] If Green: all 8 direct-import sites migrated to `zod/mini`
- [ ] If Yellow: all non-route files migrated; route files retain chained `zod` import with a one-line rationale comment
- [ ] If Red: MANIFEST flipped to `blocked`; this worker file gets an "Outcome" section documenting the failure mode; no other code changes
- [ ] `yarn lint && yarn typecheck && yarn test && yarn e2e && yarn lint` clean from repo root
- [ ] `/docs` smoke-tested in a real browser — schemas + descriptions + examples still render (Green / Yellow paths)
- [ ] Bundle-size delta measured + reported in PR description
- [ ] PR opened against `feat/mux-magic-revamp`
- [ ] [docs/workers/MANIFEST.md](MANIFEST.md) row updated to `done` (or `blocked` per outcome) in a dedicated `chore(manifest):` commit
