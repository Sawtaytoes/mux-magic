# Worker 29 — openapi-codegen-optional

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/29-openapi-codegen-optional`
**Worktree:** `.claude/worktrees/29_openapi-codegen-optional/`
**Phase:** 4 (server infrastructure)
**Depends on:** 01 (rebrand — only needs package names to be settled)
**Parallel with:** 41 (structured-logging), 2a (server-template-storage), 2c (pure-functions-sweep), 2d (asset-fallback-to-cli), 38, 3b, 3c, 3e, 40. Independent of Phase 3 NSF work — no shared files.

> **Why this worker exists:** the server already publishes an OpenAPI 3.1 document at `/openapi.json` via `@hono/zod-openapi` (see [openApiDocConfig.ts](../../packages/server/src/api/openApiDocConfig.ts) and [docRoutes.ts](../../packages/server/src/api/routes/docRoutes.ts)). The web app and CLI (after worker 20) currently re-derive request/response types by hand: each new route requires duplicate type definitions client-side. That duplication is the source of drift — a server-side `z.string().optional()` becomes `string | undefined` in one client file and `string` in another. This worker adds an **opt-in codegen step** that turns the live `/openapi.json` into TypeScript types under `packages/tools/src/api.generated/`, which both the web app and the CLI then import. The "optional" in the name means: it's a one-shot `yarn codegen:api` command, not a build hook. If you change a route and forget to re-run codegen, CI fails with a clear "drift detected" message.

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Tests must cover the change scope. Yarn only. Manifest row update lands as its own `chore(manifest):` commit. See [AGENTS.md](../../AGENTS.md).

## Your Mission

1. Add a `yarn codegen:api` script that:
   - Boots the server in a separate process on a random port.
   - Fetches `/openapi.json`.
   - Runs `openapi-typescript` against it (the same lib already used for external schemas in [generateExternalApiSchemas.ts](../../packages/server/src/generateExternalApiSchemas.ts)).
   - Writes the output to `packages/tools/src/api.generated/internalApi.ts`.
   - Shuts the server down cleanly.
2. Add a CI check `yarn codegen:api:check` that runs codegen against a temp file and diffs it against the committed file. Non-empty diff → exit 1 with a message pointing at `yarn codegen:api`.
3. Export typed helpers from `@mux-magic/tools` so consumers get full request/response types:
   ```ts
   import type { paths } from "@mux-magic/tools/api.generated/internalApi"
   type GetJobResponse = paths["/api/jobs/{id}"]["get"]["responses"]["200"]["content"]["application/json"]
   ```
   Optionally also ship an `openapi-fetch`-style typed client wrapper if it doesn't blow up bundle size on the web side.
4. Update the web app's existing job/sequence fetch call sites (just **one or two** as a proof of concept — full migration is a follow-up worker) to import from the generated types instead of their hand-rolled mirrors. This proves the loop closes.

### Why opt-in instead of automatic

A pre-build codegen step turns every `yarn install` and every CI job into a "boot the server first" dance. That's slow, flaky, and adds a new failure mode where codegen breaks because of an unrelated route bug. The opt-in form makes the developer rerun codegen deliberately when they change a route, and CI catches the case where they forgot. If the team later decides automatic is worth the friction, the script is already there to wire in.

### The boot-the-server step

Spawn `yarn workspace @mux-magic/server start` with `PORT=$(get-random-port)`. Wait for a `GET /api/health` 200 (add this route if it doesn't exist — it's trivial). Hit `/openapi.json`. Kill the child. Use the same port/PID convention every worker uses (see AGENTS.md).

If a "boot the server" step feels too heavy: alternative is to export the OpenAPI document as a static artifact by calling `honoRoutes.getOpenAPIDocument(openApiDocs)` directly from a Node script that imports the routes — no HTTP round-trip. Try this path first; fall back to the spawn approach only if it doesn't work cleanly (e.g., import-time side effects make it impractical).

### CI integration

Add a new CI job (or extend the existing lint job) that runs `yarn codegen:api:check`. Document the failure message:

```
OpenAPI codegen drift detected.
The committed packages/tools/src/api.generated/internalApi.ts is out of date.
Run `yarn codegen:api` and commit the result.
```

### What NOT to do

- Do not regenerate types from individual route files — go through `/openapi.json` so the schema-of-record is the same one external consumers see.
- Do not add the codegen step to the default `yarn build` or `yarn dev`. Opt-in is the point.
- Do not generate a runtime client SDK with heavyweight dependencies (axios, etc.). Types-only, or a thin `openapi-fetch`-style wrapper over native `fetch`.
- Do not touch external API schemas — the existing [generateExternalApiSchemas.ts](../../packages/server/src/generateExternalApiSchemas.ts) script handles tvdb. This worker is internal-API-only.
- Do not migrate every web-side call site in this PR; one or two is enough to prove the loop. The rest is a follow-up worker.

## Tests (per test-coverage discipline)

- **Unit:** the codegen helper that converts an OpenAPI document into a TypeScript file produces stable output (run it twice, expect identical output).
- **Unit:** the drift checker returns exit 0 when the committed file matches the freshly generated output and exit 1 with a clear stderr message when it doesn't.
- **Integration:** `yarn codegen:api` against a running server produces a non-empty `internalApi.ts` containing at least one known operation (e.g., `/api/jobs/{id}` GET).
- **Integration:** one migrated call site in the web app type-checks against the generated types (the type-check itself is the assertion).
- **CI:** the new `codegen:api:check` job runs in a fresh checkout and passes.

## TDD steps

1. Failing test: drift-checker on a known-stale fixture exits 1. Commit `test(codegen): failing tests for drift checker`.
2. Implement the OpenAPI-document → TS-file helper. Get unit tests green.
3. Add the `yarn codegen:api` script that boots the server (or imports the routes directly) and writes the file.
4. Generate the file once; commit it.
5. Add `yarn codegen:api:check` and wire it into CI.
6. Migrate one or two web call sites to import from the generated file.
7. Final lint + manifest row → `done`.

## Files

- [packages/tools/src/api.generated/internalApi.ts](../../packages/tools/src/api.generated/internalApi.ts) — new; generated output (committed)
- [packages/tools/src/api.generated/README.md](../../packages/tools/src/api.generated/README.md) — new; one-paragraph note saying "DO NOT EDIT — generated by `yarn codegen:api`"
- `scripts/generate-internal-api.ts` (or similar) — new; the codegen entry point
- `scripts/check-internal-api-drift.ts` — new; the CI gate
- [package.json](../../package.json) — add `codegen:api` and `codegen:api:check` scripts
- [.github/workflows/](../../.github/workflows/) — extend or add the workflow that runs the drift check
- [packages/server/src/api/routes/](../../packages/server/src/api/routes/) — add `/api/health` if not present (trivial; only needed if boot-the-server path is chosen)
- [packages/web/src/](../../packages/web/src/) — one or two migrated call sites (PoC)
- Tests for all of the above

## Verification checklist

- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Failing tests committed first
- [ ] `yarn codegen:api` writes a stable file (running it twice yields identical output)
- [ ] `yarn codegen:api:check` fails with a clear message when out of date and passes when current
- [ ] CI runs the drift check; the committed generated file is current
- [ ] At least one web call site imports from the generated types (PoC); other sites left for a follow-up worker
- [ ] No new heavy runtime dependencies in the web bundle (check bundle size before/after)
- [ ] Standard gate clean
- [ ] PR opened
- [ ] Manifest row → `done` in a separate commit
